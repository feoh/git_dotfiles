# Global Pi agent instructions

## Personal projects

- Personal projects generally live locally under `~/src/personal` and use GitHub repositories under the GitHub user `feoh`.

## Local experiments and branch comparison

- Always use `git worktree` rather than switching branches in my working checkout. Create throwaway worktrees outside the repo (e.g. `git worktree add /tmp/<repo>-<ref> <ref>`) and remove them with `git worktree remove` when done.
- Never use `git stash` to free up a dirty tree. Use a worktree instead.
- Note that per-worktree tooling state is not shared: a `uv` project needs its own `uv sync` in each worktree.
- Clean up in the same session as the mess: delete scratch files, tear down containers that were started for the task, and restore tooling state that was changed. Say so explicitly when something cannot be restored, and why.

## GitHub issues

- The GitHub CLI (`gh`) is available and should be used for GitHub issue work.
- Before reading or changing issues, verify authentication and repository access with `gh auth status` and/or an appropriate `gh repo view` command.
- I can list, read, create, edit, comment on, label, assign, close, and reopen issues using `gh issue ...` commands.
- For `mitodl` repositories, use the available `create-github-issue` skill when creating issues so the standard organization templates are followed.
- Never expose tokens or credentials in responses, commits, issue bodies, or comments.
