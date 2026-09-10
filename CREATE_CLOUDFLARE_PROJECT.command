#!/bin/zsh
set -e
cd "$(dirname "$0")"
npm install
npm run cf:login
npm run cf:create
read -n 1 -s -r '?Cloudflare Pages 프로젝트 생성 완료. 아무 키나 누르면 닫힙니다.'
