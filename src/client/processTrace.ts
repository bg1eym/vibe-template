export type ProcessPoint = {
  point_cn: string;
  evidence_cn?: string;
};

export type ProcessMechanism = {
  mechanism_id: string;
  name_cn: string;
  why_this_mechanism_cn: string;
};

export type ProcessClaim = {
  claim_id: string;
  claim_cn: string;
  evidence_quote_cn: string;
  vp_pick_name_cn: string;
  vp_score_breakdown?: string;
};

export type ProcessTraceData = {
  selected_points: ProcessPoint[];
  claims: ProcessClaim[];
  mechanisms: ProcessMechanism[];
  candidates_count: number;
  status_text?: string;
};

export function renderProcessTrace(doc: Document, d: ProcessTraceData): HTMLElement {
  const wrap = doc.createElement("details");
  wrap.className = "process-trace";
  wrap.open = true;

  const summary = doc.createElement("summary");
  summary.textContent = `过程面板 · points ${d.selected_points.length} · claims ${d.claims.length} · mechanisms ${d.mechanisms.length} · candidates ${d.candidates_count}`;
  wrap.appendChild(summary);

  if (d.status_text) {
    const status = doc.createElement("div");
    status.className = "process-status";
    status.textContent = d.status_text;
    wrap.appendChild(status);
  }

  const sec1 = doc.createElement("div");
  sec1.className = "process-section";
  const t1 = doc.createElement("div");
  t1.className = "process-title";
  t1.textContent = "1) 选中的新闻 points";
  sec1.appendChild(t1);
  for (const p of d.selected_points) {
    const item = doc.createElement("div");
    item.className = "process-item";
    item.textContent = `${p.point_cn}${p.evidence_cn ? `（证据：${p.evidence_cn.slice(0, 80)}）` : ""}`;
    sec1.appendChild(item);
  }
  wrap.appendChild(sec1);

  const sec2 = doc.createElement("div");
  sec2.className = "process-section";
  const t2 = doc.createElement("div");
  t2.className = "process-title";
  t2.textContent = "2) 观点 claims（含 vp_pick）";
  sec2.appendChild(t2);
  for (const c of d.claims) {
    const item = doc.createElement("div");
    item.className = "process-item";
    item.textContent = `${c.claim_id}：${c.claim_cn}（证据：${c.evidence_quote_cn.slice(0, 80)}，VP：${c.vp_pick_name_cn}${
      c.vp_score_breakdown ? `，分解：${c.vp_score_breakdown}` : ""
    }）`;
    sec2.appendChild(item);
  }
  wrap.appendChild(sec2);

  const sec3 = doc.createElement("div");
  sec3.className = "process-section";
  const t3 = doc.createElement("div");
  t3.className = "process-title";
  t3.textContent = "3) 命中的机制 mechanisms";
  sec3.appendChild(t3);
  for (const m of d.mechanisms) {
    const item = doc.createElement("div");
    item.className = "process-item";
    item.textContent = `${m.name_cn}(${m.mechanism_id})：${m.why_this_mechanism_cn}`;
    sec3.appendChild(item);
  }
  wrap.appendChild(sec3);

  const sec4 = doc.createElement("div");
  sec4.className = "process-section";
  const t4 = doc.createElement("div");
  t4.className = "process-title";
  t4.textContent = "4) 候选作品梗概/引用";
  sec4.appendChild(t4);
  const hint = doc.createElement("div");
  hint.className = "process-item";
  hint.textContent = "候选卡片内可展开查看剧情节点/映射/引用原文。";
  sec4.appendChild(hint);
  wrap.appendChild(sec4);

  return wrap;
}
