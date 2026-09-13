@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Guild Dashboard v2.4.0 update
echo ========================================

if not exist ".git" (
  echo This folder is not connected to GitHub.
  echo Run this file inside the existing chungju-guild-dashboard repository.
  pause
  exit /b 1
)

git add .
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "feat: add raid efficiency and manual guild war scores"
  if errorlevel 1 goto :failed
) else (
  echo No new local changes to commit.
)

echo Updating from GitHub...
git pull --rebase -X theirs origin main
if errorlevel 1 goto :failed

git push origin main
if errorlevel 1 goto :failed

echo.
echo RESULT: GITHUB_UPDATE_OK
echo Cloudflare Pages will deploy automatically.
pause
exit /b 0

:failed
echo.
echo RESULT: GITHUB_UPDATE_FAILED
echo Copy the error shown above and send it here.
pause
exit /b 1
