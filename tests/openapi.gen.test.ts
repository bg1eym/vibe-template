import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { OPENAPI_SPEC } from "../src/lib/openapiSpec.js";

describe("openapi generation", () => {
  it("docs/openapi.json matches OPENAPI_SPEC", async () => {
    const raw = await readFile("docs/openapi.json", "utf-8");
    const json = JSON.parse(raw);
    expect(json).toEqual(OPENAPI_SPEC);
  });
});
