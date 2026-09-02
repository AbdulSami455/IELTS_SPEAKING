#!/bin/sh

set -eu

LOCKFILE="package-lock.json"
STAMP_FILE="node_modules/.package-lock.hash"

lockfile_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$LOCKFILE" | awk '{ print $1 }'
    return
  fi
  shasum -a 256 "$LOCKFILE" | awk '{ print $1 }'
}

current_hash="$(lockfile_hash)"
stored_hash=""

if [ -f "$STAMP_FILE" ]; then
  stored_hash="$(cat "$STAMP_FILE")"
fi

if [ ! -d "node_modules" ] || [ ! -x "node_modules/.bin/vite" ] || [ "$stored_hash" != "$current_hash" ]; then
  npm ci --no-audit --no-fund
  printf '%s\n' "$current_hash" > "$STAMP_FILE"
fi

exec npm run dev -- --host 0.0.0.0 --port 3000
