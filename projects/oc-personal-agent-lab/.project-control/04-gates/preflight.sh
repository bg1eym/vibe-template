#!/usr/bin/env bash
# PCK Preflight Gate — Verify ledger and snapshots exist.

set -euo pipefail

ROOT="${PCK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LEDGER="${ROOT}/.project-control/00-ledger"

fail() { echo "PREFLIGHT FAIL: $*" >&2; exit 1; }

LATEST=$(ls -1 "${LEDGER}" 2>/dev/null | grep -E '^PCK-' | sort -V | tail -1)
[ -n "${LATEST:-}" ] || fail "No ledger version found under ${LEDGER}"

VERSION_DIR="${LEDGER}/${LATEST}"
for f in meta.json config.snapshot.json contract.snapshot.md wiring.snapshot.md rollback.md; do
  [ -f "${VERSION_DIR}/${f}" ] || fail "Required snapshot file missing: ${VERSION_DIR}/${f}"
done

TASK_ID=$(jq -r '.task_id // empty' "${VERSION_DIR}/meta.json" 2>/dev/null || true)
[ -n "${TASK_ID:-}" ] || fail "meta.json must have task_id"

echo "=== Preflight PASS ==="
echo "Latest ledger: ${LATEST}"
