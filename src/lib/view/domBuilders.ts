/**
 * DOM builders: createElement + textContent only. No innerHTML with user data.
 * Attribute values (title etc.) escaped to prevent attribute injection.
 * Safe for XSS. Testable in Node with jsdom.
 */

function attrEscape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type TrackData = {
  trackId: string;
  title: string;
  confidence: number;
  categories: string[];
  mechanisms: string[];
  whyThisTrack: string;
};

export function renderTrackCard(doc: Document, tr: TrackData): HTMLElement {
  const div = doc.createElement("div");
  div.className = "track-card";
  div.dataset.trackId = tr.trackId;

  const titleEl = doc.createElement("div");
  titleEl.className = "track-card-title";
  titleEl.textContent = tr.title;
  div.appendChild(titleEl);

  const metaEl = doc.createElement("div");
  metaEl.className = "track-card-meta";
  const cats = (tr.categories || []).slice(0, 3).join("、");
  const mechs = (tr.mechanisms || []).slice(0, 2).join("、");
  metaEl.textContent = `置信度 ${tr.confidence || 0} · ${cats}${mechs ? " · " + mechs : ""}`;
  div.appendChild(metaEl);

  const whyEl = doc.createElement("div");
  whyEl.className = "track-card-why";
  whyEl.textContent = tr.whyThisTrack || "";
  div.appendChild(whyEl);

  return div;
}

export type OutlineData = {
  opening_hook?: string;
  framing?: string[];
  debate?: { thesis?: string; antithesis?: string; synthesis?: string };
  analogy_scenarios?: string[];
  counterexamples?: string[];
  closing?: string;
};

export function renderOutline(doc: Document, o: OutlineData): HTMLElement {
  const wrap = doc.createElement("div");

  const addP = (label: string, content: string) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    p.appendChild(doc.createTextNode(content));
    wrap.appendChild(p);
  };

  const addList = (label: string, items: string[]) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    const ul = doc.createElement("ul");
    for (const it of items || []) {
      const li = doc.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    }
    p.appendChild(ul);
    wrap.appendChild(p);
  };

  addP("开场：", o.opening_hook || "");
  addList("框架：", o.framing || []);
  const d = o.debate || {};
  addP("辩论：", `正题：${d.thesis || ""} 反题：${d.antithesis || ""} 合题：${d.synthesis || ""}`);
  addList("类比场景：", o.analogy_scenarios || []);
  addList("反例：", o.counterexamples || []);
  addP("收尾：", o.closing || "");

  return wrap;
}

export type OutlineExpandData = {
  opening_cn?: string;
  framing_cn?: string[];
  closing_cn?: string;
};

export function renderOutlineExpand(doc: Document, o: OutlineExpandData): HTMLElement {
  const wrap = doc.createElement("div");

  const addP = (label: string, content: string) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    p.appendChild(doc.createTextNode(content));
    wrap.appendChild(p);
  };

  addP("开场：", o.opening_cn || "");
  const addList = (label: string, items: string[]) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    const ul = doc.createElement("ul");
    for (const it of items || []) {
      const li = doc.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    }
    p.appendChild(ul);
    wrap.appendChild(p);
  };
  addList("框架：", o.framing_cn || []);
  addP("收尾：", o.closing_cn || "");

  return wrap;
}

export type EvidenceRefData = {
  source_id?: string;
  title_cn: string;
  hook_cn: string;
  quote_en?: string;
};

export type EvidenceLinkData = {
  categories: string[];
  mechanisms: string[];
  scifiRefs: EvidenceRefData[];
};

