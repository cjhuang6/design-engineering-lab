#!/usr/bin/env bash
set -euo pipefail

FILE="${PROTECTED_FILE:-AGENTS.md}"

if git diff --quiet "$BASE...$HEAD" -- "$FILE"; then
  echo "$FILE is unchanged in this pull request."
  exit 0
fi

if [ "$ACTION" = "synchronize" ]; then
  if ! git cat-file -e "$BEFORE^{commit}" 2>/dev/null || ! git diff --quiet "$BEFORE" "$HEAD" -- "$FILE"; then
    gh api -X DELETE "repos/$REPO/issues/$PR/labels/$LABEL" >/dev/null 2>&1 || true
    echo "::error::$FILE changed in the latest push. $APPROVER must review the new diff and add the '$LABEL' label again."
    exit 1
  fi
fi

labels=$(gh api "repos/$REPO/issues/$PR/labels" --jq '.[].name')
if ! grep -qx "$LABEL" <<<"$labels"; then
  echo "::error::This pull request changes $FILE. $APPROVER must review the diff and add the '$LABEL' label."
  exit 1
fi

added_by=$(gh api --paginate "repos/$REPO/issues/$PR/events" \
  --jq ".[] | select(.event == \"labeled\" and .label.name == \"$LABEL\") | .actor.login" | tail -n 1)
if [ "$added_by" != "$APPROVER" ]; then
  echo "::error::The '$LABEL' label was added by '${added_by:-unknown}', not $APPROVER."
  exit 1
fi

echo "$FILE change approved by $APPROVER."
