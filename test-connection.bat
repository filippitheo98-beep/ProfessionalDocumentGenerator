@echo off
chcp 65001 > nul

echo ================================================
echo    TEST DE CONNEXION GENERATEUR DUERP
echo ================================================
echo.

echo [1/4] Test de Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERREUR: Node.js non installe
    pause
    exit /b 1
)
echo OK - Node.js fonctionne

echo.
echo [2/4] Test de la base de donnees PostgreSQL...
node -e "
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: 'postgresql://duerp_user:1234@localhost:5000/duerp_db' });
pool.query('SELECT version()').then(res => {
    console.log('✓ PostgreSQL version:', res.rows[0].version);
    return pool.query('SELECT current_database(), current_user');
}).then(res => {
    console.log('✓ Base de donnees:', res.rows[0].current_database);
    console.log('✓ Utilisateur:', res.rows[0].current_user);
    process.exit(0);
}).catch(err => {
    console.log('✗ Erreur:', err.message);
    console.log('✗ Code erreur:', err.code);
    process.exit(1);
});
"
if %errorlevel% neq 0 (
    echo.
    echo DIAGNOSTIC:
    echo - Verifiez que PostgreSQL est demarre
    echo - Verifiez que l'utilisateur duerp_user existe
    echo - Verifiez que la base duerp_db existe
    echo - Verifiez que PostgreSQL ecoute sur le port 5000
    echo.
    pause
    exit /b 1
)
echo OK - Base de donnees accessible

echo.
echo [3/4] Test du port 3001...
node -e "
const net = require('net');
const server = net.createServer();
server.listen(3001, 'localhost', () => {
    console.log('✓ Port 3001 disponible');
    server.close();
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('✗ Port 3001 deja utilise');
        process.exit(1);
    } else {
        console.log('✗ Erreur:', err.message);
        process.exit(1);
    }
});
"
if %errorlevel% neq 0 (
    echo.
    echo SOLUTION: Un autre processus utilise le port 3001
    echo Fermez les autres applications ou redemarrez votre PC
    echo.
    pause
    exit /b 1
)
echo OK - Port 3001 libre

echo.
echo [4/4] Test des dependances...
if not exist "node_modules" (
    echo Installation des dependances...
    npm install
    if %errorlevel% neq 0 (
        echo ERREUR: Echec de l'installation
        pause
        exit /b 1
    )
)
echo OK - Dependances installees

echo.
echo ================================================
echo           DIAGNOSTIC COMPLET
echo ================================================
echo ✓ Node.js: Fonctionne
echo ✓ PostgreSQL: Accessible
echo ✓ Port 3001: Libre
echo ✓ Dependances: Installees
echo.
echo Tout est pret ! Lancez start-local.bat
echo.
pause