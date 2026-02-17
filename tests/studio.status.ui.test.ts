import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { applyLoadingText, formatDoneStatus, formatErrorStatus } from "../src/client/statusUi.js";

describe("studio status ui", () => {
  it("applyLoadingText sets loading text for different actions", () => {
    const dom = new JSDOM(
      '<div id="cards-loading" class="loading"><span class="loading-text">x</span></div>',
    );
    const el = dom.window.document.getElementById("cards-loading") as HTMLElement;
    applyLoadingText(el, "正在生成候选...");
    expect(el.querySelector(".loading-text")?.textContent).toBe("正在生成候选...");
    applyLoadingText(el, "正在重排...");
    expect(el.querySelector(".loading-text")?.textContent).toBe("正在重排...");
    applyLoadingText(el, "正在改进选中条目...");
    expect(el.querySelector(".loading-text")?.textContent).toBe("正在改进选中条目...");
  });

  it("formatDoneStatus includes req_id and elapsedMs", () => {
    expect(formatDoneStatus("abcd1234", 88)).toContain("[abcd1234] 完成，用时 88 ms");
  });

  it("formatErrorStatus includes route/status/detail and optional req_id", () => {
    const a = formatErrorStatus("r1", "/match_scifi_ai", 503, "bad upstream");
    expect(a).toContain("[r1] POST /match_scifi_ai 失败：status=503 bad upstream");
    const b = formatErrorStatus(undefined, "/match_scifi_ai", undefined, "network error");
    expect(b).toContain("POST /match_scifi_ai 失败：network error");
  });
});
