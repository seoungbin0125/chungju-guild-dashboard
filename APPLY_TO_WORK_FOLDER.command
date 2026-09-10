#!/bin/bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="/Users/bin/Desktop/work/chungju-guild-dashboard"

if [ "$SOURCE_DIR" = "$TARGET_DIR" ]; then
  echo "이미 작업 폴더에서 실행 중입니다."
  exit 0
fi

mkdir -p "$TARGET_DIR"
rsync -av --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "적용 완료: $TARGET_DIR"
echo "버전: v2.1.0"
