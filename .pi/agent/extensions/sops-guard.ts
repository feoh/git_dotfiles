import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SOPS_SECRET_PATH_PATTERNS = [
	/(^|\/)src\/bridge\/secrets\/.*\.ya?ml$/,
	/(^|\/).*\.sops\.ya?ml$/,
];

const SOPS_GUIDANCE = `SOPS encrypted secrets workflow:
- Edit encrypted secrets only with the sops CLI; do not use direct edit/write tools on encrypted secret files.
- Avoid changing SOPS metadata unless explicitly requested. Expected metadata changes are limited to the MAC and lastmodified fields after a value edit.
- Do not run sops rotate/updatekeys, add/remove recipient flags, or full re-encryption on existing secrets unless the user specifically asks for metadata/key changes.
- Avoid generic YAML formatters on encrypted SOPS files; they can churn the sops metadata block. If validation is needed, prefer decrypt/parse checks and inspect git diff for metadata-only churn.
- After editing, verify with sops -d and git diff without exposing secret values in the response.`;

function isSopsSecretPath(path: string): boolean {
	const normalized = path.replace(/^@/, "").replace(/\\/g, "/");
	return SOPS_SECRET_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shellWords(command: string): string[] {
	const words: string[] = [];
	const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^\s]+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command)) !== null) {
		words.push(match[1] ?? match[2] ?? match[3] ?? "");
	}
	return words;
}

function commandMentionsSopsSecret(command: string): boolean {
	return shellWords(command).some(isSopsSecretPath);
}

function commandUsesSops(command: string): boolean {
	return /(^|[\s;&|()])(?:\.\/)?sops(?:\s|$)/.test(command);
}

function commandChangesSopsMetadata(command: string): boolean {
	return (
		/\bsops\s+(?:updatekeys|rotate|groups)\b/.test(command) ||
		/\bsops\b[^\n]*(?:--(?:add|rm)-(?:kms|pgp|gcp-kms|hckms|azure-kv|hc-vault-transit)|--(?:kms|pgp|age|gcp-kms|hckms|azure-kv|hc-vault-transit)\b)/.test(
			command,
		) ||
		/\bsops\s+(?:encrypt|--encrypt|-e)\b[^\n]*(?:--in-place|-i)\b/.test(command)
	);
}

function commandFormatsSopsSecret(command: string): boolean {
	return (
		commandMentionsSopsSecret(command) &&
		(/\byamlfmt\b/.test(command) ||
			(/\bpre-commit\s+run\b/.test(command) && !/\bSKIP=[^\s]*yamlfmt/.test(command)))
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const promptMentionsSops = /\b(sops|secret|secrets)\b/i.test(event.prompt);
		const inInfraRepo = event.systemPromptOptions.cwd.includes("ol-infrastructure");
		if (!promptMentionsSops && !inInfraRepo) return undefined;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${SOPS_GUIDANCE}`,
		};
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "edit" || event.toolName === "write") {
			const path = String((event.input as { path?: unknown }).path ?? "");
			if (isSopsSecretPath(path)) {
				return {
					block: true,
					reason: `Use sops, not ${event.toolName}, to modify encrypted secret file ${path}`,
				};
			}
		}

		if (event.toolName !== "bash") return undefined;

		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!commandMentionsSopsSecret(command)) return undefined;

		if (commandFormatsSopsSecret(command)) {
			const reason =
				"YAML formatting encrypted SOPS files can churn the sops metadata block. Use decrypt/parse validation or SKIP=yamlfmt unless formatting churn is intentional.";
			if (!ctx.hasUI) return { block: true, reason };
			const ok = await ctx.ui.confirm("SOPS metadata churn risk", `${reason}\n\nAllow command?`);
			if (!ok) return { block: true, reason };
		}

		if (commandUsesSops(command) && commandChangesSopsMetadata(command)) {
			const reason =
				"This sops command can alter recipients/key groups or otherwise rewrite SOPS metadata. Use value-only sops edits unless metadata changes were explicitly requested.";
			if (!ctx.hasUI) return { block: true, reason };
			const ok = await ctx.ui.confirm("SOPS metadata change", `${reason}\n\nAllow command?`);
			if (!ok) return { block: true, reason };
		}

		return undefined;
	});

	pi.registerCommand("sops-guidelines", {
		description: "Show safe SOPS encrypted secrets editing guidance",
		handler: async (_args, ctx) => {
			ctx.ui.notify(SOPS_GUIDANCE, "info");
		},
	});
}
