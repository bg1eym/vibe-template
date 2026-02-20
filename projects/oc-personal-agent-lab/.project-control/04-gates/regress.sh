#!/usr/bin/env bash
# PCK Regression Gate — Gate Chain Lock + run RG-ATLAS-ENV-001.

set -euo pipefail

ROOT="${PCK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REGRESS_DIR="${ROOT}/.project-control/02-regressions"
GATES="${ROOT}/.project-control/04-gates"

# Gate Chain Lock: mandatory scripts exist
[ -f "${ROOT}/tools/atlas-env-audit.sh" ] || { echo "REGRESS FAIL: tools/atlas-env-audit.sh missing"; exit 1; }
[ -x "${ROOT}/tools/atlas-env-audit.sh" ] || { echo "REGRESS FAIL: tools/atlas-env-audit.sh not executable"; exit 1; }
[ -f "${GATES}/critical-tests.sh" ] || { echo "REGRESS FAIL: critical-tests.sh missing"; exit 1; }
[ -x "${GATES}/critical-tests.sh" ] || { echo "REGRESS FAIL: critical-tests.sh not executable"; exit 1; }
[ -f "${REGRESS_DIR}/RG-ATLAS-ENV-001.sh" ] || { echo "REGRESS FAIL: RG-ATLAS-ENV-001.sh missing"; exit 1; }
[ -x "${REGRESS_DIR}/RG-ATLAS-ENV-001.sh" ] || { echo "REGRESS FAIL: RG-ATLAS-ENV-001.sh not executable"; exit 1; }

FAILED=0
for script in "${REGRESS_DIR}"/*.sh; do
  [ -f "$script" ] && [ -x "$script" ] || continue
  if ! "${script}"; then
    echo "REGRESS FAIL: ${script}" >&2
    FAILED=1
  fi
done

[ "${FAILED}" -eq 0 ] || exit 1
echo "=== Regress PASS ==="
