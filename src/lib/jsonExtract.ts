/**
 * Extract JSON object from LLM output.
 * Handles: pure JSON, code fence(s), explanatory text, strings containing {/}.
 * State-machine brace matching ignores { } inside strings.
 */
export type ExtractResult = { ok: true; value: unknown } | { ok: false; reason: string };

/**
 * Try to extract first complete JSON object from raw text.
 * 1. Code fences: try each ``` block, return first that parses
 * 2. Otherwise: bracket-matching from first { (state machine, ignores braces in strings)
 */
export function extractJsonObject(raw: string): ExtractResult {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: false, reason: "empty response" };

  const candidates: string[] = [];

  // 1. Collect from all code fences
  const fenceRe = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  let fenceMatch;
  while ((fenceMatch = fenceRe.exec(s)) !== null) {
    const inner = fenceMatch[1].trim();
    const extracted = extractFirstObject(inner);
    if (extracted) candidates.push(extracted);
  }

  // 2. Fallback: from full text (no fence or fence failed)
  if (candidates.length === 0) {
    const extracted = extractFirstObject(s);
    if (extracted) candidates.push(extracted);
  }

  let lastParseError: string | null = null;
  for (const jsonStr of candidates) {
    try {
      const value = JSON.parse(jsonStr);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return { ok: true, value };
      }
    } catch (e) {
      lastParseError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  if (candidates.length > 0) {
    const msg = lastParseError
      ? `JSON parse error: ${lastParseError.slice(0, 80)}`
      : "no valid JSON object in extracted candidates";
    return { ok: false, reason: msg };
  }
  return { ok: false, reason: "no JSON object found" };
}

/** Find first complete JSON object from text, using state-machine brace matching. */
function extractFirstObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  return extractObjectFromBrace(text, start);
}

/**
 * From index of '{', find matching '}' using state machine.
 * Ignores { } inside double-quoted strings; handles escape sequences.
 */
function extractObjectFromBrace(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let i = start;

  while (i < text.length) {
    const c = text[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (inString) {
      if (c === "\\") {
        escapeNext = true;
      } else if (c === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (c === '"') {
      inString = true;
      i++;
      continue;
    }

    if (c === "{") {
      depth++;
      i++;
      continue;
    }

    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
      i++;
      continue;
    }

    i++;
  }
  return null;
}
