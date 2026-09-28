#!/usr/bin/env bash
# Usage: ./scripts/snapshot.sh [file ...] prints repository context and optional file contents.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'Error: run this script from inside a Git repository.\n' >&2
  exit 1
}
cd "$repo_root"

for path in "$@"; do
  if [[ ! -f "$path" ]]; then
    printf 'Error: file does not exist: %s\n' "$path" >&2
    exit 1
  fi
done

print_snapshot() {
  printf '===== Git state =====\n'
  printf 'Current branch: %s\n\n' "$(git branch --show-current)"

  printf '%s\n' '--- git log origin/main --oneline -5 ---'
  git log origin/main --oneline -5
  printf '\n%s\n' '--- git status --short ---'
  git status --short

  printf '\n===== File tree =====\n'
  find src supabase/migrations docs \
    \( -name node_modules -o -name dist -o -name .git \) -prune -o -print \
    | LC_ALL=C sort

  for path in "$@"; do
    printf '\n===== File: %s =====\n' "$path"
    printf '%s\n' '```'
    cat -- "$path"
    printf '\n%s\n' '```'
  done
}

snapshot="$(print_snapshot "$@")"
character_count="$(printf '%s\n' "$snapshot" | wc -m | tr -d '[:space:]')"

printf '%s\n' "$snapshot"
printf '\n===== Total characters (excluding this footer): %s =====\n' "$character_count"
