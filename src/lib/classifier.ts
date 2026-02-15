import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CategoryRule = {
  id: string;
  keywords: string[];
  weight: number;
  negative_keywords: string[];
  required_keywords: string[];
};

export type CategoryScore = { category: string; score: number };

const DEFAULT_RULES_PATH = join(process.cwd(), "data", "classifier_rules.json");

let rulesCache: CategoryRule[] | null = null;

export function loadRules(path: string = DEFAULT_RULES_PATH): CategoryRule[] {
  if (path === DEFAULT_RULES_PATH && rulesCache) return rulesCache;
  const raw = readFileSync(path, "utf-8");
  const rules = JSON.parse(raw) as CategoryRule[];
  if (path === DEFAULT_RULES_PATH) rulesCache = rules;
  return rules;
}

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    const re = new RegExp(kw.replace(/\s/g, "\\s+"), "gi");
    const matches = lower.match(re);
    count += matches ? matches.length : 0;
  }
  return count;
}

function hasAll(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.every((kw) => {
    const re = new RegExp(kw.replace(/\s/g, "\\s+"), "i");
    return re.test(lower);
  });
}

function hasAny(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const re = new RegExp(kw.replace(/\s/g, "\\s+"), "i");
    return re.test(lower);
  });
}

export function classify(text: string, rulesPath?: string): CategoryScore[] {
  const rules = rulesPath ? loadRules(rulesPath) : loadRules();
  const scores: CategoryScore[] = rules.map((rule) => {
    if (!hasAll(text, rule.required_keywords || [])) {
      return { category: rule.id, score: 0 };
    }
    if (hasAny(text, rule.negative_keywords || [])) {
      return { category: rule.id, score: 0 };
    }
    const matches = countMatches(text, rule.keywords || []);
    const weight = typeof rule.weight === "number" ? rule.weight : 1;
    return { category: rule.id, score: matches * weight };
  });
  return scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
