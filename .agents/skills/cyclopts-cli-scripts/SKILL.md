---
name: cyclopts-cli-scripts
description: >
  Write CLI scripts using the cyclopts framework. Use this skill when creating
  any command-line script or developer utility — place it in bin/ using cyclopts,
  not argparse, click, typer, or bare sys.argv.
license: BSD-3-Clause
metadata:
  category: python
---

# CLI Scripts with cyclopts

All command-line scripts in this codebase use the **`cyclopts`** framework.

## Framework

Use `cyclopts`, not `argparse`, `click`, `typer`, or bare `sys.argv`.

```python
import cyclopts

app = cyclopts.App()

@app.command
def my_command(arg1: str, flag: bool = False) -> None:
    """Brief description shown in --help."""
    ...

if __name__ == "__main__":
    app()
```

## Location

Place scripts in the `bin/` directory at the root of the relevant project or
repository. Do not place scripts in `src/`, `scripts/`, or ad-hoc locations.

## Naming

Use hyphen-separated names: `bin/migrate-assets`, `bin/sync-catalog`.

## Registering with uv

If the script should be runnable via `uv run <script-name>`, register it in
`pyproject.toml`:

```toml
[project.scripts]
my-script = "my_package.bin.my_script:app"
```

Or place the script directly in `bin/` and run it with:

```bash
uv run python bin/my-script
```
