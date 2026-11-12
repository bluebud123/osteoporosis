@echo off
setlocal
title PeriLoop Console
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org then run this again.
  pause
  exit /b 1
)

rem The AI key is kept in a local file that git ignores. It is never uploaded.
set "KEYFILE=%~dp0deepseek-key.txt"
set "NEWKEY="
if not exist "%KEYFILE%" (
  echo No AI key saved yet.
  set /p "NEWKEY=Paste your DeepSeek API key and press Enter (or just press Enter to run without AI): "
)
if defined NEWKEY >"%KEYFILE%" echo %NEWKEY%
if exist "%KEYFILE%" set /p PROVIDER_KEY=<"%KEYFILE%"

if defined PROVIDER_KEY (
  set "PROVIDER_BASE_URL=https://api.deepseek.com"
  set "PROVIDER_MODEL=deepseek-chat"
)
if not defined PORT set "PORT=8090"

echo.
echo Starting PeriLoop on http://localhost:%PORT%
echo Close this window or press Ctrl+C to stop it.
echo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
node app\server.js

echo.
echo PeriLoop has stopped. If you saw "EADDRINUSE", another copy is already running.
pause
