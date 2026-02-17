export function applyLoadingText(container: HTMLElement, msg: string): void {
  container.classList.add("visible");
  const textEl = container.querySelector(".loading-text");
  if (textEl) textEl.textContent = msg;
}

export function formatDoneStatus(reqId: string | undefined, elapsedMs: number): string {
  const rid = reqId ? `[${reqId}] ` : "";
  return `${rid}完成，用时 ${elapsedMs} ms`;
}

export function formatErrorStatus(
  reqId: string | undefined,
  path: string,
  status: number | undefined,
  detail: string,
): string {
  const rid = reqId ? `[${reqId}] ` : "";
  const st = typeof status === "number" ? `status=${status} ` : "";
  return `${rid}POST ${path} 失败：${st}${detail}`;
}