export function renderEvidenceChain(
  doc: Document,
  ec: EvidenceLinkData[],
  onQuoteToggle?: (evIdx: number, refIdx: number) => void,
): HTMLElement {
  const wrap = doc.createElement("div");
  for (let ei = 0; ei < (ec || []).length; ei++) {
    const ev = ec[ei];
    const item = doc.createElement("div");
    item.className = "evidence-item";

    const catLabel = doc.createElement("div");
    catLabel.className = "evidence-label";
    catLabel.textContent = "使用的分类";
    item.appendChild(catLabel);
    const catVal = doc.createElement("div");
    catVal.textContent = (ev.categories || []).join("、") || "—";
    item.appendChild(catVal);

    const mechLabel = doc.createElement("div");
    mechLabel.className = "evidence-label";
    mechLabel.textContent = "使用的机制";
    item.appendChild(mechLabel);
    const mechVal = doc.createElement("div");
    mechVal.textContent = (ev.mechanisms || []).join("、") || "—";
    item.appendChild(mechVal);

    const refLabel = doc.createElement("div");
    refLabel.className = "evidence-label";
    refLabel.textContent = "引用的作品";
    item.appendChild(refLabel);
    const refsWrap = doc.createElement("div");
    for (let ri = 0; ri < (ev.scifiRefs || []).length; ri++) {
      const r = ev.scifiRefs[ri];
      const refDiv = doc.createElement("div");
      refDiv.className = "evidence-ref";
      refDiv.appendChild(doc.createTextNode(`${r.title_cn}：`));
      const hookSpan = doc.createElement("span");
      hookSpan.textContent = r.hook_cn;
      refDiv.appendChild(hookSpan);
      if (r.quote_en) {
        const toggle = doc.createElement("div");
        toggle.className = "quote-toggle";
        toggle.dataset.evidx = String(ei);
        toggle.dataset.refidx = String(ri);
        toggle.textContent = "引用原文（点击展开）";
        toggle.onclick = () => onQuoteToggle?.(ei, ri);
        refDiv.appendChild(toggle);
        const quoteDiv = doc.createElement("div");
        quoteDiv.className = "quote-content";
        quoteDiv.id = `ev-quote-${ei}-${ri}`;
        quoteDiv.textContent = r.quote_en;
        refDiv.appendChild(quoteDiv);
      }
      refsWrap.appendChild(refDiv);
    }
    item.appendChild(refsWrap);
    wrap.appendChild(item);
  }
  return wrap;
}

export type PlotCardData = {
  scene_title_cn: string;
  plot_summary_cn: string;
  mapping_cn: string;
  podcast_question_cn: string;
  source_id?: string;
  source_title_cn?: string;
  source_quote_en?: string;
};

export function renderPlotCard(
  doc: Document,
  c: PlotCardData,
  idx: number,
  onQuoteToggle?: (idx: number) => void,
): HTMLElement {
  const card = doc.createElement("div");
  card.className = "card";

  const titleEl = doc.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = c.scene_title_cn;
  card.appendChild(titleEl);

  const addField = (label: string, value: string) => {
    const field = doc.createElement("details");
    field.className = "card-field";
    field.open = false;
    const summary = doc.createElement("summary");
    summary.className = "card-field-label";
    summary.textContent = label;
    field.appendChild(summary);
    const val = doc.createElement("div");
    val.className = "card-field-value";
    val.textContent = value;
    field.appendChild(val);
    card.appendChild(field);
  };

  addField("剧情概述", c.plot_summary_cn);
  addField("现实映射", c.mapping_cn);
  addField("播客提问", c.podcast_question_cn);

  if (c.source_quote_en) {
    const toggle = doc.createElement("div");
    toggle.className = "quote-toggle";
    toggle.dataset.idx = String(idx);
    toggle.textContent = "引用原文（点击展开）";
    toggle.onclick = () => onQuoteToggle?.(idx);
    card.appendChild(toggle);
    const quoteDiv = doc.createElement("div");
    quoteDiv.className = "quote-content";
    quoteDiv.id = `quote-${idx}`;
    quoteDiv.textContent = c.source_quote_en;
    card.appendChild(quoteDiv);
  }

  return card;
}

export type NewsPointData = {
  point_cn: string;
  evidence_cn: string;
  keywords_cn: string[];
};

export function renderNewsPointCard(
  doc: Document,
  np: NewsPointData,
  idx: number,
  selected: boolean,
  onToggle: (idx: number) => void,
): HTMLElement {
  const div = doc.createElement("div");
  div.className = "track-card" + (selected ? " selected" : "");
  div.dataset.pointIdx = String(idx);
  div.dataset.pointCn = np.point_cn;

  const label = doc.createElement("label");
  label.className = "news-point-label";
  const cb = doc.createElement("input");
  cb.type = "checkbox";
  cb.checked = selected;
  cb.dataset.pointIdx = String(idx);
  cb.addEventListener("change", () => onToggle(idx));
  label.appendChild(cb);
  label.appendChild(doc.createTextNode(" " + np.point_cn));
  div.appendChild(label);

  const ev = doc.createElement("div");
  ev.className = "track-card-meta";
  ev.textContent = np.evidence_cn.slice(0, 120) + (np.evidence_cn.length > 120 ? "…" : "");
  div.appendChild(ev);

  div.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).tagName !== "INPUT") onToggle(idx);
  });

  return div;
}

