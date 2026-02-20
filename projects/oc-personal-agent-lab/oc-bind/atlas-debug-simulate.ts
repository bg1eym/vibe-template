#!/usr/bin/env npx tsx
/**
 * ATLAS-007: Simulate /atlas debug output for human-simulation validation.
 * Outputs the same format as TG /atlas debug.
 */
import { resolve } from "node:path";
import { existsSync, readFileSync, accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { getBuildFingerprint } from "./index.js";
import { resolveNodeBin, resolvePnpmJs } from "./atlas-adapter.js";

const atlasRoot = process.env.ATLAS_ROOT?.trim() || process.cwd();
const dashboardUrlBase = process.env.ATLAS_DASHBOARD_URL_BASE?.trim() || "";
const coverUrlBase = process.env.ATLAS_COVER_URL_BASE?.trim() || "";

const { nodeBin, probe: nodeProbe } = resolveNodeBin();
const { pnpmJs, probe: pnpmProbe } = resolvePnpmJs();

const pathVal = process.env.PATH ?? "missing";
const pathDisplay = pathVal.length > 200 ? `${pathVal.slice(0, 200)}...[truncated]` : pathVal;
const nodeProbeStr = Object.entries(nodeProbe).map(([k, v]) => `${k}=${v}`).join("; ");
const pnpmProbeStr = Object.entries(pnpmProbe).map(([k, v]) => `${k}=${v}`).join("; ");

const atlasRootResolved = atlasRoot ? resolve(atlasRoot) : "";
const atlasRootExists = atlasRoot ? existsSync(atlasRootResolved) : false;
const atlasRootHasPkg = atlasRootExists && existsSync(resolve(atlasRootResolved, "package.json"));
let atlasRootHasScriptAtlasRun = false;
if (atlasRootHasPkg) {
  try {
    const pkg = JSON.parse(readFileSync(resolve(atlasRootResolved, "package.json"), "utf-8"));
    atlasRootHasScriptAtlasRun = !!pkg?.scripts?.["atlas:run"];
  } catch {
    /* ignore */
  }
}

let nodeAccess = "unknown";
let pnpmJsAccess = "unknown";
if (nodeBin) {
  try {
    accessSync(nodeBin, constants.X_OK);
    nodeAccess = "X_OK";
  } catch {
    nodeAccess = "not_executable";
  }
}
if (pnpmJs) {
  try {
    accessSync(pnpmJs, constants.R_OK);
    pnpmJsAccess = "R_OK";
  } catch {
    pnpmJsAccess = "not_readable";
  }
}

let pnpmVersionProbe = "not_run";
if (nodeBin && pnpmJs) {
  try {
    const probeProc = spawnSync(nodeBin, [pnpmJs, "-v"], {
      encoding: "utf-8",
      timeout: 3000,
    });
    pnpmVersionProbe =
      probeProc.status === 0
        ? `ok: ${(probeProc.stdout || "").trim() || "unknown"}`
        : `fail: exit ${probeProc.status}`;
  } catch (e) {
    pnpmVersionProbe = `fail: ${(e as Error).message}`;
  }
}

const hintLine = !atlasRootExists ? "Run: bash tools/atlas-env-audit.sh" : null;
const debugLines = [
  getBuildFingerprint(),
  `process_execPath: ${process.execPath}`,
  `gateway_node_exec: ${process.execPath}`,
  `plugin_dir: oc-bind`,
  `ATLAS_ROOT: ${atlasRoot ? "present" : "missing"}`,
  `atlas_root_value: ${atlasRoot || "(not set)"}`,
  `atlas_root_exists: ${atlasRootExists}`,
  `atlas_root_has_pkg_json: ${atlasRootHasPkg}`,
  `atlas_root_has_script_atlas_run: ${atlasRootHasScriptAtlasRun}`,
  ...(hintLine ? [hintLine] : []),
  `ATLAS_DASHBOARD_URL_BASE: ${dashboardUrlBase ? "present" : "missing"}`,
  `ATLAS_COVER_URL_BASE: ${coverUrlBase ? "present" : "missing"}`,
  `PATH: ${pathDisplay}`,
  `node_bin_used: ${nodeBin ?? "none"}`,
  `node_access: ${nodeAccess}`,
  `pnpm_js_used: ${pnpmJs ?? "none"}`,
  `pnpm_js_access: ${pnpmJsAccess}`,
  `node_probe: ${nodeProbeStr || "(none)"}`,
  `pnpm_js_probe: ${pnpmProbeStr || "(none)"}`,
  `pnpm_version_probe: ${pnpmVersionProbe}`,
];

console.log(debugLines.join("\n"));
