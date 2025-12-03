@echo off
REM Script para Windows para levantar con Docker Compose
cd /d "%~dp0"
echo Levantando con Docker Compose (requerido Docker Desktop)...
docker compose up --build
