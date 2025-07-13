@echo off
chcp 65001 > nul

echo ================================================
echo    DEMARRAGE DUERP - PORT 5000 UNIFIE
echo ================================================
echo.

REM Vérifier Node.js
echo [1/4] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe
    echo Telechargez-le depuis: https://nodejs.org/
    pause
    exit /b 1
)
echo OK - Node.js detecte

REM Créer/vérifier le fichier .env
echo [2/4] Configuration...
if not exist ".env" (
    echo Creation du fichier .env...
    echo DATABASE_URL=postgresql://duerp_user:1234@localhost:5000/duerp_db > .env
    echo OPENAI_API_KEY=sk-votre-cle-ici >> .env
    echo NODE_ENV=development >> .env
)
echo OK - Configuration prete

REM Installer les dépendances
echo [3/4] Dependances...
if not exist "node_modules" (
    echo Installation...
    npm install
    if %errorlevel% neq 0 (
        echo ERREUR: Echec installation
        pause
        exit /b 1
    )
)
echo OK - Dependances installees

REM Démarrer l'application
echo [4/4] Demarrage...
echo.
echo ================================================
echo         APPLICATION SUR PORT 5000
echo ================================================
echo.
echo Configuration unifiee:
echo - Application web: http://localhost:5000
echo - Base de donnees: PostgreSQL port 5000
echo.
echo L'application sera accessible sur:
echo   http://localhost:5000
echo   http://127.0.0.1:5000
echo.
echo Pour arreter: Ctrl+C
echo.

REM Utiliser le port 5000 par défaut (pas de variable PORT)
npm run dev