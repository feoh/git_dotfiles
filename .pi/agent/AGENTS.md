# Global Pi agent instructions

## Run it yourself

- Don't ask me to run low- to no-risk invocations that you could just run yourself. If a command is reversible or read-only, or it is the next step of work I already asked for (e.g. `gh release create` once its CI check passes, `uv sync`, re-running a check), run it and report the result instead of handing me the command.
- Ask first only for things that are hard to undo or that I haven't asked for, and say why. Credentials or actions only I can perform (like a web UI sign-in) are the remaining exceptions.

## Personal projects

- Personal projects generally live locally under `~/src/personal` and use GitHub repositories under the GitHub user `feoh`.
- For SSH to hosts in personal homelab projects, do not block work on strict host-key verification. If a host key is unknown or has changed, remove the stale entry and update `known_hosts` with the current key, then continue. This is an owner-approved convenience policy for the personal homelab; do not apply it to work/organizational infrastructure or other users' systems.

## TrueNAS administration

- Never call the deprecated TrueNAS REST API under `/api/v2.0`, including for one-off inspection or administration.
- For remote automation, use the supported JSON-RPC 2.0 WebSocket API at `/api/current` and follow the authentication method documented for the installed TrueNAS release. For approved one-off administration, prefer SSH plus NAS-local `midclt call`, which uses the supported middleware client.
- Never reuse SMB mount credentials for TrueNAS API authentication. Use a purpose-specific, least-privilege API credential when remote API access is required, and never expose credentials in command arguments, logs, responses, or session artifacts.

## Storing secrets in Vault

- When a secret needs to go into Vault, don't write it there directly (no `vault kv put`). Encrypt it into the repo's SOPS files with the `sops` command, and let the Pulumi stack write it to Vault (e.g. `read_yaml_secrets` plus `vault.generic.Secret` in ol-infrastructure).

## Local experiments and branch comparison

- Always use `git worktree` rather than switching branches in my working checkout. Create throwaway worktrees outside the repo (e.g. `git worktree add /tmp/<repo>-<ref> <ref>`) and remove them with `git worktree remove` when done.
- Never use `git stash` to free up a dirty tree. Use a worktree instead.
- Note that per-worktree tooling state is not shared: a `uv` project needs its own `uv sync` in each worktree.
- Clean up in the same session as the mess: delete scratch files, tear down containers that were started for the task, and restore tooling state that was changed. Say so explicitly when something cannot be restored, and why.

## Waiting on long-running work

- Never block a turn polling CI, deploys, or other long-running work (e.g. a `bash` loop of `sleep` + status checks). A running tool call stops the harness from accepting steering.
- Instead, delegate the wait to an async subagent that notifies the session on completion, or check once, report what's still pending, and return control.

## Subagents on claude-bridge models

- Run pi-subagents native children on `claude-bridge/*` models with `async: true`. Never pass `async: false` for them; foreground children fail prompt-capture (elidickinson/pi-claude-bridge#178). Avoid foreground-forcing options (clarify mode) on bridge models.
- Remove this section once pi-claude-bridge#178 is fixed.

## Pull requests in summaries

- Whenever a summary or report mentions a pull request, give its full clickable URL (e.g. `https://github.com/mitodl/ol-infrastructure/pull/6307`), not a bare `owner/repo#N` or `#N`. PRs exist for human review, and the user needs to be able to open and share them in one click. Do the same for any issue that needs action.

## GitHub issues

- The GitHub CLI (`gh`) is available and should be used for GitHub issue work.
- Before reading or changing issues, verify authentication and repository access with `gh auth status` and/or an appropriate `gh repo view` command.
- I can list, read, create, edit, comment on, label, assign, close, and reopen issues using `gh issue ...` commands.
- For `mitodl` repositories, use the available `create-github-issue` skill when creating issues so the standard organization templates are followed.
- Never expose tokens or credentials in responses, commits, issue bodies, or comments.
