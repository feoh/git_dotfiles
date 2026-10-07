import { isAbsolute, normalize, resolve } from "node:path";

const SOPS_FILENAME_PATTERN = /\.sops\.(?:ya?ml|json|env|ini)$/i;
const SECRET_YAML_PATH_PATTERN = /(^|\/)src\/bridge\/secrets\/.*\.ya?ml$/i;
const PATH_LIKE_PATTERN = /(?:[\\/]|\.(?:ya?ml|json|env|ini)$)/i;

export type SopsValueFormat = "string" | "json";

export function resolveUserPath(path: string, cwd: string): string {
	let candidate = path.trim().replace(/^@/, "");
	if (candidate === "~") candidate = process.env.HOME ?? candidate;
	if (candidate.startsWith("~/") && process.env.HOME) {
		candidate = resolve(process.env.HOME, candidate.slice(2));
	}
	if (candidate.startsWith("$PWD/"))
		candidate = resolve(cwd, candidate.slice(5));
	return normalize(isAbsolute(candidate) ? candidate : resolve(cwd, candidate));
}

export function isKnownSopsPath(path: string, cwd: string): boolean {
	const normalized = resolveUserPath(path, cwd).replace(/\\/g, "/");
	return (
		SOPS_FILENAME_PATTERN.test(normalized) ||
		SECRET_YAML_PATH_PATTERN.test(normalized)
	);
}

export function hasSopsMetadata(content: string): boolean {
	return (
		/(?:^|\n)sops:\s*(?:\n|$)/m.test(content) ||
		/"sops"\s*:\s*\{/m.test(content) ||
		/(?:^|\n)\[sops\]\s*(?:\n|$)/m.test(content) ||
		/(?:^|\n)sops_(?:version|mac|lastmodified)=/m.test(content)
	);
}

export function shellWords(command: string): string[] {
	const words: string[] = [];
	const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^\s]+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command)) !== null) {
		words.push(match[1] ?? match[2] ?? match[3] ?? "");
	}
	return words;
}

function pathFromToken(token: string): string | undefined {
	let candidate = token.replace(/^[;&|()<>]+|[;&|()<>]+$/g, "");
	if (candidate.startsWith("--") && candidate.includes("=")) {
		candidate = candidate.slice(candidate.indexOf("=") + 1);
	}
	candidate = candidate.replace(/^[<>]+/, "");
	if (!candidate || candidate.startsWith("-") || candidate.includes("://"))
		return undefined;
	if (candidate.includes("$") && !candidate.startsWith("$PWD/"))
		return undefined;
	return PATH_LIKE_PATTERN.test(candidate) ? candidate : undefined;
}

export function commandCandidatePaths(command: string, cwd: string): string[] {
	const words = shellWords(command);
	const paths = new Set<string>();
	let effectiveCwd = resolve(cwd);

	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		if (word === "cd") {
			let next = words[index + 1];
			if (next === "--") next = words[index + 2];
			if (next) {
				const cdPath = next.replace(/^[;&|()]+|[;&|()]+$/g, "");
				if (cdPath && !cdPath.includes("$"))
					effectiveCwd = resolveUserPath(cdPath, effectiveCwd);
			}
			continue;
		}

		const candidate = pathFromToken(word);
		if (candidate) paths.add(resolveUserPath(candidate, effectiveCwd));
	}

	return [...paths];
}

function normalizeSopsExecutableWords(command: string): string[] {
	return shellWords(command).map((word) => {
		const cleaned = word.replace(/^[;&|()]+|[;&|()]+$/g, "");
		return /(^|\/)sops$/.test(cleaned) ? "sops" : cleaned;
	});
}

export function commandUsesSops(command: string): boolean {
	return normalizeSopsExecutableWords(command).includes("sops");
}

export function commandPassesSopsValueInArguments(command: string): boolean {
	const words = normalizeSopsExecutableWords(command);
	const sopsIndex = words.indexOf("sops");
	if (sopsIndex < 0 || words[sopsIndex + 1] !== "set") return false;
	const operationWords = words.slice(sopsIndex + 2);
	return (
		!operationWords.includes("--value-stdin") &&
		!operationWords.includes("--value-file")
	);
}

