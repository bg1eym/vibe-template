import { writeFile } from "node:fs/promises";
import { OPENAPI_SPEC } from "../src/lib/openapiSpec.js";

function stableStringify(obj: unknown) {
  return JSON.stringify(obj, null, 2) + "\n";
}

async function main() {
  const out = stableStringify(OPENAPI_SPEC);
  await writeFile("docs/openapi.json", out, "utf-8");
  process.stdout.write("Wrote docs/openapi.json\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
