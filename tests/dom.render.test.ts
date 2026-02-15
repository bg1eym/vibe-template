/**
 * DOM 渲染安全测试：验证渲染后的 DOM 不包含 <script，且所有用户输入只进入 textContent。
 * 防止回退：若有人恢复 innerHTML 拼接或未转义插入，此测试会失败。
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  renderTrackCard,
  renderOutline,
  renderEvidenceChain,
  renderPlotCard,
  renderItem,
  renderChartBar,
  renderChartLabel,
} from "../src/lib/view/domBuilders.js";

function setupDom(): Document {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  return dom.window.document;
}

describe("dom.render - no script in output", () => {
  it("renderTrackCard: malicious input in textContent only, no <script in serialized HTML", () => {
    const doc = setupDom();
    const xss = "<script>alert(1)</script><img onerror=alert(1)>";
    const el = renderTrackCard(doc, {
      trackId: "t1",
      title: xss,
      confidence: 0.9,
      categories: [xss],
      mechanisms: [],
      whyThisTrack: xss,
    });
    const html = el.outerHTML;
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    const titleEl = el.querySelector(".track-card-title");
    expect(titleEl?.textContent).toBe(xss);
  });

  it("renderOutline: user content only in textContent", () => {
    const doc = setupDom();
    const xss = "<script>evil</script>";
    const el = renderOutline(doc, {
      opening_hook: xss,
      framing: [xss],
      debate: { thesis: xss, antithesis: "", synthesis: "" },
      analogy_scenarios: [],
      counterexamples: [],
      closing: xss,
    });
    const html = el.outerHTML;
    expect(html).not.toContain("<script");
  });

  it("renderEvidenceChain: ref content only in textContent", () => {
    const doc = setupDom();
    const xss = "<script>alert(1)</script>";
    const el = renderEvidenceChain(doc, [
      {
        categories: ["cat"],
        mechanisms: ["mech"],
        scifiRefs: [{ source_id: "Dune", title_cn: "沙丘", hook_cn: xss, quote_en: xss }],
      },
    ]);
    const html = el.outerHTML;
    expect(html).not.toContain("<script");
  });

  it("renderPlotCard: card content only in textContent", () => {
    const doc = setupDom();
    const xss = "<script>evil</script>";
    const el = renderPlotCard(
      doc,
      {
        scene_title_cn: xss,
        plot_summary_cn: xss,
        mapping_cn: xss,
        podcast_question_cn: xss,
        source_quote_en: xss,
      },
      0,
    );
    const html = el.outerHTML;
    expect(html).not.toContain("<script");
  });

  it("renderItem: item content only in textContent", () => {
    const doc = setupDom();
    const xss = "<img src=x onerror=alert(1)>";
    const el = renderItem(doc, {
      title: xss,
      content: xss,
      tags: [xss],
    });
    const html = el.outerHTML;
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/<img[^>]*onerror/i);
  });

  it("renderChartBar and renderChartLabel: label only in textContent", () => {
    const doc = setupDom();
    const xss = "<script>evil</script>";
    const bar = renderChartBar(doc, xss, 50, 5);
    const label = renderChartLabel(doc, xss);
    expect(bar.outerHTML).not.toContain("<script");
    expect(label.outerHTML).not.toContain("<script");
    expect(label.textContent).toBe(xss);
  });
});
