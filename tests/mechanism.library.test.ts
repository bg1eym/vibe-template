import { describe, it, expect } from "vitest";
import { MECHANISM_LIBRARY } from "../src/data/mechanismLibrary.js";

describe("mechanism library", () => {
  it("loads successfully with at least 30 mechanisms", () => {
    expect(Array.isArray(MECHANISM_LIBRARY)).toBe(true);
    expect(MECHANISM_LIBRARY.length).toBeGreaterThanOrEqual(30);
  });

  it("mechanism_id should be unique", () => {
    const ids = MECHANISM_LIBRARY.map((m) => m.mechanism_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("required fields should be non-empty", () => {
    for (const m of MECHANISM_LIBRARY) {
      expect((m.mechanism_id ?? "").length).toBeGreaterThan(0);
      expect((m.name_cn ?? "").length).toBeGreaterThan(0);
      expect((m.definition_cn ?? "").length).toBeGreaterThan(0);
      expect(Array.isArray(m.diagnostic_questions_cn)).toBe(true);
      expect(m.diagnostic_questions_cn.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(m.routing_intents_cn)).toBe(true);
      expect(m.routing_intents_cn.length).toBeGreaterThanOrEqual(2);
    }
  });
});
