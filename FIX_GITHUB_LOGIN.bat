@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Dashboard - GitHub login
echo =================================

if not exist ".git" (
  echo Run this file inside C:\work\meki\chungju-guild-dashboard.
  pause
  exit /b 1
)

git remote set-url origin https://seoungbin0125@github.com/seoungbin0125/chungju-guild-dashboard.git
git config --local credential.username seoungbin0125

git credential-manager github login --username seoungbin0125 --force
if errorlevel 1 goto :manual

echo.
echo Login complete. Pushing the saved commits...
git push origin main
if errorlevel 1 goto :failed

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
pause
exit /b 1
