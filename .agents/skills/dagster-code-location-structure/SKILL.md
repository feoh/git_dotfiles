---
name: dagster-code-location-structure
description: >
  Structure and organize Dagster code locations using dg. Use this skill when
  creating or migrating code locations, placing assets or sensors in the correct
  location, scaffolding new dg projects, or setting up the dg_projects/ workspace
  layout.
license: BSD-3-Clause
metadata:
  category: dagster
---

# Dagster Code Location Structure

## Project layout

Code locations live under `dg_projects/` as separate subdirectories, each managed
by `dg`. Shared code (base classes, utilities, sensors used by multiple locations)
lives in `packages/ol-orchestrate-lib/`.

```
dg_projects/
  <code_location_name>/
    pyproject.toml
    src/
      <code_location_name>/
        assets/
        sensors/
        ...
packages/
  ol-orchestrate-lib/
    ...
```

## Scaffolding new code locations

Use the `create-dagster` tool to scaffold new code locations — **not** `dg scaffold`:

```bash
create-dagster <code_location_name>
```

## Asset and sensor placement

Assets and sensors must be placed in the code location that owns them. Do not
accidentally include an asset or sensor from one code location in another.
When migrating or moving definitions, double-check `defs.py` / `__init__.py`
imports in *each* code location.

## Migration sequencing

When migrating multiple code locations (e.g., from EC2/docker-compose to
Kubernetes), **do one code location at a time**. The first location becomes the
validated template. Never try to migrate all locations in a single PR.

## Shared OAuth / base classes

The `oauth` module inside `ol-orchestrate-lib` is used as a base class by
multiple code locations. It must remain in the library even if it looks unused
from a single code location's perspective.

## Checking partitions

Static partitions with hardcoded values are the *old* approach. Prefer
dynamic/time-based partitions when an up-to-date implementation already exists
in another code location — copy that pattern rather than the older one.
