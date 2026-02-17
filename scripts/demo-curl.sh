#!/usr/bin/env bash
# Demo: analyze_ai + match_scifi_ai，打印首条 match 供人工验收
# 用法: LLM_PROVIDER=fake ./scripts/demo-curl.sh  或  LLM_API_KEY=sk-xxx ./scripts/demo-curl.sh
set -e
cd "$(dirname "$0")/.."
npm run build -s
echo "=== 1. POST /analyze_ai ==="
LLM_PROVIDER="${LLM_PROVIDER:-fake}" npx tsx -e "
(async () => {
  const { buildApp } = await import('./src/app.js');
  const { openDb, closeDb } = await import('./src/db/client.js');
  const { migrate } = await import('./src/db/migrate.js');
  const db = openDb(':memory:');
  migrate(db);
  const app = buildApp({ db });
  const r = await app.inject({ method: 'POST', url: '/analyze_ai', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user_1' }, payload: { text: '张文宏称新冠可能长期存在，需建立常态化防控机制' } });
  console.log('status:', r.statusCode);
  const j = r.json();
  console.log('success:', j.success);
  if (j.data?.analysis) {
    console.log('news_points count:', j.data.analysis.news_points?.length);
    const pts = j.data.analysis.news_points?.slice(0, 2).map(p => p.point_cn) || [];
    console.log('selected_points (first 2):', pts);
  }
  await app.close();
  closeDb(db);
})();
"
echo ""
echo "=== 2. POST /match_scifi_ai (with selected_points) ==="
LLM_PROVIDER="${LLM_PROVIDER:-fake}" npx tsx -e "
(async () => {
  const { buildApp } = await import('./src/app.js');
  const { openDb, closeDb } = await import('./src/db/client.js');
  const { migrate } = await import('./src/db/migrate.js');
  const db = openDb(':memory:');
  migrate(db);
  const app = buildApp({ db });
  const analyzeRes = await app.inject({ method: 'POST', url: '/analyze_ai', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user_1' }, payload: { text: '张文宏称新冠可能长期存在，需建立常态化防控机制' } });
  const analysis = analyzeRes.json().data?.analysis;
  if (!analysis) { console.log('analyze failed'); await app.close(); closeDb(db); return; }
  const pts = (analysis.news_points || []).slice(0, 2).map(p => p.point_cn).filter(Boolean);
  const r = await app.inject({ method: 'POST', url: '/match_scifi_ai', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user_1' }, payload: { analysis, selected_points: pts } });
  console.log('status:', r.statusCode);
  const j = r.json();
  if (j.success && j.data?.matches?.[0]) {
    const m = j.data.matches[0];
    console.log('');
    console.log('--- 首条 match 供人工验收 ---');
    console.log('source_id:', m.source_id);
    console.log('scene_cn:', m.scene_cn);
    console.log('mapping_cn:', m.mapping_cn);
    console.log('why_this_is_relevant_cn:', m.why_this_is_relevant_cn);
    console.log('quote_en:', m.quote_en || '(无)');
  } else if (j.error) {
    console.log('error:', j.error?.code, j.error?.message);
  }
  await app.close();
  closeDb(db);
})();
"
echo ""
echo "=== 3. BAD_UPSTREAM: 缺 news_points 的 fake 输出 ==="
npx tsx -e "
(async () => {
  const { buildApp } = await import('./src/app.js');
  const { openDb, closeDb } = await import('./src/db/client.js');
  const { migrate } = await import('./src/db/migrate.js');
  const db = openDb(':memory:');
  migrate(db);
  const fakeBad = { async complete() { return JSON.stringify({ news_points: [], questions: [], confidence: 0.5 }); } };
  const app = buildApp({ db, llmClient: fakeBad });
  const r = await app.inject({ method: 'POST', url: '/analyze_ai', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user_1' }, payload: { text: '测试' } });
  console.log('status:', r.statusCode);
  const j = r.json();
  console.log('error.code:', j.error?.code);
  console.log('error.message:', j.error?.message);
  await app.close();
  closeDb(db);
})();
"
echo "OK"
