@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js 或 npm。
  echo 请先安装 Node.js 22.12 或更高版本，然后重新双击 start.cmd。
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo 首次运行，正在安装依赖，请稍候……
  call npm ci
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 正在启动排图者 diagramer……
echo 浏览器地址：http://127.0.0.1:4173/
call npm run local

if errorlevel 1 (
  echo [错误] 启动失败。若 4173 端口已被占用，请先关闭旧的排图者窗口或进程。
  pause
)

endlocal
