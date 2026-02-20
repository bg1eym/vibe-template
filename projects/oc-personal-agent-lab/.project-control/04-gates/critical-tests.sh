#!/usr/bin/env bash
# Critical Tests Gate — Run CT-ATLAS-ENV-001.

set -euo pipefail

ROOT="${PCK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ACTF_DIR="${ROOT}/.project-control/07-critical-tests"

export PCK_ROOT="${ROOT}"
cd "${ROOT}"

"${ACTF_DIR}/CT-ATLAS-ENV-001.sh" || { echo "CRITICAL-TESTS FAIL: CT-ATLAS-ENV-001"; exit 4; }

echo "=== Critical Tests PASS ==="
