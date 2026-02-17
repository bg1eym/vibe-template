/**
 * OpenClaw plugin: /bind command triggers oc:bind and returns 6-line summary.
 * Only active when OC_BIND_ENABLED=1.
 */
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIND_TIMEOUT_MS = 10_000;
const DEFAULT_CWD = process.env.OC_BIND_CWD || resolve(__dirname, "..");

function extractSixLines(stdout: string): string {
  const want = [
    "task_id:",
    "source_message_id:",
    "source_ts:",
    "top3:",
    "trace_path:",
    "report_path:",
  ];
  const found: string[] = [];
  for (const prefix of want) {
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (t.startsWith(prefix)) {
        found.push(t);
        break;
      }
    }
  }
  return found.join("\n") || stdout.slice(0, 500);
}

export default function register(api: OpenClawPluginApi) {
  if (process.env.OC_BIND_ENABLED !== "1") {
    return;
  }

  const cwd =
    (api.pluginConfig as { cwd?: string } | undefined)?.cwd ||
    process.env.OC_BIND_CWD ||
    DEFAULT_CWD;

  api.registerCommand({
    name: "bind",
    description: "Trigger oc-personal-agent-lab pipeline and return summary (OC_BIND_ENABLED=1)",
    acceptsArgs: true,
    requireAuth: true,
    handler: async () => {
      return new Promise<{ text: string }>((resolveHandler) => {
        const proc = spawn("npm", ["run", "oc:bind"], {
          cwd,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (d) => (stdout += d.toString()));
        proc.stderr?.on("data", (d) => (stderr += d.toString()));

        const timeout = setTimeout(() => {
          proc.kill("SIGTERM");
          resolveHandler({ text: "bind_error: timeout" });
          logStderr(api, stderr, cwd);
        }, BIND_TIMEOUT_MS);

        proc.on("close", (code) => {
          clearTimeout(timeout);
          if (code !== 0) {
            const reason = stderr.split("\n")[0]?.slice(0, 80) || `exit ${code}`;
            resolveHandler({ text: `bind_error: ${reason}` });
            logStderr(api, stderr, cwd);
            return;
          }
          const six = extractSixLines(stdout);
          resolveHandler({ text: six || "bind_error: no output" });
        });

        proc.on("error", (err) => {
          clearTimeout(timeout);
          resolveHandler({ text: `bind_error: ${err.message}` });
          logStderr(api, stderr, cwd);
        });
      });
    },
  });
}

function logStderr(api: OpenClawPluginApi, stderr: string, cwd: string) {
  try {
    api.logger?.error?.("[oc-bind] stderr:", stderr.slice(0, 500));
    const debugPath = resolve(cwd, "out", "ingest_debug.json");
    mkdirSync(resolve(cwd, "out"), { recursive: true });
    writeFileSync(
      debugPath,
      JSON.stringify(
        {
          bind_stderr: stderr.slice(0, 2000),
          cwd,
          ts: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    /* ignore */
  }
}
