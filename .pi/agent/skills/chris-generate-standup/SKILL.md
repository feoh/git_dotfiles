---
name: chris-generate-standup
description: >
  Augments the generate-standup workflow for Chris by automatically including
  Todoist tasks completed today from the MIT project in the standup write-up.
  Use this skill when Chris asks to write, generate, or post a daily standup,
  especially when Todoist, MIT project tasks, or completed tasks should be
  reflected alongside GitHub and agent-session activity.
license: BSD-3-Clause
metadata:
  category: process
---

# Chris Generate Standup

This is a companion skill for `generate-standup`. It does **not** replace the
base workflow; it adds Chris-specific Todoist context.

## Required base skill

When this skill is used, also load and follow the original `generate-standup`
skill. Apply the additions below while otherwise preserving the base workflow,
including GitHub context gathering, agent session history, user confirmation,
and posting behavior.

## Additional requirement: include Todoist MIT completions

Before rendering the final standup, automatically fetch Todoist tasks that were
completed **today** under the Todoist project named `MIT`, and incorporate them
into the write-up.

### How to fetch Todoist context

Use the Todoist MCP server if available:

1. Connect to the Todoist MCP server:

   ```js
   mcp({ connect: "todoist" })
   ```

2. If tool names are not already known, inspect/search the server tools:

   ```js
   mcp({ server: "todoist" })
   mcp({ search: "project", server: "todoist" })
   mcp({ search: "completed", server: "todoist" })
   ```

3. Find the Todoist project whose name is exactly `MIT`.
4. Fetch tasks/items completed today in that project.
   - Use Chris's local/current date for "today" unless the base
     `generate-standup` context has already established `meta.today`; in that
     case use `meta.today`.
   - Include tasks completed from local midnight through the current time.
   - Exclude tasks from other projects.
   - If subtasks are returned, include them when they are completed today and
     belong to the MIT project or a task within it.

If the Todoist MCP server cannot be reached or does not expose completed-task
history, do **not** silently ignore the failure. Mention that Todoist completed
MIT tasks could not be fetched and ask Chris whether to proceed without them or
provide the completed tasks manually.

### How to incorporate Todoist tasks

- Add Todoist-completed MIT tasks to the completed-work section of the standup.
- For EOD standups, this is normally `What did I work on today?`.
- For BOD standups, still include tasks completed on `meta.today` if any were
  found, but phrase carefully so they are not mistaken for yesterday's work;
  either add them to the current-day section or ask Chris how to classify them
  if the placement is ambiguous.
- Deduplicate against GitHub/agent-session bullets. If a Todoist task clearly
  corresponds to an already listed PR, issue, incident, or session, enrich that
  existing bullet instead of adding a duplicate.
- Preserve Todoist task wording when it is concise and human-readable.
- Do not include Todoist IDs unless they are useful links. Prefer task content
  or task links when available.
- If no MIT tasks were completed today, do not add a Todoist-specific bullet;
  continue with the normal `generate-standup` workflow.

### Suggested wording

For multiple standalone Todoist completions, a natural grouped bullet is often
best:

```markdown
- Completed MIT Todoist tasks:
  - <task content>
  - <task content>
```

For one task, prefer a normal work bullet:

```markdown
- <task content>
```

Avoid mechanical wording like `Todoist task completed: ...` unless the task text
needs that context.
