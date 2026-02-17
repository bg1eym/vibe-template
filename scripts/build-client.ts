/**
 * Build client JS (esbuild) + copy CSS to dist/public.
 * Cross-platform: no shell cp, works on Windows/CI.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const src = join(root, "src", "client");
const out = join(root, "dist", "public");

async function main() {
  mkdirSync(out, { recursive: true });

  await build({
    entryPoints: [join(src, "studio.ts"), join(src, "ui.ts")],
    bundle: true,
    format: "iife",
    outdir: out,
  });

  copyFileSync(join(src, "studio.css"), join(out, "studio.css"));
  copyFileSync(join(src, "ui.css"), join(out, "ui.css"));

  process.stdout.write("Built dist/public/{studio,ui}.{js,css}\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
