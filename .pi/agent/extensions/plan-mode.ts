import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BRAINSTORM_PROMPT = `
You are in PLAN MODE — BRAINSTORM phase for this request.

Your job is to collaborate with the user to design an implementation. This is a
conversation, not a one-shot deliverable.

Rules:
- You may use the read tool and run read-only shell commands (ls, find, grep,
  cat, head, tail, git log/diff/status, gh, jq, etc.) to inspect the repo.
- Do NOT call the write or edit tools — they are blocked.
- Do NOT run shell commands that mutate the filesystem, package state, git
  state, services, or external systems.
- Do NOT produce a final numbered implementation plan and do NOT ask the user
  to "approve the plan" yet. The user will explicitly run /finalize when they
  are ready to lock in a plan.
- Instead: ask clarifying questions, surface assumptions, explore the codebase
  read-only, sketch options with tradeoffs, and converge on intent with the
  user. Keep replies focused and incremental — one or two questions or
  proposals at a time, not an essay.
- If the user's intent is already crystal clear, you may say so and suggest
  they run /finalize.
`;

const FINALIZE_PROMPT_TEMPLATE = (path: string) => `
You are in PLAN MODE — FINALIZE phase.

The user has asked you to lock in the plan you have been discussing. Write the
agreed implementation plan as a single Markdown file at:

    ${path}

Use the write tool. The ONLY file you are permitted to create or modify in
this phase is exactly that path. All other write/edit calls will be blocked.

Structure the document with these sections (use \`##\` headings):

- Context — short summary of the problem and relevant background from the
  conversation.
- Goals / Non-goals
- Files to change — bullet list of likely files/components with a one-line
  note on what changes in each.
- Ordered steps — numbered implementation steps in the order they should be
  performed.
- Validation — tests, commands, or manual checks to confirm the change works.
- Risks & unknowns

Base the contents strictly on what you and the user actually discussed. Do not
invent new requirements. If something is genuinely unresolved, list it under
Risks & unknowns rather than guessing.

After writing the file, reply with just the path and a one-line summary, then
stop. Do not start implementing.
`;

// Patterns that indicate filesystem/state mutation.
const MUTATING_BASH_PATTERNS = [
  /(?:^|[;&|])\s*[^|]*\s+>{1,2}\s/,
  /(?:^|[;&|])\s*[^|]*\s+>{1,2}$/m,
  /(?:^|[;&|]\s*)(?:rm|rmdir|mv|cp|mkdir|mktemp|touch|chmod|chown|chgrp|ln|install|truncate|dd|shred|mknod)\b/,
  /(?:^|[;&|]\s*)(?:tee)\b/,
  /(?:^|[;&|]\s*)git\s+(?:commit|push|pull|fetch|checkout|switch|merge|rebase|reset|clean|stash|add|rm|init|clone|tag\s+-[adfs])\b/,
  /(?:^|[;&|]\s*)(?:npm|yarn|pnpm|pip|pip3|uv|conda|poetry|pdm|pipx)\s+(?:install|add|remove|uninstall|update|upgrade|create|init|run|exec|build|publish)\b/,
  /(?:^|[;&|]\s*)(?:make|cmake|cargo\s+build|cargo\s+run|go\s+build|go\s+run|go\s+install|mvn|gradle)\b/,
  /(?:^|[;&|]\s*)(?:sudo|su)\b/,
  /(?:^|[;&|]\s*)(?:docker|podman)\s+(?:run|build|push|exec|rm|stop|kill|create|compose)\b/,
  /(?:^|[;&|]\s*)(?:kubectl|helm|terraform|pulumi|ansible)\s+(?:apply|delete|destroy|create|run|up|down)\b/,
  /(?:^|[;&|]\s*)(?:apt|apt-get|brew|dnf|yum|pacman|apk|snap|flatpak)\s+(?:install|remove|update|upgrade|purge)\b/,
  /(?:^|[;&|]\s*)(?:systemctl|service|launchctl)\s+(?:start|stop|restart|enable|disable)\b/,
  /(?:^|[;&|]\s*)(?:curl|wget)\s.*\|\s*(?:bash|sh|zsh)\b/,
  /(?:^|[;&|]\s*)(?:eval)\b/,
];

