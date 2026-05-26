#!/usr/bin/env bash
# post-standup-comment.sh
# Posts a standup comment to a GitHub Discussions thread via the GraphQL API.
#
# Usage:
#   echo "<body>" | bash post-standup-comment.sh -d DISCUSSION_ID
#   bash post-standup-comment.sh -d DISCUSSION_ID -b "$(cat standup.md)"
#
# Options:
#   -d DISCUSSION_ID   GraphQL node ID of the discussion (required)
#   -b BODY            Comment body text; reads from stdin if omitted
#
# Output: URL of the newly created comment
# Requires: gh (authenticated), jq

set -euo pipefail

DISCUSSION_ID=""
BODY=""

while getopts "d:b:" opt; do
  case "$opt" in
    d) DISCUSSION_ID="$OPTARG" ;;
    b) BODY="$OPTARG" ;;
    *) echo "Usage: $0 -d DISCUSSION_ID [-b BODY]" >&2; exit 1 ;;
  esac
done

if [[ -z "$DISCUSSION_ID" ]]; then
  echo "Error: -d DISCUSSION_ID is required" >&2
  exit 1
fi

if [[ -z "$BODY" ]]; then
  BODY="$(cat)"
fi

if [[ -z "$BODY" ]]; then
  echo "Error: comment body is empty (pass -b or pipe via stdin)" >&2
  exit 1
fi

jq -n \
  --arg discussionId "$DISCUSSION_ID" \
  --arg body "$BODY" \
  --arg query '
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment { url }
      }
    }' \
  '{query: $query, variables: {discussionId: $discussionId, body: $body}}' \
| gh api graphql --input - \
| jq -r '.data.addDiscussionComment.comment.url'
