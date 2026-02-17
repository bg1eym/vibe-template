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
  renderNewsPointCard,
  renderCandidateCard,
  renderAuditedMatchCard,
  renderAuditSummary,
  type EvidenceLinkData,
  type PlotCardData,
  type NewsPointData,
  type CandidateCardData,
  type AuditedMatchData,
  type AuditSummaryData,
  type CandidateCardCallbacks,
} from "../lib/view/domBuilders.js";
import { buildImproveRequestBody } from "./matchFeedbackPayload.js";
import { renderProcessTrace, type ProcessMechanism, type ProcessPoint } from "./processTrace.js";
import { MECHANISM_BY_ID } from "../data/mechanismLibrary.js";
import { renderImproveButton } from "./controls.js";
import { VIEWPOINT_BY_ID } from "../data/viewpointLibrary.js";
import { applyLoadingText, formatDoneStatus } from "./statusUi.js";

declare const document: Document;

function tokenVal(): string {
  const v = (document.getElementById("token") as HTMLInputElement)?.value?.trim() || "";
  return v ? (v.startsWith("user_") ? v : "user_" + v) : "";
}

function showError(msg: string): void {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = msg || "";
    (el as HTMLElement).classList.toggle("visible", !!msg);
  }
}

function toast(msg: string): void {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function showStatus(msg: string): void {
  const el = document.getElementById("cards-loading");
  if (el) {
    applyLoadingText(el as HTMLElement, msg);
  }
}

function hideStatus(): void {
  const el = document.getElementById("cards-loading");
  if (el) el.classList.remove("visible");
}

function clearAndAppend(container: HTMLElement, child: Node): void {
  container.textContent = "";
  container.appendChild(child);
}

type ApiResult<T> =
  | { ok: true; data: T; reqId?: string; elapsedMs: number }
  | { ok: false; error: string; elapsedMs: number };

async function apiPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  token: string,
): Promise<ApiResult<T>> {
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    return { ok: false, error: `POST ${path} 网络错误: ${msg}`, elapsedMs: Date.now() - t0 };
  }

  const reqId = res.headers.get("x-req-id") ?? undefined;

  if (!res.ok) {
    let detail: string;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text) as { error?: { message?: string; code?: string } };
        detail = json.error?.message ?? text.slice(0, 300);
      } catch {
        detail = text.slice(0, 300);
      }
    } catch {
      detail = "(无响应体)";
    }
    const prefix = reqId ? `[${reqId}] ` : "";
    return {
      ok: false,
      error: `${prefix}POST ${path} 失败：status=${res.status} detail=${detail}`,
      elapsedMs: Date.now() - t0,
    };
  }

  try {
    const json = (await res.json()) as { success?: boolean; data?: T };
    if (!json.success) {
      const anyJson = json as Record<string, unknown>;
      const errObj = anyJson.error as { message?: string } | undefined;
      const prefix = reqId ? `[${reqId}] ` : "";
      return {
        ok: false,
        error: `${prefix}POST ${path}: ${errObj?.message ?? "success=false"}`,
        elapsedMs: Date.now() - t0,
      };
    }
    return { ok: true, data: json.data as T, reqId, elapsedMs: Date.now() - t0 };
  } catch (parseErr) {
    const prefix = reqId ? `[${reqId}] ` : "";
    return {
      ok: false,
      error: `${prefix}POST ${path} 响应解析失败: ${parseErr}`,
      elapsedMs: Date.now() - t0,
    };
  }
}

