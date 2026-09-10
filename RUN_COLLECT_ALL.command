#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "충주시 대시보드 전체 수집을 시작합니다."
echo "- MGF 길드 상세 기준: https://mgf.gg/contents/guild_info.php?g_name=충주시"
echo "- 핫딜: 기프트카드 최신 5개"
npm run collect:all-data
echo "완료: 길드/토벌 주차 이력, 콘텐츠 매칭 이력, 핫딜 데이터 갱신됨"
