#!/bin/zsh
set -e
cd "$(dirname "$0")"
npm install
npm run cf:deploy
read -n 1 -s -r '?Cloudflare Pages 배포 완료. 아무 키나 누르면 닫힙니다.'
