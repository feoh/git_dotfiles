import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PLAN_MODE_PROMPT = `
You are in PLAN MODE for this request.

Plan mode rules:
- Your goal is to understand the task, inspect relevant context, and produce a concrete implementation plan.
- You may use read-only inspection tools such as read, ls, grep, and find.
- Do not modify files, install packages, run formatters, run migrations, create commits, or make network/deployment changes.
- Do not call write or edit.
- Do not run shell commands that can mutate the filesystem, package state, git state, services, or external systems.
- If you need more information, inspect read-only sources or ask concise clarifying questions.
- End with a plan that includes: likely files/components to change, ordered implementation steps, validation/tests to run, and risks/unknowns.
- Explicitly ask the user to approve the plan or request changes before implementation.
`;

const READ_ONLY_BASH_PATTERNS = [
  /^pwd\b/,
  /^ls\b/,
  /^tree\b/,
  /^find\b/,
  /^grep\b/,
  /^rg\b/,
  /^cat\b/,
  /^head\b/,
  /^tail\b/,
  /^wc\b/,
  /^git\s+(status|diff|log|show|grep|ls-files)\b/,
  /^git\s+branch\s+--show-current\b/,
];

function isReadOnlyBash(command: string): boolean {
  const normalized = command.trim();
  if (!normalized || /[<>`]/.test(normalized)) return false;

  // Allow simple chains of explicitly read-only commands. Anything more complex
  // is blocked in plan mode; the model can use built-in read/grep/find/ls tools.
  const parts = normalized.split(/\s*(?:&&|\|\||;)\s*/).filter(Boolean);
  return parts.every((part) => READ_ONLY_BASH_PATTERNS.some((pattern) => pattern.test(part.trim())));
}

export default function planModeExtension(pi: ExtensionAPI) {
  let oneShotPlanMode = false;
  let persistentPlanMode = false;

  const isPlanModeActive = () => oneShotPlanMode || persistentPlanMode;

  const setPlanStatus = (ctx: { ui?: { setStatus?: (key: string, value?: string) => void } }) => {
    ctx.ui?.setStatus?.("plan-mode", persistentPlanMode ? "plan: on" : undefined);
  };

  pi.registerCommand("plan", {
    description: "Plan first, with read-only inspection only. Usage: /plan <task>",
    handler: async (args, ctx) => {
      const task = args.trim();
      if (!task) {
        ctx.ui.notify("Usage: /plan <task>. For a persistent toggle, use /planmode on|off|status.", "warning");
        return;
      }

      oneShotPlanMode = true;
      ctx.ui.notify("Plan mode enabled for this request. Mutating tools will be blocked.", "info");
      pi.sendUserMessage(task);
    },
  });

  pi.registerCommand("planmode", {
    description: "Toggle persistent plan mode. Usage: /planmode on|off|status",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();

      if (value === "on") {
        persistentPlanMode = true;
        setPlanStatus(ctx);
        ctx.ui.notify("Persistent plan mode is on. Future prompts will plan only until /planmode off.", "info");
        return;
      }

      if (value === "off") {
        persistentPlanMode = false;
        oneShotPlanMode = false;
        setPlanStatus(ctx);
        ctx.ui.notify("Plan mode is off.", "info");
        return;
      }

      if (value === "" || value === "status") {
        ctx.ui.notify(
          `Plan mode status: ${persistentPlanMode ? "persistent on" : oneShotPlanMode ? "one-shot active" : "off"}.`,
          "info"
        );
        return;
      }

      ctx.ui.notify("Usage: /planmode on|off|status", "warning");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    setPlanStatus(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!isPlanModeActive()) return;

    ctx.ui.setWorkingMessage("Planning read-only…");
    return {
      systemPrompt: `${event.systemPrompt}\n\n${PLAN_MODE_PROMPT}`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (!isPlanModeActive()) return;

    if (event.toolName === "write" || event.toolName === "edit") {
      return {
        block: true,
        reason: "Plan mode is active: file modification tools are blocked until the user approves the plan.",
      };
    }

    if (event.toolName === "bash") {
      const input = event.input as { command?: unknown };
      const command = typeof input.command === "string" ? input.command : "";
      if (!isReadOnlyBash(command)) {
        return {
          block: true,
          reason: "Plan mode is active: only simple read-only shell commands are allowed until the user approves the plan.",
        };
      }
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (oneShotPlanMode) {
      oneShotPlanMode = false;
      ctx.ui.notify("One-shot plan mode complete. Reply with approval or changes.", "info");
    }
    ctx.ui.setWorkingMessage();
  });

  pi.on("session_shutdown", async () => {
    oneShotPlanMode = false;
  });
}
