/**
 * Studio client: uses DOM builders only (no innerHTML with user data).
 * Bundled to public/studio.js for browser.
 */
import {
  renderTrackCard,
  renderOutline,
  renderOutlineExpand,
  renderEvidenceChain,
  renderPlotCard,
  type EvidenceLinkData,
  type PlotCardData,
} from "../lib/view/domBuilders.js";

declare const document: Document;

function tokenVal(): string {
  const v = (document.getElementById("token") as HTMLInputElement)?.value?.trim() || "";
  return v ? (v.startsWith("user_") ? v : "user_" + v) : "";
}

function showError(msg: string): void {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = msg || "";
    (el as HTMLElement).style.display = msg ? "block" : "none";
  }
}

function toast(msg: string): void {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function clearAndAppend(container: HTMLElement, child: Node): void {
  container.textContent = "";
  container.appendChild(child);
}

function main(): void {
  let analyzeData: Record<string, unknown> | null = null;
  let selectedTrackId: string | null = null;

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      const tabId = (t as HTMLElement).dataset.tab;
      const content = document.getElementById("tab-" + tabId);
      if (content) content.classList.add("active");
    });
  });

  document.getElementById("analyze")?.addEventListener("click", () => {
    const t = tokenVal();
    const text = (document.getElementById("text") as HTMLTextAreaElement)?.value?.trim() || "";
    if (!t) {
      showError("请先设置令牌。");
      return;
    }
    if (!text) {
      showError("请输入要分析的文本。");
      return;
    }
    showError("");
    const btn = document.getElementById("analyze") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "分析中…";

    fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ text }),
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            showError("401 未授权，请检查令牌。");
            return;
          }
          return r.json().then((b: { error?: { message?: string } }) => {
            showError((b.error?.message as string) || String(r.status));
          });
        }
        return r.json();
      })
      .then((data: { success?: boolean; data?: Record<string, unknown> }) => {
        btn.disabled = false;
        btn.textContent = "分析";
        if (data?.success && data.data) {
          analyzeData = data.data;
          selectedTrackId = null;
          showError("");
          toast("分析完成");

          const tracks = (analyzeData.recommendedTracks as Array<Record<string, unknown>>) || [];
          const tracksList = document.getElementById("tracks-list");
          if (tracksList) {
            tracksList.textContent = "";
            for (const tr of tracks) {
              const card = renderTrackCard(document, {
                trackId: String(tr.trackId ?? ""),
                title: String(tr.title ?? ""),
                confidence: Number(tr.confidence ?? 0),
                categories: (tr.categories as string[]) || [],
                mechanisms: (tr.mechanisms as string[]) || [],
                whyThisTrack: String(tr.whyThisTrack ?? ""),
              });
              card.addEventListener("click", () => {
                document
                  .querySelectorAll(".track-card")
                  .forEach((c) => c.classList.remove("selected"));
                card.classList.add("selected");
                selectedTrackId = card.dataset.trackId ?? null;
              });
              tracksList.appendChild(card);
            }
          }

          (document.getElementById("tracks-section") as HTMLElement).style.display = "block";
          (document.getElementById("expand-section") as HTMLElement).style.display = "block";

          const o = analyzeData.podcastOutline as Record<string, unknown> | undefined;
          const outlineContent = document.getElementById("outline-content");
          const outlineEmpty = document.getElementById("outline-empty");
          if (o && outlineContent && outlineEmpty) {
            outlineEmpty.style.display = "none";
            outlineContent.style.display = "block";
            clearAndAppend(outlineContent, renderOutline(document, o));
          } else if (outlineEmpty && outlineContent) {
            outlineEmpty.style.display = "block";
            outlineContent.style.display = "none";
          }

          const ec = (analyzeData.evidenceChain as Array<Record<string, unknown>>) || [];
          const evidenceContent = document.getElementById("evidence-content");
          const evidenceEmpty = document.getElementById("evidence-empty");
          if (ec.length > 0 && evidenceContent && evidenceEmpty) {
            evidenceEmpty.style.display = "none";
            evidenceContent.style.display = "block";
            const onQuoteToggle = (ei: number, ri: number) => {
              const el = document.getElementById("ev-quote-" + ei + "-" + ri);
              const tog = document.querySelector(
                `[data-evidx="${ei}"][data-refidx="${ri}"]`,
              ) as HTMLElement;
              if (el && tog) {
                (el as HTMLElement).style.display =
                  (el as HTMLElement).style.display === "none" ? "block" : "none";
                tog.textContent =
                  (el as HTMLElement).style.display === "none"
                    ? "引用原文（点击展开）"
                    : "引用原文（点击折叠）";
              }
            };
            clearAndAppend(
              evidenceContent,
              renderEvidenceChain(document, ec as EvidenceLinkData[], onQuoteToggle),
            );
          } else if (evidenceEmpty && evidenceContent) {
            evidenceEmpty.style.display = "block";
            evidenceContent.style.display = "none";
          }
        }
      })
      .catch((e: Error) => {
        btn.disabled = false;
        btn.textContent = "分析";
        showError(e.message || "请求失败");
      });
  });

  document.getElementById("expand")?.addEventListener("click", () => {
    const t = tokenVal();
    const text = (document.getElementById("text") as HTMLTextAreaElement)?.value?.trim() || "";
    if (!t) {
      showError("请先设置令牌。");
      return;
    }
    if (!text) {
      showError("请输入要分析的文本。");
      return;
    }
    if (!analyzeData) {
      showError("请先执行分析。");
      return;
    }
    if (!selectedTrackId) {
      showError("请先选择一条推荐路径。");
      return;
    }
    showError("");
    (document.getElementById("cards-empty") as HTMLElement).style.display = "none";
    (document.getElementById("cards-list") as HTMLElement).style.display = "none";
    (document.getElementById("cards-loading") as HTMLElement).style.display = "flex";
    (document.getElementById("outline-empty") as HTMLElement).style.display = "block";
    (document.getElementById("outline-content") as HTMLElement).style.display = "none";
    (document.getElementById("evidence-empty") as HTMLElement).style.display = "block";
    (document.getElementById("evidence-content") as HTMLElement).style.display = "none";

    fetch("/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ text, selectedTrackId }),
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            showError("401 未授权，请检查令牌。");
            return;
          }
          return r.json().then((b: { error?: { message?: string } }) => {
            showError((b.error?.message as string) || String(r.status));
          });
        }
        return r.json();
      })
      .then((data: { success?: boolean; data?: Record<string, unknown> }) => {
        (document.getElementById("cards-loading") as HTMLElement).style.display = "none";
        if (data?.success && data.data) {
          const d = data.data;
          const cards = (d.plotSupportCards as Array<Record<string, unknown>>) || [];
          const cardsEmpty = document.getElementById("cards-empty");
          const cardsList = document.getElementById("cards-list");
          if (cards.length === 0 && cardsEmpty) {
            cardsEmpty.style.display = "block";
            cardsEmpty.textContent = "暂无剧情支撑卡片。";
          } else if (cardsList && cardsEmpty) {
            cardsList.style.display = "block";
            cardsList.textContent = "";
            const onQuoteToggle = (i: number) => {
              const el = document.getElementById("quote-" + i);
              const tog = document.querySelector(`[data-idx="${i}"]`) as HTMLElement;
              if (el && tog) {
                el.classList.toggle("open");
                tog.textContent = el.classList.contains("open")
                  ? "引用原文（点击折叠）"
                  : "引用原文（点击展开）";
              }
            };
            cards.forEach((c, i) => {
              const card = renderPlotCard(document, c as PlotCardData, i, onQuoteToggle);
              cardsList.appendChild(card);
            });
            toast("已生成 " + cards.length + " 条剧情支撑");
          }

          const outline = d.podcastOutline as Record<string, unknown> | undefined;
          const outlineContent = document.getElementById("outline-content");
          const outlineEmpty = document.getElementById("outline-empty");
          if (outline && outlineContent && outlineEmpty) {
            outlineEmpty.style.display = "none";
            outlineContent.style.display = "block";
            clearAndAppend(outlineContent, renderOutlineExpand(document, outline));
          } else if (outlineEmpty && outlineContent) {
            outlineEmpty.style.display = "block";
            outlineContent.style.display = "none";
          }

          const evidence = (d.evidenceChain as Array<Record<string, unknown>>) || [];
          const evidenceContent = document.getElementById("evidence-content");
          const evidenceEmpty = document.getElementById("evidence-empty");
          if (evidence.length > 0 && evidenceContent && evidenceEmpty) {
            evidenceEmpty.style.display = "none";
            evidenceContent.style.display = "block";
            const onQuoteToggle = (ei: number, ri: number) => {
              const el = document.getElementById("ev-quote-" + ei + "-" + ri);
              const tog = document.querySelector(
                `[data-evidx="${ei}"][data-refidx="${ri}"]`,
              ) as HTMLElement;
              if (el && tog) {
                (el as HTMLElement).style.display =
                  (el as HTMLElement).style.display === "none" ? "block" : "none";
                tog.textContent =
                  (el as HTMLElement).style.display === "none"
                    ? "引用原文（点击展开）"
                    : "引用原文（点击折叠）";
              }
            };
            clearAndAppend(
              evidenceContent,
              renderEvidenceChain(document, evidence as EvidenceLinkData[], onQuoteToggle),
            );
          } else if (evidenceEmpty && evidenceContent) {
            evidenceEmpty.style.display = "block";
            evidenceEmpty.textContent = "暂无证据链数据。";
            evidenceContent.style.display = "none";
          }
        }
      })
      .catch((e: Error) => {
        (document.getElementById("cards-loading") as HTMLElement).style.display = "none";
        const cardsEmpty = document.getElementById("cards-empty");
        if (cardsEmpty) {
          cardsEmpty.style.display = "block";
          cardsEmpty.textContent = "请求失败：" + (e.message || "未知错误");
        }
        showError(e.message || "请求失败");
      });
  });
}

main();
