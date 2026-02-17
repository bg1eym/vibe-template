import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ajv = new Ajv({ allErrors: true });

export function loadSchema(name: string) {
  const path = resolve(__dirname, "..", "contracts", `${name}.schema.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function validateAgainst(name: string, data: unknown): { ok: boolean; errors?: string[] } {
  const schema = loadSchema(name);
  const validate = ajv.compile(schema);
  if (validate(data)) return { ok: true };
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
  return { ok: false, errors };
}
