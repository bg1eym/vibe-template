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
  chartBarHeightClass,
  renderCandidateCard,
  renderAuditedMatchCard,
  renderAuditSummary,
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

describe("dom.render - renderCandidateCard", () => {
  it("renders candidate card with source info and no script injection", () => {
    const doc = setupDom();
    const xss = "<script>alert(1)</script>";
    const card = renderCandidateCard(
      doc,
      {
        id: "c1",
        source: { work_cn: xss, source_id: "Dune", author: "Author" },
        scene_cn: xss,
        mapping_cn: xss,
        why_this_is_relevant_cn: xss,
        quote_en: xss,
        confidence: 0.9,
      },
      0,
    );
    const html = card.outerHTML;
    expect(html).not.toContain("<script");
    expect(card.className).toContain("candidate-card");
  });

  it("renders feedback action buttons (keep/reject/boost/improve)", () => {
    const doc = setupDom();
    const clicked: string[] = [];
    const card = renderCandidateCard(
      doc,
      {
        id: "fb-test",
        source: { work_cn: "沙丘", source_id: "Dune" },
        scene_cn: "角色训练场景",
        mapping_cn: "映射描述",
        why_this_is_relevant_cn: "解释",
        confidence: 0.8,
      },
      0,
      {
        onKeep: (id: string) => clicked.push("keep:" + id),
        onReject: (id: string) => clicked.push("reject:" + id),
        onBoost: (id: string) => clicked.push("boost:" + id),
        onImprove: (id: string) => clicked.push("improve:" + id),
      },
    );
    expect(card.querySelector(".action-keep")).toBeTruthy();
    expect(card.querySelector(".action-reject")).toBeTruthy();
    expect(card.querySelector(".action-boost")).toBeTruthy();
    expect(card.querySelector(".action-improve")).toBeTruthy();

    // Simulate clicks and verify callbacks
    (card.querySelector(".action-keep") as HTMLElement).click();
    (card.querySelector(".action-reject") as HTMLElement).click();
    (card.querySelector(".action-boost") as HTMLElement).click();
    (card.querySelector(".action-improve") as HTMLElement).click();
    expect(clicked).toEqual(["keep:fb-test", "reject:fb-test", "boost:fb-test", "improve:fb-test"]);
  });

  it("clicking feedback buttons changes card data-feedback and CSS class", () => {
    const doc = setupDom();
    const card = renderCandidateCard(
      doc,
      {
        id: "state-test",
        source: { work_cn: "沙丘" },
        scene_cn: "场景",
        mapping_cn: "映射",
        why_this_is_relevant_cn: "解释",
        confidence: 0.8,
      },
      0,
      {},
    );
    // Initially no feedback state
    expect(card.dataset.feedback).toBeFalsy();
    expect(card.classList.contains("fb-keep")).toBe(false);

    // Click keep → sets data-feedback="keep" and fb-keep class
    (card.querySelector(".action-keep") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("keep");
    expect(card.classList.contains("fb-keep")).toBe(true);
    expect(card.classList.contains("fb-reject")).toBe(false);

    // Click keep again → toggles off
    (card.querySelector(".action-keep") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("");
    expect(card.classList.contains("fb-keep")).toBe(false);

    // Click reject → sets data-feedback="reject"
    (card.querySelector(".action-reject") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("reject");
    expect(card.classList.contains("fb-reject")).toBe(true);

    // Click boost → switches from reject to boost
    (card.querySelector(".action-boost") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("boost");
    expect(card.classList.contains("fb-boost")).toBe(true);
    expect(card.classList.contains("fb-reject")).toBe(false);
  });
});

describe("dom.render - renderAuditedMatchCard", () => {
  it("renders audited card with scores, verdict badge, and action buttons", () => {
    const doc = setupDom();
    const card = renderAuditedMatchCard(
      doc,
      {
        id: "test-1",
        source: { work_cn: "沙丘", source_id: "Dune", author: "Frank Herbert" },
        scene_cn: "角色在沙漠中训练",
        mapping_cn: "映射内容",
        why_this_is_relevant_cn: "解释内容",
        quote_en: "Spice extends life",
        confidence: 0.9,
        audit: {
          score: {
            relevance: 4,
            specificity: 3,
            mechanism_fit: 4,
            novelty: 3,
            human_plausibility: 4,
          },
          total: 36,
          verdict: "keep",
          reasons_cn: ["类比具体"],
          fix_suggestions_cn: [],
        },
      },
      0,
    );
    const html = card.outerHTML;
    expect(html).not.toContain("<script");
    expect(html).toContain("保留"); // verdict badge
    expect(html).toContain("相关:4"); // score badge
    expect(html).toContain("总分:36");
    expect(card.querySelector(".action-keep")).toBeTruthy();
    expect(card.querySelector(".action-reject")).toBeTruthy();
    expect(card.querySelector(".action-boost")).toBeTruthy();
  });

  it("audited card feedback buttons toggle data-feedback and CSS class", () => {
    const doc = setupDom();
    const card = renderAuditedMatchCard(
      doc,
      {
        id: "audited-fb",
        source: { work_cn: "沙丘" },
        scene_cn: "场景",
        mapping_cn: "映射",
        why_this_is_relevant_cn: "解释",
        confidence: 0.9,
        audit: {
          score: {
            relevance: 4,
            specificity: 3,
            mechanism_fit: 4,
            novelty: 3,
            human_plausibility: 4,
          },
          total: 36,
          verdict: "keep",
          reasons_cn: [],
          fix_suggestions_cn: [],
        },
      },
      0,
    );

    // Click keep → fb-keep
    (card.querySelector(".action-keep") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("keep");
    expect(card.classList.contains("fb-keep")).toBe(true);

    // Click reject → switches to fb-reject
    (card.querySelector(".action-reject") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("reject");
    expect(card.classList.contains("fb-reject")).toBe(true);
    expect(card.classList.contains("fb-keep")).toBe(false);

    // Click reject again → toggles off
    (card.querySelector(".action-reject") as HTMLElement).click();
    expect(card.dataset.feedback).toBe("");
    expect(card.classList.contains("fb-reject")).toBe(false);
  });

  it("renders 8+ audited cards without script injection", () => {
    const doc = setupDom();
    const xss = "<script>alert(1)</script>";
    const cards: HTMLElement[] = [];
    for (let i = 0; i < 10; i++) {
      cards.push(
        renderAuditedMatchCard(
          doc,
          {
            id: `test-${i}`,
            source: { work_cn: xss },
            scene_cn: xss,
            mapping_cn: xss,
            why_this_is_relevant_cn: xss,
            confidence: 0.8,
            audit: {
              score: {
                relevance: 3,
                specificity: 3,
                mechanism_fit: 3,
                novelty: 3,
                human_plausibility: 3,
              },
              total: 30,
              verdict: "maybe",
              reasons_cn: [xss],
              fix_suggestions_cn: [xss],
            },
          },
          i,
        ),
      );
    }
    expect(cards.length).toBe(10);
    for (const card of cards) {
      expect(card.outerHTML).not.toContain("<script");
    }
  });
});

describe("dom.render - renderAuditSummary", () => {
  it("renders audit summary with stats", () => {
    const doc = setupDom();
    const el = renderAuditSummary(doc, {
      pass: true,
      keep_count: 8,
      maybe_count: 2,
      reject_count: 1,
      avg_relevance: 3.5,
      avg_total: 32.1,
      common_failures: ["类比太弱"],
    });
    const html = el.outerHTML;
    expect(html).toContain("审核通过");
    expect(html).toContain("保留 8");
    expect(html).toContain("类比太弱");
  });
});

describe("chartBarHeightClass - 5% step mapping", () => {
  it("rounds to nearest 5%", () => {
    expect(chartBarHeightClass(0)).toBe("h-0");
    expect(chartBarHeightClass(2)).toBe("h-0");
    expect(chartBarHeightClass(3)).toBe("h-5");
    expect(chartBarHeightClass(50)).toBe("h-50");
    expect(chartBarHeightClass(52)).toBe("h-50");
    expect(chartBarHeightClass(53)).toBe("h-55");
    expect(chartBarHeightClass(100)).toBe("h-100");
  });

  it("clamps to 0-100", () => {
    expect(chartBarHeightClass(-10)).toBe("h-0");
    expect(chartBarHeightClass(150)).toBe("h-100");
  });
});
