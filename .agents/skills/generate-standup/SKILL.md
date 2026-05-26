---
name: generate-standup
description: >
  Generates a daily standup post from GitHub activity and agent session
  history, and posts it to the mitodl/hq Check-ins discussion. Use when asked
  to write, generate, or post a daily standup — fetches PR, issue, and
  code-review activity via the gh CLI, queries recent agent sessions, asks
  clarifying questions about timing and off-GitHub work, renders the standup
  in the team's standard format, and posts it as a discussion comment with
  user confirmation.
license: BSD-3-Clause
metadata:
  category: process
---

# Generate Daily Standup

Produces a daily standup post from live GitHub activity and optionally posts it
to the `mitodl/hq` Check-ins discussion.

**Requires:** `gh` (authenticated) and `jq`.

---

## Step 1 — Fetch GitHub context

Run the bundled context script **before asking any questions**:

```bash
bash skills/process/generate-standup/scripts/get-standup-context.sh [-t YYYY-MM-DD] [-o org1,org2]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-t` | "Today" date (`YYYY-MM-DD`) | today (UTC) |
| `-o` | Comma-separated orgs to search | `mitodl,openedx` |

The script outputs a JSON object:

```json
{
  "meta": { "username", "today", "yesterday", "tomorrow", "since" },
  "checkin_discussion": { "id", "number", "title", "url", "createdAt" },
  "prs_authored":    [...],
  "prs_reviewed":    [...],
  "issues":          [...],
  "rfc_discussions": [...]
}
```

- `meta.yesterday` is the previous weekday (Friday if today is Monday).
- `meta.tomorrow` is the next weekday (Monday if today is Friday).
- `meta.since` is midnight UTC on `meta.yesterday` — the fetch window start.
- `checkin_discussion` is the most recent Check-ins discussion in `mitodl/hq`.
  Keep its `id` (GraphQL node ID) and `url` for Steps 4–5.
- Do **not** infer or fabricate activity beyond what the script returns.

---

## Step 1b — Query agent session history

Using the `sql` tool (`database: "session_store"`), fetch agent sessions
active since `meta.since`:

```sql
SELECT
  s.id,
  s.repository,
  s.branch,
  s.summary,
  s.created_at,
  s.updated_at,
  c.title        AS checkpoint_title,
  c.overview     AS checkpoint_overview,
  c.work_done    AS checkpoint_work_done
FROM sessions s
LEFT JOIN checkpoints c ON c.session_id = s.id
WHERE s.updated_at >= '<meta.since>'
ORDER BY s.updated_at DESC
```

For sessions with **no checkpoints**, fetch the first user turn as a fallback:

```sql
SELECT s.id, s.repository, s.branch, t.user_message
FROM sessions s
JOIN turns t ON t.session_id = s.id AND t.turn_index = 0
WHERE s.updated_at >= '<meta.since>'
  AND NOT EXISTS (SELECT 1 FROM checkpoints c WHERE c.session_id = s.id)
ORDER BY s.updated_at DESC
```

**Summarization rules:**

| Evidence available | Action |
|--------------------|--------|
| Checkpoint with `work_done` / `overview` | Use as session summary |
| No checkpoint; has repo + branch + concrete first turn | Derive brief summary from repo/branch + turn intent |
| No checkpoint; NULL repo or trivial/meta prompt | Skip |
| Session is for generating this standup | Skip |

Store the resulting list of session summaries; use in Steps 3–4 to enrich
GitHub-derived bullets and fill in non-GitHub work.

---

## Step 2 — Ask clarifying questions

Use a **single `ask_user` call** with all fields at once.

