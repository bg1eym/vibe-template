#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
BASE="http://${HOST}:${PORT}"

npm run dev >/dev/null 2>&1 &
PID=$!

cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for i in $(seq 1 50); do
  if curl -sS "${BASE}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

curl -sS -i "${BASE}/health"
echo
echo "OK: dev server is up (pid=${PID})"
echo "Tip: Press Ctrl+C to stop"
wait "$PID"
