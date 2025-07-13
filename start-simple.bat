@echo off
chcp 65001 > nul

echo ================================================
echo       DEMARRAGE GENERATEUR DUERP
echo ================================================
echo.

REM Vérifier Node.js
echo [1/4] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe
    echo Telechargez-le depuis: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo OK - Node.js detecte

REM Vérifier le fichier .env
echo [2/4] Verification de la configuration...
if not exist ".env" (
    echo ERREUR: Fichier .env manquant
    echo Lancez d'abord scripts\install.bat
    echo.
    pause
    exit /b 1
)
echo OK - Configuration presente

REM Installer les dépendances si nécessaire
echo [3/4] Verification des dependances...
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
)
echo OK - Dependances pretes

REM Démarrer directement l'application
echo [4/4] Demarrage de l'application...
echo.
echo ================================================
echo    APPLICATION EN COURS DE DEMARRAGE...
echo ================================================
echo.
echo L'application va s'ouvrir sur: http://localhost:3001
echo.
echo IMPORTANT: La base de donnees sera initialisee automatiquement
echo au premier demarrage. Cela peut prendre quelques secondes.
echo.
echo Pour arreter l'application, appuyez sur Ctrl+C
echo.

set PORT=3001
npm run dev