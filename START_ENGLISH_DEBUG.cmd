@echo off
setlocal
cd /d "%~dp0"
title Daily English - Local Study Site (Debug)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13.0 or later is required.
  pause
  exit /b 1
)
node.exe scripts\launch.mjs %*
pause
