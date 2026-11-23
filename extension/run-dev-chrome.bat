@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

rem Use this .bat file's own folder (= extension folder, where manifest.json lives)
set "EXT_DIR=%~dp0"
if "!EXT_DIR:~-1!"=="\" set "EXT_DIR=!EXT_DIR:~0,-1!"

rem Keep a dedicated test profile so this never touches your normal Chrome profile
set "PROFILE_DIR=%~dp0.chrome-profile"

rem Copy env vars into plain variables BEFORE using them in any if/set line.
rem On some systems the ProgramFiles variable itself resolves to a path
rem ending in (x86), for example when running as a 32-bit process under
rem WOW64. cmd.exe's parser can misread that parenthesis as a command-block
rem delimiter even inside quotes, causing a "was unexpected at this time"
rem error. Delayed expansion (enabled above) defers substitution until after
rem the line has already been parsed, so a literal parenthesis in the value
rem can no longer confuse the parser.
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"
set "LAD=%LocalAppData%"

set "CHROME_EXE="
if exist "!PF!\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=!PF!\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "!PF86!\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=!PF86!\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "!LAD!\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=!LAD!\Google\Chrome\Application\chrome.exe"

echo ============================================================
echo  YouTube Window - dev Chrome launcher
echo ============================================================
echo.

if not defined CHROME_EXE (
    echo [ERROR] Could not find chrome.exe automatically.
    echo Checked these paths:
    echo   !PF!\Google\Chrome\Application\chrome.exe
    echo   !PF86!\Google\Chrome\Application\chrome.exe
    echo   !LAD!\Google\Chrome\Application\chrome.exe
    echo.
    echo Open this .bat file in a text editor and set CHROME_EXE manually
    echo to your real chrome.exe path near the top, then run it again.
    goto :end
)

echo Chrome found  : !CHROME_EXE!
echo Extension dir : !EXT_DIR!
echo Test profile  : !PROFILE_DIR!
echo   (separate from your normal Chrome profile - NOT being logged in
echo    to YouTube there is expected and fine for Phase 1 testing)
echo.
echo After editing the extension code: close the Chrome window this opens,
echo then run this file again to pick up the latest code.
echo.
echo A chrome://extensions tab will open automatically - check there that
echo "YouTube Shorts Organizer" is listed with no red error banner.
echo.

start "" "!CHROME_EXE!" --user-data-dir="!PROFILE_DIR!" --load-extension="!EXT_DIR!" --no-first-run --no-default-browser-check "chrome://extensions/" "https://www.youtube.com/"

echo Launch command sent.
echo If no Chrome window appeared, or something looks wrong, keep this
echo window open and copy everything shown here.

:end
echo.
echo ------------------------------------------------------------
echo Press any key to close this window.
echo ------------------------------------------------------------
pause >nul
endlocal
