import { describe, it, expect } from "vitest";
import {
  VIEWPOINT_LIBRARY,
  validateViewpointLibrary,
  type ViewpointEntry,
} from "../src/data/viewpointLibrary.js";

describe("viewpoint library", () => {
  it("has at least 200 entries", () => {
    expect(VIEWPOINT_LIBRARY.length).toBeGreaterThanOrEqual(200);
  });

  it("passes full validation", () => {
    const errs = validateViewpointLibrary(VIEWPOINT_LIBRARY);
    expect(errs).toEqual([]);
  });

  it("reports invalid vp_id and field details", () => {
    const bad: ViewpointEntry[] = [
      {
        ...VIEWPOINT_LIBRARY[0],
        vp_id: "VP001",
        routing_intents_cn: ["不存在意图"],
        related_mechanism_ids: ["M999"],
        diagnostic_questions_cn: ["q1"],
        evidence_patterns: ["a"],
        examples: ["x"],
      },
      {
        ...VIEWPOINT_LIBRARY[1],
        vp_id: "VP001",
      },
    ];
    const errs = validateViewpointLibrary(bad);
    expect(errs.some((x) => x.includes("duplicate vp_id"))).toBe(true);
    expect(
      errs.some((x) => x.includes("invalid routing_intent") || x.includes("routing_intents_cn")),
    ).toBe(true);
    expect(errs.some((x) => x.includes("invalid mechanism_id"))).toBe(true);
  });
});
