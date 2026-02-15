/**
 * Centralized HTML escape. Use for any user/API content before DOM insertion.
 * Prevents XSS when content is rendered into HTML.
 * Works in both Node (tests) and browser.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  const str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline script for browser: `function esc(s){...}`. Keep in sync with escapeHtml. */
export const ESCAPE_HTML_BROWSER = `function esc(s){if(s==null)return '';var s=String(s);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}`;
