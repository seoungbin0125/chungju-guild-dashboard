@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Dashboard - GitHub login
echo =================================

if not exist "%CD%\.git\HEAD" (
  echo Run this file inside C:\work\meki\chungju-guild-dashboard.
  pause
  exit /b 1
)

git remote set-url origin https://seoungbin0125@github.com/seoungbin0125/chungju-guild-dashboard.git
git config --local credential.username seoungbin0125

git credential-manager github login --username seoungbin0125 --force
if errorlevel 1 goto :manual

echo.
echo Login complete. Syncing GitHub before pushing...
git pull --rebase --autostash origin main
if errorlevel 1 goto :failed

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

:manual
echo.
echo Browser login could not be started automatically.
echo Open Windows Credential Manager and remove credentials containing github.com.
echo Then run: git push origin main
pause
exit /b 1

:failed
echo.
echo RESULT: GITHUB_UPDATE_FAILED
echo Make sure the browser was signed in as seoungbin0125, not tjsy-developer.
echo Run git status. Resolve any rebase conflict before pushing again.
pause
exit /b 1
