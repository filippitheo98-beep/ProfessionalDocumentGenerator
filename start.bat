@echo off
title Générateur DUERP - Démarrage
echo.
echo ================================================
echo    DEMARRAGE GENERATEUR DUERP
echo ================================================
echo.

REM Vérifier Node.js
echo [1/5] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERREUR: Node.js n'est pas installe
    echo Veuillez d'abord executer scripts\install.bat
    echo.
    pause
    exit /b 1
)
echo OK - Node.js: 
node --version
echo.

REM Vérifier si .env existe
echo [2/5] Verification de la configuration...
if not exist ".env" (
    echo.
    echo ERREUR: Fichier .env manquant
    echo Veuillez d'abord executer scripts\install.bat
    echo.
    pause
    exit /b 1
)
echo OK - Configuration trouvee
echo.

REM Vérifier si les dépendances sont installées
echo [3/5] Verification des dependances...
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERREUR: Echec de l'installation des dependances
        echo.
        pause
        exit /b 1
    )
)
echo OK - Dependances installees
echo.

REM Initialiser la base de données
echo [4/5] Initialisation de la base de donnees...
npm run db:push
if %errorlevel% neq 0 (
    echo.
    echo ERREUR: Echec de l'initialisation de la base de donnees
    echo Verifiez votre DATABASE_URL dans le fichier .env
    echo.
    echo Exemple DATABASE_URL:
    echo postgresql://user:password@localhost:5000/duerp_db
    echo.
    pause
    exit /b 1
)
echo OK - Base de donnees initialisee
echo.

REM Démarrer l'application
echo [5/5] Demarrage de l'application...
echo.
echo ================================================
echo    APPLICATION DEMARREE !
echo ================================================
echo.
echo Ouvrez votre navigateur et allez a: http://localhost:3001
echo.
echo Pour arreter l'application, appuyez sur Ctrl+C
echo.
npm run dev