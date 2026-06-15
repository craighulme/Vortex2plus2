@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-relay\Start-NativeBridge.ps1" %*
pause
