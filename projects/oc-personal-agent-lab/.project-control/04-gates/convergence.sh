#!/usr/bin/env bash
# PCK Convergence Gate — contract.snapshot.md must match BOOTSTRAP.

set -euo pipefail

ROOT="${PCK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LEDGER="${ROOT}/.project-control/00-ledger"
BOOTSTRAP_CONTRACT="${LEDGER}/PCK-BOOTSTRAP-000/contract.snapshot.md"

VERSIONS=$(ls -1 "${LEDGER}" 2>/dev/null | grep -E '^PCK-' | sort -V)
LATEST=$(echo "${VERSIONS}" | tail -1)

[ -n "${LATEST:-}" ] || { echo "CONVERGENCE FAIL: No ledger version found"; exit 1; }

LATEST_CONTRACT="${LEDGER}/${LATEST}/contract.snapshot.md"
[ -f "${LATEST_CONTRACT}" ] || { echo "CONVERGENCE FAIL: ${LATEST_CONTRACT} not found"; exit 1; }

if [ -f "${BOOTSTRAP_CONTRACT}" ]; then
  diff -q "${BOOTSTRAP_CONTRACT}" "${LATEST_CONTRACT}" >/dev/null 2>&1 || {
    echo "CONVERGENCE FAIL: contract.snapshot.md differs from BOOTSTRAP";
    exit 1;
  }
fi

echo "=== Convergence PASS (contract unchanged) ==="