export type AiMatchData = {
  work_cn: string;
  scene_cn: string;
  mapping_cn: string;
  why_this_is_relevant_cn: string;
  quote_en?: string;
};

export function renderAiMatchCard(
  doc: Document,
  m: AiMatchData,
  idx: number,
  onQuoteToggle?: (idx: number) => void,
): HTMLElement {
  const card = doc.createElement("div");
  card.className = "card";

  const titleEl = doc.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = m.work_cn + "：" + m.scene_cn;
  card.appendChild(titleEl);

  const addField = (label: string, value: string) => {
    const field = doc.createElement("details");
    field.className = "card-field";
    field.open = false;
    const summary = doc.createElement("summary");
    summary.className = "card-field-label";
    summary.textContent = label;
    field.appendChild(summary);
    const val = doc.createElement("div");
    val.className = "card-field-value";
    val.textContent = value;
    field.appendChild(val);
    card.appendChild(field);
  };

  addField("现实映射", m.mapping_cn);
  addField("为何相关", m.why_this_is_relevant_cn);

  if (m.quote_en) {
    const toggle = doc.createElement("div");
    toggle.className = "quote-toggle";
    toggle.dataset.idx = String(idx);
    toggle.textContent = "引用原文（点击展开）";
    toggle.onclick = () => onQuoteToggle?.(idx);
    card.appendChild(toggle);
    const quoteDiv = doc.createElement("div");
    quoteDiv.className = "quote-content";
    quoteDiv.id = `quote-${idx}`;
    quoteDiv.textContent = m.quote_en;
    card.appendChild(quoteDiv);
  }

  return card;
}

/* ─── Candidate Card (fast mode, no audit) ─── */

export type CandidateCardData = {
  id: string;
  source: {
    source_id?: string;
    work_cn: string;
    author?: string;
  };
  scene_cn: string;
  mapping_cn: string;
  why_this_is_relevant_cn: string;
  synopsis_cn?: string;
  claim_id?: string;
  vp_id?: string;
  match_why_cn?: string;
  evidence_quote_cn?: string;
  quote_en?: string;
  confidence: number;
};

export type CandidateCardCallbacks = {
  onQuoteToggle?: (idx: number) => void;
  onKeep?: (id: string) => void;
  onReject?: (id: string) => void;
  onBoost?: (id: string) => void;
  onImprove?: (id: string) => void;
};

