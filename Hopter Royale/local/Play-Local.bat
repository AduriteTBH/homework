@echo off
title Hopter Royale - Local Server
cd /d "%~dp0.."
echo.
echo  Hopter Royale local server
echo  ========================
echo  Starting server at http://localhost:8080
echo  Multiplayer will work in the browser — friends on your network can join too.
echo  Press Ctrl+C to stop.
echo.
start "" "http://localhost:8080/index.html"
python -m http.server 8080 2>nul || py -m http.server 8080
pause