First, identify **session-only work** from Step 1b (sessions with `repository:
null` or whose repository doesn't appear in `prs_authored`). Format them as a
short suggestion list for the `off_github` field description.

The most important field is `timing` — it controls the section headers and
which date's activity is treated as "done" work:

```json
{
  "timing": {
    "type": "string",
    "title": "When are you posting?",
    "enum": ["EOD — reporting today's work (today/tomorrow headers)",
             "BOD — reporting yesterday's work (yesterday/today headers)"],
    "description": "EOD: post at end of your work day; yesterday section covers today's date (meta.today). BOD: post at start of your work day; yesterday section covers meta.yesterday."
  },
  "blockers": {
    "type": "string",
    "title": "Blockers",
    "description": "Are you blocked on anything? Include a link and the @handle of whoever needs to unblock you. Leave blank if none."
  },
  "announcements": {
    "type": "string",
    "title": "Announcements",
    "description": "Anything to announce not in GitHub? (OOO, special review requests, schedule changes, etc.) Leave blank if none."
  },
  "off_github": {
    "type": "string",
    "title": "Off-GitHub work",
    "description": "Meetings, planning, research, design, or other work that won't appear in GitHub. Leave blank if none.\n\nPossible session-only work detected:\n<bullet list of session-only summaries, or 'none detected'>"
  }
}
```

---

## Step 3 — Classify activity

From the user's `timing` answer, determine:

| Timing | `report_date` (done work) | `planned_date` (next work) | Past header | Future header |
|--------|--------------------------|---------------------------|-------------|---------------|
| EOD    | `meta.today`             | `meta.tomorrow`           | `What did I work on today?` | `What am I working on tomorrow?` |
| BOD    | `meta.yesterday`         | `meta.today`              | `What did I work on yesterday?` | `What am I working on today?` |

**Bucketing rules:**

- **Done (past section):** Any PR or issue with `updatedAt` or `mergedAt`
  on `report_date`. Include both merged and still-open items that were
  actively worked on that day.
- **Planned (future section):** Open PRs and issues the user is continuing,
  plus anything explicitly stated in user answers. Omit items with no
  `updatedAt` since `meta.since` (stale).
- **Announcements:** PRs authored by the user that are still open and need
  human review (exclude bots: Copilot, Gemini, Renovate, Dependabot, Sentry).
  Also include RFC discussions created today, blockers, and OOO info.
- **Deduplication:** A PR in both `prs_authored` and `prs_reviewed` → list
  once under the most relevant bucket.

**Incorporating agent sessions:**

- If a session maps to a PR/issue already in the GitHub data, enrich that
  bullet with context from the session summary — do not create a duplicate.
- If a session represents work with no GitHub artifact, add it as its own
  bullet under done or planned based on `updated_at` vs `report_date`.

---

## Step 4 — Render the standup

Use `meta.username` (the GitHub login) as the name.

```markdown
<Display Name>

> Standup announcements

- <item>

> <past header>

- <item>

> <future header>

- <item>
```

**Formatting rules:**

- **Empty sections:** write `- None`, never omit the section header.
- **Blockers** go in announcements as a bullet; tag with `@handle` and link.
- **Links:** raw GitHub URLs are fine; markdown `[text](url)` formatting is
  also fine — match what feels natural for the content. Don't force one style.
- **Level of detail:** match what the data supports. If a PR/issue title is
  self-explanatory, a bare link is sufficient. Add a brief description only
  when context genuinely helps (e.g., the PR title doesn't convey purpose, or
  the work involved investigation/discussion not captured in a link).
- **Do not impose narrative style:** some people post links; some post prose;
  both are correct. Let the available data guide the output.
- **Do not group PRs** across repos into parent bullets unless the user
  explicitly works across many repos on the same thing and grouping is clearly
  cleaner — default to separate bullets.
- **Planned section** should reflect what's actually next, not a mechanical
  list of every open PR. Omit items the user is clearly done with.

---

## Step 5 — Confirm and post

Display the rendered standup, then use `ask_user` to confirm:

```json
{
  "action": {
    "type": "string",
    "title": "Post this standup?",
    "enum": ["Post it", "Edit first", "Cancel"],
    "description": "Post as a comment on <title> (<checkin_discussion.url>), make edits, or cancel."
  }
}
```

**Do not post unless the user selects "Post it".**

On confirmation, post using the bundled script:

```bash
echo "<rendered standup>" \
  | bash skills/process/generate-standup/scripts/post-standup-comment.sh \
      -d "<checkin_discussion.id>"
```

The script prints the comment URL on success.

---

## Example output (EOD, link-primary style)

```markdown
Anna G

> Standup announcements

- https://github.com/mitodl/mitxonline/pull/3600 needs review

> What did I work on today?

- worked on https://github.com/mitodl/mitxonline/pull/3600
- updated UI and fixed tests https://github.com/mitodl/mit-learn/pull/3346, received review

> What am I working on tomorrow?

- address feedback https://github.com/mitodl/mit-learn/pull/3346
- resolve https://github.com/mitodl/hq/issues/11440
```

## Example output (BOD, narrative style)

```markdown
Tobias Macey

> Standup announcements

- PRs needing review:
  - [ol-infrastructure #4659: add Archive/Deep Archive access tier support to OLBucket](https://github.com/mitodl/ol-infrastructure/pull/4659)
  - [ol-data-platform #2238: automate Iceberg table maintenance across the lakehouse](https://github.com/mitodl/ol-data-platform/pull/2238)

> What did I work on yesterday?

- Worked on addressing the hanging open issue for Dagster assets using Polars to read Iceberg tables
- Opened https://github.com/mitodl/ol-infrastructure/pull/4659 for S3 cost optimization

> What am I working on today?

- Finish fixing the Polars/Iceberg hang in Dagster
- Test the Concourse release workflow end to end
- Wrap up self assessment
```

## Example output (ambiguous timing, hybrid style)

```markdown
Sar

> Standup announcements

- None

> What did I work on yesterday/today?

- Wrote and deployed https://github.com/mitodl/ol-infrastructure/pull/4658
- Continued investigating SCIM sync failures — updates are reaching Keycloak
  logs but not propagating to Learn/MITx Online; restarting Keycloak temporarily
  restores sync, root cause still unknown

> What am I working on today/tomorrow?

- Continue digging into the SCIM update issue
```

---

See [context script](scripts/get-standup-context.sh) for the GitHub
data-fetching implementation and [post script](scripts/post-standup-comment.sh)
for the comment posting implementation.