export function commandChangesSopsMetadata(command: string): boolean {
	const normalized = normalizeSopsExecutableWords(command).join(" ");
	return (
		/\bsops\s+(?:updatekeys|rotate|groups)\b/.test(normalized) ||
		/\bsops\b[^\n]*(?:--(?:add|rm)-(?:kms|pgp|gcp-kms|hckms|azure-kv|hc-vault-transit)|--(?:kms|pgp|age|gcp-kms|hckms|azure-kv|hc-vault-transit)\b)/.test(
			normalized,
		) ||
		/\bsops\s+(?:encrypt|--encrypt|-e)\b[^\n]*(?:--in-place|-i)\b/.test(
			normalized,
		)
	);
}

export function commandMayMutateFiles(command: string): boolean {
	return (
		/(?:^|[;&|]\s*)(?:sudo\s+)?(?:sed|perl|yq)\b[^\n]*(?:\s-i\b|--in-place\b)/.test(
			command,
		) ||
		/(?:^|[;&|]\s*)(?:sudo\s+)?(?:tee|cp|mv|rm|truncate|touch|install|dd|python\d*|ruby|node)\b/.test(
			command,
		) ||
		/(?:^|[^<])>{1,2}(?!>)/.test(command)
	);
}

export function commandFormatsSopsSecret(
	command: string,
	hasSopsPath: boolean,
	inInfraRepo: boolean,
): boolean {
	if (/(?:^|\s)SKIP=(?:[^\s,]+,)*yamlfmt(?:,|\s|$)/.test(command)) return false;
	if (hasSopsPath && /\byamlfmt\b/.test(command)) return true;
	return /\bpre-commit\s+run\b/.test(command) && (hasSopsPath || inInfraRepo);
}

