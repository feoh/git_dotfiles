#!/usr/bin/env bash
# get-standup-context.sh
# Fetches GitHub activity for daily standup generation.
#
# Usage:
#   bash skills/process/generate-standup/scripts/get-standup-context.sh [OPTIONS]
#
# Options:
#   -t YYYY-MM-DD   "Today" date (default: today UTC)
#   -o ORGS         Comma-separated list of GitHub orgs to search
#                   (default: mitodl,openedx)
#
# Output: JSON — keys: meta, checkin_discussion, prs_authored, prs_reviewed,
#                       issues, rfc_discussions
#
#   meta.today      — the date the script was run
#   meta.yesterday  — previous weekday (Friday if today is Monday)
#   meta.tomorrow   — next weekday (Monday if today is Friday)
#   meta.since      — ISO timestamp: midnight UTC on meta.yesterday (fetch window start)
#
# Requires: gh (authenticated), jq

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

TODAY="$(date -u +%Y-%m-%d)"
ORGS="mitodl,openedx"

# ── Argument parsing ──────────────────────────────────────────────────────────

while getopts "t:o:" opt; do
	case "$opt" in
	t) TODAY="$OPTARG" ;;
	o) ORGS="$OPTARG" ;;
	*)
		echo "Usage: $0 [-t YYYY-MM-DD] [-o org1,org2]" >&2
		exit 1
		;;
	esac
done

# ── Weekday helpers ───────────────────────────────────────────────────────────

# Portable previous weekday (GNU date and BSD date compatible)
# Returns the most recent weekday before $TODAY (skips Saturday/Sunday).
_prev_weekday() {
	local ref="$1"
	local dow
	# %u: 1=Mon … 7=Sun
	dow="$(date -u -d "$ref" +%u 2>/dev/null || date -u -j -f "%Y-%m-%d" "$ref" +%u)"
	local offset
	case "$dow" in
	1) offset=3 ;; # Monday → Friday
	*) offset=1 ;;
	esac
	date -u -d "$ref -${offset} days" +%Y-%m-%d 2>/dev/null ||
		date -u -v-"${offset}"d -j -f "%Y-%m-%d" "$ref" +%Y-%m-%d
}

# Portable next weekday
_next_weekday() {
	local ref="$1"
	local dow
	dow="$(date -u -d "$ref" +%u 2>/dev/null || date -u -j -f "%Y-%m-%d" "$ref" +%u)"
	local offset
	case "$dow" in
	5) offset=3 ;; # Friday → Monday
	6) offset=2 ;; # Saturday → Monday (edge case)
	7) offset=1 ;; # Sunday → Monday (edge case)
	*) offset=1 ;;
	esac
	date -u -d "$ref +${offset} days" +%Y-%m-%d 2>/dev/null ||
		date -u -v+"${offset}"d -j -f "%Y-%m-%d" "$ref" +%Y-%m-%d
}

YESTERDAY="$(_prev_weekday "$TODAY")"
TOMORROW="$(_next_weekday "$TODAY")"

# Fetch window: midnight UTC on the previous weekday.
# Wide enough to catch all activity from yesterday and today.
SINCE="${YESTERDAY}T00:00:00Z"

USER_JSON="$(gh api user 2>/dev/null || echo '{}')"
USERNAME="$(jq -r '.login // empty' <<<"$USER_JSON")"
DISPLAY_NAME="$(jq -r '.name // empty' <<<"$USER_JSON")"
if [[ -z "$USERNAME" ]]; then
	echo "Error: could not detect GitHub username; run 'gh auth login' first" >&2
	exit 1
fi
if [[ -z "$DISPLAY_NAME" ]]; then
	DISPLAY_NAME="$USERNAME"
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

IFS=',' read -ra ORG_LIST <<<"$ORGS"

