@echo off
title newtab server
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
    echo Starting server at http://localhost:8080
    echo Press Ctrl+C to stop
    python -m http.server 8080
) else (
    where python3 >nul 2>&1
    if %errorlevel%==0 (
        echo Starting server at http://localhost:8080
        echo Press Ctrl+C to stop
        python3 -m http.server 8080
    ) else (
        echo Python not found. Install Python from https://python.org
        pause
    )
)
