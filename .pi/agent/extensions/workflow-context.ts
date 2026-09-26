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
 *    query latency doesn't re-bloat — see #124. It also auto-closes the
 *    active WorkflowSession, looked up by the agent session id. Pi exposes
 *    `PI_SESSION_ID` only to its bash tool's commands, not to its own process
 *    env, so the handler sets it on the checkpoint child explicitly from
 *    `ctx.sessionManager.getSessionId()` — the same value the agent passed
 *    as `session_id` to `workflow_session_start` (read via
 *    `echo $PI_SESSION_ID`). No session id, no handle: the close no-ops and
 *    the compaction still runs.
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

/**
 * How long before_agent_start waits for `witan inject-context`: 45s, the same
 * budget as the Claude `UserPromptSubmit` hook `witan setup` installs
 * (`witan.setup.INJECT_CONTEXT_TIMEOUT_SECONDS`; tests/test_setup.py asserts
 * the two agree). 5s cleared the warm output-cache hit (0.6-0.9s measured in
 * agent-kit#349) but sat far below the cold path (16-23s there), so every
 * prompt that missed the 30s cache silently contributed no block. A timeout
 * is still wanted — a hung read must degrade to no context rather than stall
 * the turn — but it has to sit above the cold path, not inside it.
 *
 * Only this prompt-injection read waits. session_shutdown stays detached.
 */
const INJECT_CONTEXT_TIMEOUT_MS = 45_000;

/** Run a witan subcommand detached in the background; ignore all failures. */
function runInBackground(
	args: string[],
	cwd?: string,
	env?: NodeJS.ProcessEnv,
): void {
	try {
		const child = spawn("witan", args, {
			detached: true,
			stdio: "ignore",
			...(cwd ? { cwd } : {}),
			...(env ? { env } : {}),
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
			// A timeout, a missing CLI, or a non-zero exit all land in the
			// `r.status !== 0` branch below: no context, never a thrown error.
			const r = spawnSync("witan", ["inject-context"], {
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

	// Opportunistically compact the memory graph store on session end (mirrors
	// the Claude `workflow-session-checkpoint.sh` Stop hook's optimize half).
	// Detached and non-blocking — session_shutdown fires before teardown, not
	// after, so this must not wait on the child process.
	pi.on("session_shutdown", async (_event, ctx: any) => {
		runInBackground(["session-checkpoint"], ctx?.cwd, checkpointEnv(ctx));
	});
}

/**
 * The checkpoint child's env: Pi's own, plus this session's `PI_SESSION_ID`
 * so `witan session-checkpoint` finds the handle `workflow_session_start`
 * parked under it. Only the child's copy is touched. Both id variables are
 * dropped from that copy first: witan prefers `CLAUDE_SESSION_ID`, and either
 * one inherited from an enclosing session (Claude Code, or a parent Pi's bash
 * tool) names a different session than the one shutting down. When the id is
 * unavailable the child gets neither, so the close no-ops instead of closing
 * the enclosing session's handle.
 */
function checkpointEnv(ctx: any): NodeJS.ProcessEnv {
	let sessionId: string | undefined;
	try {
		sessionId = ctx?.sessionManager?.getSessionId?.();
	} catch {
		sessionId = undefined;
	}
	const env: NodeJS.ProcessEnv = { ...process.env };
	delete env.CLAUDE_SESSION_ID;
	delete env.PI_SESSION_ID;
	if (sessionId) env.PI_SESSION_ID = sessionId;
	return env;
}
