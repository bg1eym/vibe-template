import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScifiEntry } from "./types.js";

let catalogCache: ScifiEntry[] | null = null;
let mechanismRulesCache: Record<string, string[]> | null = null;

export function loadCatalog(): ScifiEntry[] {
  if (catalogCache) return catalogCache;
  const path = join(process.cwd(), "data", "scifi_catalog.json");
  const raw = readFileSync(path, "utf-8");
  catalogCache = JSON.parse(raw) as ScifiEntry[];
  return catalogCache;
}

export function loadMechanismRules(): Record<string, string[]> {
  if (mechanismRulesCache) return mechanismRulesCache;
  const path = join(process.cwd(), "data", "mechanism_rules.json");
  const raw = readFileSync(path, "utf-8");
  mechanismRulesCache = JSON.parse(raw) as Record<string, string[]>;
  return mechanismRulesCache;
}

export function matchMechanisms(text: string): Set<string> {
  const lower = text.toLowerCase();
  const rules = loadMechanismRules();
  const matched = new Set<string>();
  for (const [mechanism, keywords] of Object.entries(rules)) {
    for (const kw of keywords || []) {
      const re = new RegExp(kw.replace(/\s/g, "\\s+"), "i");
      if (re.test(lower) || lower.includes(kw)) {
        matched.add(mechanism);
        break;
      }
    }
  }
  return matched;
}

export function matchByMechanism(text: string, minCount: number): ScifiEntry[] {
  const mechanisms = matchMechanisms(text);
  const catalog = loadCatalog();
  let matches = catalog.filter((e) => e.mechanism && mechanisms.has(e.mechanism));
  if (matches.length < minCount) {
    const ids = new Set(matches.map((e) => e.title));
    for (const e of catalog) {
      if (e.mechanism && !ids.has(e.title)) {
        matches = [...matches, e];
        ids.add(e.title);
        if (matches.length >= minCount) break;
      }
    }
  }
  return matches.slice(0, 10);
}

export function matchScifi(
  categories: Array<{ category: string; score: number }>,
  limit: number,
): Array<ScifiEntry & { overlap: number }> {
  const catSet = new Set(categories.map((c) => c.category));
  const catalog = loadCatalog();
  const scored = catalog.map((entry) => {
    const overlap = (entry.themes || []).filter((t) => catSet.has(t)).length;
    return { ...entry, overlap };
  });
  return scored
    .filter((e) => e.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}
