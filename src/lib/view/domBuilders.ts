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
        quoteDiv.style.display = "none";
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
    const field = doc.createElement("div");
    field.className = "card-field";
    const lbl = doc.createElement("div");
    lbl.className = "card-field-label";
    lbl.textContent = label;
    field.appendChild(lbl);
    const val = doc.createElement("div");
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

export function renderChartBar(
  doc: Document,
  label: string,
  pct: number,
  count?: number,
): HTMLElement {
  const bar = doc.createElement("div");
  bar.className = "chart-bar";
  bar.style.height = `${pct}%`;
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
