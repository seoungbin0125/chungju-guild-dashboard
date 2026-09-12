#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "충주시 길드 대시보드 v2.2.0 업데이트 업로드"
if [[ ! -d .git ]]; then
  echo "이 폴더는 아직 GitHub 저장소와 연결되지 않았습니다. PUSH_TO_GITHUB.command를 먼저 실행해주세요."
  read -r -p "Enter를 누르면 종료합니다."
  exit 1
fi

git add .
if git diff --cached --quiet; then
  echo "업로드할 변경 사항이 없습니다."
else
  git commit -m "feat: add individual guild war history and server ranks"
  git push origin main
  echo "GitHub 업로드 완료. 연결된 Cloudflare Pages가 자동 배포를 시작합니다."
fi

read -r -p "Enter를 누르면 종료합니다."
