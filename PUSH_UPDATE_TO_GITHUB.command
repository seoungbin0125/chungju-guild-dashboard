#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "충주시 길드 대시보드 v2.5.2 업데이트 업로드"
if [[ ! -d .git ]]; then
  echo "이 폴더는 아직 GitHub 저장소와 연결되지 않았습니다. PUSH_TO_GITHUB.command를 먼저 실행해주세요."
  read -r -p "Enter를 누르면 종료합니다."
  exit 1
fi

echo "GitHub의 최신 변경 사항을 먼저 합치는 중..."
git pull --rebase --autostash origin main

git add .
if git diff --cached --quiet; then
  echo "새로 커밋할 변경 사항은 없습니다. 원격 변경을 확인합니다."
else
  git commit -m "fix: ignore carried-over MGF raid scores after weekly reset"
fi

if ! git push origin main; then
  echo "원격 자동수집 커밋이 생겨 한 번 더 동기화합니다..."
  git pull --rebase --autostash origin main
  git push origin main
fi
echo "GitHub 업로드 완료. 연결된 Cloudflare Pages가 자동 배포를 시작합니다."

read -r -p "Enter를 누르면 종료합니다."
