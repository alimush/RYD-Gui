@echo off

REM ===============================
REM Start RYD-GUI using PM2
REM ===============================

cd /d “C:\Users\Administrator\Desktop\JS App\RYD-Gui\RYD-Gui”

set PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm;%PATH%

pm2 start ecosystem.config.js
pm2 save

pause