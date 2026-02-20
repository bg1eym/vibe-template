/**
 * Atlas dashboard adapter — runs atlas:run pipeline, reads result.json.
 * PCK-ATLAS-004: Shebang-proof — node direct execution of pnpm.cjs.
 * PCK-ATLAS-FINAL-001: ATLAS_ROOT check, fs.access(X_OK), ATLAS_EMPTY.
 * PCK-ATLAS-006: process.execPath fallback, ATLAS_ROOT_INVALID, SPAWN_FAILED_ENOENT classification.
 * PCK-ATLAS-008: atlas:run script check, discovery fallback, ATLAS_PIPELINE_BLOCKED for exit 42, PDF_EXTRACT_ALLOW_FALLBACK.
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, accessSync, constants } from "node:fs";
import { resolve } from "node:path";

const TRUNCATE_LEN = 2000;
const DISCOVERY_SCRIPT_CANDIDATES = [
  resolve(process.env.HOME || "/tmp", "Projects/atlas-radar/tools/atlas-root-discovery.sh"),
  resolve(process.env.HOME || "/tmp", "atlas-radar/tools/atlas-root-discovery.sh"),
  resolve(process.env.HOME || "/tmp", "Projects/vibe-template/projects/atlas-radar/tools/atlas-root-discovery.sh"),
];
const ATLAS_TIMEOUT_MS = 900_000; // PCK-ATLAS-005: 15 min (was 3 min) for long translation

// Node resolution order: NODE_BIN env → process.execPath (gateway's node) → fixed candidates
const NODE_CANDIDATES = [
  "/opt/homebrew/bin/node",
  "/usr/local/bin/node",
  "/usr/bin/node",
] as const;

const PNPM_JS_CANDIDATES = [
  "/opt/homebrew/lib/node_modules/pnpm/bin/pnpm.cjs",
  "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs",
] as const;

export type NodeResolveResult = {
  nodeBin: string | null;
  probe: Record<string, "exists" | "missing">;
};

export type PnpmJsResolveResult = {
  pnpmJs: string | null;
  probe: Record<string, "exists" | "missing">;
};

/**
 * Resolve node absolute path. Order: NODE_BIN env → process.execPath → fixed candidates.
 * process.execPath is critical for launchd: gateway runs with a specific node; spawn must use same.
 */
export function resolveNodeBin(): NodeResolveResult {
  const probe: Record<string, "exists" | "missing"> = {};

  const fromEnv = process.env.NODE_BIN?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { nodeBin: fromEnv, probe: { [fromEnv]: "exists" } };
  }
  if (fromEnv) probe[fromEnv] = "missing";

  const execPath = process.execPath;
  if (execPath && existsSync(execPath)) {
    return { nodeBin: execPath, probe: { ...probe, [execPath]: "exists" } };
  }
  if (execPath) probe[execPath] = "missing";

  for (const p of NODE_CANDIDATES) {
    if (existsSync(p)) {
      return { nodeBin: p, probe: { ...probe, [p]: "exists" } };
    }
    probe[p] = "missing";
  }

  return { nodeBin: null, probe };
}

/**
 * Resolve pnpm.cjs absolute path. Order: PNPM_JS env → fixed candidates.
 */
export function resolvePnpmJs(): PnpmJsResolveResult {
  const probe: Record<string, "exists" | "missing"> = {};

  const fromEnv = process.env.PNPM_JS?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { pnpmJs: fromEnv, probe: { [fromEnv]: "exists" } };
  }
  if (fromEnv) probe[fromEnv] = "missing";

  for (const p of PNPM_JS_CANDIDATES) {
    if (existsSync(p)) {
      return { pnpmJs: p, probe: { ...probe, [p]: "exists" } };
    }
    probe[p] = "missing";
  }

  return { pnpmJs: null, probe };
}

export type AtlasTodayResult = {
  ok: boolean;
  dashboardUrl: string;
  coverUrl: string;
  coverMissing: boolean;
  runId: string;
  durationMs: number;
  error?: string;
  failure_mode?: string;
  stderr?: string;
  stdout?: string;
  nodeBinUsed?: string;
  pnpmJsUsed?: string;
  envPath?: string;
  atlasRoot?: string;
  gatewayNodeExec?: string;
  exit_code?: number;
  stderr_snippet?: string;
  stdout_snippet?: string;
};

type ResultContract = {
  run_id: string;
  generated_at?: string;
  item_count: number;
  categories_count?: number;
  coverage?: { overall_ok_rate?: number; pipeline_verdict?: string };
  dashboard_rel_path?: string;
  cover_rel_path_or_url?: string | null;
  cover_missing?: boolean;
};

