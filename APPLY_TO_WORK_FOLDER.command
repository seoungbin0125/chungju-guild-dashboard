#!/bin/bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -d "$SOURCE_DIR/.git" ]]; then
  echo "이미 GitHub에 연결된 충주시 프로젝트 폴더입니다."
  echo "이 창을 닫고 PUSH_UPDATE_TO_GITHUB.command를 실행해주세요."
  read -r -p "Enter를 누르면 종료합니다."
  exit 0
fi

TARGET_DIR=""
for candidate in \
  "$HOME/Desktop/chungju-guild-dashboard" \
  "$HOME/Desktop/work/chungju-guild-dashboard" \
  "$HOME/Downloads/chungju-guild-dashboard"; do
  if [[ -d "$candidate/.git" ]]; then
    TARGET_DIR="$candidate"
    break
  fi
done

if [[ -z "$TARGET_DIR" ]]; then
  echo "기존 chungju-guild-dashboard 폴더를 이 창으로 끌어다 놓고 Enter를 누르세요."
  read -r -p "기존 프로젝트 폴더: " TARGET_DIR
  TARGET_DIR="${TARGET_DIR%/}"
fi

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  echo "GitHub에 연결된 기존 프로젝트 폴더가 아닙니다: $TARGET_DIR"
  read -r -p "Enter를 누르면 종료합니다."
  exit 1
fi

if [ "$SOURCE_DIR" = "$TARGET_DIR" ]; then
  echo "이미 작업 폴더에서 실행 중입니다."
  exit 0
fi

mkdir -p "$TARGET_DIR"
rsync -av \
  --exclude ".git" \
  --exclude "node_modules" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "적용 완료: $TARGET_DIR"
echo "버전: v2.5.2"
