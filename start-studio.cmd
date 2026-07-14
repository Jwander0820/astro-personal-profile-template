@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [Profile Studio] Node.js was not found.
  echo Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\astro\astro.js" (
  echo [Profile Studio] Dependencies are missing. Running npm install...
  call npm.cmd install
  if errorlevel 1 (
    echo [Profile Studio] npm install failed. Check the network and error output above.
    pause
    exit /b 1
  )
)

echo [Profile Studio] Starting local editor...
node.exe scripts\studio-server.mjs
set "studio_exit=%errorlevel%"

if not "%studio_exit%"=="0" (
  echo [Profile Studio] The editor stopped with exit code %studio_exit%.
  pause
)

exit /b %studio_exit%
