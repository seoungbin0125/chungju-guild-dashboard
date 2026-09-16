@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Guild Dashboard v2.5.2 update
echo ========================================

if not exist "%CD%\.git\HEAD" (
  echo This folder is not connected to GitHub.
  echo Run this file inside the existing chungju-guild-dashboard repository.
  pause
  exit /b 1
)

git remote set-url origin https://seoungbin0125@github.com/seoungbin0125/chungju-guild-dashboard.git
git config --local credential.username seoungbin0125

echo Updating from GitHub before making the update commit...
git pull --rebase --autostash origin main
if errorlevel 1 goto :failed

git add .
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "fix: ignore carried-over MGF raid scores after weekly reset"
  if errorlevel 1 goto :failed
) else (
  echo No new local changes to commit.
)

git push origin main
if not errorlevel 1 goto :success

echo Remote changed while pushing. Syncing once and retrying...
git pull --rebase --autostash origin main
if errorlevel 1 goto :failed
git push origin main
if errorlevel 1 goto :failed

:success
echo.
echo RESULT: GITHUB_UPDATE_OK
echo Cloudflare Pages will deploy automatically.
pause
exit /b 0

:failed
echo.
echo RESULT: GITHUB_UPDATE_FAILED
echo Run git status. If the message contains 403, run FIX_GITHUB_LOGIN.bat.
echo If rebase shows a conflict, do not push again until the conflict is resolved.
pause
exit /b 1
