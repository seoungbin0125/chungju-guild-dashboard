@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Chungju Plaza - Firebase rules
echo ===============================
echo Run this only if Plaza chat shows a permission error.
echo A Google login window may open.
echo.

npx --yes firebase-tools@latest deploy --only firestore:rules --project meki-guild1
if errorlevel 1 goto :failed

echo.
echo RESULT: FIREBASE_RULES_OK
echo Plaza positions and chat logs can now be shared.
pause
exit /b 0

:failed
echo.
echo RESULT: FIREBASE_RULES_FAILED
echo Sign in with the Google account that owns the meki-guild1 Firebase project.
pause
exit /b 1