export function isSafeSopsPathExpression(expression: string): boolean {
	if (
		expression.length === 0 ||
		expression.length > 1024 ||
		/[\r\n\0]/.test(expression)
	)
		return false;
	const segment = String.raw`\[(?:\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]`;
	return new RegExp(`^(?:${segment})+$`).test(expression);
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

type YamlLine = { indent: number; text: string };

const YAML_KEY_PATTERN = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/;

function isYamlSequenceItem(line: YamlLine): boolean {
	return line.text === "-" || line.text.startsWith("- ");
}

function parseYamlScalar(raw: string): string {
	if (raw.startsWith('"')) {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "string") throw new Error("unsupported scalar");
		return parsed;
	}
	if (raw.startsWith("'")) {
		if (raw.length < 2 || !raw.endsWith("'"))
			throw new Error("unterminated scalar");
		return raw.slice(1, -1).replace(/''/g, "'");
	}
	if (/^[[{&*!|>%@`#]/.test(raw) || /\s#/.test(raw))
		throw new Error("unsupported scalar");
	return raw;
}

// Parses the small block-style YAML subset that SOPS emits for its metadata
// (mappings, sequences, plain/quoted scalars and block scalars) so that the
// fingerprint ignores formatting such as sequence indentation. Anything outside
// that subset throws, and callers fall back to a raw-text fingerprint.
function parseSopsYamlBlock(block: string): unknown {
	const lines: YamlLine[] = block
		.split(/\r?\n/)
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const text = line.trimStart();
			if (/^\s*\t/.test(line)) throw new Error("tab indentation");
			return { indent: line.length - text.length, text: text.trimEnd() };
		});
	let index = 0;

	const parseNode = (): unknown =>
		isYamlSequenceItem(lines[index])
			? parseSequence(lines[index].indent)
			: parseMapping(lines[index].indent);

	const parseChild = (parentIndent: number): unknown => {
		const next = lines[index];
		if (
			next &&
			(next.indent > parentIndent ||
				(next.indent === parentIndent && isYamlSequenceItem(next)))
		)
			return parseNode();
		return null;
	};

	const parseMapping = (indent: number): Record<string, unknown> => {
		const result: Record<string, unknown> = {};
		while (index < lines.length) {
			const line = lines[index];
			if (line.indent < indent) break;
			if (line.indent > indent) throw new Error("unexpected indentation");
			// An offset-0 sequence item at this indent belongs to the parent.
			if (isYamlSequenceItem(line)) break;
			const match = YAML_KEY_PATTERN.exec(line.text);
			if (!match) throw new Error("unsupported mapping entry");
			const [, key, rest = ""] = match;
			if (Object.hasOwn(result, key)) throw new Error("duplicate key");
			index += 1;
			if (rest === "") {
				result[key] = parseChild(indent);
			} else if (/^[|>][-+]?$/.test(rest)) {
				const content: string[] = [];
				while (index < lines.length && lines[index].indent > indent) {
					content.push(lines[index].text);
					index += 1;
				}
				result[key] = content.join("\n");
			} else {
				result[key] = parseYamlScalar(rest);
			}
		}
		return result;
	};

	const parseSequence = (indent: number): unknown[] => {
		const result: unknown[] = [];
		while (index < lines.length) {
			const line = lines[index];
			if (line.indent > indent) throw new Error("unexpected indentation");
			if (line.indent < indent || !isYamlSequenceItem(line)) break;
			const rest = line.text.slice(1).trimStart();
			if (rest === "") {
				index += 1;
				result.push(parseChild(indent));
			} else if (YAML_KEY_PATTERN.test(rest)) {
				const column = indent + line.text.length - rest.length;
				lines[index] = { indent: column, text: rest };
				result.push(parseMapping(column));
			} else {
				index += 1;
				result.push(parseYamlScalar(rest));
			}
		}
		return result;
	};

	const parsed = parseMapping(0);
	if (index !== lines.length) throw new Error("trailing content");
	return parsed;
}

export function stableSopsMetadata(content: string): string | undefined {
	try {
		const parsed = JSON.parse(content) as { sops?: Record<string, unknown> };
		if (parsed.sops && typeof parsed.sops === "object") {
			const {
				mac: _mac,
				lastmodified: _lastmodified,
				...metadata
			} = structuredClone(parsed.sops);
			return stableJson(metadata);
		}
	} catch {
		// Not JSON; try the other supported text formats.
	}

	const yamlMatch = content.match(/(?:^|\n)(sops:\s*\n[\s\S]*)$/m);
	if (yamlMatch) {
		try {
			const parsed = parseSopsYamlBlock(yamlMatch[1]) as {
				sops?: unknown;
			};
			if (parsed.sops && typeof parsed.sops === "object") {
				const {
					mac: _mac,
					lastmodified: _lastmodified,
					...metadata
				} = parsed.sops as Record<string, unknown>;
				return stableJson(metadata);
			}
		} catch {
			// Outside the supported subset; compare the raw text instead.
		}
		return yamlMatch[1]
			.replace(/^(\s+)(?:mac|lastmodified):.*$/gm, "$1<mutable-field>")
			.trimEnd();
	}

	const iniMatch = content.match(
		/(?:^|\n)(\[sops\]\s*\n[\s\S]*?)(?=\n\[[^\]]+\]|$)/m,
	);
	if (iniMatch) {
		return iniMatch[1]
			.replace(/^(?:mac|lastmodified)=.*$/gm, "<mutable-field>")
			.trimEnd();
	}

	const dotenvLines = content
		.split(/\r?\n/)
		.flatMap((line) =>
			/^sops_/.test(line)
				? [
						line.replace(
							/^sops_(?:mac|lastmodified)=.*$/,
							"sops_<mutable-field>",
						),
					]
				: [],
		);
	return dotenvLines.length > 0 ? dotenvLines.join("\n") : undefined;
}

export function encodeSopsValue(
	value: unknown,
	format: SopsValueFormat,
): string {
	if (format === "json") {
		if (typeof value !== "string") return JSON.stringify(value);
		try {
			return JSON.stringify(JSON.parse(value));
		} catch (error) {
			throw new Error(
				`SOPS JSON source is invalid: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	const stringValue = typeof value === "string" ? value : JSON.stringify(value);
	return JSON.stringify(stringValue);
}
