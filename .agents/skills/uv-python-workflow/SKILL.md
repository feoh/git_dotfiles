---
name: uv-python-workflow
description: >
  Use uv as the exclusive Python package and environment manager. Use this skill
  when installing packages, syncing environments, running scripts, writing
  Dockerfiles, or doing any Python dependency management — never pip, pip-compile,
  or virtualenv directly.
license: BSD-3-Clause
metadata:
  category: python
---

# uv Python Workflow

All Python dependency and environment management in this codebase uses **`uv`** exclusively.

## Package management

- Add dependencies: `uv add <package>`
- Remove dependencies: `uv remove <package>`
- Install/sync the current project: `uv sync`
- Run a command inside the project environment: `uv run <command>`
- Never use `pip install`, `pip-compile`, or bare `python -m venv`.

## Workspace layout

Projects may be organized as a `uv` workspace. Code locations managed by `dg`
do **not** use `uv` workspaces — they rely on the `dg` workspace instead.

## Docker / container images

When building a Python app inside a Docker image, create a *relocatable* virtual
environment so it works after the image layers are assembled:

```dockerfile
RUN uv venv --relocatable /app/.venv
RUN uv sync --frozen --no-dev
```

Do **not** mount `ol-orchestrate-lib` (or any shared library) as a volume at
runtime. Shared libraries are installed as build-time dependencies only.

## Running pre-commit and type checks

```bash
uv run pre-commit run --all-files
uv run mypy <package>
```
