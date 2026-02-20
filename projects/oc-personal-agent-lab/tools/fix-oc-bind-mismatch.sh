#!/usr/bin/env bash
# fix-oc-bind-mismatch.sh — One-shot diagnostic + fix for OpenClaw oc-bind plugin id mismatch
# Usage: ./fix-oc-bind-mismatch.sh
# Exit: 0 on success, non-zero on failure

set -euo pipefail

CONFIG="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
PLUGIN_DIR="/Users/qiangguo/Projects/vibe-template/projects/oc-personal-agent-lab/oc-bind"
LAUNCHD_LABEL="ai.openclaw.gateway"
LAUNCHD_SCOPE="gui/$(id -u)"

# --- Helpers ---
log() { printf '%s\n' "$*"; }
section() { log ""; log "=== $* ==="; }
die() { log "ERROR: $*"; exit 1; }

# Prefer jq; fallback to python3
json_get() {
  local key="$1"
  if command -v jq &>/dev/null; then
    jq -r "$key" "$CONFIG" 2>/dev/null || true
  else
    python3 -c "
import json,sys
try:
    with open('$CONFIG') as f: c=json.load(f)
    v=c
    for k in '$key'.replace('[\"','.').replace('\"]','').split('.'):
        if k: v=v.get(k) if isinstance(v,dict) else None
    print(v if v is not None else '')
except: print('')
" 2>/dev/null || true
  fi
}

# --- A. Discover truth ---
section "A. Discover truth"

log "launchctl print $LAUNCHD_SCOPE/$LAUNCHD_LABEL:"
launchctl print "$LAUNCHD_SCOPE/$LAUNCHD_LABEL" 2>/dev/null | head -50 || log "(job not running or not found)"

if command -v jq &>/dev/null; then
  PORT=$(jq -r '.gateway.port // 18789' "$CONFIG" 2>/dev/null || echo 18789)
else
  PORT=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c.get('gateway',{}).get('port',18789))" 2>/dev/null || echo 18789)
fi
log ""
log "Config port (from $CONFIG): $PORT"

log ""
log "lsof LISTEN on port $PORT:"
lsof -i ":$PORT" -sTCP:LISTEN 2>/dev/null || log "(none)"

