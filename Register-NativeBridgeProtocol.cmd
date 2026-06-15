@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-relay\Register-NativeBridgeProtocol.ps1"
pause