export function renderCandidateCard(
  doc: Document,
  c: CandidateCardData,
  idx: number,
  onQuoteToggleOrCallbacks?: ((idx: number) => void) | CandidateCardCallbacks,
): HTMLElement {
  const callbacks: CandidateCardCallbacks =
    typeof onQuoteToggleOrCallbacks === "function"
      ? { onQuoteToggle: onQuoteToggleOrCallbacks }
      : (onQuoteToggleOrCallbacks ?? {});

  const card = doc.createElement("div");
  card.className = "card candidate-card";
  card.dataset.candidateId = c.id;

  const titleEl = doc.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = c.source.work_cn + ` (${c.source.author || "未知出处"})`;
  card.appendChild(titleEl);

  const addField = (label: string, value: string) => {
    const field = doc.createElement("details");
    field.className = "card-field";
    field.open = false;
    const summary = doc.createElement("summary");
    summary.className = "card-field-label";
    summary.textContent = label;
    field.appendChild(summary);
    const val = doc.createElement("div");
    val.className = "card-field-value";
    val.textContent = value;
    field.appendChild(val);
    card.appendChild(field);
  };

  addField("剧情节点", c.scene_cn);
  addField("现实映射", c.mapping_cn);
  addField("为何相关", c.why_this_is_relevant_cn);

  const basis = doc.createElement("details");
  basis.className = "card-field synopsis-details";
  const basisSummary = doc.createElement("summary");
  basisSummary.className = "card-field-label";
  basisSummary.textContent = "匹配内容（梗概/依据/证据）";
  basis.appendChild(basisSummary);
  const basisText = doc.createElement("div");
  basisText.className = "card-field-value";
  basisText.textContent =
    `梗概：${c.synopsis_cn || "暂无梗概"}\n` +
    `匹配依据：claim=${c.claim_id || "N/A"} / vp=${c.vp_id || "N/A"} / why=${c.match_why_cn || c.why_this_is_relevant_cn || "暂无"}\n` +
    `新闻证据句：${c.evidence_quote_cn || "暂无证据句"}`;
  basis.appendChild(basisText);
  card.appendChild(basis);

  if (c.quote_en) {
    const toggle = doc.createElement("div");
    toggle.className = "quote-toggle";
    toggle.dataset.idx = String(idx);
    toggle.textContent = "引用原文（点击展开）";
    toggle.onclick = () => callbacks.onQuoteToggle?.(idx);
    card.appendChild(toggle);
    const quoteDiv = doc.createElement("div");
    quoteDiv.className = "quote-content";
    quoteDiv.id = `quote-${idx}`;
    quoteDiv.textContent = c.quote_en;
    card.appendChild(quoteDiv);
  }

  // Feedback action buttons
  const actions = doc.createElement("div");
  actions.className = "card-actions";

  const toggleFbState = (state: string) => {
    const cur = card.dataset.feedback ?? "";
    card.dataset.feedback = cur === state ? "" : state;
    card.classList.toggle("fb-keep", card.dataset.feedback === "keep");
    card.classList.toggle("fb-reject", card.dataset.feedback === "reject");
    card.classList.toggle("fb-boost", card.dataset.feedback === "boost");
  };

  const makeActionBtn = (text: string, cls: string, state: string, onClick: () => void) => {
    const btn = doc.createElement("button");
    btn.className = "action-btn " + cls;
    btn.textContent = text;
    btn.addEventListener("click", () => {
      toggleFbState(state);
      onClick();
    });
    actions.appendChild(btn);
  };

  makeActionBtn("\u{1F44D} \u4FDD\u7559", "action-keep", "keep", () => callbacks.onKeep?.(c.id));
  makeActionBtn("\u{1F44E} \u4E0D\u8981", "action-reject", "reject", () =>
    callbacks.onReject?.(c.id),
  );
  makeActionBtn("\u2B50 \u5F88\u50CF", "action-boost", "boost", () => callbacks.onBoost?.(c.id));
  makeActionBtn("\u270F\uFE0F \u8BA9\u5B83\u66F4\u50CF", "action-improve", "", () =>
    callbacks.onImprove?.(c.id),
  );

  card.appendChild(actions);

  return card;
}

/* ─── Audited Match Card (after rerank) ─── */

export type AuditScoreData = {
  relevance: number;
  specificity: number;
  mechanism_fit: number;
  novelty: number;
  human_plausibility: number;
};

export type AuditedMatchData = {
  id: string;
  source: {
    source_id?: string;
    work_cn: string;
    author?: string;
  };
  scene_cn: string;
  mapping_cn: string;
  why_this_is_relevant_cn: string;
  synopsis_cn?: string;
  claim_id?: string;
  vp_id?: string;
  match_why_cn?: string;
  evidence_quote_cn?: string;
  quote_en?: string;
  confidence: number;
  audit: {
    score: AuditScoreData;
    total: number;
    verdict: "keep" | "maybe" | "reject";
    reasons_cn: string[];
    fix_suggestions_cn: string[];
  };
};

