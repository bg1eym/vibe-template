/**
 * NL Router — Pure function to route user text to Atlas dashboard actions.
 * Strict allowlist: ACTION_ATLAS_TODAY, ACTION_ATLAS_HELP, or HELP fallback.
 * No user args injection; deterministic behavior.
 */

export const ACTION_ATLAS_TODAY = "ACTION_ATLAS_TODAY";
export const ACTION_ATLAS_HELP = "ACTION_ATLAS_HELP";
export const ACTION_ATLAS_DEBUG = "ACTION_ATLAS_DEBUG";
export const ACTION_HELP = "ACTION_HELP";

export type AtlasAction =
  | typeof ACTION_ATLAS_TODAY
  | typeof ACTION_ATLAS_HELP
  | typeof ACTION_ATLAS_DEBUG
  | typeof ACTION_HELP;

export type RouteResult = {
  action: AtlasAction;
  confidence: number;
  reason: string;
};

/** Reject if text contains shell metacharacters or injection attempts. */
const UNSAFE_PATTERNS = [
  /[;&|`$(){}[\]<>]/,
  /--\w+/,
  /\brm\s+-rf/i,
  /\bcurl\s+/i,
  /\bwget\s+/i,
  /\beval\s*\(/i,
  /\$\{/,
  /\b&&\b/,
];

function isUnsafe(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return UNSAFE_PATTERNS.some((re) => re.test(t));
}

function normalize(text: string): string {
  let t = text.trim().toLowerCase();
  t = t.replace(/^\/atlas\s*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Patterns that map to ACTION_ATLAS_TODAY. */
const ATLAS_TODAY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /^atlas$/i, reason: "atlas_only" },
  { re: /^atlas\s+today$/i, reason: "atlas_today" },
  { re: /^today$/i, reason: "today_only" }, // /atlas today
  { re: /^(发|把).*atlas.*(看板|发|给)/i, reason: "send_atlas_board" },
  { re: /^(发|把).*atlas\s*$/i, reason: "send_atlas" },
  { re: /^(生成|跑).*(今日|今天)\s*atlas/i, reason: "generate_today_atlas" },
  { re: /^(今日|今天)\s*atlas/i, reason: "today_atlas" },
  { re: /^situation\s+monitor$/i, reason: "situation_monitor" },
  { re: /^open\s+atlas$/i, reason: "open_atlas" },
  { re: /^打开\s*(atlas|dashboard|看板)/i, reason: "open_dashboard" },
  { re: /^看板$/i, reason: "kanban_only" },
  { re: /^dashboard$/i, reason: "dashboard_only" },
];

/** Patterns that map to ACTION_ATLAS_HELP. */
const ATLAS_HELP_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /^atlas\s+help$/i, reason: "atlas_help" },
  { re: /^help\s+atlas$/i, reason: "help_atlas" },
  { re: /^help$/i, reason: "help_only" }, // /atlas help -> args "help"
];

/** Patterns that map to ACTION_ATLAS_DEBUG (internal). */
const ATLAS_DEBUG_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /^debug$/i, reason: "debug" },
];

export function route(text: string): RouteResult {
  if (isUnsafe(text)) {
    return {
      action: ACTION_HELP,
      confidence: 1,
      reason: "unsafe_input_rejected",
    };
  }

  const norm = normalize(text);

  for (const { re, reason } of ATLAS_DEBUG_PATTERNS) {
    if (re.test(norm)) {
      return { action: ACTION_ATLAS_DEBUG, confidence: 1, reason };
    }
  }

  for (const { re, reason } of ATLAS_HELP_PATTERNS) {
    if (re.test(norm)) {
      return { action: ACTION_ATLAS_HELP, confidence: 1, reason };
    }
  }

  for (const { re, reason } of ATLAS_TODAY_PATTERNS) {
    if (re.test(norm)) {
      return { action: ACTION_ATLAS_TODAY, confidence: 1, reason };
    }
  }

  return {
    action: ACTION_HELP,
    confidence: 0,
    reason: "no_match",
  };
}
