@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 해부 데일리를 여는 중... (이 창을 닫으면 앱도 꺼져요)
start "" http://127.0.0.1:5180
py -3 -m http.server 5180 --bind 127.0.0.1
