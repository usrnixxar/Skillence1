@echo off
title Push Skillence Academy to GitHub
echo ===================================================
echo   Pushing Skillence Academy to GitHub
echo   Repository: https://github.com/usrnixxar/Skillence1.git
echo ===================================================
echo.

set "PATH=C:\Users\hp\.gemini\antigravity-ide\tools\mingit\cmd;C:\Users\hp\.gemini\antigravity-ide\tools\mingit\mingw64\bin;%PATH%"

cd /d "%~dp0"

echo Current Git Status:
git status
echo.
echo Pushing branch 'main' to origin...
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ===================================================
    echo   SUCCESS! All project files pushed to GitHub.
    echo ===================================================
) else (
    echo ===================================================
    echo   Push failed. Please check your GitHub login or token.
    echo ===================================================
)

echo.
pause
