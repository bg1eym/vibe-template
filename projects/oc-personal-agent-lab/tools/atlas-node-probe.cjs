#!/usr/bin/env node
/**
 * Atlas node+pnpm probe — harness for RG-ATLAS-004-shebang-proof.
 * Standalone JS: inlined resolve logic (no TS import).
 * Calls resolveNodeBin + resolvePnpmJs equivalents, outputs result.
 */
const fs = require("fs");
const path = require("path");

const NODE_CANDIDATES = [
  "/opt/homebrew/bin/node",
  "/usr/local/bin/node",
  "/usr/bin/node",
];

const PNPM_JS_CANDIDATES = [
  "/opt/homebrew/lib/node_modules/pnpm/bin/pnpm.cjs",
  "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs",
];

function resolveNodeBin() {
  const probe = {};
  const fromEnv = process.env.NODE_BIN?.trim();
  if (fromEnv) {
    if (fs.existsSync(fromEnv)) {
      return { nodeBin: fromEnv, probe: { [fromEnv]: "exists" } };
    }
    probe[fromEnv] = "missing";
  }
  for (const p of NODE_CANDIDATES) {
    if (fs.existsSync(p)) {
      return { nodeBin: p, probe: { ...probe, [p]: "exists" } };
    }
    probe[p] = "missing";
  }
  return { nodeBin: null, probe };
}

function resolvePnpmJs() {
  const probe = {};
  const fromEnv = process.env.PNPM_JS?.trim();
  if (fromEnv) {
    if (fs.existsSync(fromEnv)) {
      return { pnpmJs: fromEnv, probe: { [fromEnv]: "exists" } };
    }
    probe[fromEnv] = "missing";
  }
  for (const p of PNPM_JS_CANDIDATES) {
    if (fs.existsSync(p)) {
      return { pnpmJs: p, probe: { ...probe, [p]: "exists" } };
    }
    probe[p] = "missing";
  }
  return { pnpmJs: null, probe };
}

const { nodeBin, probe: nodeProbe } = resolveNodeBin();
const { pnpmJs, probe: pnpmProbe } = resolvePnpmJs();

console.log("node_bin:", nodeBin ?? "none");
console.log("pnpm_js:", pnpmJs ?? "none");
console.log("node_probe:", JSON.stringify(nodeProbe));
console.log("pnpm_js_probe:", JSON.stringify(pnpmProbe));

if (nodeBin && pnpmJs) {
  process.exit(0);
}
console.error("hint: set NODE_BIN or PNPM_JS");
process.exit(1);
