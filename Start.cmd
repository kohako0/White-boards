@echo off
cd /d "%~dp0"
node launch.js
if errorlevel 1 pause
