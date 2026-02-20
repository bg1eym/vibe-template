#!/usr/bin/env bash
# ATLAS-ITER-010 acceptance — preflight, regress, convergence, critical-tests.

set -euo pipefail

ROOT="${PCK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
GATES="${ROOT}/.project-control/04-gates"

export PCK_ROOT="${ROOT}"
cd "${ROOT}"

FAILED=0

bash "${GATES}/preflight.sh" || FAILED=1
bash "${GATES}/regress.sh" || FAILED=1
bash "${GATES}/convergence.sh" || FAILED=1
bash "${GATES}/critical-tests.sh" || FAILED=1

if [ "${FAILED}" -eq 0 ]; then
  echo "ACCEPTANCE PASS"
  exit 0
fi

echo "ACCEPTANCE FAIL"
exit 1
