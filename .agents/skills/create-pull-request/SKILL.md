---
name: create-pull-request
description: >
  Create a pull request in a mitodl GitHub repository using the org's standard
  PR template. Triggered by /olpr or whenever the user asks to open a pull
  request in a repo whose remote is under the mitodl GitHub organization.
  Guides branch inspection, title/body population, and gh pr create invocation.
license: BSD-3-Clause
triggers:
  - /olpr
metadata:
  category: process
---

# Create a Pull Request (`/olpr`)

When the user runs `/olpr`, or asks to open a pull request in a repo with a
`mitodl` remote, guide them through creating a PR using the org's standard
pull request template.

## Auto-detection

This skill should activate automatically (without `/olpr`) when:

- The user says "create a PR", "open a pull request", "submit a PR", etc., **and**
- The current repo has a remote URL containing `github.com/mitodl/` (verify with
  `git remote -v`).

## Step 1 — Inspect the branch and diff

Before prompting the user, gather context automatically:

```bash
# Confirm current branch and its upstream
git --no-pager branch --show-current
git --no-pager log --oneline origin/HEAD..HEAD

# Check for an existing open PR on this branch
gh pr view --json url,title,state 2>/dev/null
```

- If an open PR already exists for the branch, share its URL and stop —
  do not create a duplicate.
- If there are no commits ahead of the base, warn the user before proceeding.

## Step 2 — Determine the base branch

Default to the repo's default branch (usually `main`). Override if the user
specifies a different target.

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

## Step 3 — Gather PR metadata

Collect or infer:

| Field | How to obtain |
|-------|---------------|
| **Title** | Ask the user, or suggest one derived from the branch name / commit messages |
| **Linked tickets** | Ask the user for issue numbers (Closes #, Fixes #, or N/A) |
| **Description** | Ask what the PR does; summarise from commits if the user says "summarise" |
| **Screenshots** | Ask if UI changes are present; skip section if not applicable |
| **Testing notes** | Ask how the changes were tested and how a reviewer can validate |
| **Additional context** | Ask for reviewer notes, caveats, or checklist items; skip if none |
| **Draft?** | Ask if this should be a draft PR (default: no) |

## Step 4 — Populate the template

Fill in the standard PR template below with the gathered information.
Strip HTML comments before passing to `gh pr create`.

```markdown
### What are the relevant tickets?
<!-- Closes #<n> | Fixes #<n> | N/A -->

### Description (What does it do?)
<description>

### Screenshots (if appropriate):
<screenshot checklist, or delete section if not applicable>

### How can this be tested?
<testing instructions>

### Additional Context
<reviewer notes, or delete section if not applicable>
```

Checklist section (uncomment and populate **only** if there are pre-merge steps):

```markdown
### Checklist:
- [ ] <step>
```

## Step 5 — Create the PR

```bash
gh pr create \
  --repo mitodl/<repo> \
  --base <base-branch> \
  --title "<title>" \
  --body "<filled-in body>" \
  [--draft]
```

Confirm the PR URL returned by `gh pr create` and share it with the user.

---

## Full PR template (reference)

> Source: https://github.com/mitodl/.github/blob/main/.github/pull_request_template.md

```markdown
### What are the relevant tickets?
<!--- If it fixes an open issue, please link to the issue here. -->
<!--- Closes # --->
<!--- Fixes # --->
<!--- N/A --->

### Description (What does it do?)
<!--- Describe your changes in detail -->

### Screenshots (if appropriate):
<!--- optional - delete if empty --->
- [ ] Desktop screenshots
- [ ] Mobile width screenshots

### How can this be tested?
<!---
Please describe in detail how your changes have been tested.
Include details of your testing environment, any set-up required
(e.g. data entry required for validation) and the tests you ran to
see how your change affects other areas of the code, etc.
Please also include instructions for how your reviewer can validate your changes.
--->

### Additional Context
<!--- optional - delete if empty --->
<!--- Please add any reviewer questions, details worth noting, etc. that will help in
assessing this change.  --->


<!--- Uncomment and add steps to be completed before merging this PR if necessary
### Checklist:
- [ ] e.g. Update secret values in Vault before merging
--->
```

---

## Tips

- **Summarise from commits**: if the user asks you to write the description,
  run `git --no-pager log --oneline origin/HEAD..HEAD` and synthesise a
  concise summary from the commit messages.
- **Strip comments**: remove all `<!-- ... -->` blocks from the body before
  calling `gh pr create` to keep the PR clean.
- **Screenshots**: only include the Screenshots section when the PR touches UI
  code. Ask the user to attach images after the PR is created if needed.
- **Checklist**: only uncomment and use the Checklist section when there are
  explicit pre-merge steps (e.g. Vault secret updates, migration runs). Leave
  it out otherwise.
- **Draft PRs**: suggest `--draft` if the branch is a work-in-progress or the
  user mentions it isn't ready for review.