function main(): void {
  let analyzeData: Record<string, unknown> | null = null;
  let aiAnalysis: { analysis: Record<string, unknown> } | null = null;
  let selectedTrackId: string | null = null;
  let selectedPoints: Set<number> = new Set();
  let lastMatchResult: Record<string, unknown> | null = null;
  let filterOnlyKeep = false;
  let filterHideReject = false;
  let sortMode: "score" | "novelty" | "default" = "default";

  // Human feedback state
  const feedbackKeep = new Set<string>();
  const feedbackReject = new Set<string>();
  const feedbackBoost = new Set<string>();
  const selectedImproveIds = new Set<string>();
  const feedbackNotes: Record<string, string> = {};
  let _renderMatchResults: ((d: Record<string, unknown>) => void) | null = null;

  function toggleFeedback(set: Set<string>, id: string) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (lastMatchResult && _renderMatchResults) _renderMatchResults(lastMatchResult);
  }

  function toggleImproveSelection(id: string) {
    if (selectedImproveIds.has(id)) selectedImproveIds.delete(id);
    else {
      if (selectedImproveIds.size >= 5) {
        showError("最多只能选择 5 条进行改进。");
        return;
      }
      selectedImproveIds.add(id);
    }
    if (lastMatchResult && _renderMatchResults) _renderMatchResults(lastMatchResult);
  }

  function buildFeedbackPayload() {
    const fb: Record<string, unknown> = {};
    if (feedbackKeep.size > 0) fb.keep_ids = [...feedbackKeep];
    if (feedbackReject.size > 0) fb.reject_ids = [...feedbackReject];
    if (feedbackBoost.size > 0) fb.boost_ids = [...feedbackBoost];
    const noteEntries = Object.entries(feedbackNotes).filter(([, v]) => v);
    if (noteEntries.length > 0) fb.notes_by_id = Object.fromEntries(noteEntries);
    return Object.keys(fb).length > 0 ? fb : undefined;
  }

  function syncSelectedImproveIds(d: Record<string, unknown>) {
    const audited = (d.matches ?? []) as Array<{ id?: string }>;
    const candidates = (d.candidates ?? []) as Array<{ id?: string }>;
    const recommended = (d.recommended_for_ui ?? []) as Array<{ id?: string }>;
    const ids = new Set(
      [...audited, ...candidates, ...recommended].map((x) => String(x?.id ?? "")).filter(Boolean),
    );
    for (const id of [...selectedImproveIds]) {
      if (!ids.has(id)) selectedImproveIds.delete(id);
    }
  }

  function renderProcess(statusText?: string) {
    const host = document.getElementById("process-trace");
    if (!host) return;

    const pointsRaw = ((aiAnalysis?.analysis?.news_points as NewsPointData[]) ?? []).filter(
      Boolean,
    );
    const selected = Array.from(selectedPoints)
      .sort((a, b) => a - b)
      .map((i) => pointsRaw[i])
      .filter(Boolean);
    const selectedPointsData: ProcessPoint[] = selected.map((p) => ({
      point_cn: p.point_cn,
      evidence_cn: p.evidence_cn,
    }));

    const claimsRaw = (
      (aiAnalysis?.analysis?.claims as Array<Record<string, unknown>>) ?? []
    ).filter(Boolean);
    const claimsData = claimsRaw
      .map((c, idx) => {
        const vpPick = (c.vp_pick as Record<string, unknown> | undefined) ?? {};
        const vpId = String(vpPick.vp_id ?? "");
        return {
          claim_id: String(c.claim_id ?? `c${idx + 1}`),
          claim_cn: String(c.claim_cn ?? ""),
          evidence_quote_cn: String(c.evidence_quote_cn ?? ""),
          vp_pick_name_cn: (VIEWPOINT_BY_ID.get(vpId)?.name_cn ?? vpId) || "未选择",
          vp_score_breakdown: (() => {
            const b = (c.vp_score_breakdown as Record<string, unknown> | undefined) ?? {};
            const k = Number(b.keyword_hit ?? 0);
            const q = Number(b.question_hit ?? 0);
            const m = Number(b.mechanism_overlap ?? 0);
            const t = Number(b.total ?? k + q + m);
            return `kw=${k}, q=${q}, mech=${m}, total=${t}`;
          })(),
        };
      })
      .filter((c) => c.claim_cn);

    const mechsRaw = (
      (aiAnalysis?.analysis?.mechanisms as Array<Record<string, unknown>>) ?? []
    ).filter(Boolean);
    const selectedSet = new Set(Array.from(selectedPoints));
    const mechanismsData: ProcessMechanism[] = mechsRaw
      .filter((m) => {
        const pointId = Number(m.point_id);
        return Number.isInteger(pointId) ? selectedSet.has(pointId) : true;
      })
      .map((m) => {
        const id = String(m.mechanism_id ?? m.id ?? "");
        const name = (MECHANISM_BY_ID.get(id)?.name_cn ?? id) || "未知机制";
        return {
          mechanism_id: id || "NA",
          name_cn: name,
          why_this_mechanism_cn: String(m.why_this_mechanism_cn ?? m.rationale_cn ?? "命中该机制"),
        };
      });

    const candidatesCount = Array.isArray(lastMatchResult?.matches)
      ? ((lastMatchResult?.matches as unknown[]) ?? []).length
      : Array.isArray(lastMatchResult?.recommended_for_ui)
        ? ((lastMatchResult?.recommended_for_ui as unknown[]) ?? []).length
        : Array.isArray(lastMatchResult?.candidates)
          ? ((lastMatchResult?.candidates as unknown[]) ?? []).length
          : 0;

    host.textContent = "";
    host.appendChild(
      renderProcessTrace(document, {
        selected_points: selectedPointsData,
        claims: claimsData,
        mechanisms: mechanismsData,
        candidates_count: candidatesCount,
        status_text: statusText,
      }),
    );
  }

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

    apiPost<Record<string, unknown>>("/analyze", { text }, t).then((result) => {
      btn.disabled = false;
      btn.textContent = "分析";
      if (!result.ok) {
        showError(result.error);
        return;
      }
      {
        analyzeData = result.data;
        aiAnalysis = null;
        selectedTrackId = null;
        selectedPoints = new Set();
        showError("");
        toast("分析完成");

        const step2Title = document.getElementById("step2-title");
        if (step2Title) step2Title.textContent = "步骤 2：选择推荐路径";
        const expandBtn = document.getElementById("expand") as HTMLButtonElement;
        if (expandBtn) expandBtn.textContent = "生成剧情支撑";
        const tracksList = document.getElementById("tracks-list");
        const newsPointsList = document.getElementById("news-points-list");
        if (newsPointsList) {
          newsPointsList.classList.remove("visible");
          newsPointsList.textContent = "";
        }
        const tracks = (analyzeData.recommendedTracks as Array<Record<string, unknown>>) || [];
        if (tracksList) {
          tracksList.classList.remove("hidden");
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

        (document.getElementById("tracks-section") as HTMLElement).classList.add("visible");
        (document.getElementById("expand-section") as HTMLElement).classList.add("visible");

        const o = analyzeData.podcastOutline as Record<string, unknown> | undefined;
        const outlineContent = document.getElementById("outline-content");
        const outlineEmpty = document.getElementById("outline-empty");
        if (o && outlineContent && outlineEmpty) {
          outlineEmpty.classList.add("hidden");
          outlineContent.classList.add("visible");
          clearAndAppend(outlineContent, renderOutline(document, o));
        } else if (outlineEmpty && outlineContent) {
          outlineEmpty.classList.remove("hidden");
          outlineContent.classList.remove("visible");
        }

        const ec = (analyzeData.evidenceChain as Array<Record<string, unknown>>) || [];
        const evidenceContent = document.getElementById("evidence-content");
        const evidenceEmpty = document.getElementById("evidence-empty");
        if (ec.length > 0 && evidenceContent && evidenceEmpty) {
          evidenceEmpty.classList.add("hidden");
          evidenceContent.classList.add("visible");
          const onQuoteToggle = (ei: number, ri: number) => {
            const el = document.getElementById("ev-quote-" + ei + "-" + ri);
            const tog = document.querySelector(
              `[data-evidx="${ei}"][data-refidx="${ri}"]`,
            ) as HTMLElement;
            if (el && tog) {
              (el as HTMLElement).classList.toggle("open");
              tog.textContent = (el as HTMLElement).classList.contains("open")
                ? "引用原文（点击折叠）"
                : "引用原文（点击展开）";
            }
          };
          clearAndAppend(
            evidenceContent,
            renderEvidenceChain(document, ec as EvidenceLinkData[], onQuoteToggle),
          );
        } else if (evidenceEmpty && evidenceContent) {
          evidenceEmpty.classList.remove("hidden");
          evidenceContent.classList.remove("visible");
        }
      }
    });
  });

  document.getElementById("analyze-ai")?.addEventListener("click", () => {
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
    const btn = document.getElementById("analyze-ai") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "AI分析中…";

    apiPost<{ analysis: Record<string, unknown> }>("/analyze_ai", { text }, t).then((result) => {
      btn.disabled = false;
      btn.textContent = "AI分析";
      if (!result.ok) {
        showError(result.error);
        return;
      }
      const analysis = result.data?.analysis;
      if (!analysis) {
        showError("AI分析返回数据格式异常");
        return;
      }
      {
        aiAnalysis = { analysis };
        analyzeData = null;
        selectedTrackId = null;
        selectedPoints = new Set();
        showError("");
        toast("AI 分析完成");

        const step2Title = document.getElementById("step2-title");
        if (step2Title) step2Title.textContent = "步骤 2：选择新闻点（可多选 1–2 条）";
        const tracksList = document.getElementById("tracks-list");
        const newsPointsList = document.getElementById("news-points-list");
        if (tracksList) {
          tracksList.classList.add("hidden");
          tracksList.textContent = "";
        }
        if (newsPointsList) {
          newsPointsList.classList.add("visible");
          newsPointsList.textContent = "";
          const points = (aiAnalysis.analysis.news_points as NewsPointData[]) || [];
          const togglePoint = (idx: number) => {
            if (selectedPoints.has(idx)) {
              selectedPoints.delete(idx);
            } else if (selectedPoints.size < 2) {
              selectedPoints.add(idx);
            }
            newsPointsList.textContent = "";
            points.forEach((p, i) => {
              const card = renderNewsPointCard(document, p, i, selectedPoints.has(i), togglePoint);
              newsPointsList.appendChild(card);
            });
          };
          points.forEach((p, i) => {
            const card = renderNewsPointCard(document, p, i, selectedPoints.has(i), togglePoint);
            newsPointsList.appendChild(card);
          });
        }

        (document.getElementById("tracks-section") as HTMLElement).classList.add("visible");
        (document.getElementById("expand-section") as HTMLElement).classList.add("visible");
        const expandBtn = document.getElementById("expand") as HTMLButtonElement;
        if (expandBtn) expandBtn.textContent = "找科幻剧情支撑";

        (document.getElementById("outline-empty") as HTMLElement).classList.remove("hidden");
        (document.getElementById("outline-content") as HTMLElement).classList.remove("visible");
        (document.getElementById("evidence-empty") as HTMLElement).classList.remove("hidden");
        (document.getElementById("evidence-content") as HTMLElement).classList.remove("visible");
        renderProcess("已完成 AI 分析，等待生成候选...");
      }
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
    if (aiAnalysis) {
      const points = (aiAnalysis.analysis.news_points as NewsPointData[]) || [];
      const selected = Array.from(selectedPoints)
        .sort((a, b) => a - b)
        .map((i) => points[i]?.point_cn)
        .filter(Boolean);
      if (selected.length === 0) {
        showError("请至少选择一条新闻点。");
        return;
      }
      showError("");
      (document.getElementById("cards-empty") as HTMLElement).classList.add("hidden");
      (document.getElementById("cards-list") as HTMLElement).classList.remove("visible");
      showStatus("正在生成候选...");
      renderProcess("正在生成候选...");
      (document.getElementById("outline-empty") as HTMLElement).classList.remove("hidden");
      (document.getElementById("outline-content") as HTMLElement).classList.remove("visible");
      (document.getElementById("evidence-empty") as HTMLElement).classList.remove("hidden");
      (document.getElementById("evidence-content") as HTMLElement).classList.remove("visible");

      // Reset feedback on new generation
      feedbackKeep.clear();
      feedbackReject.clear();
      feedbackBoost.clear();
      selectedImproveIds.clear();

      apiPost<Record<string, unknown>>(
        "/match_scifi_ai",
        { analysis: aiAnalysis.analysis, selected_points: selected },
        t,
      ).then((result) => {
        hideStatus();
        if (!result.ok) {
          const cardsEmpty = document.getElementById("cards-empty");
          if (cardsEmpty) {
            cardsEmpty.classList.remove("hidden");
            cardsEmpty.textContent = result.error;
          }
          showError(result.error);
          return;
        }
        lastMatchResult = result.data;
        syncSelectedImproveIds(result.data);
        renderMatchResults(result.data);
        const done = formatDoneStatus(result.reqId, result.elapsedMs);
        renderProcess(done);
        toast(`${done}`);
      });
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
    (document.getElementById("cards-empty") as HTMLElement).classList.add("hidden");
    (document.getElementById("cards-list") as HTMLElement).classList.remove("visible");
    showStatus("正在生成剧情支撑...");
    renderProcess("正在生成剧情支撑...");
    (document.getElementById("outline-empty") as HTMLElement).classList.remove("hidden");
    (document.getElementById("outline-content") as HTMLElement).classList.remove("visible");
    (document.getElementById("evidence-empty") as HTMLElement).classList.remove("hidden");
    (document.getElementById("evidence-content") as HTMLElement).classList.remove("visible");

    /* ─── renderMatchResults: handles fast (candidates) and rerank (audited) ─── */
    function renderMatchResults(d: Record<string, unknown>) {
      _renderMatchResults = renderMatchResults;
      renderProcess();
      const auditedMatches = (d.matches ?? []) as AuditedMatchData[];
      const recommended = (d.recommended_for_ui ?? []) as CandidateCardData[];
      const candidates = (d.candidates ?? []) as CandidateCardData[];
      const audit = d.audit as AuditSummaryData | undefined;
      const pipeline = d.pipeline as { mode: string; llm_calls: number } | undefined;

      const displayItems =
        auditedMatches.length > 0
          ? auditedMatches
          : recommended.length > 0
            ? recommended
            : candidates;

      const cardsEmpty = document.getElementById("cards-empty");
      const cardsList = document.getElementById("cards-list");

      if (displayItems.length === 0 && cardsEmpty) {
        cardsEmpty.classList.remove("hidden");
        cardsEmpty.textContent = "暂无科幻剧情匹配。";
        return;
      }

      if (!cardsList || !cardsEmpty) return;
      cardsEmpty.classList.add("hidden");
      cardsList.classList.add("visible");
      cardsList.textContent = "";

      // Pipeline info
      if (pipeline) {
        const infoEl = document.createElement("div");
        infoEl.className = "pipeline-info";
        infoEl.textContent = `模式: ${pipeline.mode} · LLM调用: ${pipeline.llm_calls}次`;
        cardsList.appendChild(infoEl);
      }

      // Feedback summary
      const fbTotal = feedbackKeep.size + feedbackReject.size + feedbackBoost.size;
      if (fbTotal > 0) {
        const fbInfo = document.createElement("div");
        fbInfo.className = "feedback-info";
        fbInfo.textContent = `已标记：保留 ${feedbackKeep.size} · 不要 ${feedbackReject.size} · 很像 ${feedbackBoost.size}`;
        cardsList.appendChild(fbInfo);
      }

      // Audit summary (if from rerank)
      if (audit && audit.keep_count != null) {
        cardsList.appendChild(renderAuditSummary(document, audit));
      }

      // Control bar
      const controlBar = document.createElement("div");
      controlBar.className = "match-controls";

      const makeBtn = (
        text: string,
        cls: string,
        onClick: () => void,
        opts?: { disabled?: boolean; disabledTitle?: string },
      ) => {
        const b = document.createElement("button");
        b.className = "control-btn " + cls;
        b.textContent = text;
        if (opts?.disabled) {
          b.disabled = true;
          if (opts.disabledTitle) b.title = opts.disabledTitle;
        } else {
          b.addEventListener("click", onClick);
        }
        controlBar.appendChild(b);
        return b;
      };

      // Filter buttons (always available)
      makeBtn(
        filterOnlyKeep ? "取消只看 👍" : "只看 👍",
        filterOnlyKeep ? "filter-active" : "filter-keep",
        () => {
          filterOnlyKeep = !filterOnlyKeep;
          renderMatchResults(lastMatchResult!);
        },
      );
      makeBtn(
        filterHideReject ? "取消隐藏 👎" : "隐藏 👎",
        filterHideReject ? "filter-active" : "filter-reject",
        () => {
          filterHideReject = !filterHideReject;
          renderMatchResults(lastMatchResult!);
        },
      );

      if (auditedMatches.length > 0) {
        makeBtn("按分数排序", "sort-score", () => {
          sortMode = sortMode === "score" ? "default" : "score";
          renderMatchResults(lastMatchResult!);
        });
        makeBtn("按新颖度排序", "sort-novelty", () => {
          sortMode = sortMode === "novelty" ? "default" : "novelty";
          renderMatchResults(lastMatchResult!);
        });
      }
      makeBtn("重新审核/重排", "ctrl-rerank", () => doRerank());
      makeBtn("补充更多候选", "ctrl-expand", () => doExpand());
      controlBar.appendChild(
        renderImproveButton(document, selectedImproveIds.size, () => doImprove()),
      );

      cardsList.appendChild(controlBar);

      const onQuoteToggle = (idx: number) => {
        const el = document.getElementById("quote-" + idx);
        const tog = document.querySelector(`[data-idx="${idx}"]`) as HTMLElement;
        if (el && tog) {
          el.classList.toggle("open");
          tog.textContent = el.classList.contains("open")
            ? "引用原文（点击折叠）"
            : "引用原文（点击展开）";
        }
      };

      const attachImproveSelector = (card: HTMLElement, id: string) => {
        const row = document.createElement("label");
        row.className = "improve-select-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "improve-select";
        cb.checked = selectedImproveIds.has(id);
        cb.addEventListener("change", () => toggleImproveSelection(id));
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" 选中用于改进"));
        card.appendChild(row);
      };

      if (auditedMatches.length > 0) {
        let filtered = [...auditedMatches];
        if (filterOnlyKeep) {
          filtered = filtered.filter((m) => feedbackKeep.has(m.id) || m.audit?.verdict === "keep");
        }
        if (filterHideReject) {
          filtered = filtered.filter((m) => !feedbackReject.has(m.id));
        }
        if (sortMode === "score") {
          filtered.sort((a, b) => (b.audit?.total ?? 0) - (a.audit?.total ?? 0));
        } else if (sortMode === "novelty") {
          filtered.sort((a, b) => (b.audit?.score?.novelty ?? 0) - (a.audit?.score?.novelty ?? 0));
        }
        filtered.forEach((m, i) => {
          const card = renderAuditedMatchCard(document, m, i, {
            onQuoteToggle,
            onKeep: () => toggleFeedback(feedbackKeep, m.id),
            onReject: () => toggleFeedback(feedbackReject, m.id),
            onBoost: () => toggleFeedback(feedbackBoost, m.id),
            onFix: () => {
              feedbackKeep.add(m.id);
              doImproveSingle(m.id);
            },
          });
          // Visual state for feedback
          if (feedbackKeep.has(m.id)) card.classList.add("fb-keep");
          if (feedbackReject.has(m.id)) card.classList.add("fb-reject");
          if (feedbackBoost.has(m.id)) card.classList.add("fb-boost");
          attachImproveSelector(card, m.id);
          cardsList.appendChild(card);
        });
        toast("已显示 " + filtered.length + " 条审核后匹配");
      } else {
        let items = recommended.length > 0 ? recommended : candidates;
        // Apply filtering
        if (filterOnlyKeep) {
          items = items.filter((c) => feedbackKeep.has(c.id));
        }
        if (filterHideReject) {
          items = items.filter((c) => !feedbackReject.has(c.id));
        }
        const cardCallbacks: CandidateCardCallbacks = {
          onQuoteToggle,
          onKeep: (id: string) => toggleFeedback(feedbackKeep, id),
          onReject: (id: string) => toggleFeedback(feedbackReject, id),
          onBoost: (id: string) => toggleFeedback(feedbackBoost, id),
          onImprove: (id: string) => {
            feedbackKeep.add(id);
            doImproveSingle(id);
          },
        };
        items.forEach((c, i) => {
          const card = renderCandidateCard(document, c, i, cardCallbacks);
          if (feedbackKeep.has(c.id)) card.classList.add("fb-keep");
          if (feedbackReject.has(c.id)) card.classList.add("fb-reject");
          if (feedbackBoost.has(c.id)) card.classList.add("fb-boost");
          attachImproveSelector(card, c.id);
          cardsList.appendChild(card);
        });
        toast("已显示 " + items.length + " 条候选匹配");
      }
    }

    function doExpand() {
      if (!aiAnalysis || !lastMatchResult) return;
      const tkn = tokenVal();
      if (!tkn) {
        showError("请先设置令牌。");
        return;
      }
      const points = (aiAnalysis.analysis.news_points as NewsPointData[]) || [];
      const sel = Array.from(selectedPoints)
        .sort((a, b) => a - b)
        .map((i) => points[i]?.point_cn)
        .filter(Boolean);
      showError("");
      showStatus("正在补充候选...");
      renderProcess("正在补充候选...");
      apiPost<Record<string, unknown>>(
        "/match_scifi_ai_expand",
        {
          analysis: aiAnalysis.analysis,
          selected_points: sel,
          existing_candidates: lastMatchResult.candidates || [],
          feedback: buildFeedbackPayload(),
        },
        tkn,
      ).then((result) => {
        hideStatus();
        if (!result.ok) {
          showError(result.error);
          return;
        }
        lastMatchResult = result.data;
        syncSelectedImproveIds(result.data);
        renderMatchResults(result.data);
        const done = formatDoneStatus(result.reqId, result.elapsedMs);
        renderProcess(done);
        toast(done);
      });
    }

    function doRerank() {
      if (!aiAnalysis || !lastMatchResult) return;
      const tkn = tokenVal();
      if (!tkn) {
        showError("请先设置令牌。");
        return;
      }
      showError("");
      showStatus("正在重排/审核...");
      renderProcess("正在重排...");
      apiPost<Record<string, unknown>>(
        "/match_scifi_ai_rerank",
        {
          candidates: lastMatchResult.candidates || lastMatchResult.matches || [],
          analysis: aiAnalysis.analysis,
          feedback: buildFeedbackPayload(),
        },
        tkn,
      ).then((result) => {
        hideStatus();
        if (!result.ok) {
          showError(result.error);
          return;
        }
        lastMatchResult = result.data;
        syncSelectedImproveIds(result.data);
        renderMatchResults(result.data);
        const done = formatDoneStatus(result.reqId, result.elapsedMs);
        renderProcess(done);
        toast(done);
      });
    }

    function doImprove() {
      if (!aiAnalysis || !lastMatchResult) return;
      const tkn = tokenVal();
      if (!tkn) {
        showError("请先设置令牌。");
        return;
      }
      const targetIds = [...selectedImproveIds];
      if (targetIds.length === 0) {
        showError("请先勾选 1–5 条要改进的候选。");
        return;
      }
      if (targetIds.length > 5) {
        showError("一次最多改进 5 条候选。");
        return;
      }
      const points = (aiAnalysis.analysis.news_points as NewsPointData[]) || [];
      const sel = Array.from(selectedPoints)
        .sort((a, b) => a - b)
        .map((i) => points[i]?.point_cn)
        .filter(Boolean);
      showError("");
      showStatus(`正在改进 ${targetIds.length} 条选中条目...`);
      renderProcess(`正在改进选中条目...（${targetIds.length} 条）`);
      apiPost<Record<string, unknown>>(
        "/match_scifi_ai_improve",
        buildImproveRequestBody({
          analysis: aiAnalysis.analysis,
          selectedPoints: sel,
          candidates: (lastMatchResult.candidates || lastMatchResult.matches || []) as unknown[],
          targetIds,
          feedback: buildFeedbackPayload() as Record<string, unknown> | undefined,
        }),
        tkn,
      ).then((result) => {
        hideStatus();
        if (!result.ok) {
          showError(result.error);
          return;
        }
        lastMatchResult = result.data;
        syncSelectedImproveIds(result.data);
        renderMatchResults(result.data);
        const done = formatDoneStatus(result.reqId, result.elapsedMs);
        renderProcess(done);
        toast(done);
      });
    }

    function doImproveSingle(id: string) {
      if (!aiAnalysis || !lastMatchResult) return;
      const tkn = tokenVal();
      if (!tkn) {
        showError("请先设置令牌。");
        return;
      }
      const points = (aiAnalysis.analysis.news_points as NewsPointData[]) || [];
      const sel = Array.from(selectedPoints)
        .sort((a, b) => a - b)
        .map((i) => points[i]?.point_cn)
        .filter(Boolean);
      showError("");
      showStatus("正在改进选中条目...");
      renderProcess("正在改进选中条目...");
      apiPost<Record<string, unknown>>(
        "/match_scifi_ai_improve",
        buildImproveRequestBody({
          analysis: aiAnalysis.analysis,
          selectedPoints: sel,
          candidates: (lastMatchResult.candidates || lastMatchResult.matches || []) as unknown[],
          targetIds: [id],
          feedback: buildFeedbackPayload() as Record<string, unknown> | undefined,
        }),
        tkn,
      ).then((result) => {
        hideStatus();
        if (!result.ok) {
          showError(result.error);
          return;
        }
        lastMatchResult = result.data;
        syncSelectedImproveIds(result.data);
        renderMatchResults(result.data);
        const done = formatDoneStatus(result.reqId, result.elapsedMs);
        renderProcess(done);
        toast(done);
      });
    }

    apiPost<Record<string, unknown>>("/expand", { text, selectedTrackId }, t).then((result) => {
      hideStatus();
      if (!result.ok) {
        const cardsEmpty = document.getElementById("cards-empty");
        if (cardsEmpty) {
          cardsEmpty.classList.remove("hidden");
          cardsEmpty.textContent = result.error;
        }
        showError(result.error);
        return;
      }
      const d = result.data;
      const cards = (d.plotSupportCards as Array<Record<string, unknown>>) || [];
      const cardsEmpty = document.getElementById("cards-empty");
      const cardsList = document.getElementById("cards-list");
      if (cards.length === 0 && cardsEmpty) {
        cardsEmpty.classList.remove("hidden");
        cardsEmpty.textContent = "暂无剧情支撑卡片。";
      } else if (cardsList && cardsEmpty) {
        cardsEmpty.classList.add("hidden");
        cardsList.classList.add("visible");
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
        outlineEmpty.classList.add("hidden");
        outlineContent.classList.add("visible");
        clearAndAppend(outlineContent, renderOutlineExpand(document, outline));
      } else if (outlineEmpty && outlineContent) {
        outlineEmpty.classList.remove("hidden");
        outlineContent.classList.remove("visible");
      }

      const evidence = (d.evidenceChain as Array<Record<string, unknown>>) || [];
      const evidenceContent = document.getElementById("evidence-content");
      const evidenceEmpty = document.getElementById("evidence-empty");
      if (evidence.length > 0 && evidenceContent && evidenceEmpty) {
        evidenceEmpty.classList.add("hidden");
        evidenceContent.classList.add("visible");
        const onQuoteToggle2 = (ei: number, ri: number) => {
          const el = document.getElementById("ev-quote-" + ei + "-" + ri);
          const tog = document.querySelector(
            `[data-evidx="${ei}"][data-refidx="${ri}"]`,
          ) as HTMLElement;
          if (el && tog) {
            (el as HTMLElement).classList.toggle("open");
            tog.textContent = (el as HTMLElement).classList.contains("open")
              ? "引用原文（点击折叠）"
              : "引用原文（点击展开）";
          }
        };
        clearAndAppend(
          evidenceContent,
          renderEvidenceChain(document, evidence as EvidenceLinkData[], onQuoteToggle2),
        );
      } else if (evidenceEmpty && evidenceContent) {
        evidenceEmpty.classList.remove("hidden");
        evidenceEmpty.textContent = "暂无证据链数据。";
        evidenceContent.classList.remove("visible");
      }
    });
  });
}

main();
