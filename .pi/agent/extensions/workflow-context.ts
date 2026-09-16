/**
 * witan workflow context — Pi extension
 *
 * Pi equivalent of two Claude Code hooks:
 *  - `workflow-context-inject` (UserPromptSubmit): before each agent turn,
 *    injects active WorkflowProjects and ready tasks for the current repo
 *    into the system prompt.
 *  - `workflow-session-checkpoint.sh` (Stop): on session end, runs `witan
 *    session-checkpoint`, which opportunistically compacts the memory graph
 *    store (throttled; see witan.maintenance.spawn_background_optimize) so
 *    query latency doesn't re-bloat — see #124. It also tries to auto-close
 *    the active WorkflowSession, but that half is keyed on
 *    `CLAUDE_SESSION_ID` and safely no-ops under Pi (unset env var); the
 *    optimize half has no such dependency, so it *is* safe to mirror here.
 *
 * Both delegate to the `witan` CLI. Requires `witan` on PATH
 * (`uv tool install git+https://github.com/mitodl/agent-kit#subdirectory=mcp/servers/witan`).
 *
 * Best-effort: any failure (missing binary, no graph, non-git dir) is
 * swallowed and never disrupts the session.
 *
 * Install: copy or symlink into ~/.pi/agent/extensions/ (via `witan setup --agent pi`
 * or the manual symlink in configs/pi/README.md).
 */

import { spawn, spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Run a witan subcommand detached in the background; ignore all failures. */
function runInBackground(args: string[], cwd?: string): void {
	try {
		const child = spawn("witan", args, {
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

export default function workflowContextExtension(pi: ExtensionAPI): void {
	pi.on("before_agent_start", async (event: any, ctx: any) => {
		try {
			const r = spawnSync("witan", ["inject-context"], {
				encoding: "utf8",
				timeout: 5000,
				cwd: ctx?.cwd,
			});
			const text = (r.stdout ?? "").trim();
			if (r.status !== 0 || !text) return;
			return { systemPrompt: `${event.systemPrompt ?? ""}\n\n${text}` };
		} catch {
			return;
		}
	});

	// Opportunistically compact the memory graph store on session end (mirrors
	// the Claude `workflow-session-checkpoint.sh` Stop hook's optimize half).
	// Detached and non-blocking — session_shutdown fires before teardown, not
	// after, so this must not wait on the child process.
	pi.on("session_shutdown", async (_event, ctx: any) => {
		runInBackground(["session-checkpoint"], ctx?.cwd);
	});
}