function isMutatingBash(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) return false;
  if (/`/.test(normalized)) return true;
  return MUTATING_BASH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return cleaned || "plan";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

export default function planModeExtension(pi: ExtensionAPI) {
  let oneShotPlanMode = false;
  let persistentPlanMode = false;
  let phase: "brainstorm" | "finalize" = "brainstorm";
  let currentPlanPath: string | null = null;

  const isPlanModeActive = () => oneShotPlanMode || persistentPlanMode;

  const statusLabel = () => {
    if (!isPlanModeActive()) return undefined;
    if (phase === "finalize") return "plan: finalizing";
    return persistentPlanMode ? "plan: brainstorm" : "plan: one-shot";
  };

  const refreshStatus = (ctx: {
    ui?: { setStatus?: (key: string, value?: string) => void };
  }) => {
    ctx.ui?.setStatus?.("plan-mode", statusLabel());
  };

  const resetToBrainstorm = () => {
    phase = "brainstorm";
    currentPlanPath = null;
  };

  pi.registerCommand("plan", {
    description: "One-shot plan with read-only inspection. Usage: /plan <task>",
    handler: async (args, ctx) => {
      const task = args.trim();
      if (!task) {
        ctx.ui.notify(
          "Usage: /plan <task>. For a persistent brainstorm session, use /planmode on.",
          "warning",
        );
        return;
      }

      oneShotPlanMode = true;
      phase = "brainstorm";
      refreshStatus(ctx);
      ctx.ui.notify(
        "Plan mode (one-shot) enabled. Brainstorm with me, then run /finalize to write the plan.",
        "info",
      );
      pi.sendUserMessage(task);
    },
  });

  pi.registerCommand("planmode", {
    description: "Toggle persistent plan mode. Usage: /planmode on|off|status",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();

      if (value === "on") {
        persistentPlanMode = true;
        phase = "brainstorm";
        refreshStatus(ctx);
        ctx.ui.notify(
          "Persistent plan mode is on (brainstorm phase). Use /finalize to lock in a plan, /execute to run it, or /planmode off to cancel.",
          "info",
        );
        return;
      }

      if (value === "off") {
        persistentPlanMode = false;
        oneShotPlanMode = false;
        resetToBrainstorm();
        refreshStatus(ctx);
        ctx.ui.notify("Plan mode is off.", "info");
        return;
      }

      if (value === "" || value === "status") {
        const label = !isPlanModeActive()
          ? "off"
          : `${persistentPlanMode ? "persistent" : "one-shot"} / ${phase}` +
            (currentPlanPath ? ` → ${currentPlanPath}` : "");
        ctx.ui.notify(`Plan mode status: ${label}.`, "info");
        return;
      }

      ctx.ui.notify("Usage: /planmode on|off|status", "warning");
    },
  });

  pi.registerCommand("finalize", {
    description:
      "Write the brainstormed plan to a Markdown file. Usage: /finalize [slug]",
    handler: async (args, ctx) => {
      if (!isPlanModeActive()) {
        ctx.ui.notify(
          "Plan mode is not active. Start with /planmode on or /plan <task>.",
          "warning",
        );
        return;
      }

      const slug = slugify(args.trim());
      const dir = resolve(process.cwd(), ".pi", "plans");
      try {
        mkdirSync(dir, { recursive: true });
      } catch (err) {
        ctx.ui.notify(
          `Could not create ${dir}: ${(err as Error).message}`,
          "error",
        );
        return;
      }

      const path = `.pi/plans/${timestamp()}-${slug}.md`;
      currentPlanPath = path;
      phase = "finalize";
      refreshStatus(ctx);
      ctx.ui.notify(
        `Finalizing plan → ${path}. Only that file may be written.`,
        "info",
      );
      pi.sendUserMessage(
        `Finalize the plan we discussed. Write it to ${path} following the FINALIZE phase instructions.`,
      );
    },
  });

  pi.registerCommand("execute", {
    description:
      "Exit plan mode and execute the most recently finalized plan file.",
    handler: async (args, ctx) => {
      if (!currentPlanPath) {
        ctx.ui.notify(
          "No finalized plan to execute. Run /finalize first.",
          "warning",
        );
        return;
      }

      const path = currentPlanPath;
      persistentPlanMode = false;
      oneShotPlanMode = false;
      resetToBrainstorm();
      refreshStatus(ctx);
      ctx.ui.notify(
        `Plan mode off. Executing plan: ${path}`,
        "info",
      );
      const extra = args.trim();
      pi.sendUserMessage(
        `Execute the implementation plan in ${path}. Read the file first, then work through the Ordered steps in order. Pause for confirmation between major steps, and run the Validation section when done.${extra ? `\n\nAdditional instructions: ${extra}` : ""}`,
      );
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    refreshStatus(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!isPlanModeActive()) return;

    if (phase === "finalize" && currentPlanPath) {
      ctx.ui.setWorkingMessage("Writing finalized plan…");
      return {
        systemPrompt: `${event.systemPrompt}\n\n${FINALIZE_PROMPT_TEMPLATE(currentPlanPath)}`,
      };
    }

    ctx.ui.setWorkingMessage("Brainstorming (read-only)…");
    return {
      systemPrompt: `${event.systemPrompt}\n\n${BRAINSTORM_PROMPT}`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (!isPlanModeActive()) return;

    if (event.toolName === "write" || event.toolName === "edit") {
      if (phase === "finalize" && currentPlanPath) {
        const input = event.input as { path?: unknown };
        const target = typeof input.path === "string" ? input.path : "";
        const targetAbs = resolve(process.cwd(), target);
        const allowedAbs = resolve(process.cwd(), currentPlanPath);
        if (targetAbs === allowedAbs) {
          return;
        }
        return {
          block: true,
          reason: `Plan mode (finalize): only ${currentPlanPath} may be written. Refused write to ${target || "<missing path>"}.`,
        };
      }
      return {
        block: true,
        reason:
          "Plan mode (brainstorm): file modification tools are blocked. Use /finalize to write the plan, or /planmode off to exit.",
      };
    }

    if (event.toolName === "bash") {
      const input = event.input as { command?: unknown };
      const command = typeof input.command === "string" ? input.command : "";
      if (isMutatingBash(command)) {
        return {
          block: true,
          reason:
            "Plan mode is active: this command appears to mutate the filesystem, packages, or external state. Use read-only commands only.",
        };
      }
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (oneShotPlanMode && phase === "brainstorm") {
      // One-shot stays armed until the user either /finalize's or /planmode off's,
      // so a single brainstorm turn doesn't silently drop guardrails.
    }
    ctx.ui.setWorkingMessage();
    refreshStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    oneShotPlanMode = false;
    persistentPlanMode = false;
    resetToBrainstorm();
  });
}