export function renderAuditedMatchCard(
  doc: Document,
  m: AuditedMatchData,
  idx: number,
  callbacks?: {
    onQuoteToggle?: (idx: number) => void;
    onKeep?: (idx: number) => void;
    onReject?: (idx: number) => void;
    onBoost?: (idx: number) => void;
    onFix?: (idx: number) => void;
  },
): HTMLElement {
  const card = doc.createElement("div");
  card.className = `card audited-card verdict-${m.audit.verdict}`;
  card.dataset.candidateId = m.id;

  // Header: work name + verdict badge
  const header = doc.createElement("div");
  header.className = "card-header";

  const titleEl = doc.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = m.source.work_cn + ` (${m.source.author || "未知出处"})`;
  header.appendChild(titleEl);

  const verdictBadge = doc.createElement("span");
  verdictBadge.className = `verdict-badge verdict-${m.audit.verdict}`;
  const verdictLabel =
    m.audit.verdict === "keep" ? "保留" : m.audit.verdict === "maybe" ? "待定" : "淘汰";
  verdictBadge.textContent = verdictLabel;
  header.appendChild(verdictBadge);

  card.appendChild(header);

  // Score badges row
  const scoresRow = doc.createElement("div");
  scoresRow.className = "score-badges";
  const dims: [string, number][] = [
    ["相关", m.audit.score.relevance],
    ["具体", m.audit.score.specificity],
    ["机制", m.audit.score.mechanism_fit],
    ["新颖", m.audit.score.novelty],
    ["可信", m.audit.score.human_plausibility],
  ];
  for (const [label, val] of dims) {
    const badge = doc.createElement("span");
    badge.className = `score-badge ${val >= 4 ? "score-high" : val >= 2 ? "score-mid" : "score-low"}`;
    badge.textContent = `${label}:${val}`;
    scoresRow.appendChild(badge);
  }
  const totalBadge = doc.createElement("span");
  totalBadge.className = "score-badge score-total";
  totalBadge.textContent = `总分:${m.audit.total}`;
  scoresRow.appendChild(totalBadge);
  card.appendChild(scoresRow);

  // Scene
  const addField = (label: string, value: string) => {
    const field = doc.createElement("details");
    field.className = "card-field";
    field.open = false;
    const summary = doc.createElement("summary");
    summary.className = "card-field-label";
    summary.textContent = label;
    field.appendChild(summary);
    const val = doc.createElement("div");
    val.className = "card-field-value";
    val.textContent = value;
    field.appendChild(val);
    card.appendChild(field);
  };

  addField("剧情节点", m.scene_cn);
  addField("现实映射", m.mapping_cn);
  addField("为何相关", m.why_this_is_relevant_cn);

  const basis = doc.createElement("details");
  basis.className = "card-field synopsis-details";
  const basisSummary = doc.createElement("summary");
  basisSummary.className = "card-field-label";
  basisSummary.textContent = "匹配内容（梗概/依据/证据）";
  basis.appendChild(basisSummary);
  const basisText = doc.createElement("div");
  basisText.className = "card-field-value";
  basisText.textContent =
    `梗概：${m.synopsis_cn || "暂无梗概"}\n` +
    `匹配依据：claim=${m.claim_id || "N/A"} / vp=${m.vp_id || "N/A"} / why=${m.match_why_cn || m.why_this_is_relevant_cn || "暂无"}\n` +
    `新闻证据句：${m.evidence_quote_cn || "暂无证据句"}`;
  basis.appendChild(basisText);
  card.appendChild(basis);

  // Audit reasons (collapsible)
  if (m.audit.reasons_cn.length > 0) {
    const reasonsWrap = doc.createElement("div");
    reasonsWrap.className = "audit-reasons collapsed";
    const reasonsToggle = doc.createElement("div");
    reasonsToggle.className = "reasons-toggle";
    reasonsToggle.textContent = `审核意见（${m.audit.reasons_cn.length}条，点击展开）`;
    reasonsToggle.addEventListener("click", () => {
      reasonsWrap.classList.toggle("collapsed");
      reasonsToggle.textContent = reasonsWrap.classList.contains("collapsed")
        ? `审核意见（${m.audit.reasons_cn.length}条，点击展开）`
        : `审核意见（${m.audit.reasons_cn.length}条，点击折叠）`;
    });
    reasonsWrap.appendChild(reasonsToggle);
    const reasonsList = doc.createElement("ul");
    reasonsList.className = "reasons-list";
    for (const r of m.audit.reasons_cn) {
      const li = doc.createElement("li");
      li.textContent = r;
      reasonsList.appendChild(li);
    }
    reasonsWrap.appendChild(reasonsList);
    card.appendChild(reasonsWrap);
  }

  // Quote
  if (m.quote_en) {
    const toggle = doc.createElement("div");
    toggle.className = "quote-toggle";
    toggle.dataset.idx = String(idx);
    toggle.textContent = "引用原文（点击展开）";
    toggle.onclick = () => callbacks?.onQuoteToggle?.(idx);
    card.appendChild(toggle);
    const quoteDiv = doc.createElement("div");
    quoteDiv.className = "quote-content";
    quoteDiv.id = `quote-${idx}`;
    quoteDiv.textContent = m.quote_en;
    card.appendChild(quoteDiv);
  }

  // Action buttons
  const actions = doc.createElement("div");
  actions.className = "card-actions";

  const toggleFbState = (state: string) => {
    const cur = card.dataset.feedback ?? "";
    card.dataset.feedback = cur === state ? "" : state;
    card.classList.toggle("fb-keep", card.dataset.feedback === "keep");
    card.classList.toggle("fb-reject", card.dataset.feedback === "reject");
    card.classList.toggle("fb-boost", card.dataset.feedback === "boost");
  };

  const keepBtn = doc.createElement("button");
  keepBtn.className = "action-btn action-keep";
  keepBtn.textContent = "\u{1F44D} \u4FDD\u7559";
  keepBtn.addEventListener("click", () => {
    toggleFbState("keep");
    callbacks?.onKeep?.(idx);
  });
  actions.appendChild(keepBtn);

  const rejectBtn = doc.createElement("button");
  rejectBtn.className = "action-btn action-reject";
  rejectBtn.textContent = "\u{1F44E} \u4E0D\u8981";
  rejectBtn.addEventListener("click", () => {
    toggleFbState("reject");
    callbacks?.onReject?.(idx);
  });
  actions.appendChild(rejectBtn);

  const boostBtn = doc.createElement("button");
  boostBtn.className = "action-btn action-boost";
  boostBtn.textContent = "\u2B50 \u5F88\u50CF";
  boostBtn.addEventListener("click", () => {
    toggleFbState("boost");
    callbacks?.onBoost?.(idx);
  });
  actions.appendChild(boostBtn);

  if (m.audit.fix_suggestions_cn.length > 0) {
    const fixBtn = doc.createElement("button");
    fixBtn.className = "action-btn action-fix";
    fixBtn.textContent = "\u270F\uFE0F \u8BA9\u5B83\u66F4\u50CF";
    fixBtn.addEventListener("click", () => callbacks?.onFix?.(idx));
    actions.appendChild(fixBtn);
  }

  card.appendChild(actions);

  return card;
}

