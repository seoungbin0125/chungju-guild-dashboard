#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "기프트카드 핫딜 수집을 시작합니다."
npm run collect:hotdeals
echo "완료: data/hotdeals.json 갱신됨"
