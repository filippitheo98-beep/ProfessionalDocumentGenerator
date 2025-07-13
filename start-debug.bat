@echo off
title Générateur DUERP - Mode Debug
echo.
echo ================================================
echo    GENERATEUR DUERP - MODE DEBUG
echo ================================================
echo.

echo Informations systeme:
echo - Repertoire actuel: %CD%
echo - Utilisateur: %USERNAME%
echo - Version Windows: 
ver
echo.

echo Verification des fichiers...
if exist "package.json" (
    echo OK - package.json trouve
) else (
    echo ERREUR - package.json manquant
    echo Etes-vous dans le bon repertoire ?
)

if exist ".env" (
    echo OK - .env trouve
) else (
    echo ATTENTION - .env manquant
)

if exist "node_modules" (
    echo OK - node_modules trouve
) else (
    echo ATTENTION - node_modules manquant
)

if exist "scripts\install.bat" (
    echo OK - scripts d'installation trouves
) else (
    echo ATTENTION - scripts manquants
)

echo.
echo Verification Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERREUR - Node.js non installe ou non accessible
) else (
    echo OK - Node.js fonctionne
)

echo.
echo Verification npm...
npm --version
if %errorlevel% neq 0 (
    echo ERREUR - npm non accessible
) else (
    echo OK - npm fonctionne
)

echo.
echo Contenu du repertoire:
dir /b

echo.
echo ================================================
echo    DIAGNOSTIC TERMINE
echo ================================================
echo.
echo Si tout semble correct, essayez:
echo 1. scripts\install.bat
echo 2. start.bat
echo.
echo Sinon, verifiez:
echo - Que vous etes dans le bon repertoire
echo - Que Node.js est bien installe
echo - Que tous les fichiers sont presents
echo.
pause