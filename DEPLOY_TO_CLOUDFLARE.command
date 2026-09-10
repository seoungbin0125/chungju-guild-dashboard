#!/bin/zsh
set -e
cd "$(dirname "$0")"
echo "충주시 Guild Dashboard Cloudflare 배포를 시작합니다."
echo "Cloudflare 로그인 화면이 뜨면 계정 인증을 완료해주세요."
npm install
npm run cf:setup
read -n 1 -s -r '?완료되었습니다. 아무 키나 누르면 닫힙니다.'
