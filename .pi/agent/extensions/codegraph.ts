/**
 * witan-code — Pi extension
 *
 * Pi equivalent of the four Claude Code code-graph hooks:
 *  - session_start     : seed/refresh the whole repo's Layer-2 code graph in
 *                        the background (first session builds it, later
 *                        sessions re-hash and skip unchanged files).
 *  - edit / write      : incrementally re-index the edited file after the
 *                        tool runs.
 *  - before_agent_start: report whether the code graph is indexed (file
 *                        count, last-updated) or still being built, plus
 *                        cross-repo coverage and how to reach the code_*
 *                        tools. Runs `inject-context --client pi`, so the
 *                        block names pi-mcp-adapter's `mcp` proxy
 *                        (search, then call) rather than Claude's
 *                        ToolSearch, which Pi does not have.
 *  - session_shutdown  : opportunistically compact the current repo's store
 *                        and the shared cross-repo bridge store (throttled;
 *                        see witan_code.maintenance) — no session-id
 *                        dependency, unlike workflow-session-checkpoint, so
 *                        this one *is* mirrored under Pi.
 *
 * Best-effort: a missing CLI, non-git dir, or parse failure never disrupts
 * the session. Every handler is detached and non-blocking except
 * before_agent_start, which waits up to INJECT_CONTEXT_TIMEOUT_MS for the
 * status block (the same budget the Claude hook gets). Requires `witan-code` on PATH
 * (`witan-code setup --agent pi`, or `uv tool install --editable
 * mcp/servers/witan-code`); otherwise it silently no-ops.
 *
 * Install: `witan-code setup --agent pi`, or symlink into
 * ~/.pi/agent/extensions/ (see configs/pi/README.md).
 */

import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * How long before_agent_start waits for `witan-code inject-context`: 15s, the
 * same budget as the Claude `UserPromptSubmit` hook `witan-code setup`
 * installs (`witan_code.setup.INJECT_CONTEXT_TIMEOUT_SECONDS`;
 * tests/test_setup.py asserts the two agree). The first prompt in a cache
 * window can pay a ~10s cold store read that must finish once to populate the
 * on-disk cache; the 5s this used to be killed that read every time, so the
 * cache never filled and every prompt came back with no block.
 *
 * Only this prompt-injection read waits. session_start's index, the per-edit
 * reindex, and session_shutdown's checkpoint all stay detached.
 */
const INJECT_CONTEXT_TIMEOUT_MS = 15_000;

const SRC_EXT = /\.(py|pyi|ts|tsx|js|jsx|mjs|cjs)$/;
const EDIT_TOOLS = new Set(["edit", "write"]);

function inGitRepo(cwd: string): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", {
			cwd,
			stdio: ["ignore", "ignore", "ignore"],
		});
		return true;
	} catch {
		return false;
	}
}

/** Run a witan-code subcommand detached in the background; ignore all failures. */
function runInBackground(args: string[], cwd?: string): void {
	try {
		const child = spawn("witan-code", args, {
			detached: true,
			stdio: "ignore",
			...(cwd ? { cwd } : {}),
		});
		child.on("error", () => {}); // CLI not installed, etc.
		child.unref();
	} catch {
		/* ignore */
	}
}

function editedPath(event: any, cwd: string): string | null {
	const input = event?.input ?? {};
	const raw = input.path ?? input.file_path ?? input.filename;
	if (typeof raw !== "string" || raw.length === 0) return null;
	const abs = isAbsolute(raw) ? raw : resolve(cwd, raw);
	return SRC_EXT.test(abs) ? abs : null;
}

export default function codegraphExtension(pi: ExtensionAPI): void {
	// Paths captured at tool_call, consumed at tool_result (FIFO) — covers Pi
	// builds where tool_result carries no input.
	const pending: string[] = [];

	// Seed / refresh the whole repo once per session (incremental).
	pi.on("session_start", async (_event, ctx) => {
		if (inGitRepo(ctx.cwd)) runInBackground(["index", ctx.cwd]);
	});

	// Push one entry per edit tool_call (path or "") so the FIFO stays paired
	// 1:1 with tool_result, which always shifts exactly one.
	pi.on("tool_call", (event: any, ctx) => {
		if (!EDIT_TOOLS.has(event?.toolName)) return;
		pending.push(editedPath(event, ctx.cwd) ?? "");
	});

	// After a successful edit/write, re-index just that file.
	pi.on("tool_result", (event: any, ctx) => {
		if (!EDIT_TOOLS.has(event?.toolName)) return;
		const queued = pending.shift() ?? "";
		if (event?.isError) return;
		const p = editedPath(event, ctx.cwd) ?? queued;
		if (p && existsSync(p)) runInBackground(["index", p]);
	});

	// Report code-graph readiness before each turn (mirrors the Claude
	// `witan-code inject-context` UserPromptSubmit hook). A timeout, a
	// missing CLI, or a non-zero exit all land in the `r.status !== 0` branch:
	// no context, never a thrown error.
	pi.on("before_agent_start", async (event: any, ctx: any) => {
		try {
			const r = spawnSync("witan-code", ["inject-context", "--client", "pi"], {
				encoding: "utf8",
				timeout: INJECT_CONTEXT_TIMEOUT_MS,
				cwd: ctx?.cwd,
			});
			const text = (r.stdout ?? "").trim();
			if (r.status !== 0 || !text) return;
			return { systemPrompt: `${event.systemPrompt ?? ""}\n\n${text}` };
		} catch {
			return;
		}
	});

	// Opportunistically compact the store(s) on session end (mirrors the
	// Claude `witan-code checkpoint` Stop hook). Detached and non-blocking,
	// like session_start's index — session_shutdown fires before teardown,
	// not after, so this must not wait on the child process.
	pi.on("session_shutdown", async (_event, ctx: any) => {
		if (inGitRepo(ctx?.cwd)) runInBackground(["checkpoint"], ctx.cwd);
	});
}
