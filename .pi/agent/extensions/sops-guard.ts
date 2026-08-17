import { spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
	commandCandidatePaths,
	commandChangesSopsMetadata,
	commandFormatsSopsSecret,
	commandMayMutateFiles,
	commandPassesSopsValueInArguments,
	commandUsesSops,
	encodeSopsValue,
	hasSopsMetadata,
	isKnownSopsPath,
	isSafeSopsPathExpression,
	resolveUserPath,
	stableSopsMetadata,
	type SopsValueFormat,
} from "./lib/sops-guard-core.ts";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_ERROR_BYTES = 16 * 1024;
const COMMAND_TIMEOUT_MS = 60_000;
const SOPS_BINARY = process.env.SOPS_BINARY || "sops";
const VAULT_BINARY = process.env.VAULT_BINARY || "vault";

const SOPS_GUIDANCE = `SOPS encrypted secrets workflow:
- Prefer the sops_secret tool for inspecting, validating, setting, or deleting encrypted values. It never returns plaintext and never accepts plaintext literal values in tool arguments.
- Supply new values to sops_secret from an environment variable, local file, authenticated Vault KV field, or another encrypted SOPS value.
- Edit encrypted secrets only with SOPS; direct edit/write and non-SOPS mutation commands are blocked for recognized encrypted files, including relative paths.
- Avoid changing SOPS recipients or metadata unless explicitly requested. Value-only updates may change only the MAC and lastmodified fields.
- Never pass plaintext values in command arguments. For a manual fallback, use sops set --value-stdin or --value-file.
- Avoid generic YAML formatters on encrypted SOPS files. Prefer decrypt/parse validation and inspect git diff without exposing secret values.`;

type SourceType = "environment" | "file" | "vault" | "sops";
type SopsAction = "inspect" | "validate" | "set" | "delete";

interface SopsToolParams {
	action: SopsAction;
	file: string;
	keyPath?: string;
	sourceType?: SourceType;
	sourceName?: string;
	sourcePath?: string;
	sourceKey?: string;
	vaultAddress?: string;
	valueFormat?: SopsValueFormat;
}

interface ProcessOptions {
	cwd: string;
	signal?: AbortSignal;
	stdin?: string;
	env?: NodeJS.ProcessEnv;
	captureStdout?: boolean;
	maxStdoutBytes?: number;
}

interface CheckedProcessOptions extends ProcessOptions {
	label: string;
	redactions?: string[];
}

interface ProcessResult {
	stdout: string;
	stderr: string;
	code: number;
}

interface SetSource {
	value: unknown;
	redactions: string[];
	description: string;
}

interface MutationOptions {
	target: string;
	cwd: string;
	action: "set" | "delete";
	keyPath: string;
	signal?: AbortSignal;
	encodedValue?: string;
	redactions?: string[];
}

function truncate(text: string, maxBytes = MAX_ERROR_BYTES): string {
	const buffer = Buffer.from(text);
	if (buffer.byteLength <= maxBytes) return text;
	return `${buffer.subarray(0, maxBytes).toString()}…`;
}

function redact(text: string, values: string[]): string {
	let sanitized = text;
	for (const value of values) {
		if (value.length >= 3)
			sanitized = sanitized.split(value).join("[REDACTED]");
	}
	return truncate(sanitized.trim());
}

