"use strict";
(() => {
  // src/lib/view/domBuilders.ts
  function renderTrackCard(doc, tr) {
    const div = doc.createElement("div");
    div.className = "track-card";
    div.dataset.trackId = tr.trackId;
    const titleEl = doc.createElement("div");
    titleEl.className = "track-card-title";
    titleEl.textContent = tr.title;
    div.appendChild(titleEl);
    const metaEl = doc.createElement("div");
    metaEl.className = "track-card-meta";
    const cats = (tr.categories || []).slice(0, 3).join("\u3001");
    const mechs = (tr.mechanisms || []).slice(0, 2).join("\u3001");
    metaEl.textContent = `\u7F6E\u4FE1\u5EA6 ${tr.confidence || 0} \xB7 ${cats}${mechs ? " \xB7 " + mechs : ""}`;
    div.appendChild(metaEl);
    const whyEl = doc.createElement("div");
    whyEl.className = "track-card-why";
    whyEl.textContent = tr.whyThisTrack || "";
    div.appendChild(whyEl);
    return div;
  }
  function renderOutline(doc, o) {
    const wrap = doc.createElement("div");
    const addP = (label, content) => {
      const p = doc.createElement("div");
      p.className = "outline-p";
      const strong = doc.createElement("strong");
      strong.textContent = label;
      p.appendChild(strong);
      p.appendChild(doc.createTextNode(content));
      wrap.appendChild(p);
    };
    const addList = (label, items) => {
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
    addP("\u5F00\u573A\uFF1A", o.opening_hook || "");
    addList("\u6846\u67B6\uFF1A", o.framing || []);
    const d = o.debate || {};
    addP("\u8FA9\u8BBA\uFF1A", `\u6B63\u9898\uFF1A${d.thesis || ""} \u53CD\u9898\uFF1A${d.antithesis || ""} \u5408\u9898\uFF1A${d.synthesis || ""}`);
    addList("\u7C7B\u6BD4\u573A\u666F\uFF1A", o.analogy_scenarios || []);
    addList("\u53CD\u4F8B\uFF1A", o.counterexamples || []);
    addP("\u6536\u5C3E\uFF1A", o.closing || "");
    return wrap;
  }
  function renderOutlineExpand(doc, o) {
    const wrap = doc.createElement("div");
    const addP = (label, content) => {
      const p = doc.createElement("div");
      p.className = "outline-p";
      const strong = doc.createElement("strong");
      strong.textContent = label;
      p.appendChild(strong);
      p.appendChild(doc.createTextNode(content));
      wrap.appendChild(p);
    };
    addP("\u5F00\u573A\uFF1A", o.opening_cn || "");
    const addList = (label, items) => {
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
    addList("\u6846\u67B6\uFF1A", o.framing_cn || []);
    addP("\u6536\u5C3E\uFF1A", o.closing_cn || "");
    return wrap;
  }
  function renderEvidenceChain(doc, ec, onQuoteToggle) {
    const wrap = doc.createElement("div");
    for (let ei = 0; ei < (ec || []).length; ei++) {
      const ev = ec[ei];
      const item = doc.createElement("div");
      item.className = "evidence-item";
      const catLabel = doc.createElement("div");
      catLabel.className = "evidence-label";
      catLabel.textContent = "\u4F7F\u7528\u7684\u5206\u7C7B";
      item.appendChild(catLabel);
      const catVal = doc.createElement("div");
      catVal.textContent = (ev.categories || []).join("\u3001") || "\u2014";
      item.appendChild(catVal);
      const mechLabel = doc.createElement("div");
      mechLabel.className = "evidence-label";
      mechLabel.textContent = "\u4F7F\u7528\u7684\u673A\u5236";
      item.appendChild(mechLabel);
      const mechVal = doc.createElement("div");
      mechVal.textContent = (ev.mechanisms || []).join("\u3001") || "\u2014";
      item.appendChild(mechVal);
      const refLabel = doc.createElement("div");
      refLabel.className = "evidence-label";
      refLabel.textContent = "\u5F15\u7528\u7684\u4F5C\u54C1";
      item.appendChild(refLabel);
      const refsWrap = doc.createElement("div");
      for (let ri = 0; ri < (ev.scifiRefs || []).length; ri++) {
        const r = ev.scifiRefs[ri];
        const refDiv = doc.createElement("div");
        refDiv.className = "evidence-ref";
        refDiv.appendChild(doc.createTextNode(`${r.title_cn}\uFF1A`));
        const hookSpan = doc.createElement("span");
        hookSpan.textContent = r.hook_cn;
        refDiv.appendChild(hookSpan);
        if (r.quote_en) {
          const toggle = doc.createElement("div");
          toggle.className = "quote-toggle";
          toggle.dataset.evidx = String(ei);
          toggle.dataset.refidx = String(ri);
          toggle.textContent = "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09";
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
  function renderPlotCard(doc, c, idx, onQuoteToggle) {
    const card = doc.createElement("div");
    card.className = "card";
    const titleEl = doc.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = c.scene_title_cn;
    card.appendChild(titleEl);
    const addField = (label, value) => {
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
    addField("\u5267\u60C5\u6982\u8FF0", c.plot_summary_cn);
    addField("\u73B0\u5B9E\u6620\u5C04", c.mapping_cn);
    addField("\u64AD\u5BA2\u63D0\u95EE", c.podcast_question_cn);
    if (c.source_quote_en) {
      const toggle = doc.createElement("div");
      toggle.className = "quote-toggle";
      toggle.dataset.idx = String(idx);
      toggle.textContent = "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09";
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

  // src/client/studio.ts
  function tokenVal() {
    const v = document.getElementById("token")?.value?.trim() || "";
    return v ? v.startsWith("user_") ? v : "user_" + v : "";
  }
  function showError(msg) {
    const el = document.getElementById("error");
    if (el) {
      el.textContent = msg || "";
      el.style.display = msg ? "block" : "none";
    }
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }
  function clearAndAppend(container, child) {
    container.textContent = "";
    container.appendChild(child);
  }
  function main() {
    let analyzeData = null;
    let selectedTrackId = null;
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const tabId = t.dataset.tab;
        const content = document.getElementById("tab-" + tabId);
        if (content) content.classList.add("active");
      });
    });
    document.getElementById("analyze")?.addEventListener("click", () => {
      const t = tokenVal();
      const text = document.getElementById("text")?.value?.trim() || "";
      if (!t) {
        showError("\u8BF7\u5148\u8BBE\u7F6E\u4EE4\u724C\u3002");
        return;
      }
      if (!text) {
        showError("\u8BF7\u8F93\u5165\u8981\u5206\u6790\u7684\u6587\u672C\u3002");
        return;
      }
      showError("");
      const btn = document.getElementById("analyze");
      btn.disabled = true;
      btn.textContent = "\u5206\u6790\u4E2D\u2026";
      fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ text })
      }).then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            showError("401 \u672A\u6388\u6743\uFF0C\u8BF7\u68C0\u67E5\u4EE4\u724C\u3002");
            return;
          }
          return r.json().then((b) => {
            showError(b.error?.message || String(r.status));
          });
        }
        return r.json();
      }).then((data) => {
        btn.disabled = false;
        btn.textContent = "\u5206\u6790";
        if (data?.success && data.data) {
          analyzeData = data.data;
          selectedTrackId = null;
          showError("");
          toast("\u5206\u6790\u5B8C\u6210");
          const tracks = analyzeData.recommendedTracks || [];
          const tracksList = document.getElementById("tracks-list");
          if (tracksList) {
            tracksList.textContent = "";
            for (const tr of tracks) {
              const card = renderTrackCard(document, {
                trackId: String(tr.trackId ?? ""),
                title: String(tr.title ?? ""),
                confidence: Number(tr.confidence ?? 0),
                categories: tr.categories || [],
                mechanisms: tr.mechanisms || [],
                whyThisTrack: String(tr.whyThisTrack ?? "")
              });
              card.addEventListener("click", () => {
                document.querySelectorAll(".track-card").forEach((c) => c.classList.remove("selected"));
                card.classList.add("selected");
                selectedTrackId = card.dataset.trackId ?? null;
              });
              tracksList.appendChild(card);
            }
          }
          document.getElementById("tracks-section").style.display = "block";
          document.getElementById("expand-section").style.display = "block";
          const o = analyzeData.podcastOutline;
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
          const ec = analyzeData.evidenceChain || [];
          const evidenceContent = document.getElementById("evidence-content");
          const evidenceEmpty = document.getElementById("evidence-empty");
          if (ec.length > 0 && evidenceContent && evidenceEmpty) {
            evidenceEmpty.style.display = "none";
            evidenceContent.style.display = "block";
            const onQuoteToggle = (ei, ri) => {
              const el = document.getElementById("ev-quote-" + ei + "-" + ri);
              const tog = document.querySelector(
                `[data-evidx="${ei}"][data-refidx="${ri}"]`
              );
              if (el && tog) {
                el.style.display = el.style.display === "none" ? "block" : "none";
                tog.textContent = el.style.display === "none" ? "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09" : "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u6298\u53E0\uFF09";
              }
            };
            clearAndAppend(
              evidenceContent,
              renderEvidenceChain(document, ec, onQuoteToggle)
            );
          } else if (evidenceEmpty && evidenceContent) {
            evidenceEmpty.style.display = "block";
            evidenceContent.style.display = "none";
          }
        }
      }).catch((e) => {
        btn.disabled = false;
        btn.textContent = "\u5206\u6790";
        showError(e.message || "\u8BF7\u6C42\u5931\u8D25");
      });
    });
    document.getElementById("expand")?.addEventListener("click", () => {
      const t = tokenVal();
      const text = document.getElementById("text")?.value?.trim() || "";
      if (!t) {
        showError("\u8BF7\u5148\u8BBE\u7F6E\u4EE4\u724C\u3002");
        return;
      }
      if (!text) {
        showError("\u8BF7\u8F93\u5165\u8981\u5206\u6790\u7684\u6587\u672C\u3002");
        return;
      }
      if (!analyzeData) {
        showError("\u8BF7\u5148\u6267\u884C\u5206\u6790\u3002");
        return;
      }
      if (!selectedTrackId) {
        showError("\u8BF7\u5148\u9009\u62E9\u4E00\u6761\u63A8\u8350\u8DEF\u5F84\u3002");
        return;
      }
      showError("");
      document.getElementById("cards-empty").style.display = "none";
      document.getElementById("cards-list").style.display = "none";
      document.getElementById("cards-loading").style.display = "flex";
      document.getElementById("outline-empty").style.display = "block";
      document.getElementById("outline-content").style.display = "none";
      document.getElementById("evidence-empty").style.display = "block";
      document.getElementById("evidence-content").style.display = "none";
      fetch("/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ text, selectedTrackId })
      }).then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            showError("401 \u672A\u6388\u6743\uFF0C\u8BF7\u68C0\u67E5\u4EE4\u724C\u3002");
            return;
          }
          return r.json().then((b) => {
            showError(b.error?.message || String(r.status));
          });
        }
        return r.json();
      }).then((data) => {
        document.getElementById("cards-loading").style.display = "none";
        if (data?.success && data.data) {
          const d = data.data;
          const cards = d.plotSupportCards || [];
          const cardsEmpty = document.getElementById("cards-empty");
          const cardsList = document.getElementById("cards-list");
          if (cards.length === 0 && cardsEmpty) {
            cardsEmpty.style.display = "block";
            cardsEmpty.textContent = "\u6682\u65E0\u5267\u60C5\u652F\u6491\u5361\u7247\u3002";
          } else if (cardsList && cardsEmpty) {
            cardsList.style.display = "block";
            cardsList.textContent = "";
            const onQuoteToggle = (i) => {
              const el = document.getElementById("quote-" + i);
              const tog = document.querySelector(`[data-idx="${i}"]`);
              if (el && tog) {
                el.classList.toggle("open");
                tog.textContent = el.classList.contains("open") ? "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u6298\u53E0\uFF09" : "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09";
              }
            };
            cards.forEach((c, i) => {
              const card = renderPlotCard(document, c, i, onQuoteToggle);
              cardsList.appendChild(card);
            });
            toast("\u5DF2\u751F\u6210 " + cards.length + " \u6761\u5267\u60C5\u652F\u6491");
          }
          const outline = d.podcastOutline;
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
          const evidence = d.evidenceChain || [];
          const evidenceContent = document.getElementById("evidence-content");
          const evidenceEmpty = document.getElementById("evidence-empty");
          if (evidence.length > 0 && evidenceContent && evidenceEmpty) {
            evidenceEmpty.style.display = "none";
            evidenceContent.style.display = "block";
            const onQuoteToggle = (ei, ri) => {
              const el = document.getElementById("ev-quote-" + ei + "-" + ri);
              const tog = document.querySelector(
                `[data-evidx="${ei}"][data-refidx="${ri}"]`
              );
              if (el && tog) {
                el.style.display = el.style.display === "none" ? "block" : "none";
                tog.textContent = el.style.display === "none" ? "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09" : "\u5F15\u7528\u539F\u6587\uFF08\u70B9\u51FB\u6298\u53E0\uFF09";
              }
            };
            clearAndAppend(
              evidenceContent,
              renderEvidenceChain(document, evidence, onQuoteToggle)
            );
          } else if (evidenceEmpty && evidenceContent) {
            evidenceEmpty.style.display = "block";
            evidenceEmpty.textContent = "\u6682\u65E0\u8BC1\u636E\u94FE\u6570\u636E\u3002";
            evidenceContent.style.display = "none";
          }
        }
      }).catch((e) => {
        document.getElementById("cards-loading").style.display = "none";
        const cardsEmpty = document.getElementById("cards-empty");
        if (cardsEmpty) {
          cardsEmpty.style.display = "block";
          cardsEmpty.textContent = "\u8BF7\u6C42\u5931\u8D25\uFF1A" + (e.message || "\u672A\u77E5\u9519\u8BEF");
        }
        showError(e.message || "\u8BF7\u6C42\u5931\u8D25");
      });
    });
  }
  main();
})();
