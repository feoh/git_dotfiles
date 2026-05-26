---
name: create-github-issue
description: >
  Create a GitHub issue in a mitodl repository using the organization's standard
  issue templates. Triggered by /olissue — prompts for repo, issue type, and
  fills in the appropriate template (Bug Report, Technical, Product, Design QA).
  Defaults the organization to mitodl.
license: BSD-3-Clause
triggers:
  - /olissue
metadata:
  category: process
---

# Create a GitHub Issue (`/olissue`)

When the user runs `/olissue`, guide them through creating a GitHub issue in a
`mitodl` repository using the org's standard issue templates.

## Default organization

Always default to **`mitodl`** unless the user explicitly names a different org.

## Step 1 — Gather required inputs

Ask the user (or infer from context) for:

| Field | Notes |
|-------|-------|
| **Repository** | e.g. `ol-django` — org is implied as `mitodl` |
| **Issue type** | See template menu below |
| **Title** | Short, imperative sentence |
| **Body details** | Specifics to fill into the chosen template |

If any field is missing, ask before proceeding.

## Step 2 — Choose a template

Present these four options and apply the matching template body:

| # | Name | Labels | Template file |
|---|------|--------|---------------|
| 1 | Bug Report | `bug` | [bug.md](#template-bug-report) |
| 2 | Technical Issue | _(none)_ | [default.md](#template-technical-issue) |
| 3 | Product Issue | _(none)_ | [product.md](#template-product-issue) |
| 4 | Design QA | `design QA` | [designQA.md](#template-design-qa) |

## Step 3 — Create the issue

Use the GitHub CLI to create the issue:

```bash
gh issue create \
  --repo mitodl/<repo> \
  --title "<title>" \
  --body "<filled-in template body>" \
  --label "<label>"   # omit if no label for this template type
```

Confirm the URL returned by `gh issue create` and share it with the user.

---

## Template: Bug Report

Labels: `bug`

```markdown
<!--- Provide a general summary of the issue in the Title above -->

### Expected Behavior
<!--- Explain what should happen -->


### Current Behavior
<!--- Describe what happens instead of the expected behavior -->


### Steps to Reproduce
<!--- Provide a link to a live example, or an unambiguous set of steps to -->
<!--- reproduce this bug. Include code to reproduce, if relevant -->
1.
2.
3.
4.

### Possible Solution
<!--- optional — delete if empty -->
<!--- Do you have any ideas how to fix this bug? -->


### Additional Details
<!--- optional — delete if empty -->
<!--- If there are additional details that are helpful for addressing this bug please add them here -->
```

---

## Template: Technical Issue

Labels: _(none)_

```markdown
### Description/Context
<!-- What needs to be done? What additional details are needed by the person who will do the work? -->


### Plan/Design
<!--- How do you plan to achieve the stated goals? --->
<!--- Include any design documents or visual mockups as relevant --->
```

---

## Template: Product Issue

Labels: _(none)_

```markdown
### User Story
<!-- Why does this need to be done? Who will it benefit and how? -->
- As a ..., I want to ..., so I can ...

### Description/Context
<!-- What needs to be done? What additional details are needed by the person who will do the work? -->


### Acceptance Criteria
<!-- What are the concrete outcomes that need to happen for this to be "done"? -->
- [ ]

### Plan/Design
<!--- How do you plan to achieve the stated goals? --->
<!--- Include any design documents or visual mockups as relevant --->
```

---

## Template: Design QA

Labels: `design QA`

```markdown
<!--- Title template: "Design QA: <Template/Section/Component> -->

### Relevant Links
<!--- Include Figma and/or relevant reference links -->


### Prioritized List of Issues
<!--- Provide a prioritized checklist of design feedback with relevant screenshots and details. Include indication of high, med, low priority from a design perspective -->
1. `high`
2. `high`
3. `med`
4. `low`

### Additional Details
<!--- optional — delete if empty -->
<!--- If there are additional details that are helpful for addressing the design feedback please add them here -->
```

---

## Tips

- Fill in the template sections with the user's details **before** calling
  `gh issue create`. Populated templates are more useful than placeholder text.
- Strip HTML comments (`<!-- ... -->`) from the final body to keep the issue clean.
- If the user provides a full `org/repo` slug, use it as-is instead of prepending `mitodl/`.
- For Design QA issues, remind the user to follow the title convention:
  `Design QA: <Template/Section/Component>`.