function runProcess(
	command: string,
	args: string[],
	options: ProcessOptions,
): Promise<ProcessResult> {
	return new Promise((resolveProcess, rejectProcess) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			shell: false,
			stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
		});
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		let settled = false;
		let outputExceeded = false;

		const finish = (callback: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			options.signal?.removeEventListener("abort", abort);
			callback();
		};
		const terminate = () => {
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!child.killed) child.kill("SIGKILL");
			}, 2_000).unref();
		};
		const abort = () => {
			terminate();
			finish(() =>
				rejectProcess(new Error(`${basename(command)} command cancelled`)),
			);
		};
		const timeout = setTimeout(() => {
			terminate();
			finish(() =>
				rejectProcess(new Error(`${basename(command)} command timed out`)),
			);
		}, COMMAND_TIMEOUT_MS);
		timeout.unref();

		if (options.signal?.aborted) {
			abort();
			return;
		}
		options.signal?.addEventListener("abort", abort, { once: true });

		child.on("error", (error) => finish(() => rejectProcess(error)));
		child.stdout.on("data", (chunk: Buffer) => {
			if (options.captureStdout === false || outputExceeded) return;
			stdout = Buffer.concat([stdout, chunk]);
			if (stdout.byteLength > (options.maxStdoutBytes ?? MAX_SOURCE_BYTES)) {
				outputExceeded = true;
				terminate();
			}
		});
		child.stderr.on("data", (chunk: Buffer) => {
			if (stderr.byteLength < MAX_ERROR_BYTES)
				stderr = Buffer.concat([stderr, chunk]);
		});
		child.on("close", (code) => {
			finish(() => {
				if (outputExceeded) {
					rejectProcess(
						new Error(
							`${basename(command)} produced more than ${MAX_SOURCE_BYTES} bytes`,
						),
					);
					return;
				}
				resolveProcess({
					stdout: stdout.toString(),
					stderr: stderr.toString(),
					code: code ?? 1,
				});
			});
		});

		if (options.stdin !== undefined) child.stdin?.end(options.stdin);
	});
}

async function runChecked(
	command: string,
	args: string[],
	options: CheckedProcessOptions,
): Promise<string> {
	const { label, redactions = [], ...processOptions } = options;
	const result = await runProcess(command, args, processOptions);
	if (result.code !== 0) {
		const detail = redact(result.stderr, redactions);
		throw new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
	}
	return result.stdout;
}

async function readTextFile(path: string): Promise<string> {
	const fileStat = await stat(path);
	if (!fileStat.isFile()) throw new Error(`${path} is not a regular file`);
	if (fileStat.size > MAX_SOURCE_BYTES)
		throw new Error(
			`${path} exceeds the ${MAX_SOURCE_BYTES}-byte safety limit`,
		);
	return readFile(path, "utf8");
}

async function isProtectedSopsFile(
	path: string,
	cwd: string,
): Promise<boolean> {
	const resolved = resolveUserPath(path, cwd);
	if (isKnownSopsPath(resolved, cwd)) return true;
	try {
		return hasSopsMetadata(await readTextFile(resolved));
	} catch {
		return false;
	}
}

async function resolveSopsTarget(path: string, cwd: string): Promise<string> {
	const resolved = resolveUserPath(path, cwd);
	const content = await readTextFile(resolved);
	if (!hasSopsMetadata(content)) {
		throw new Error(`${resolved} does not contain recognizable SOPS metadata`);
	}
	if (!stableSopsMetadata(content)) {
		throw new Error(`${resolved} uses an unsupported SOPS metadata format`);
	}
	return resolved;
}

function requireKeyPath(params: SopsToolParams): string {
	if (!params.keyPath || !isSafeSopsPathExpression(params.keyPath)) {
		throw new Error(
			'keyPath must use SOPS bracket syntax, for example ["service"]["api_key"]',
		);
	}
	return params.keyPath;
}

async function validateSopsFile(
	target: string,
	cwd: string,
	signal?: AbortSignal,
): Promise<void> {
	await runChecked(SOPS_BINARY, ["decrypt", "--output", "/dev/null", target], {
		cwd,
		signal,
		captureStdout: false,
		label: `SOPS validation for ${target}`,
	});
}

function vaultData(payload: unknown, field: string): unknown {
	if (!payload || typeof payload !== "object")
		throw new Error("Vault returned an invalid JSON response");
	const data = (payload as { data?: unknown }).data;
	if (!data || typeof data !== "object")
		throw new Error("Vault response has no data object");
	const values = (data as { data?: unknown }).data;
	if (!values || typeof values !== "object")
		throw new Error("Vault response has no KV data object");
	if (!Object.hasOwn(values, field))
		throw new Error(`Vault field ${field} was not found`);
	return (values as Record<string, unknown>)[field];
}

