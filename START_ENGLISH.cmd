@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13.0 or later is required.
  echo Download it from https://nodejs.org/
  pause
  exit /b 1
)

rem Double-click starts silently. Use START_ENGLISH_DEBUG.cmd to see logs.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\start-background.ps1"
exit /b %errorlevel%
