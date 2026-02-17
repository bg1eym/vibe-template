#!/usr/bin/env -S npx tsx
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function run(cmd: string) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

export function runPipeline() {
  run("npm run run:parse");
  run("npm run run:match");
  run("npm run eval");
  run("npm run oc:smoke");
}