function readEnvironmentSource(params: SopsToolParams): SetSource {
	if (
		!params.sourceName ||
		!/^[A-Za-z_][A-Za-z0-9_]*$/.test(params.sourceName)
	) {
		throw new Error("sourceName must be a valid environment variable name");
	}
	const value = process.env[params.sourceName];
	if (value === undefined)
		throw new Error(`Environment variable ${params.sourceName} is not set`);
	return {
		value,
		redactions: [value],
		description: `environment variable ${params.sourceName}`,
	};
}

async function readFileSource(
	params: SopsToolParams,
	cwd: string,
): Promise<SetSource> {
	if (!params.sourcePath)
		throw new Error("sourcePath is required for a file source");
	const sourcePath = resolveUserPath(params.sourcePath, cwd);
	const value = await readTextFile(sourcePath);
	if (value.includes("\0"))
		throw new Error("Binary source files are not supported");
	return {
		value,
		redactions: [value],
		description: `local file ${sourcePath}`,
	};
}

function vaultEnvironment(addressValue?: string): NodeJS.ProcessEnv {
	const env = { ...process.env };
	if (!addressValue) return env;
	let address: URL;
	try {
		address = new URL(addressValue);
	} catch {
		throw new Error("vaultAddress must be a valid HTTP or HTTPS URL");
	}
	if (address.protocol !== "https:" && address.protocol !== "http:") {
		throw new Error("vaultAddress must use HTTP or HTTPS");
	}
	env.VAULT_ADDR = address.toString().replace(/\/$/, "");
	return env;
}

async function readVaultSource(
	params: SopsToolParams,
	cwd: string,
	signal?: AbortSignal,
): Promise<SetSource> {
	if (!params.sourcePath || !params.sourceKey) {
		throw new Error(
			"sourcePath (Vault KV path) and sourceKey (field) are required for a Vault source",
		);
	}
	const output = await runChecked(
		VAULT_BINARY,
		["kv", "get", "-format=json", params.sourcePath],
		{
			cwd,
			signal,
			env: vaultEnvironment(params.vaultAddress),
			label: `Vault read for ${params.sourcePath}`,
		},
	);
	let payload: unknown;
	try {
		payload = JSON.parse(output);
	} catch {
		throw new Error("Vault returned malformed JSON");
	}
	const value = vaultData(payload, params.sourceKey);
	return {
		value,
		redactions: [typeof value === "string" ? value : JSON.stringify(value)],
		description: `Vault field ${params.sourcePath}:${params.sourceKey}`,
	};
}

async function readSopsSource(
	params: SopsToolParams,
	cwd: string,
	signal?: AbortSignal,
): Promise<SetSource> {
	if (
		!params.sourcePath ||
		!params.sourceKey ||
		!isSafeSopsPathExpression(params.sourceKey)
	) {
		throw new Error(
			"sourcePath and a bracket-syntax sourceKey are required for a SOPS source",
		);
	}
	const sourcePath = await resolveSopsTarget(params.sourcePath, cwd);
	const value = await runChecked(
		SOPS_BINARY,
		["decrypt", "--extract", params.sourceKey, sourcePath],
		{
			cwd,
			signal,
			label: `SOPS extraction from ${sourcePath}`,
		},
	);
	return {
		value: value.replace(/\r?\n$/, ""),
		redactions: [value, value.trimEnd()],
		description: `encrypted SOPS value ${sourcePath}:${params.sourceKey}`,
	};
}

