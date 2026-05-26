---
name: pulumi-modify-existing
description: >
  Modify existing Pulumi infrastructure stacks safely. Use this skill when making
  any Pulumi IaC changes — always edit the existing stack entrypoint, never create
  new files, preserve assumeRole and cross-account configuration, and validate with
  pulumi preview before finishing.
license: BSD-3-Clause
metadata:
  category: infrastructure
---

# Pulumi: Modify Existing Files

## Always modify, never create

Infrastructure changes belong in the **existing** entrypoint for the stack
(typically `__main__.py`). Do not create additional Pulumi files unless the stack
already follows a multi-file pattern that makes a new file the right fit.

## Preserve existing functionality

When editing a Pulumi stack entrypoint, the following must **never** be silently
removed:

- **`assumeRole` / cross-account role configuration** — removing this breaks
  production deployments that depend on cross-account access.
- Existing resource exports (`pulumi.export(...)`).
- Stack references to other stacks.

Before finalizing changes, scan the diff to confirm nothing was deleted
unintentionally.

## Validate changes before declaring done

After modifying any Pulumi code, run a preview to confirm the plan is correct:

```bash
pulumi preview --stack <stack-name>
```

Review the output carefully:
- Unexpected resource **replacements** or **deletions** are bugs, not acceptable
  side effects.
- "0 changes" is only correct if you genuinely expected no changes.
