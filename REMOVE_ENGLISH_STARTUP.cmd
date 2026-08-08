@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-startup.ps1" -Action remove
echo.
echo Daily English startup has been removed.
pause
