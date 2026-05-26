---
name: docker-uv-image-builds
description: >
  Build Docker images for Python services following team conventions. Use this
  skill when writing Dockerfiles, authoring CI image build pipelines, or adding
  a new service — covers mitodl image naming, git short-ref tags, relocatable uv
  venvs, and shared library handling.
license: BSD-3-Clause
metadata:
  category: containers
---

# Docker Image Builds for Python Services

## Image naming

Images follow the pattern: `mitodl/<service-name>`

The service name should match the application or code location name used elsewhere
in configuration (Helm values, Pulumi stacks, Concourse pipelines).

## Image tags

Tag images with the **git short ref** (7-character SHA):

```bash
GIT_TAG=$(git rev-parse --short HEAD)
docker build -t mitodl/${SERVICE_NAME}:${GIT_TAG} .
```

Do not use `latest` as a production tag.

## Python environment inside the image

Use a **relocatable** virtual environment so the venv works after Docker layer
assembly:

```dockerfile
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv venv --relocatable /app/.venv && \
    uv sync --frozen --no-dev
```

## Shared libraries

Install shared internal libraries (e.g. `ol-orchestrate-lib`) as **build-time**
dependencies — do **not** mount them as Docker volumes at runtime. Add them to
`pyproject.toml` and let `uv sync` install them during the image build.

## Build context & `.dockerignore`

Exclude development artifacts:

```
.venv/
__pycache__/
*.pyc
.git/
```

## Concourse CI integration

Concourse pipelines use `paths:` filters on git resources to trigger image
rebuilds only when relevant files change. When adding a new service, add its
path to the corresponding pipeline's git resource `paths` list.