async function readSetSource(
	params: SopsToolParams,
	ctx: ExtensionContext,
	signal?: AbortSignal,
): Promise<SetSource> {
	switch (params.sourceType) {
		case "environment":
			return readEnvironmentSource(params);
		case "file":
			return readFileSource(params, ctx.cwd);
		case "vault":
			return readVaultSource(params, ctx.cwd, signal);
		case "sops":
			return readSopsSource(params, ctx.cwd, signal);
		default:
			throw new Error(
				"sourceType is required for set and must be environment, file, vault, or sops",
			);
	}
}

function mutationDetails(before: string, after: string) {
	return {
		changed: before !== after,
		bytesBefore: Buffer.byteLength(before),
		bytesAfter: Buffer.byteLength(after),
		linesBefore: before.split(/\r?\n/).length,
		linesAfter: after.split(/\r?\n/).length,
		metadataChangesLimitedTo: ["mac", "lastmodified"],
	};
}

async function mutateSopsFile(options: MutationOptions) {
	const {
		target,
		cwd,
		action,
		keyPath,
		signal,
		encodedValue,
		redactions = [],
	} = options;
	return withFileMutationQueue(target, async () => {
		const before = await readTextFile(target);
		const metadataBefore = stableSopsMetadata(before);
		if (!metadataBefore)
			throw new Error("Unable to fingerprint SOPS metadata before mutation");
		await validateSopsFile(target, cwd, signal);

		try {
			if (action === "set") {
				if (encodedValue === undefined)
					throw new Error("Encoded value is required for set");
				await runChecked(
					SOPS_BINARY,
					["set", "--value-stdin", "--idempotent", target, keyPath],
					{
						cwd,
						signal,
						stdin: encodedValue,
						captureStdout: false,
						label: `SOPS set for ${target}:${keyPath}`,
						redactions,
					},
				);
			} else {
				await runChecked(
					SOPS_BINARY,
					["unset", "--idempotent", target, keyPath],
					{
						cwd,
						signal,
						captureStdout: false,
						label: `SOPS unset for ${target}:${keyPath}`,
					},
				);
			}

			await validateSopsFile(target, cwd, signal);
			const after = await readTextFile(target);
			if (stableSopsMetadata(after) !== metadataBefore) {
				throw new Error("SOPS recipient or key metadata changed unexpectedly");
			}
			return mutationDetails(before, after);
		} catch (error) {
			await writeFile(target, before, "utf8");
			throw error;
		}
	});
}

function describePlaintext(value: string) {
	const trimmed = value.trimEnd();
	let type = "string";
	try {
		const parsed = JSON.parse(trimmed);
		if (parsed === null) type = "null";
		else if (Array.isArray(parsed)) type = "array";
		else type = typeof parsed;
	} catch {
		// YAML and dotenv scalar extraction commonly returns an unquoted string.
	}
	return { type, bytes: Buffer.byteLength(trimmed), present: true };
}

