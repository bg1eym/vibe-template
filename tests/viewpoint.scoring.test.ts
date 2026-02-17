import { describe, it, expect } from "vitest";
import { scoreClaimAgainstViewpoint } from "../src/services/viewpointScoring.js";
import { VIEWPOINT_LIBRARY } from "../src/data/viewpointLibrary.js";

describe("viewpoint scoring", () => {
  it("returns stable deterministic score breakdown", () => {
    const claim = "医疗自动化出现效率提升但训练不足，导致误判风险与问责压力";
    const vps = VIEWPOINT_LIBRARY.slice(0, 8);
    const mechanisms = [
      { point_id: 0, mechanism_id: "M01", why_this_mechanism_cn: "", evidence_quote_cn: "" },
    ];
    const scores = scoreClaimAgainstViewpoint(claim, vps, mechanisms);
    expect(scores.length).toBe(8);
    expect(scores[0].total).toBeGreaterThanOrEqual(scores[1].total);
    expect(scores[0]).toMatchObject({
      vp_id: expect.any(String),
      keyword_hit: expect.any(Number),
      question_hit: expect.any(Number),
      mechanism_overlap: expect.any(Number),
      total: expect.any(Number),
    });
  });
});
