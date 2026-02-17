import { describe, it, expect } from "vitest";
import { buildImproveRequestBody } from "../src/client/matchFeedbackPayload.js";

describe("studio improve payload", () => {
  it("includes selected target_ids and feedback in request body", () => {
    const body = buildImproveRequestBody({
      analysis: { a: 1 },
      selectedPoints: ["点1", "点2"],
      candidates: [{ id: "c1" }, { id: "c2" }],
      targetIds: ["c2"],
      feedback: {
        keep_ids: ["c1"],
        reject_ids: ["c3"],
        boost_ids: ["c2"],
      },
    });

    expect(body).toMatchObject({
      selected_points: ["点1", "点2"],
      target_ids: ["c2"],
      feedback: {
        keep_ids: ["c1"],
        reject_ids: ["c3"],
        boost_ids: ["c2"],
      },
    });
  });
});