async function executeSopsTool(
	params: SopsToolParams,
	signal: AbortSignal | undefined,
	ctx: ExtensionContext,
) {
	const target = await resolveSopsTarget(params.file, ctx.cwd);
	if (params.action === "validate") {
		await withFileMutationQueue(target, () =>
			validateSopsFile(target, ctx.cwd, signal),
		);
		return {
			content: [
				{
					type: "text" as const,
					text: `Validated ${relative(ctx.cwd, target)} without exposing plaintext.`,
				},
			],
			details: { action: "validate", file: target, valid: true },
		};
	}

	const keyPath = requireKeyPath(params);
	if (params.action === "inspect") {
		const plaintext = await withFileMutationQueue(target, () =>
			runChecked(SOPS_BINARY, ["decrypt", "--extract", keyPath, target], {
				cwd: ctx.cwd,
				signal,
				label: `SOPS inspection for ${target}:${keyPath}`,
			}),
		);
		const description = describePlaintext(plaintext);
		return {
			content: [
				{
					type: "text" as const,
					text: `Inspected ${relative(ctx.cwd, target)}:${keyPath}; value exists (${description.type}, ${description.bytes} bytes). Plaintext was not returned.`,
				},
			],
			details: { action: "inspect", file: target, keyPath, ...description },
		};
	}

	if (params.action === "delete") {
		if (!ctx.hasUI)
			throw new Error(
				"Deleting a SOPS value requires interactive confirmation",
			);
		const confirmed = await ctx.ui.confirm(
			"Delete encrypted SOPS value?",
			`${relative(ctx.cwd, target)}\n${keyPath}\n\nThe encrypted file will be validated and automatically restored if metadata changes unexpectedly.`,
		);
		if (!confirmed) throw new Error("SOPS deletion cancelled by user");
		const details = await mutateSopsFile({
			target,
			cwd: ctx.cwd,
			action: "delete",
			keyPath,
			signal,
		});
		return {
			content: [
				{
					type: "text" as const,
					text: `Deleted ${keyPath} from ${relative(ctx.cwd, target)} and validated the encrypted result. No plaintext was exposed.`,
				},
			],
			details: { action: "delete", file: target, keyPath, ...details },
		};
	}

	const source = await readSetSource(params, ctx, signal);
	const valueFormat = params.valueFormat ?? "string";
	const encodedValue = encodeSopsValue(source.value, valueFormat);
	const details = await mutateSopsFile({
		target,
		cwd: ctx.cwd,
		action: "set",
		keyPath,
		signal,
		encodedValue,
		redactions: [...source.redactions, encodedValue],
	});
	return {
		content: [
			{
				type: "text" as const,
				text: `Set ${keyPath} in ${relative(ctx.cwd, target)} from ${source.description}; validated encryption and preserved recipient metadata. No plaintext was exposed.`,
			},
		],
		details: {
			action: "set",
			file: target,
			keyPath,
			source: source.description,
			valueFormat,
			...details,
		},
	};
}

function registerSopsTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "sops_secret",
		label: "SOPS Secret",
		description:
			'Safely inspect, validate, set, or delete a value in an existing SOPS-encrypted file. Plaintext is never returned and cannot be supplied literally. Set sources: environment variable, local file, authenticated Vault KV field, or another SOPS value. keyPath/sourceKey use bracket syntax such as ["service"]["api_key"]. valueFormat=string stores source text as one string; valueFormat=json parses and stores structured JSON.',
		promptSnippet:
			"Safely inspect, validate, set, or delete encrypted SOPS values without exposing plaintext",
		promptGuidelines: [
			"Use sops_secret instead of edit, write, or ad-hoc bash commands whenever changing an existing SOPS-encrypted file.",
			"Never place plaintext secrets in sops_secret arguments; select environment, file, Vault, or SOPS as the source.",
		],
		parameters: Type.Object({
			action: StringEnum(["inspect", "validate", "set", "delete"] as const),
			file: Type.String({
				description:
					"SOPS-encrypted target file; relative paths resolve from the session cwd",
			}),
			keyPath: Type.Optional(
				Type.String({
					description: 'SOPS bracket path, e.g. ["service"]["api_key"]',
				}),
			),
			sourceType: Type.Optional(
				StringEnum(["environment", "file", "vault", "sops"] as const),
			),
			sourceName: Type.Optional(
				Type.String({
					description: "Environment variable name for an environment source",
				}),
			),
			sourcePath: Type.Optional(
				Type.String({
					description:
						"Local source file, Vault KV path, or encrypted source SOPS file",
				}),
			),
			sourceKey: Type.Optional(
				Type.String({
					description: "Vault field name, or bracket path when sourceType=sops",
				}),
			),
			vaultAddress: Type.Optional(
				Type.String({
					description:
						"Optional Vault HTTP(S) address; credentials remain in the environment",
				}),
			),
			valueFormat: Type.Optional(StringEnum(["string", "json"] as const)),
		}),
		executionMode: "sequential",
		async execute(...args) {
			const [, rawParams, signal, , ctx] = args;
			return executeSopsTool(rawParams as SopsToolParams, signal, ctx);
		},
	});
}

