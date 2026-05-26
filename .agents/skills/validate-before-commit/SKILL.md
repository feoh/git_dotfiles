---
name: validate-before-commit
description: >
  Run the full validation sequence before declaring any task done. Use this skill
  proactively after any code or infrastructure change — run pre-commit, mypy, and
  pulumi preview (where applicable) without waiting to be asked. Never declare
  success without passing checks.
license: BSD-3-Clause
metadata:
  category: workflow
---

# Validate Before Commit

**Do not declare a task done until the full validation sequence has passed.**
Run these checks proactively — do not wait for the human to ask.

## Standard sequence

```bash
# 1. Linting, formatting, and basic static checks
uv run pre-commit run --all-files

# 2. Type checking
uv run mypy <package_or_src_dir>

# 3. Infrastructure plan (if Pulumi files were changed)
pulumi preview --stack <stack-name>
```

## Rules

- Run pre-commit **before** mypy; pre-commit may auto-fix formatting that would
  otherwise produce mypy noise.
- If pre-commit auto-fixes files, stage the changes and re-run pre-commit to
  confirm all hooks pass cleanly.
- mypy errors are blocking — do not leave type errors for the human to clean up.
- `pulumi preview` output must be reviewed: unexpected replacements or deletions
  are bugs, not acceptable side effects.

## For Dagster / dg changes

After modifying assets, sensors, or code location structure, also confirm the
workspace loads cleanly:

```bash
dg check
```

## Interpreting failures

Read the full error output before proposing a fix. Do not apply a speculative
patch without understanding the root cause — iterating blindly on the same error
multiple times is worse than pausing to diagnose.