/* ─── Audit Summary ─── */

export type AuditSummaryData = {
  pass: boolean;
  keep_count: number;
  maybe_count: number;
  reject_count: number;
  avg_relevance: number;
  avg_total: number;
  common_failures: string[];
};

export function renderAuditSummary(doc: Document, s: AuditSummaryData): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "audit-summary";

  const statusEl = doc.createElement("div");
  statusEl.className = `audit-status ${s.pass ? "audit-pass" : "audit-fail"}`;
  statusEl.textContent = s.pass ? "审核通过" : "审核未通过";
  wrap.appendChild(statusEl);

  const statsEl = doc.createElement("div");
  statsEl.className = "audit-stats";
  statsEl.textContent = `保留 ${s.keep_count} · 待定 ${s.maybe_count} · 淘汰 ${s.reject_count} · 平均相关 ${s.avg_relevance} · 平均总分 ${s.avg_total}`;
  wrap.appendChild(statsEl);

  if (s.common_failures.length > 0) {
    const failEl = doc.createElement("div");
    failEl.className = "audit-failures";
    failEl.textContent = "常见问题：" + s.common_failures.slice(0, 3).join("；");
    wrap.appendChild(failEl);
  }

  return wrap;
}

export type AiEvidenceWork = { work_cn: string; mapping_cn: string; quote_en?: string };

export type AiEvidenceChainData = {
  selected_points: string[];
  mechanisms: string[];
  works: AiEvidenceWork[];
};

