import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { renderProcessTrace } from "../src/client/processTrace.js";
import { renderImproveButton } from "../src/client/controls.js";
import { renderCandidateCard } from "../src/lib/view/domBuilders.js";

function setupDom(): Document {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  return dom.window.document;
}

describe("studio process panel dom", () => {
  it("renders points and mechanisms in process trace panel", () => {
    const doc = setupDom();
    const el = renderProcessTrace(doc, {
      selected_points: [{ point_cn: "新闻点A", evidence_cn: "证据片段A" }],
      claims: [
        {
          claim_id: "c1",
          claim_cn: "主张A",
          evidence_quote_cn: "证据A",
          vp_pick_name_cn: "技能退化观点",
        },
      ],
      mechanisms: [
        { mechanism_id: "M10", name_cn: "技能退化", why_this_mechanism_cn: "自动化替代训练" },
      ],
      candidates_count: 12,
      status_text: "正在重排...",
    });
    const html = el.outerHTML;
    expect(html).toContain("过程面板");
    expect(html).toContain("选中的新闻 points");
    expect(html).toContain("新闻点A");
    expect(html).toContain("证据片段A");
    expect(html).toContain("主张A");
    expect(html).toContain("技能退化");
    expect(html).toContain("正在重排");
  });

  it("candidate card has collapsible synopsis blocks", () => {
    const doc = setupDom();
    const card = renderCandidateCard(
      doc,
      {
        id: "c1",
        source: { work_cn: "沙丘", author: "Frank Herbert" },
        scene_cn: "剧情节点A",
        mapping_cn: "映射A",
        why_this_is_relevant_cn: "解释A",
        synopsis_cn: "梗概A",
        quote_en: "quote text",
        confidence: 0.8,
      },
      0,
    );
    expect(card.querySelectorAll("details.card-field").length).toBeGreaterThanOrEqual(3);
    expect(card.querySelector("summary.card-field-label")?.textContent).toContain("剧情节点");
    expect(card.querySelector("details.synopsis-details")).toBeTruthy();
    expect(card.querySelector("div.quote-toggle")).toBeTruthy();
  });
});

describe("studio improve button dom state", () => {
  it("improve button disabled when selected count is 0", () => {
    const doc = setupDom();
    const onClick = vi.fn();
    const btn = renderImproveButton(doc, 0, onClick);
    expect(btn.disabled).toBe(true);
  });

  it("improve button enabled when selected count is 1", () => {
    const doc = setupDom();
    const onClick = vi.fn();
    const btn = renderImproveButton(doc, 1, onClick);
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
