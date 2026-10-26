@echo off
rem Abre o Shinichi no navegador. De dois cliques neste arquivo (nao no index.html).
rem O jogo precisa de um servidor local (Vite); este atalho instala o que falta e o inicia.
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado. Baixe a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Instalando as dependencias do jogo (so na primeira vez, pode levar alguns minutos)...
  call npm install
  if errorlevel 1 (
    echo  A instalacao falhou. Verifique a internet e tente de novo.
    pause
    exit /b 1
  )
)

echo.
echo  Iniciando o Shinichi... o navegador vai abrir sozinho.
echo  Para fechar o jogo, feche esta janela (ou aperte Ctrl+C).
echo.
call npm run dev -- --open
