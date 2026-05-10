@echo off
chcp 65001 >nul
setlocal

echo === [1/5] Pulling latest from GitHub ===
git pull --rebase || goto :fail

echo.
echo === [2/5] Generating product + lot data from xlsx ===
python generate_data.py || goto :fail

echo.
echo === [3/5] Building images.js + details.js ===
python generate_assets.py || goto :fail

echo.
echo === [4/5] Optimizing image thumbnails ===
python optimize_images.py
REM optimize_images.py is non-fatal: skip if it errors

echo.
echo === [5/5] Committing and pushing ===
git add data assets *.html sitemap.xml robots.txt favicon.svg 2025-2026-named-top5
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No changes to commit. Done.
    goto :end
)
git commit -m "Updated %date%" || goto :fail
git push || goto :fail

echo.
echo === Done! Site updates in 1-2 minutes. ===
goto :end

:fail
echo.
echo *** UPDATE FAILED. See errors above. ***
exit /b 1

:end
pause
