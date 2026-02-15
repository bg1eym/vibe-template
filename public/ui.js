"use strict";
(() => {
  // src/lib/view/domBuilders.ts
  function attrEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderItem(doc, it) {
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
  function renderChartBar(doc, label, pct, count) {
    const bar = doc.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${pct}%`;
    const titleVal = count != null ? `${label}: ${count}` : label;
    bar.setAttribute("title", attrEscape(titleVal));
    return bar;
  }
  function renderChartLabel(doc, label) {
    const el = doc.createElement("div");
    el.className = "chart-label";
    el.setAttribute("title", attrEscape(label));
    el.textContent = label;
    return el;
  }

  // src/client/ui.ts
  function tokenVal() {
    const v = document.getElementById("token")?.value?.trim() || "";
    return v ? v.startsWith("user_") ? v : "user_" + v : "";
  }
  function showError(msg) {
    const el = document.getElementById("error");
    if (el) {
      el.textContent = msg;
      el.style.display = msg ? "block" : "none";
    }
  }
  function tagCounts(items) {
    const m = {};
    (items || []).forEach((it) => {
      (it.tags || []).forEach((t) => {
        m[t] = (m[t] || 0) + 1;
      });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  function renderList(items) {
    const el = document.getElementById("list");
    if (!el) return;
    el.textContent = "";
    if (!items || items.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No items.";
      el.appendChild(p);
      return;
    }
    for (const it of items) {
      el.appendChild(
        renderItem(document, {
          title: it.title || "",
          content: it.content || "",
          tags: it.tags || []
        })
      );
    }
  }
  function renderChart(items) {
    const counts = tagCounts(items);
    const max = Math.max(1, ...counts.map((c) => c[1]));
    const chart = document.getElementById("chart");
    const labels = document.getElementById("chart-labels");
    if (!chart || !labels) return;
    chart.textContent = "";
    labels.textContent = "";
    if (counts.length === 0) {
      const p = document.createElement("p");
      p.style.color = "#9ca3af";
      p.textContent = "No tags in current list.";
      chart.appendChild(p);
      return;
    }
    for (const [label, cnt] of counts) {
      const pct = cnt / max * 100;
      chart.appendChild(renderChartBar(document, label, pct, cnt));
      labels.appendChild(renderChartLabel(document, label));
    }
  }
  function load() {
    showError("");
    const t = tokenVal();
    const q = document.getElementById("q")?.value?.trim() || "";
    const tag = document.getElementById("tag")?.value?.trim() || "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    const url = "/items" + (params.toString() ? "?" + params : "");
    fetch(url, { headers: t ? { Authorization: "Bearer " + t } : {} }).then((r) => {
      if (!r.ok) {
        if (r.status === 401) {
          showError("401 Unauthorized \u2013 set token and query.");
          renderList([]);
          renderChart([]);
        } else {
          return r.json().then((b) => {
            showError(b.error?.message || String(r.status));
          });
        }
        return;
      }
      return r.json();
    }).then((data) => {
      if (data?.success && data.data?.items) {
        showError("");
        renderList(data.data.items);
        renderChart(data.data.items);
      }
    }).catch((e) => {
      showError(e.message || "Request failed");
    });
  }
  function main() {
    document.getElementById("query")?.addEventListener("click", load);
    document.getElementById("token")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load();
    });
    document.getElementById("q")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load();
    });
    document.getElementById("tag")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load();
    });
    document.getElementById("create")?.addEventListener("click", () => {
      const t = tokenVal();
      if (!t) {
        showError("Set token first.");
        return;
      }
      const title = document.getElementById("new-title")?.value?.trim() || "";
      const content = document.getElementById("new-content")?.value?.trim() || "";
      const tagsStr = document.getElementById("new-tags")?.value?.trim() || "";
      const tags = tagsStr ? tagsStr.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) : [];
      if (!title || !content) {
        showError("Title and content required.");
        return;
      }
      fetch("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
        body: JSON.stringify({ title, content, tags })
      }).then((r) => {
        if (r.ok) {
          document.getElementById("new-title").value = "";
          document.getElementById("new-content").value = "";
          document.getElementById("new-tags").value = "";
          load();
        } else {
          return r.json().then((b) => {
            showError(b.error?.message || String(r.status));
          });
        }
      }).catch((e) => {
        showError(e.message || "Create failed");
      });
    });
    load();
  }
  main();
})();
