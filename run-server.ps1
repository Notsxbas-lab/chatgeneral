# Script para instalar dependencias y arrancar el servidor en Windows PowerShell
Set-Location -Path $PSScriptRoot

Write-Output "Instalando dependencias (npm)..."
npm install

Write-Output "Arrancando servidor..."
npm start
