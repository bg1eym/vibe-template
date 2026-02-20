#!/usr/bin/env node
/**
 * Atlas node spawn test — verifies node + pnpm.cjs spawn works (no ENOENT).
 * Spawns: node pnpm.cjs -v
 */
const { spawn } = require("child_process");
const fs = require("fs");

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
  const fromEnv = process.env.NODE_BIN?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  for (const p of NODE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function resolvePnpmJs() {
  const fromEnv = process.env.PNPM_JS?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  for (const p of PNPM_JS_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const nodeBin = resolveNodeBin();
const pnpmJs = resolvePnpmJs();

if (!nodeBin || !pnpmJs) {
  console.error("atlas-node-spawn-test: node or pnpm.cjs not found");
  process.exit(1);
}

const proc = spawn(nodeBin, [pnpmJs, "-v"], {
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
proc.stderr.on("data", (d) => (stderr += d.toString()));

proc.on("close", (code) => {
  if (code !== 0) {
    console.error("atlas-node-spawn-test FAIL: exit", code, stderr);
    process.exit(1);
  }
  console.log("atlas-node-spawn-test PASS: pnpm -v exit 0");
  process.exit(0);
});

proc.on("error", (err) => {
  console.error("atlas-node-spawn-test FAIL: ENOENT or spawn error:", err.message);
  process.exit(1);
});
