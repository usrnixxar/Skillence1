@echo off
title Skillence Academy Local Server
echo Starting Skillence Academy Local Server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
