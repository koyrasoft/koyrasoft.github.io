#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/push.sh "Your commit message"
#   ./scripts/push.sh            # auto message

cd "$(git rev-parse --show-toplevel)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

branch="$(git branch --show-current)"
if [[ -z "${branch}" ]]; then
  echo "Cannot detect current branch."
  exit 1
fi

if [[ "${branch}" != "main" ]]; then
  echo "Refusing to push: current branch is '${branch}' (expected 'main')."
  echo "Switch to main or edit scripts/push.sh if you want different behavior."
  exit 1
fi

if ! git diff --quiet || ! git diff --staged --quiet; then
  : # changes exist (staged or unstaged)
else
  echo "Nothing to commit."
  exit 0
fi

msg="${1:-}"
if [[ -z "${msg}" ]]; then
  msg="Update site ($(date '+%Y-%m-%d %H:%M'))"
fi

git add -A

if git diff --staged --quiet; then
  echo "Nothing staged after git add."
  exit 0
fi

git commit -m "${msg}"
git push
