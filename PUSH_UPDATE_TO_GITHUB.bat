@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Guild Dashboard v2.5.1 update
echo ========================================

if not exist ".git" (
  echo This folder is not connected to GitHub.
  echo Run this file inside the existing chungju-guild-dashboard repository.
  pause
  exit /b 1
)

git remote set-url origin https://seoungbin0125@github.com/seoungbin0125/chungju-guild-dashboard.git
git config --local credential.username seoungbin0125

git add .
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "fix: align raid week with Monday through Sunday"
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
echo If the message contains 403, run FIX_GITHUB_LOGIN.bat and sign in as seoungbin0125.
pause
exit /b 1