async function protectedPathsForCommand(
	command: string,
	cwd: string,
): Promise<string[]> {
	const protectedPaths: string[] = [];
	for (const candidate of commandCandidatePaths(command, cwd).slice(0, 64)) {
		if (await isProtectedSopsFile(candidate, cwd))
			protectedPaths.push(candidate);
	}
	return protectedPaths;
}

async function confirmRisk(
	ctx: ExtensionContext,
	title: string,
	reason: string,
): Promise<ToolCallEventResult | undefined> {
	if (!ctx.hasUI) return { block: true, reason };
	const confirmed = await ctx.ui.confirm(title, `${reason}\n\nAllow command?`);
	return confirmed ? undefined : { block: true, reason };
}

async function guardBashCommand(
	command: string,
	ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> {
	const protectedPaths = await protectedPathsForCommand(command, ctx.cwd);
	const hasProtectedPath = protectedPaths.length > 0;
	const usesSops = commandUsesSops(command);
	if (hasProtectedPath && commandMayMutateFiles(command) && !usesSops) {
		return {
			block: true,
			reason: `Direct mutation of encrypted SOPS files is blocked. Use sops_secret. Matched: ${protectedPaths.join(", ")}`,
		};
	}
	if (
		hasProtectedPath &&
		usesSops &&
		commandPassesSopsValueInArguments(command)
	) {
		return {
			block: true,
			reason:
				"Do not pass plaintext to sops set in command arguments. Use sops_secret, --value-stdin, or --value-file.",
		};
	}
	if (
		commandFormatsSopsSecret(
			command,
			hasProtectedPath,
			ctx.cwd.includes("ol-infrastructure"),
		)
	) {
		return confirmRisk(
			ctx,
			"SOPS metadata churn risk",
			"Formatting encrypted SOPS files can churn protected metadata. Use decrypt/parse validation or SKIP=yamlfmt unless formatting churn is intentional.",
		);
	}
	if (hasProtectedPath && usesSops && commandChangesSopsMetadata(command)) {
		return confirmRisk(
			ctx,
			"SOPS metadata change",
			"This SOPS command can alter recipients, key groups, or encrypted data-key metadata. Value-only operations should use sops_secret.",
		);
	}
	return undefined;
}

async function handleSopsToolCall(
	event: ToolCallEvent,
	ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> {
	if (event.toolName === "edit" || event.toolName === "write") {
		const path = String((event.input as { path?: unknown }).path ?? "");
		if (await isProtectedSopsFile(path, ctx.cwd)) {
			return {
				block: true,
				reason: `Use sops_secret, not ${event.toolName}, to modify encrypted secret file ${resolveUserPath(path, ctx.cwd)}`,
			};
		}
	}
	if (event.toolName !== "bash") return undefined;
	return guardBashCommand(
		String((event.input as { command?: unknown }).command ?? ""),
		ctx,
	);
}

function registerSopsGuards(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (event) => {
		const promptMentionsSops = /\b(sops|secret|secrets)\b/i.test(event.prompt);
		const inInfraRepo =
			event.systemPromptOptions.cwd.includes("ol-infrastructure");
		if (!promptMentionsSops && !inInfraRepo) return undefined;
		return { systemPrompt: `${event.systemPrompt}\n\n${SOPS_GUIDANCE}` };
	});
	pi.on("tool_call", handleSopsToolCall);
}

function registerSopsCommand(pi: ExtensionAPI): void {
	pi.registerCommand("sops-guidelines", {
		description:
			"Show safe SOPS encrypted-secrets guidance and the sops_secret tool workflow",
		handler: (_args, ctx) => {
			ctx.ui.notify(SOPS_GUIDANCE, "info");
			return Promise.resolve();
		},
	});
}

export default function (pi: ExtensionAPI) {
	registerSopsTool(pi);
	registerSopsGuards(pi);
	registerSopsCommand(pi);
}
