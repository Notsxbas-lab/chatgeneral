@echo off
REM Script para Windows (cmd) — instala dependencias y arranca el servidor en una nueva ventana
cd /d "%~dp0"
echo Instalando dependencias (npm)...
npm.cmd install
if errorlevel 1 (
  echo Error durante "npm install". Comprueba la salida arriba.
  pause
  exit /b 1
)
echo Iniciando el servidor en una nueva ventana...
start "Chat Server" cmd /k "npm.cmd start"