function runDiscovery(): string | null {
  for (const scriptPath of DISCOVERY_SCRIPT_CANDIDATES) {
    if (!existsSync(scriptPath)) continue;
    try {
      const r = spawnSync("bash", [scriptPath], {
        encoding: "utf-8",
        timeout: 10000,
      });
      if (r.status !== 0) continue;
      const out = (r.stdout || "").trim();
      const jsonMatch = out.match(/\{[\s\S]*"selected_root"[\s\S]*\}/);
      if (!jsonMatch) continue;
      const json = JSON.parse(jsonMatch[0]) as { selected_root?: string; candidates?: string[] };
      const root = json.selected_root?.trim();
      if (!root || !existsSync(root)) continue;
      if (json.candidates && json.candidates.length > 1) return null;
      return root;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function buildUrl(base: string, runId: string): string {
  const b = base.trim();
  if (b.includes("{{run_id}}")) {
    return b.replaceAll("{{run_id}}", encodeURIComponent(runId));
  }
  try {
    const u = new URL(b);
    u.searchParams.set("run_id", runId);
    return u.toString();
  } catch {
    const sep = b.includes("?") ? "&" : "?";
    return `${b}${sep}run_id=${encodeURIComponent(runId)}`;
  }
}

/**
 * Run Atlas pipeline via node + pnpm.cjs (shebang-proof).
 * spawn(nodeBin, [pnpmJs, "-C", root, "run", "atlas:run"])
 */
export async function runAtlasToday(params: {
  atlasRoot: string;
  dashboardUrlBase: string;
  coverUrlBase: string;
  /** PCK-ATLAS-005: Optional progress callback — called every 10s so handler can log/send to TG */
  onProgress?: (msg: string) => void;
}): Promise<AtlasTodayResult> {
  const { atlasRoot, dashboardUrlBase, coverUrlBase, onProgress } = params;
  const start = Date.now();
  const envPath = process.env.PATH ?? "missing";

  // TEST_ATLAS_FORCE_TIMEOUT: for acceptance test only — return timeout immediately
  if (process.env.TEST_ATLAS_FORCE_TIMEOUT === "1") {
    return Promise.resolve({
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: "timeout",
      envPath,
    });
  }

  // Fix-1: ATLAS_ROOT validation — if missing/invalid, try discovery (single unambiguous only)
  let root = atlasRoot?.trim() ? resolve(atlasRoot) : "";
  if (!root || !existsSync(root) || !existsSync(resolve(root, "package.json"))) {
    const discovered = runDiscovery();
    if (discovered) {
      root = discovered;
    } else {
      return {
        ok: false,
        dashboardUrl: "",
        coverUrl: "",
        coverMissing: true,
        runId: "",
        durationMs: Date.now() - start,
        error: "ATLAS_ROOT_INVALID",
        failure_mode: "ATLAS_ROOT_INVALID",
        stderr: atlasRoot?.trim()
          ? `ATLAS_ROOT path invalid: ${root}. Run tools/atlas-root-discovery.sh for suggestions.`
          : "ATLAS_ROOT is empty. Set to atlas-radar root or run tools/atlas-root-discovery.sh.",
        atlasRoot: root || "",
        envPath,
      };
    }
  }
  if (!existsSync(resolve(root, "package.json"))) {
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: "ATLAS_ROOT_INVALID",
      failure_mode: "ATLAS_ROOT_INVALID",
      stderr: `ATLAS_ROOT lacks package.json: ${root}. Set ATLAS_ROOT to the atlas-radar repo root.`,
      atlasRoot: root,
      envPath,
    };
  }
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }
  if (!pkg?.scripts?.["atlas:run"]) {
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: "ATLAS_ROOT_INVALID",
      failure_mode: "ATLAS_ROOT_INVALID",
      stderr: `ATLAS_ROOT package.json lacks scripts.atlas:run: ${root}. Set to atlas-radar repo root.`,
      atlasRoot: root,
      envPath,
    };
  }

  const { nodeBin, probe: nodeProbe } = resolveNodeBin();
  const { pnpmJs, probe: pnpmProbe } = resolvePnpmJs();

  if (!nodeBin) {
    const probeStr = Object.entries(nodeProbe)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: `node_missing: ${probeStr}`,
      nodeBinUsed: "none",
      pnpmJsUsed: "none",
      envPath,
      atlasRoot: root,
      stderr: "hint: set NODE_BIN or PNPM_JS",
    };
  }

  if (!pnpmJs) {
    const probeStr = Object.entries(pnpmProbe)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: `pnpm_js_missing: ${probeStr}`,
      nodeBinUsed: nodeBin,
      pnpmJsUsed: "none",
      envPath,
      atlasRoot: root,
      stderr: "hint: set NODE_BIN or PNPM_JS",
    };
  }

  // Fix-2: fs.access — ensure node executable, pnpm readable before spawn
  let nodeAccess: string;
  try {
    accessSync(nodeBin, constants.X_OK);
    nodeAccess = "X_OK";
  } catch {
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: "BINARY_NOT_EXECUTABLE",
      stderr: `node_bin exists but not executable: ${nodeBin}; hint: set NODE_BIN to executable path`,
      nodeBinUsed: nodeBin,
      pnpmJsUsed: pnpmJs,
      envPath,
      atlasRoot: root,
    };
  }

  try {
    accessSync(pnpmJs, constants.R_OK);
  } catch {
    return {
      ok: false,
      dashboardUrl: "",
      coverUrl: "",
      coverMissing: true,
      runId: "",
      durationMs: Date.now() - start,
      error: "BINARY_NOT_EXECUTABLE",
      stderr: `pnpm.cjs exists but not readable: ${pnpmJs}`,
      nodeBinUsed: nodeBin,
      pnpmJsUsed: pnpmJs,
      envPath,
      atlasRoot: root,
    };
  }

  const gatewayNodeExec = process.execPath;

  const spawnEnv = {
    ...process.env,
    PDF_EXTRACT_ALLOW_FALLBACK: "1",
  };

  return new Promise((resolveResult) => {
    const proc = spawn(nodeBin, [pnpmJs, "-C", root, "run", "atlas:run"], {
      cwd: root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: spawnEnv,
    });

    let stdout = "";
    let stderr = "";
    let progressSent = false;

    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));

    // PCK-ATLAS-005: Emit progress within 10s so handler can log/send to TG
    const progressInterval = setInterval(() => {
      if (!progressSent && onProgress) {
        progressSent = true;
        onProgress("running pipeline… fetching… translating… rendering…");
      }
    }, 10_000);

    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      proc.kill("SIGTERM");
      resolveResult({
        ok: false,
        dashboardUrl: "",
        coverUrl: "",
        coverMissing: true,
        runId: "",
        durationMs: Date.now() - start,
        error: "timeout",
        stderr: stderr.slice(0, TRUNCATE_LEN),
        nodeBinUsed: nodeBin,
        pnpmJsUsed: pnpmJs,
        envPath,
        atlasRoot: root,
      });
    }, ATLAS_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
      const durationMs = Date.now() - start;

      let runId = "";
      for (const line of stdout.split("\n")) {
        const m = line.match(/^run_id=(.+)$/);
        if (m) {
          runId = m[1].trim();
          break;
        }
      }

      if (code !== 0 || !runId) {
        const failureMode = code === 42 ? "ATLAS_PIPELINE_BLOCKED" : undefined;
        resolveResult({
          ok: false,
          dashboardUrl: "",
          coverUrl: "",
          coverMissing: true,
          runId,
          durationMs,
          error: code !== 0 ? `exit ${code}` : "no run_id in output",
          failure_mode: failureMode,
          exit_code: code ?? undefined,
          stderr: stderr ? stderr.slice(0, TRUNCATE_LEN) : undefined,
          stderr_snippet: stderr ? stderr.slice(0, 500) : undefined,
          stdout_snippet: stdout ? stdout.slice(0, 500) : undefined,
          nodeBinUsed: nodeBin,
          pnpmJsUsed: pnpmJs,
          envPath,
          atlasRoot: root,
          gatewayNodeExec: process.execPath,
        });
        return;
      }

      const resultPath = resolve(root, "out", "atlas", runId, "result.json");
      let coverMissing = true;
      let itemsCount = 0;
      let categoriesCount = 0;
      if (existsSync(resultPath)) {
        try {
          const contract = JSON.parse(readFileSync(resultPath, "utf-8")) as ResultContract;
          coverMissing = contract.cover_missing ?? true;
          itemsCount = contract.item_count ?? 0;
          categoriesCount = contract.categories_count ?? 0;
        } catch {
          /* use default */
        }
      }

      const dashboardUrl = buildUrl(dashboardUrlBase, runId);
      const coverUrl = coverMissing ? "" : buildUrl(coverUrlBase, runId);

      const degraded = itemsCount === 0 && categoriesCount === 0;
      resolveResult({
        ok: true,
        dashboardUrl,
        coverUrl,
        coverMissing,
        runId,
        durationMs,
        error: degraded ? "DEGRADED: items_count=0" : undefined,
        failure_mode: degraded ? "ATLAS_DEGRADED" : undefined,
        stderr: stderr ? stderr.slice(0, TRUNCATE_LEN) : undefined,
        nodeBinUsed: nodeBin,
        pnpmJsUsed: pnpmJs,
        envPath,
        atlasRoot: root,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
      const isEnoent = err.message?.includes("ENOENT") || (err as NodeJS.ErrnoException).code === "ENOENT";
      const failureMode = isEnoent ? "SPAWN_FAILED_ENOENT" : "SPAWN_FAILED";
      resolveResult({
        ok: false,
        dashboardUrl: "",
        coverUrl: "",
        coverMissing: true,
        runId: "",
        durationMs: Date.now() - start,
        error: failureMode,
        stderr: `${err.message}${stderr ? `\n${stderr.slice(0, TRUNCATE_LEN)}` : ""}`,
        nodeBinUsed: nodeBin,
        pnpmJsUsed: pnpmJs,
        envPath,
        atlasRoot: root,
        gatewayNodeExec,
      });
    });
  });
}
