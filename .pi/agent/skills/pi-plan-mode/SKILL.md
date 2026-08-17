---
name: pi-plan-mode
description: >
  Communicate the custom /plan and /planmode extension's controls correctly.
  Use whenever finishing a PLAN FINALIZE phase, when plan mode blocks a tool,
  or when the user asks how to finalize, exit, or implement after planning.
  Never describe /plan as a toggle or invent an unregistered shortcut.
license: BSD-3-Clause
metadata:
  category: workflow
---

# Custom Pi Plan Mode — Correct User Instructions

The active plan mode is the custom extension at
`~/.pi/agent/extensions/plan-mode.ts`, not pi's bundled example extension.
The bundled example has different controls and must not be used as the source
of truth.

## Actual lifecycle and controls

- `/plan <task>` starts a one-shot planning conversation. It does **not**
  toggle an active plan mode off. Without a task, it only shows usage help.
- `/planmode on` starts persistent planning across user turns.
- `/finalize [slug]` transitions from brainstorm to finalize and permits the
  agent to write one generated file under the current working directory's
  `.pi/plans/` directory. It does **not** exit plan mode.
- `/execute [additional instructions]` is available after `/finalize` has set
  the current plan path. It exits plan mode and immediately asks the agent to
  implement that finalized plan.
- `/planmode off` exits plan mode without starting implementation. It works in
  either brainstorm or finalize phase.
- `/planmode status` reports whether mode is off, one-shot, or persistent and
  whether the phase is brainstorm or finalize.
- This custom extension registers no plan-mode keyboard shortcut and shows no
  automatic "Execute the plan" selection prompt.

The extension also clears its in-memory plan state during session shutdown,
but `/reload`, session replacement, and quitting are lifecycle side effects,
not controls that should be recommended as ways to exit plan mode.

## What to tell the user

After finalizing a plan, say:

> The plan is saved, and plan mode is still active.
>
> - Run `/execute` to exit plan mode and start implementing the finalized plan.
> - Run `/planmode off` to exit plan mode without implementing it.

When a write or mutating command is blocked during brainstorm, say:

> Plan mode is active.
>
> - Run `/finalize` to write the agreed plan; this keeps plan mode active.
> - Run `/planmode off` to exit without finalizing.

Keep the slash commands verbatim. The agent cannot invoke an interactive slash
command on the user's behalf.

## Plan file behavior

`/finalize [slug]` creates a timestamped plan path of the form:

```text
.pi/plans/YYYYMMDD-HHMM-<slug>.md
```

The path is relative to the pi process's current working directory. During the
finalize phase, only that exact plan file may be written with `write` or
`edit`; other file modifications remain blocked. The extension does not
automatically create or maintain a repository-root `PLAN.md` mirror.

## What not to say

- Do not say `/plan` toggles or exits plan mode.
- Do not mention `Ctrl+Alt+P` or any other plan-mode shortcut.
- Do not claim that `/finalize` exits plan mode.
- Do not claim that pi will show an automatic "Execute the plan" prompt.
- Do not tell the user to type "go", "continue", "yes", or another free-text
  trigger to exit. Free text starts another agent turn under the same plan-mode
  restrictions.
- Do not recommend `/reload`, `/new`, `/resume`, or quitting as an exit method,
  even though session shutdown currently clears the extension's in-memory
  state.

## Reference

Source of truth:
`/home/feoh/.pi/agent/extensions/plan-mode.ts`

Pi's bundled example at
`examples/extensions/plan-mode/` intentionally uses different controls
(`/plan`, `Ctrl+Alt+P`, and an automatic execution picker). Do not copy its
instructions into responses about this custom extension.
