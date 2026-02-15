/**
 * Items UI client: uses DOM builders only (no innerHTML with user data).
 * Bundled to public/ui.js for browser.
 */
import { renderItem, renderChartBar, renderChartLabel } from "../lib/view/domBuilders.js";

declare const document: Document;

function tokenVal(): string {
  const v = (document.getElementById("token") as HTMLInputElement)?.value?.trim() || "";
  return v ? (v.startsWith("user_") ? v : "user_" + v) : "";
}

function showError(msg: string): void {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = msg;
    (el as HTMLElement).style.display = msg ? "block" : "none";
  }
}

function tagCounts(items: Array<{ tags?: string[] }>): [string, number][] {
  const m: Record<string, number> = {};
  (items || []).forEach((it) => {
    (it.tags || []).forEach((t) => {
      m[t] = (m[t] || 0) + 1;
    });
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function renderList(items: Array<{ title?: string; content?: string; tags?: string[] }>): void {
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
        tags: it.tags || [],
      }),
    );
  }
}

function renderChart(items: Array<{ tags?: string[] }>): void {
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
    const pct = (cnt / max) * 100;
    chart.appendChild(renderChartBar(document, label, pct, cnt));
    labels.appendChild(renderChartLabel(document, label));
  }
}

function load(): void {
  showError("");
  const t = tokenVal();
  const q = (document.getElementById("q") as HTMLInputElement)?.value?.trim() || "";
  const tag = (document.getElementById("tag") as HTMLInputElement)?.value?.trim() || "";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const url = "/items" + (params.toString() ? "?" + params : "");

  fetch(url, { headers: t ? { Authorization: "Bearer " + t } : {} })
    .then((r) => {
      if (!r.ok) {
        if (r.status === 401) {
          showError("401 Unauthorized – set token and query.");
          renderList([]);
          renderChart([]);
        } else {
          return r.json().then((b: { error?: { message?: string } }) => {
            showError((b.error?.message as string) || String(r.status));
          });
        }
        return;
      }
      return r.json();
    })
    .then((data: { success?: boolean; data?: { items?: Array<Record<string, unknown>> } }) => {
      if (data?.success && data.data?.items) {
        showError("");
        renderList(data.data.items);
        renderChart(data.data.items);
      }
    })
    .catch((e: Error) => {
      showError(e.message || "Request failed");
    });
}

function main(): void {
  document.getElementById("query")?.addEventListener("click", load);
  document.getElementById("token")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") load();
  });
  document.getElementById("q")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") load();
  });
  document.getElementById("tag")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") load();
  });

  document.getElementById("create")?.addEventListener("click", () => {
    const t = tokenVal();
    if (!t) {
      showError("Set token first.");
      return;
    }
    const title = (document.getElementById("new-title") as HTMLInputElement)?.value?.trim() || "";
    const content =
      (document.getElementById("new-content") as HTMLInputElement)?.value?.trim() || "";
    const tagsStr = (document.getElementById("new-tags") as HTMLInputElement)?.value?.trim() || "";
    const tags = tagsStr
      ? tagsStr
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (!title || !content) {
      showError("Title and content required.");
      return;
    }
    fetch("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ title, content, tags }),
    })
      .then((r) => {
        if (r.ok) {
          (document.getElementById("new-title") as HTMLInputElement).value = "";
          (document.getElementById("new-content") as HTMLInputElement).value = "";
          (document.getElementById("new-tags") as HTMLInputElement).value = "";
          load();
        } else {
          return r.json().then((b: { error?: { message?: string } }) => {
            showError((b.error?.message as string) || String(r.status));
          });
        }
      })
      .catch((e: Error) => {
        showError(e.message || "Create failed");
      });
  });

  load();
}

main();