GATEWAY_PID=$(lsof -i ":$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
log "Live gateway PID: ${GATEWAY_PID:-<none>}"

STDERR_PATH="$HOME/.openclaw/logs/gateway.err.log"
STDOUT_PATH="$HOME/.openclaw/logs/gateway.log"
log ""
log "StandardErrorPath: $STDERR_PATH"
log "StandardOutPath: $STDOUT_PATH"

log ""
log "Last 5 lines containing 'plugin id mismatch' in gateway log:"
grep "plugin id mismatch" "$STDOUT_PATH" 2>/dev/null | tail -5 || log "(none found)"
log ""
log "Last 5 lines containing 'plugin id mismatch' in stderr:"
grep "plugin id mismatch" "$STDERR_PATH" 2>/dev/null | tail -5 || log "(none found)"

# --- B. Locate openclaw-bind source ---
section "B. Locate 'openclaw-bind' source"

log "Searching for literal 'openclaw-bind' (excluding large logs):"
FINDINGS=""
for dir in "$HOME/.openclaw" "$PLUGIN_DIR"; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    # Skip huge logs
    size=$(stat -f%z "$f" 2>/dev/null || echo 0)
    [ "$size" -lt 500000 ] || continue
    hits=$(grep -n "openclaw-bind" "$f" 2>/dev/null || true)
    [ -n "$hits" ] && FINDINGS="${FINDINGS}${f}:"$'\n'"${hits}"$'\n'
  done < <(find "$dir" -type f \( -name "*.json" -o -name "*.json5" -o -name "*.ts" -o -name "*.js" \) 2>/dev/null | head -200)
done

# Also check config and backups
for f in "$CONFIG" "$CONFIG.bak"; do
  [ -f "$f" ] || continue
  hits=$(grep -n "openclaw-bind" "$f" 2>/dev/null || true)
  [ -n "$hits" ] && FINDINGS="${FINDINGS}${f}:"$'\n'"${hits}"$'\n'
done
for f in "$CONFIG.bak."*; do
  [ -f "$f" ] || continue
  hits=$(grep -n "openclaw-bind" "$f" 2>/dev/null || true)
  [ -n "$hits" ] && FINDINGS="${FINDINGS}${f}:"$'\n'"${hits}"$'\n'
done

if [ -n "$FINDINGS" ]; then
  log "$FINDINGS"
else
  log "(no openclaw-bind in config/cache/plugin dir)"
fi

log ""
log "Active config plugins.load.paths:"
if command -v jq &>/dev/null; then
  jq -r '.plugins.load.paths[]? // empty' "$CONFIG" 2>/dev/null || log "(empty)"
else
  python3 -c "import json; c=json.load(open('$CONFIG')); [print(p) for p in c.get('plugins',{}).get('load',{}).get('paths',[])]" 2>/dev/null || log "(empty)"
fi
log ""
log "Active config plugins.installs keys:"
if command -v jq &>/dev/null; then
  jq -r '.plugins.installs // {} | keys[]?' "$CONFIG" 2>/dev/null || log "(none)"
else
  python3 -c "import json; c=json.load(open('$CONFIG')); print(' '.join(c.get('plugins',{}).get('installs',{}).keys()))" 2>/dev/null || log "(none)"
fi
log ""
log "Active config plugins.entries keys:"
if command -v jq &>/dev/null; then
  jq -r '.plugins.entries // {} | keys[]?' "$CONFIG" 2>/dev/null || log "(none)"
else
  python3 -c "import json; c=json.load(open('$CONFIG')); print(' '.join(c.get('plugins',{}).get('entries',{}).keys()))" 2>/dev/null || log "(none)"
fi

# --- C. Apply fix ---
section "C. Apply fix"

BACKUP_SUFFIX=".bak.$(date +%s)"
CHANGED=0
MISMATCH_COUNT=0

# Backup config before any change
cp -a "$CONFIG" "${CONFIG}${BACKUP_SUFFIX}"
log "Backed up config to ${CONFIG}${BACKUP_SUFFIX}"

# Fix 1: Remove installs.openclaw-bind if present
if command -v jq &>/dev/null; then
  HAS_OPENCLAW_BIND=$(jq -e '.plugins.installs["openclaw-bind"]' "$CONFIG" 2>/dev/null || true)
  if [ -n "$HAS_OPENCLAW_BIND" ] && [ "$HAS_OPENCLAW_BIND" != "null" ]; then
    log "Removing plugins.installs.openclaw-bind"
    jq 'del(.plugins.installs["openclaw-bind"])' "$CONFIG" > "${CONFIG}.tmp" && mv "${CONFIG}.tmp" "$CONFIG"
    CHANGED=1
  fi
else
  PY_FIX=$(python3 -c "
import json
with open('$CONFIG') as f: c=json.load(f)
installs = c.get('plugins',{}).get('installs',{})
if 'openclaw-bind' in installs:
    del installs['openclaw-bind']
    with open('$CONFIG','w') as f: json.dump(c,f,indent=2)
    print('removed')
else:
    print('')
" 2>/dev/null)
  [ "$PY_FIX" = "removed" ] && CHANGED=1
fi

# Fix 2: Remove openclaw-bind path from load.paths
LOAD_PATHS=$(json_get '.plugins.load.paths')
if echo "$LOAD_PATHS" | grep -q "openclaw-bind"; then
  log "Removing openclaw-bind path from plugins.load.paths"
  if command -v jq &>/dev/null; then
    jq '.plugins.load.paths |= map(select(. | test("openclaw-bind") | not))' "$CONFIG" > "${CONFIG}.tmp" && mv "${CONFIG}.tmp" "$CONFIG"
  else
    python3 -c "
import json
with open('$CONFIG') as f: c=json.load(f)
paths = c.get('plugins',{}).get('load',{}).get('paths',[])
paths = [p for p in paths if 'openclaw-bind' not in p]
c.setdefault('plugins',{}).setdefault('load',{})['paths'] = paths
with open('$CONFIG','w') as f: json.dump(c,f,indent=2)
"
  fi
  CHANGED=1
fi

# Fix 3: Ensure oc-bind is in load.paths and entries
if command -v jq &>/dev/null; then
  HAS_OC_BIND_PATH=$(jq -e --arg p "$PLUGIN_DIR" '.plugins.load.paths | index($p)' "$CONFIG" 2>/dev/null || true)
  if [ -z "$HAS_OC_BIND_PATH" ] || [ "$HAS_OC_BIND_PATH" = "null" ]; then
    log "Adding oc-bind path to plugins.load.paths"
    jq --arg p "$PLUGIN_DIR" '.plugins.load.paths |= (. + [$p] | unique)' "$CONFIG" > "${CONFIG}.tmp" && mv "${CONFIG}.tmp" "$CONFIG"
    CHANGED=1
  fi
fi

# Fix 4: Re-link plugin to refresh install record (ensures idHint aligns)
if [ -d "$PLUGIN_DIR" ] && command -v openclaw &>/dev/null; then
  log "Re-linking plugin to refresh install record: openclaw plugins install -l $PLUGIN_DIR"
  if openclaw plugins install -l "$PLUGIN_DIR" 2>/dev/null; then
    CHANGED=1
  else
    log "(install -l returned non-zero; path may already be linked; continuing)"
  fi
fi

if [ "$CHANGED" -eq 0 ]; then
  log "No config changes needed (already clean). Proceeding to restart."
fi

# Verification grep (exclude backups)
log ""
log "Verification: grep openclaw-bind in active config (excluding *.bak*):"
GREP_COUNT=$(grep -l "openclaw-bind" "$CONFIG" 2>/dev/null | wc -l | tr -d '[:space:]') || true
GREP_COUNT=${GREP_COUNT:-0}
if [ "$GREP_COUNT" -gt 0 ]; then
  log "WARNING: openclaw-bind still in $CONFIG"
  grep -n "openclaw-bind" "$CONFIG" || true
else
  log "PASS: No openclaw-bind in active config"
fi

# --- D. Restart & verify ---
section "D. Restart & verify"

log "Restarting launchd job: launchctl kickstart -k $LAUNCHD_SCOPE/$LAUNCHD_LABEL"
if ! launchctl kickstart -k "$LAUNCHD_SCOPE/$LAUNCHD_LABEL" 2>/dev/null; then
  log "WARN: launchctl kickstart returned non-zero (job may have restarted via config watcher)"
fi

log "Waiting up to 10s for LISTEN on port $PORT..."
for i in $(seq 1 10); do
  sleep 1
  if lsof -i ":$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 | grep -q .; then
    log "LISTEN detected on port $PORT after ${i}s"
    break
  fi
  [ "$i" -eq 10 ] && die "Timeout: no LISTEN on port $PORT after 10s"
done

log "Waiting 3s for logs to flush..."
sleep 3

log ""
log "Checking last 200 lines of gateway log for 'plugin id mismatch':"
MISMATCH_COUNT=$(tail -200 "$STDOUT_PATH" 2>/dev/null | grep -c "plugin id mismatch" 2>/dev/null) || true
MISMATCH_COUNT=${MISMATCH_COUNT:-0}
if [ "${MISMATCH_COUNT:-0}" -gt 0 ]; then
  log "FAIL: Found $MISMATCH_COUNT 'plugin id mismatch' line(s) in recent log"
  tail -200 "$STDOUT_PATH" | grep "plugin id mismatch" || true
  log ""
  log "--- Diagnostic bundle ---"
  launchctl print "$LAUNCHD_SCOPE/$LAUNCHD_LABEL" 2>/dev/null | head -30
  log ""
  log "LISTEN PID: $(lsof -i ":$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)"
  log ""
  log "Top 20 'openclaw-bind' search hits:"
  grep -rn "openclaw-bind" "$HOME/.openclaw" 2>/dev/null | grep -v "\.bak" | head -20
  exit 1
fi

log "PASS: No 'plugin id mismatch' in recent log"

# Final grep for openclaw-bind in config/caches (excluding backups)
log ""
log "Final check: openclaw-bind in config/caches (excluding *.bak*):"
FINAL_HITS=$(grep -r "openclaw-bind" "$HOME/.openclaw" 2>/dev/null | grep -v "\.bak" | grep -v "/logs/" | wc -l | tr -d '[:space:]') || true
FINAL_HITS=${FINAL_HITS:-0}
if [ "${FINAL_HITS:-0}" -gt 0 ]; then
  log "WARN: $FINAL_HITS hit(s) (likely in logs only):"
  grep -r "openclaw-bind" "$HOME/.openclaw" 2>/dev/null | grep -v "\.bak" | grep -v "/logs/" | head -5
else
  log "PASS: No openclaw-bind in active config/caches"
fi

# --- Acceptance ---
section "Acceptance tests"

LISTEN_PID=$(lsof -i ":$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
if [ -n "$LISTEN_PID" ]; then
  log "PASS: lsof shows LISTEN on port $PORT (PID $LISTEN_PID)"
else
  log "FAIL: No LISTEN on port $PORT"
  exit 1
fi

if [ "${MISMATCH_COUNT:-0}" -eq 0 ]; then
  log "PASS: No 'plugin id mismatch' for oc-bind in active stderr log"
else
  log "FAIL: plugin id mismatch still present"
  exit 1
fi

log ""
log "=== All checks PASSED ==="
log ""
log "--- README ---"
log "What changed:"
log "  - Config: $CONFIG (backup: ${CONFIG}${BACKUP_SUFFIX})"
log "  - Removed installs.openclaw-bind if present"
log "  - Removed openclaw-bind from load.paths if present"
log "  - Re-linked plugin via 'openclaw plugins install -l $PLUGIN_DIR'"
log ""
log "How to revert:"
log "  cp ${CONFIG}${BACKUP_SUFFIX} $CONFIG"
log "  launchctl kickstart -k $LAUNCHD_SCOPE/$LAUNCHD_LABEL"
log ""
log "How to re-run:"
log "  ./tools/fix-oc-bind-mismatch.sh"
log ""
