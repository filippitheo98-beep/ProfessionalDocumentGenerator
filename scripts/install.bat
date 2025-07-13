@echo off
title Installation Générateur DUERP
echo.
echo ================================================
echo    INSTALLATION GENERATEUR DUERP
echo ================================================
echo.

REM Vérifier Node.js
echo [1/4] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERREUR: Node.js n'est pas installe ou pas dans le PATH
    echo.
    echo Veuillez installer Node.js depuis: https://nodejs.org/
    echo Choisissez la version LTS (Long Term Support)
    echo.
    echo Apres installation, redemarrez cette fenetre.
    echo.
    pause
    exit /b 1
)

echo OK - Node.js detecte:
node --version
echo.

REM Installer les dépendances
echo [2/4] Installation des dependances...
npm install
if %errorlevel% neq 0 (
    echo.
    echo ERREUR: Echec de l'installation des dependances
    echo Verifiez votre connexion internet et reessayez
    echo.
    pause
    exit /b 1
)
echo OK - Dependances installees
echo.

REM Vérifier si .env existe
echo [3/4] Configuration de l'environnement...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo OK - Fichier .env cree depuis .env.example
    ) else (
        echo # Configuration Generateur DUERP > .env
        echo DATABASE_URL=postgresql://user:password@localhost:5432/duerp_db >> .env
        echo OPENAI_API_KEY=sk-votre-cle-ici >> .env
        echo PORT=5000 >> .env
        echo OK - Fichier .env cree avec configuration par defaut
    )
    echo.
    echo IMPORTANT: Vous devez configurer votre base de donnees dans le fichier .env
    echo Le fichier .env a ete ouvert pour modification...
    notepad .env
) else (
    echo OK - Fichier .env existe deja
)
echo.

echo [4/4] Finalisation...
echo.
echo ================================================
echo    INSTALLATION TERMINEE AVEC SUCCES !
echo ================================================
echo.
echo Prochaines etapes:
echo 1. Configurez votre DATABASE_URL dans le fichier .env
echo 2. Ajoutez votre OPENAI_API_KEY si vous voulez l'analyse IA
echo 3. Double-cliquez sur start.bat pour lancer l'application
echo.
echo L'application sera accessible a: http://localhost:5000
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul