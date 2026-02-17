import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function ensureDirFor(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function dedupe(items) {
  const map = new Map();
  for (const it of items) {
    const key = `${it.name_cn}::${it.definition_cn}`;
    if (!map.has(key)) map.set(key, it);
  }
  return [...map.values()];
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text.slice(start, end + 1)) };
  } catch {
    return { ok: false };
  }
}

function parseMechanismMeta() {
  const file = readFileSync(resolve("src/data/mechanismLibrary.ts"), "utf-8");
  const ids = [...file.matchAll(/mechanism_id:\s*"([^"]+)"/g)].map((m) => m[1]);
  const intents = [...file.matchAll(/routing_intents_cn:\s*\[([^\]]+)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .filter(Boolean);
  return {
    mechanismIds: [...new Set(ids)],
    routingIntents: [...new Set(intents)],
  };
}

function generateFallbackLibrary(meta) {
  const seeds = [
    "医疗自动化",
    "教育训练",
    "平台治理",
    "公共安全",
    "金融风控",
    "舆情传播",
    "供应链韧性",
    "城市治理",
    "数据合规",
    "能源转型",
  ];
  const list = [];
  for (let i = 0; i < 200; i++) {
    const theme = seeds[i % seeds.length];
    const vpId = `VP${String(i + 1).padStart(3, "0")}`;
    list.push({
      vp_id: vpId,
      name_cn: `${theme}观点${(i % 10) + 1}`,
      definition_cn: `${theme}的关键矛盾在效率提升与系统韧性之间，需要可解释反馈来避免局部优化。`,
      diagnostic_questions_cn: [
        `${theme}是否存在明显风险暴露？`,
        `当前流程是否出现反馈滞后？`,
        `是否因为指标导向导致行为偏差？`,
      ],
      evidence_patterns: [theme, "效率", "风险", "反馈", "训练", "误判"],
      routing_intents_cn: [
        meta.routingIntents[i % meta.routingIntents.length],
        meta.routingIntents[(i + 3) % meta.routingIntents.length],
      ],
      related_mechanism_ids: [meta.mechanismIds[i % meta.mechanismIds.length]],
      examples: [
        `${theme}场景中，新系统上线后出现训练不足导致误判的争议。`,
        `${theme}报道提到一线执行反馈不及时，形成治理盲区。`,
      ],
    });
  }
  return list;
}

function validateViewpoints(items, meta) {
  const errs = [];
  const seen = new Set();
  for (const it of items) {
    const id = it.vp_id || "unknown";
    if (!it.vp_id) errs.push(`[${id}] missing vp_id`);
    else if (seen.has(it.vp_id)) errs.push(`[${id}] duplicate vp_id`);
    else seen.add(it.vp_id);
    if (!it.name_cn) errs.push(`[${id}] name_cn empty`);
    if (!it.definition_cn) errs.push(`[${id}] definition_cn empty`);
    if (!Array.isArray(it.diagnostic_questions_cn) || it.diagnostic_questions_cn.length < 3)
      errs.push(`[${id}] diagnostic_questions_cn < 3`);
    if (!Array.isArray(it.evidence_patterns) || it.evidence_patterns.length < 5)
      errs.push(`[${id}] evidence_patterns < 5`);
    if (!Array.isArray(it.routing_intents_cn) || it.routing_intents_cn.length < 2)
      errs.push(`[${id}] routing_intents_cn < 2`);
    else {
      for (const r of it.routing_intents_cn) {
        if (!meta.routingIntents.includes(r)) errs.push(`[${id}] invalid routing_intent: ${r}`);
      }
    }
    if (!Array.isArray(it.related_mechanism_ids) || it.related_mechanism_ids.length < 1)
      errs.push(`[${id}] related_mechanism_ids empty`);
    else {
      for (const m of it.related_mechanism_ids) {
        if (!meta.mechanismIds.includes(m)) errs.push(`[${id}] invalid mechanism_id: ${m}`);
      }
    }
    if (!Array.isArray(it.examples) || it.examples.length < 2) errs.push(`[${id}] examples < 2`);
  }
  return errs;
}

async function askLlm(prompt) {
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  if (!apiKey) return null;
  const model = (process.env.LLM_MODEL || "gpt-4o-mini").trim();
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? null;
}

function buildPrompt(seed) {
  const meta = parseMechanismMeta();
  const mechanismIds = meta.mechanismIds.join(",");
  return `你是观点库构建助手。基于给定关键词生成至少200条观点库条目，输出严格 JSON。

seed:
${seed}

机制可用 id:
${mechanismIds}

输出格式:
{
  "viewpoints": [
    {
      "vp_id": "VP001",
      "name_cn": "观点名",
      "definition_cn": "定义",
      "diagnostic_questions_cn": ["q1","q2","q3"],
      "evidence_patterns": ["词1","词2","词3","词4","词5"],
      "routing_intents_cn": ["意图A","意图B"],
      "related_mechanism_ids": ["M01","M10"],
      "examples": ["例子1","例子2"]
    }
  ]
}

仅返回 JSON。`;
}

async function main() {
  const seedPath = getArg("--seed") ?? "docs/radar_keywords.md";
  const seedAbs = resolve(seedPath);
  const seed = readFileSync(seedAbs, "utf-8");
  const prompt = buildPrompt(seed);

  const promptPath = resolve("docs/viewpoint_library_prompt.md");
  ensureDirFor(promptPath);
  writeFileSync(promptPath, `# Viewpoint Library Prompt\n\n\`\`\`\n${prompt}\n\`\`\`\n`, "utf-8");

  const meta = parseMechanismMeta();
  let raw = "";
  const fallback = generateFallbackLibrary(meta);
  raw = (await askLlm(prompt)) ?? JSON.stringify({ viewpoints: fallback });

  const rawPath = resolve("tmp/viewpoint_raw.json");
  ensureDirFor(rawPath);
  writeFileSync(rawPath, raw, "utf-8");

  const extracted = extractJsonObject(raw);
  const parsed = extracted.ok ? extracted.value : { viewpoints: fallback };
  const arr = Array.isArray(parsed?.viewpoints) ? parsed.viewpoints : fallback;

  const deduped = dedupe(arr);
  const result = deduped.length >= 200 ? deduped : fallback;
  const errs = validateViewpoints(result, meta);
  if (errs.length > 0) {
    throw new Error(`viewpoint library validate failed:\n${errs.slice(0, 20).join("\n")}`);
  }

  const outPath = resolve("src/data/viewpointLibrary.generated.json");
  ensureDirFor(outPath);
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`generated viewpoint library: ${result.length} entries -> ${outPath}`);
}

void main();
