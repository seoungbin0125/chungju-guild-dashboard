#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "충주시 길드 대시보드 GitHub 업로드"
echo "먼저 GitHub에서 README 없이 빈 저장소를 만든 뒤 HTTPS 주소를 준비해주세요."
echo "예: https://github.com/아이디/chungju-guild-dashboard.git"
echo
read -r -p "빈 GitHub 저장소 HTTPS 주소: " repo_url

if [[ ! "$repo_url" =~ ^https://github\.com/[^/]+/[^/]+(\.git)?$ ]]; then
  echo "GitHub HTTPS 저장소 주소 형식이 아닙니다."
  read -r -p "Enter를 누르면 종료합니다."
  exit 1
fi

if [[ ! -d .git ]]; then
  git init
fi

if ! git config user.name >/dev/null 2>&1; then
  read -r -p "Git 커밋에 표시할 이름: " git_name
  git config user.name "$git_name"
fi

if ! git config user.email >/dev/null 2>&1; then
  read -r -p "GitHub 이메일: " git_email
  git config user.email "$git_email"
fi

git branch -M main
git add .
if ! git diff --cached --quiet; then
  git commit -m "feat: launch Chungju guild dashboard v2.1.0"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$repo_url"
else
  git remote add origin "$repo_url"
fi

git push -u origin main

echo
echo "GitHub 업로드가 완료되었습니다."
echo "다음 단계는 GITHUB_AND_SERVER_DEPLOY.md의 Cloudflare Pages 항목을 따라주세요."
read -r -p "Enter를 누르면 종료합니다."
