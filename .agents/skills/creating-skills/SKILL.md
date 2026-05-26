---
name: creating-skills
description: >
  Create a new Agent Skill for this repository. Use this skill when asked to
  capture a workflow, convention, or repeated correction as a reusable skill —
  covers file naming, frontmatter fields, category placement, progressive
  disclosure, and updating the index.
license: BSD-3-Clause
metadata:
  category: workflow
---

# Creating a New Skill

Skills follow the [Agent Skills open standard](https://agentskills.io/specification).

## 1. Choose a category

Place the skill under the most specific matching category in `skills/`:

| Category | When to use |
|----------|-------------|
| `python/` | Python tooling, packaging, dependency management |
| `dagster/` | Dagster pipelines, code locations, `dg` usage |
| `infrastructure/` | Pulumi IaC, secrets, Vault, Kubernetes config |
| `containers/` | Docker builds, image conventions |
| `workflow/` | Cross-cutting process conventions; meta-skills |

If no category fits, create a new one and add a `README.md` for it.

## 2. Create the skill directory

The directory name becomes the skill's `name`. Use lowercase letters and hyphens only.

```
skills/<category>/<skill-name>/
└── SKILL.md
```

The `name` in `SKILL.md` frontmatter **must exactly match** the directory name.

## 3. Write SKILL.md

```markdown
---
name: <skill-name>           # must match directory name; max 64 chars
description: >               # what it does AND when to use it; max 1024 chars
  <one or two sentences describing the skill and the keywords/scenarios
  that should trigger it>
license: BSD-3-Clause
metadata:
  category: <category>
---

# Skill Title

...instructions...
```

### Description guidelines (most important field)

The description is what the agent uses to decide whether to activate the skill.
Make it trigger-friendly:

- State both **what** the skill covers and **when** to use it.
- Include the specific tool names, command names, or scenario keywords an agent
  would encounter when the skill is relevant.
- Bad: "Conventions for X." — too vague, won't trigger reliably.
- Good: "Apply X conventions. Use this skill when doing Y or Z — covers A, B, C."

## 4. Apply progressive disclosure

Keep `SKILL.md` under ~500 lines. If the skill has deep reference material
(e.g., a detailed API reference, form templates, domain-specific lookup tables),
move it to a `references/` subdirectory and link to it from `SKILL.md`:

```
<skill-name>/
├── SKILL.md
└── references/
    └── REFERENCE.md
```

In `SKILL.md`, reference the file by relative path:

```markdown
See [detailed reference](references/REFERENCE.md) for full option listings.
```

## 5. Update the indexes

After creating the skill, update two places:

1. **Category README** (`skills/<category>/README.md`) — add a row to the table.
2. **Top-level skills README** (`skills/README.md`) — add a row to the **All Skills** table.

## 6. Validate

```bash
# Check frontmatter is valid (if skills-ref is available)
npx skills-ref validate ./skills/<category>/<skill-name>
```

If `skills-ref` is not installed, manually verify:
- `name` matches the directory name
- `description` is non-empty and under 1024 characters
- `SKILL.md` is the correct filename (uppercase)
