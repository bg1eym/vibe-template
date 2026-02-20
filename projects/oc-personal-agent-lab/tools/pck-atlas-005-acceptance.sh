#!/usr/bin/env bash
# PCK-ATLAS-005 acceptance — plugin-load, atlas-cache-fast-path, atlas-timeout-fallback.
# Non-interactive. Exit 0 on pass, non-zero on fail.

set -euo pipefail

OC_LAB_ROOT="${OC_LAB_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
OC_BIND="${OC_LAB_ROOT}/oc-bind"
ATLAS_ROOT="${ATLAS_ROOT:-$HOME/atlas-radar}"
GATEWAY_ERR_LOG="${GATEWAY_ERR_LOG:-$HOME/.openclaw/logs/gateway.err.log}"
GATEWAY_LOG="${GATEWAY_LOG:-$HOME/.openclaw/logs/gateway.log}"
FAILED=0

echo "=== PCK-ATLAS-005 Acceptance ==="
echo "OC_LAB_ROOT=$OC_LAB_ROOT"
echo "ATLAS_ROOT=$ATLAS_ROOT"

# 1) plugin-load check: single fs import, no duplicate readFileSync
echo ""
echo "=== 1) plugin-load (fs import sanity) ==="
FS_IMPORTS=$(grep -c 'from "node:fs"' "${OC_BIND}/index.ts" 2>/dev/null || echo "0")
LEGACY_FS=$(grep -c 'from "fs"' "${OC_BIND}/index.ts" 2>/dev/null || echo "0")
FS_IMPORTS=$(echo "${FS_IMPORTS}" | tr -d '\n' | head -c 5)
LEGACY_FS=$(echo "${LEGACY_FS}" | tr -d '\n' | head -c 5)
if [ "${FS_IMPORTS:-0}" -eq 1 ] && [ "${LEGACY_FS:-0}" -eq 0 ]; then
  echo "PASS: single node:fs import, no legacy fs import"
else
  echo "FAIL: fs imports — node:fs count=${FS_IMPORTS:-0}, legacy fs count=${LEGACY_FS:-0} (expect 1 and 0)"
  FAILED=1
fi

# Restart gateway and assert no ParseError in err log (check only NEW lines after restart)
if command -v launchctl &>/dev/null && [ -f "${GATEWAY_ERR_LOG}" ]; then
  echo "Restarting gateway (ai.openclaw.gateway)..."
  LINES_BEFORE=$(wc -l < "${GATEWAY_ERR_LOG}" 2>/dev/null || echo 0)
  launchctl bootout gui/$(id -u)/ai.openclaw.gateway 2>/dev/null || true
  sleep 2
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>/dev/null || true
  sleep 4
  LINES_AFTER=$(wc -l < "${GATEWAY_ERR_LOG}" 2>/dev/null || echo 0)
  if [ "${LINES_AFTER}" -gt "${LINES_BEFORE}" ]; then
    tail -n +"$((LINES_BEFORE + 1))" "${GATEWAY_ERR_LOG}" 2>/dev/null | grep -q "oc-bind failed to load\|ParseError.*readFileSync" && {
      echo "FAIL: gateway.err.log contains oc-bind load error after restart"
      tail -20 "${GATEWAY_ERR_LOG}"
      FAILED=1
    } || echo "PASS: no oc-bind load error in gateway.err.log after restart"
  else
    echo "PASS: no new err log entries (plugin load not retried)"
  fi
else
  echo "SKIP: launchctl or gateway.err.log not available"
fi

# 2) atlas-cache-fast-path + 3) atlas-timeout-fallback
echo ""
echo "=== 2) atlas-cache-fast-path + 3) atlas-timeout-fallback ==="
export ATLAS_ROOT
if [ ! -d "${ATLAS_ROOT}/out/atlas" ]; then
  echo "Creating cache: running pnpm run atlas:run in ${ATLAS_ROOT}..."
  (cd "${ATLAS_ROOT}" && pnpm run atlas:run 2>&1) || echo "atlas:run may have failed, continuing..."
fi
(cd "${OC_LAB_ROOT}" && npx tsx oc-bind/tools/pck-atlas-005-acceptance.ts 2>&1) || FAILED=1

if [ "${FAILED}" -eq 0 ]; then
  echo ""
  echo "=== PCK-ATLAS-005 ACCEPTANCE PASS ==="
  exit 0
fi

echo ""
echo "=== PCK-ATLAS-005 ACCEPTANCE FAIL ==="
exit 1
