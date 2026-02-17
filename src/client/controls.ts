export function renderImproveButton(
  doc: Document,
  selectedCount: number,
  onClick: () => void,
): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.className = "control-btn ctrl-improve";
  btn.textContent = `改进选中条目 (${selectedCount})`;
  const disabled = selectedCount < 1 || selectedCount > 5;
  if (disabled) {
    btn.disabled = true;
    btn.title = "请先勾选 1–5 条候选";
  } else {
    btn.addEventListener("click", onClick);
  }
  return btn;
}