export function renderAiEvidenceChain(
  doc: Document,
  ec: AiEvidenceChainData,
  onQuoteToggle?: (idx: number) => void,
): HTMLElement {
  const wrap = doc.createElement("div");
  const addSection = (label: string, items: string[]) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    const ul = doc.createElement("ul");
    for (const it of items || []) {
      const li = doc.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    }
    p.appendChild(ul);
    wrap.appendChild(p);
  };
  addSection("选中的新闻点：", ec.selected_points || []);
  addSection("机制：", ec.mechanisms || []);

  const worksLabel = doc.createElement("div");
  worksLabel.className = "evidence-label";
  worksLabel.textContent = "引用的作品";
  wrap.appendChild(worksLabel);
  for (let i = 0; i < (ec.works || []).length; i++) {
    const w = ec.works[i];
    const refDiv = doc.createElement("div");
    refDiv.className = "evidence-ref";
    refDiv.appendChild(doc.createTextNode(`${w.work_cn}：${w.mapping_cn}`));
    if (w.quote_en) {
      const toggle = doc.createElement("div");
      toggle.className = "quote-toggle";
      toggle.dataset.evidx = String(i);
      toggle.textContent = "引用原文（点击展开）";
      toggle.onclick = () => onQuoteToggle?.(i);
      refDiv.appendChild(toggle);
      const quoteDiv = doc.createElement("div");
      quoteDiv.className = "quote-content";
      quoteDiv.id = `ev-quote-${i}`;
      quoteDiv.textContent = w.quote_en;
      refDiv.appendChild(quoteDiv);
    }
    wrap.appendChild(refDiv);
  }
  return wrap;
}

export type AiPodcastOutlineData = {
  opening_cn?: string;
  framing_cn?: string[];
  debate_cn?: string;
  analogy_cn?: string[];
  counter_cn?: string[];
  closing_cn?: string;
};

export function renderAiPodcastOutline(doc: Document, o: AiPodcastOutlineData): HTMLElement {
  const wrap = doc.createElement("div");
  const addP = (label: string, content: string) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    p.appendChild(doc.createTextNode(content));
    wrap.appendChild(p);
  };
  const addList = (label: string, items: string[]) => {
    const p = doc.createElement("div");
    p.className = "outline-p";
    const strong = doc.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    const ul = doc.createElement("ul");
    for (const it of items || []) {
      const li = doc.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    }
    p.appendChild(ul);
    wrap.appendChild(p);
  };
  addP("开场：", o.opening_cn || "");
  addList("框架：", o.framing_cn || []);
  addP("辩论：", o.debate_cn || "");
  addList("类比场景：", o.analogy_cn || []);
  addList("反例：", o.counter_cn || []);
  addP("收尾：", o.closing_cn || "");
  return wrap;
}

export type ItemData = { title: string; content?: string; tags?: string[] };

export function renderItem(doc: Document, it: ItemData): HTMLElement {
  const div = doc.createElement("div");
  div.className = "item";

  const titleEl = doc.createElement("div");
  titleEl.className = "item-title";
  titleEl.textContent = it.title || "";
  div.appendChild(titleEl);

  const contentEl = doc.createElement("div");
  contentEl.className = "item-content";
  const content = it.content || "";
  contentEl.textContent = content.length > 80 ? content.slice(0, 80) + "..." : content;
  div.appendChild(contentEl);

  const tagsEl = doc.createElement("div");
  tagsEl.className = "item-tags";
  for (const t of it.tags || []) {
    const span = doc.createElement("span");
    span.className = "tag";
    span.textContent = t;
    tagsEl.appendChild(span);
  }
  div.appendChild(tagsEl);

  return div;
}

/** Height class for chart bar (CSP-safe, no inline style). Rounds to nearest 5%. */
export function chartBarHeightClass(pct: number): string {
  const n = Math.round(pct / 5) * 5;
  const clamped = Math.max(0, Math.min(100, n));
  return `h-${clamped}`;
}

export function renderChartBar(
  doc: Document,
  label: string,
  pct: number,
  count?: number,
): HTMLElement {
  const bar = doc.createElement("div");
  bar.className = "chart-bar " + chartBarHeightClass(pct);
  const titleVal = count != null ? `${label}: ${count}` : label;
  bar.setAttribute("title", attrEscape(titleVal));
  return bar;
}

export function renderChartLabel(doc: Document, label: string): HTMLElement {
  const el = doc.createElement("div");
  el.className = "chart-label";
  el.setAttribute("title", attrEscape(label));
  el.textContent = label;
  return el;
}
