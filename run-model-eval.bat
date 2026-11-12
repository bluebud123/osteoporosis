@echo off
setlocal
title PeriLoop: real-model evaluation
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org then run this again.
  pause
  exit /b 1
)

rem Uses the same local key file as start-periloop.bat. Git ignores it.
set "KEYFILE=%~dp0deepseek-key.txt"
set "NEWKEY="
if not exist "%KEYFILE%" (
  set /p "NEWKEY=Paste your DeepSeek API key and press Enter: "
)
if defined NEWKEY >"%KEYFILE%" echo %NEWKEY%
if not exist "%KEYFILE%" (
  echo No key given, so there is nothing to measure.
  pause
  exit /b 1
)
set /p PROVIDER_KEY=<"%KEYFILE%"
set "PROVIDER_BASE_URL=https://api.deepseek.com"
set "PROVIDER_MODEL=deepseek-chat"

echo.
echo This sends the synthetic test messages through the Console with the real model.
echo   1 = quick check   (about 85 messages, 1 to 3 minutes)
echo   2 = full run      (913 messages, about 5 minutes)
echo   3 = full run + AI check scored by itself on every message (about 10 to 20 minutes; best evidence)
echo.
choice /c 123 /n /m "Type 1, 2 or 3: "
if errorlevel 3 (
  node app\eval\run_model_eval.js --ai-alone
) else if errorlevel 2 (
  node app\eval\run_model_eval.js
) else (
  node app\eval\run_model_eval.js --limit 5
)
echo.
echo Finished. The result file is in app\eval\ and starts with model_run_
pause
