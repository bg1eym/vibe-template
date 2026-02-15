import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { classify } from "../src/lib/classifier.js";

const DEFAULT_RULES = join(process.cwd(), "data", "classifier_rules.json");
const ALT_RULES = join(process.cwd(), "tests", "fixtures", "classifier_rules_alt.json");

describe("classifier", () => {
  it("returns top 3 categories from default rules", () => {
    const result = classify("space travel and robots in the future", DEFAULT_RULES);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.every((r) => r.score > 0)).toBe(true);
    const cats = result.map((r) => r.category);
    expect(cats).toContain("space");
    expect(cats).toContain("ai");
  });

  it("classification changes when rules file changes (engine is configurable)", () => {
    const text = "space travel and robots in the future";

    const defaultResult = classify(text, DEFAULT_RULES);
    const altResult = classify(text, ALT_RULES);

    expect(defaultResult).not.toEqual(altResult);

    const defaultCats = defaultResult.map((r) => r.category);
    const altCats = altResult.map((r) => r.category);

    expect(defaultCats).not.toEqual(altCats);
  });

  it("respects required_keywords from rules file", () => {
    const requiredPath = join(process.cwd(), "tests", "fixtures", "classifier_rules_required.json");
    const resultNoRocket = classify("robots and future", requiredPath);
    const resultWithRocket = classify("rocket launch and space", requiredPath);
    expect(resultNoRocket.some((r) => r.category === "space")).toBe(false);
    expect(resultWithRocket.some((r) => r.category === "space")).toBe(true);
  });
});
