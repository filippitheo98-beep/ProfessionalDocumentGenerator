@echo off
chcp 65001 > nul

echo ================================================
echo    DUERP GENERATOR - VERSION SIMPLIFIEE
echo ================================================
echo.

REM Vérifier Node.js
echo [1/3] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe
    echo Telechargez-le depuis: https://nodejs.org/
    pause
    exit /b 1
)
echo OK - Node.js detecte

REM Installer les dépendances
echo [2/3] Installation des dependances...
if not exist "node_modules" (
    echo Installation en cours...
    npm install
    if %errorlevel% neq 0 (
        echo ERREUR: Echec installation
        pause
        exit /b 1
    )
)
echo OK - Dependances installees

REM Créer/vérifier le fichier .env (optionnel)
echo [3/3] Configuration...
if not exist ".env" (
    echo # Configuration optionnelle > .env
    echo # OPENAI_API_KEY=sk-votre-cle-ici >> .env
    echo OK - Fichier .env cree (optionnel)
) else (
    echo OK - Fichier .env existe
)

echo.
echo ================================================
echo    APPLICATION DEMARREE !
echo ================================================
echo.
echo ✅ VERSION SIMPLIFIEE ACTIVEE
echo ✅ Pas de base de données requise
echo ✅ Stockage en mémoire uniquement
echo ✅ Données perdues au redémarrage
echo.
echo L'application est accessible sur: http://localhost:5000
echo.
echo Pour arreter: Ctrl+C
echo.

npm run dev