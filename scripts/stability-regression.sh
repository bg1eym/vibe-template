#!/usr/bin/env bash
# 稳定性回归：analyze_ai + match_scifi_ai 连跑 N 次，断言每次 success 且 mapping_cn 均≥60
# 用法: 先 npm run dev 启动服务，再 LLM_API_KEY=sk-xxx ./scripts/stability-regression.sh [N]
# 默认 N=10
set -e
cd "$(dirname "$0")/.."
N=${1:-10}
TEXT="张文宏反对把AI引入医院病历系统，因为医生需要训练专业诊断能力。"

echo "=== 稳定性回归：$N 次 analyze + match ==="
npm run build -s

for i in $(seq 1 "$N"); do
  echo "--- Run $i/$N ---"
  ANALYSIS=$(curl -sS -X POST http://127.0.0.1:3000/analyze_ai \
    -H "Authorization: Bearer user_1" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$TEXT\"}")
  if ! echo "$ANALYSIS" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "❌ Run $i: analyze_ai failed"
    echo "$ANALYSIS" | jq .
    exit 1
  fi
  echo "{\"analysis\": $(echo $ANALYSIS | jq -c '.data.analysis'), \"selected_points\": $(echo $ANALYSIS | jq -c '.data.analysis.news_points[0:2] | map(.point_cn)')}" > /tmp/match_req.json

  RES=$(curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai \
    -H "Authorization: Bearer user_1" \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/match_req.json)

  if ! echo "$RES" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "❌ Run $i: match_scifi_ai failed"
    echo "$RES" | jq .
    exit 1
  fi

  MIN_LEN=$(echo "$RES" | jq '[.data.matches[].mapping_cn | length] | min')
  if [ "$MIN_LEN" -lt 60 ]; then
    echo "❌ Run $i: mapping_cn min length $MIN_LEN < 60"
    echo "$RES" | jq '.data.matches[] | {mapping_cn: .mapping_cn, len: (.mapping_cn | length)}'
    exit 1
  fi

  # source_id 必须全部在 catalog title 列表内
  ALLOWED_TITLES=$(jq -r '.[].title' data/scifi_catalog.json)
  BAD_SID=$(echo "$RES" | jq -r '.data.matches[].source_id' | while read -r sid; do
    if ! echo "$ALLOWED_TITLES" | grep -qxF "$sid"; then
      echo "$sid"
    fi
  done)
  if [ -n "$BAD_SID" ]; then
    echo "❌ Run $i: invalid source_id found:"
    echo "$BAD_SID"
    exit 1
  fi
  echo "✅ Run $i OK"
done

echo ""
echo "=== 全部 $N 次通过 ==="
