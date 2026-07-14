@echo off
title Servidor Local CandleSign
echo ===================================================
echo   Iniciando servidor local para CandleSign...
echo   Esto eludira las restricciones CORS del navegador.
echo ===================================================
echo.
echo Abriendo la aplicacion en tu navegador...
start "" "http://localhost:8000"
echo.
echo Servidor ejecutandose en http://localhost:8000 (Presiona Ctrl+C para cerrarlo)
python -m http.server 8000
