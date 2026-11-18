# Global Pi agent instructions

## Run it yourself

- Don't ask me to run low- to no-risk invocations that you could just run yourself. If a command is reversible or read-only, or it is the next step of work I already asked for (e.g. `gh release create` once its CI check passes, `uv sync`, re-running a check), run it and report the result instead of handing me the command.
- Ask first only for things that are hard to undo or that I haven't asked for, and say why. Credentials or actions only I can perform (like a web UI sign-in) are the remaining exceptions.

## Opening pull requests

- When I ask for a PR, open it without asking me anything first. The PR is where review and revision happen. This overrides the question and approval steps in PR skills such as `create-ol-pull-request`: don't ask for the title, tickets, description, testing notes or draft status, and don't show the body or the final changes for confirmation before pushing.
- Write the title and body yourself from the conversation, commits and checks you ran. Use `N/A` for tickets unless one was mentioned, and open it ready for review unless I called it a work in progress.
- Still run the pre-submit checks (claim audit, independent review, secret scan), fix what they confirm, and then open the PR. Report findings you didn't fix in the PR body or your reply instead of stopping to ask. Stop only if the secret scan finds a real credential.

## Personal projects

- Personal projects generally live locally under `~/src/personal` and use GitHub repositories under the GitHub user `feoh`.
- For personal projects, commit and push the working branch; do not create or open a pull request unless I explicitly ask for a PR. A general request to continue autonomously or finish the work means push only.
- For SSH to hosts in personal homelab projects, do not block work on strict host-key verification. If a host key is unknown or has changed, remove the stale entry and update `known_hosts` with the current key, then continue. This is an owner-approved convenience policy for the personal homelab; do not apply it to work/organizational infrastructure or other users' systems.

## Homelab backups

- The homelab's off-site backup is ZFS replication: TrueNAS on `deepthought` recursively replicates the `nas_general` pool to the Hetzner auction server `thought.feoh.org`. Restic (including the Deepthought Restic/Backrest/B2 pilot) was a failed proof of concept. Never describe Restic as the backup strategy.
- Data is off-site only once it lands on a `nas_general` dataset (e.g. `/nas/archives`). Proxmox `local-lvm` VM disks are not replicated, so check how a guest's data reaches the NAS before calling local copies redundant.
- `nas_general` and its replication are unencrypted. Little Fedi's per-VM Restic job (`little-fedi-backup.service`, repo `/nas/archives/little-fedi`) is how its database and secrets reach the NAS encrypted. It is not the failed pilot. Keep it.

## TrueNAS administration

- Never call the deprecated TrueNAS REST API under `/api/v2.0`, including for one-off inspection or administration.
- For remote automation, use the supported JSON-RPC 2.0 WebSocket API at `/api/current` and follow the authentication method documented for the installed TrueNAS release. For approved one-off administration, prefer SSH plus NAS-local `midclt call`, which uses the supported middleware client.
- Never reuse SMB mount credentials for TrueNAS API authentication. Use a purpose-specific, least-privilege API credential when remote API access is required, and never expose credentials in command arguments, logs, responses, or session artifacts.

## Storing secrets in Vault

- When a secret needs to go into Vault, don't write it there directly (no `vault kv put`). Encrypt it into the repo's SOPS files with the `sops` command, and let the Pulumi stack write it to Vault (e.g. `read_yaml_secrets` plus `vault.generic.Secret` in ol-infrastructure).

## 1Password prompts at pi startup

- Pi startup should cost me at most one 1Password approval. Before adding or changing anything that calls `op` when pi or a session starts (MCP servers in `~/.pi/agent/mcp.json`, extensions, hooks, provider or settings keys), tell me how many extra prompts it adds and get my OK. Don't make the change without that OK.
- Pi starts stdio MCP servers as detached processes with no terminal, and 1Password ties CLI approval to the terminal. So every `op run ... -- <server>` wrapper asks for approval on its own.
- For an MCP secret, set the server's `env` value to `"!for op in /opt/homebrew/bin/op /usr/local/bin/op /usr/bin/op; do if [ -x $op ]; then exec $op read 'op://...'; fi; done; exit 127"` and run the server binary directly. The loop finds `op` on both macOS (Homebrew) and Linux, and `!` values run under `/bin/sh` without pi's `$VAR` interpolation. Pi runs `!` commands one after another inside its own terminal session, so the first approval covers the rest. Note that pi kills a `!` command after 10 seconds.
- Secrets fetched only when a tool is used (such as the web-search `perplexityApiKey`) don't count against the startup budget.

## Local experiments and branch comparison

- Always use `git worktree` rather than switching branches in my working checkout. Create throwaway worktrees outside the repo (e.g. `git worktree add /tmp/<repo>-<ref> <ref>`) and remove them with `git worktree remove` when done.
- Never use `git stash` to free up a dirty tree. Use a worktree instead.
- Note that per-worktree tooling state is not shared: a `uv` project needs its own `uv sync` in each worktree.
- Clean up in the same session as the mess: delete scratch files, tear down containers that were started for the task, and restore tooling state that was changed. Say so explicitly when something cannot be restored, and why.

## Waiting on long-running work

- Always ask yourself, "Is there anything else I can be working on while I wait?" Proactively continue independent, authorized work instead of idling when it is safe to do so; respect task dependencies and avoid interfering with work in progress.
- Never block a turn polling CI, deploys, or other long-running work (e.g. a `bash` loop of `sleep` + status checks). A running tool call stops the harness from accepting steering.
- Instead, delegate the wait to an async subagent that notifies the session on completion, or check once, report what's still pending, and return control.

## Subagents on claude-bridge models

- Run pi-subagents native children on `claude-bridge/*` models with `async: true`. Never pass `async: false` for them; foreground children fail prompt-capture (elidickinson/pi-claude-bridge#178). Avoid foreground-forcing options (clarify mode) on bridge models.
- Remove this section once pi-claude-bridge#178 is fixed.

## Link every pull request

- Every time you refer to a pull request in text the user reads, present it as a clickable link with its full URL (e.g. `https://github.com/mitodl/ol-infrastructure/pull/6307`). This covers every reply, not just summaries or reports, and repeat mentions of a PR already linked earlier. Never write a bare `PR 1903`, `#1903`, or `owner/repo#1903`. If you know the PR, you have its URL; making the user look it up wastes their time. Do the same for any issue that needs action, and for CI runs or jobs whose status you report.

## GitHub issues

- The GitHub CLI (`gh`) is available and should be used for GitHub issue work.
- Before reading or changing issues, verify authentication and repository access with `gh auth status` and/or an appropriate `gh repo view` command.
- I can list, read, create, edit, comment on, label, assign, close, and reopen issues using `gh issue ...` commands.
- For `mitodl` repositories, use the available `create-github-issue` skill when creating issues so the standard organization templates are followed.
- Never expose tokens or credentials in responses, commits, issue bodies, or comments.
