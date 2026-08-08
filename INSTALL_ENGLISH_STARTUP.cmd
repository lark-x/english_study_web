@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-startup.ps1" -Action install
echo.
echo Daily English will start automatically when you sign in to Windows.
pause
