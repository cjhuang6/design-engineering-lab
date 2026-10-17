#!/usr/bin/env bash
set -euo pipefail

FILE="AGENTS.md"

fail() {
  echo "::error::$1"
  exit 1
}

git cat-file -e "$BASE^{commit}" 2>/dev/null || fail "Base commit $BASE is unavailable, so approval can't be established."
git cat-file -e "$HEAD^{commit}" 2>/dev/null || fail "Head commit $HEAD is unavailable (a newer push may have replaced it), so approval can't be established."

if git diff --quiet "$BASE...$HEAD" -- "$FILE"; then
  echo "$FILE is unchanged in this pull request."
  exit 0
fi

if version=$(git rev-parse --verify --quiet "$HEAD:$FILE"); then
  :
else
  version="deleted"
fi
token="/approve-agents-md $version"

count=$(APPROVER="$APPROVER" TOKEN="$token" node -e '
  const { execFileSync } = require("node:child_process");
  const { REPO, PR, APPROVER, TOKEN } = process.env;
  const comments = [];
  for (let page = 1; ; page += 1) {
    const raw = execFileSync("gh", ["api", `repos/${REPO}/issues/${PR}/comments?per_page=100&page=${page}`]).toString();
    const batch = JSON.parse(raw);
    if (!Array.isArray(batch)) throw new Error("comments response is not a list");
    if (batch.length === 0) break;
    comments.push(...batch);
  }
  if (!comments.every((c) => c && typeof c.body === "string" && c.user && typeof c.user.login === "string")) {
    throw new Error("unexpected comment shape");
  }
  const approvals = comments.filter(
    (c) => c.user.login === APPROVER && c.body.split(/\r?\n/).some((line) => line.trim() === TOKEN),
  );
  console.log(approvals.length);
') || fail "Could not read the pull request's comments, so approval can't be established."

if [ "$count" -gt 0 ]; then
  echo "$FILE version $version approved by $APPROVER."
  exit 0
fi

echo "::error::This pull request changes $FILE and $APPROVER hasn't approved this exact version."
echo "Review the change with: git diff $BASE...$HEAD -- $FILE"
echo "To approve this version, $APPROVER comments on the pull request with this line:"
echo "  $token"
echo "Then re-run this check from the Checks tab (or add or remove any label to trigger it)."
echo "Only $APPROVER can resolve this. Agents must not post this comment, re-run this check to get around it, or change this check; report it to $APPROVER instead."
exit 1
