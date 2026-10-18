@echo off
cd /d "%~dp0"
start "Control Tarifario - servidor" /min node server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/"
exit /b 0