# Fetch PRs across all orgs for a given gh search flag, deduplicated by URL
_search_prs() {
	local flag="$1"
	local since="$2"
	(for org in "${ORG_LIST[@]}"; do
		gh search prs \
			"$flag" "$USERNAME" \
			--owner "$org" \
			--updated ">=${since%T*}" \
			--json number,title,state,url,updatedAt,isDraft \
			--limit 50 2>/dev/null || echo "[]"
	done) | jq -s 'add | unique_by(.url)'
}

# Fetch issues across all orgs involving the user, deduplicated by URL.
# Filters out bot-generated noise (Renovate, Dependabot).
_search_issues() {
	local since_date="${1%T*}"
	(for org in "${ORG_LIST[@]}"; do
		gh search issues "involves:$USERNAME" \
			--owner "$org" \
			--updated ">=${since_date}" \
			--json number,title,state,url,updatedAt,author \
			--limit 50 2>/dev/null || echo "[]"
	done) | jq -s 'add | unique_by(.url) | map(select(
    (.author.login? // "" | test("\\\\[bot\\\\]$|^renovate$|^dependabot$"; "i") | not) and
    (.title | test("^Dependency Dashboard$|^Renovate Dashboard|^Action Required: Fix Renovate"; "") | not)
  ))'
}

# Fetch RFC-category discussions from mitodl/hq created today by the user
_rfc_discussions() {
	gh api graphql -f query='
  query {
    repository(owner: "mitodl", name: "hq") {
      discussions(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          number title url createdAt
          author { login }
          category { name }
        }
      }
    }
  }' 2>/dev/null |
		jq --arg today "$TODAY" --arg username "$USERNAME" \
			'[.data.repository.discussions.nodes[]
        | select(.category.name == "RFC"
                 and (.createdAt | startswith($today))
                 and .author.login == $username)]' ||
		echo "[]"
}

# Fetch the most recent Check-ins discussion from mitodl/hq (post target)
_checkin_discussion() {
	local result
	result="$(gh api graphql -f query='
  query {
    repository(owner: "mitodl", name: "hq") {
      discussions(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          id number title url createdAt
          category { name }
        }
      }
    }
  }' \
		-q '[.data.repository.discussions.nodes[]
       | select(.category.name | ascii_downcase == "check-ins")] | first' \
		2>/dev/null || true)"
	echo "${result:-null}"
}

# ── Fetch ─────────────────────────────────────────────────────────────────────

echo "Fetching GitHub activity for @${USERNAME} (since=${SINCE}, today=${TODAY}) …" >&2

PRS_AUTHORED="$(_search_prs "--author" "$SINCE")"
PRS_REVIEWED="$(_search_prs "--reviewed-by" "$SINCE")"
ISSUES="$(_search_issues "$SINCE")"
RFC_DISCUSSIONS="$(_rfc_discussions)"
CHECKIN_DISCUSSION="$(_checkin_discussion)"

# ── Emit JSON ─────────────────────────────────────────────────────────────────

jq -n \
	--arg username "$USERNAME" \
	--arg display_name "$DISPLAY_NAME" \
	--arg today "$TODAY" \
	--arg yesterday "$YESTERDAY" \
	--arg tomorrow "$TOMORROW" \
	--arg since "$SINCE" \
	--argjson prs_authored "$PRS_AUTHORED" \
	--argjson prs_reviewed "$PRS_REVIEWED" \
	--argjson issues "$ISSUES" \
	--argjson rfc_discussions "$RFC_DISCUSSIONS" \
	--argjson checkin_discussion "$CHECKIN_DISCUSSION" \
	'{
    meta: {
      username:     $username,
      display_name: $display_name,
      today:        $today,
      yesterday:    $yesterday,
      tomorrow:     $tomorrow,
      since:        $since
    },
    checkin_discussion:  $checkin_discussion,
    prs_authored:        $prs_authored,
    prs_reviewed:        $prs_reviewed,
    issues:              $issues,
    rfc_discussions:     $rfc_discussions
  }'
