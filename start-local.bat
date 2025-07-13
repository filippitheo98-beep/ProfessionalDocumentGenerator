@echo off
chcp 65001 > nul

echo ================================================
echo     DEMARRAGE LOCAL GENERATEUR DUERP
echo ================================================
echo.

REM Vérifier Node.js
echo [1/5] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe
    echo Telechargez-le depuis: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK - Node.js detecte: %NODE_VERSION%

REM Vérifier le fichier .env
echo [2/5] Verification de la configuration...
if not exist ".env" (
    echo Creation du fichier .env...
    echo DATABASE_URL=postgresql://duerp_user:1234@localhost:5000/duerp_db > .env
    echo OPENAI_API_KEY=sk-votre-cle-ici >> .env
    echo PORT=3001 >> .env
    echo NODE_ENV=development >> .env
)
echo OK - Configuration presente

REM Installer les dépendances
echo [3/5] Installation des dependances...
if not exist "node_modules" (
    echo Installation en cours...
    npm install
    if %errorlevel% neq 0 (
        echo ERREUR: Echec de l'installation
        pause
        exit /b 1
    )
)
echo OK - Dependances installees

REM Vérifier la connexion à la base de données
echo [4/5] Verification de la base de donnees...
echo Test de connexion PostgreSQL...
node -e "
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: 'postgresql://duerp_user:1234@localhost:5000/duerp_db' });
pool.query('SELECT 1').then(() => {
    console.log('✓ Base de données accessible');
    process.exit(0);
}).catch(err => {
    console.log('✗ Erreur de connexion:', err.message);
    process.exit(1);
});
"
if %errorlevel% neq 0 (
    echo.
    echo ERREUR: Impossible de se connecter a la base de donnees
    echo Verifiez que:
    echo 1. PostgreSQL est demarre
    echo 2. L'utilisateur duerp_user existe avec le mot de passe 1234
    echo 3. La base de donnees duerp_db existe
    echo 4. PostgreSQL ecoute sur le port 5000
    echo.
    pause
    exit /b 1
)
echo OK - Base de donnees accessible

REM Démarrer l'application
echo [5/5] Demarrage de l'application...
echo.
echo ================================================
echo       APPLICATION EN COURS DE DEMARRAGE
echo ================================================
echo.
echo Configuration:
echo - Port application: 3001
echo - Base de donnees: PostgreSQL port 5000
echo - Environnement: Local
echo.
echo L'application sera accessible sur:
echo   http://localhost:3001
echo   http://127.0.0.1:3001
echo.
echo IMPORTANT: Laissez cette fenetre ouverte
echo Pour arreter: Ctrl+C
echo.

REM Définir les variables d'environnement
set PORT=3001
set NODE_ENV=development
set DATABASE_URL=postgresql://duerp_user:1234@localhost:5000/duerp_db

REM Démarrer avec timeout pour éviter les blocages
timeout /t 2 /nobreak > nul
npm run dev