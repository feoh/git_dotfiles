---
name: pi-plan-mode
description: >
  Communicate pi's plan-mode controls correctly to the user. Use this skill
  whenever finishing a PLAN FINALIZE phase, when the harness blocks a tool
  call with "Plan mode is active", or when the user asks how to start
  implementing after a plan. Also preserve finalized plans in both
  `~/.pi/plans/` and, when available, the current project's GitHub-backed
  repository. Never invent custom triggers like "type go" or "say continue"
  — pi has specific built-in controls and the agent cannot exit plan mode
  from inside a turn.
license: BSD-3-Clause
metadata:
  category: workflow
---

# Pi Plan Mode — Correct User Instructions

Pi's plan mode is provided by the built-in `plan-mode` extension. It
restricts the agent to read-only tools and a bash allowlist. While plan
mode is active, any write/edit call and most mutating bash commands
(including innocuous-looking ones like `node --version` if the heuristic
flags them) will be rejected with:

> Plan mode is active: this command appears to mutate the filesystem,
> packages, or external state. Use read-only commands only.

Additionally, the FINALIZE sub-phase only permits writes to the single
plan file under `.pi/plans/`. Even creating skills or other files is
blocked until plan mode is toggled off.

## Plan file persistence

When finalizing a plan:

1. **Always** write the canonical plan file under `~/.pi/plans/` (or the
   workspace-local `.pi/plans/` path the user requested) during FINALIZE.
2. If the current project lives in a Git repository that has a GitHub
   remote, also keep a repo copy at the repository root as `PLAN.md`.
3. If plan mode restrictions prevent writing `PLAN.md` during FINALIZE,
   tell the user the canonical plan is saved and create/update the repo
   copy immediately after plan mode is exited or during the next writable
   turn.
4. If no project GitHub repository exists, skip the repo copy.

This means the canonical plan location is still `.pi/plans/...`, while the
repository copy is a convenience mirror for project-local visibility.

**The agent cannot exit plan mode from inside a turn.** Only the user can
toggle it, via pi's UI.

## What to tell the user

When you have just finalized a plan, or when a tool call is blocked by
plan mode, tell the user *exactly* this (adapt wording, keep the controls
verbatim):

> To start implementing, exit plan mode using one of:
>
> - `/plan` — slash command to toggle plan mode off
> - `Ctrl+Alt+P` — keybinding for the same toggle
> - If pi shows an "Execute the plan" prompt after the `Plan:` block,
>   selecting that option also exits plan mode
>
> Once the status bar no longer shows PLAN, re-issue your request and
> I'll proceed.

## What NOT to do

- **Do not** tell the user to "type go", "say continue", "reply yes", or
  any other free-text trigger. None of these do anything in pi; they only
  produce another user turn that is still subject to plan-mode
  restrictions.
- **Do not** attempt to run a write or mutating bash command "just to
  check" — it will be blocked and waste a turn.
- **Do not** try to write the repository mirror (`PLAN.md`) during FINALIZE
  if plan mode only permits the `.pi/plans/...` write. Save the canonical
  plan first, then mirror it in a later writable turn.
- **Do not** claim a command is read-only to bypass the heuristic. If a
  command is blocked, accept it and surface the blockage to the user.

## Reference

The plan-mode extension lives at:
`/home/feoh/.volta/tools/image/packages/@earendil-works/pi-coding-agent/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/plan-mode/README.md`

It documents the toggles (`/plan`, `Ctrl+Alt+P`), the read-only tool set
(read, bash, grep, find, ls, question), and the bash allowlist. Consult
it if the user reports unexpected blocking behavior.
