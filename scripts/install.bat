@echo off
echo 🚀 Installation du Générateur DUERP...

REM Vérifier Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js détecté
node --version

REM Installer les dépendances
echo 📦 Installation des dépendances...
npm install

REM Vérifier si .env existe
if not exist ".env" (
    echo ⚠️  Fichier .env manquant. Copie du fichier exemple...
    copy .env.example .env
    echo 🔧 Veuillez éditer le fichier .env avec vos paramètres de base de données
)

echo.
echo 🎉 Installation terminée !
echo.
echo Prochaines étapes :
echo 1. Configurez votre base de données dans le fichier .env
echo 2. Ajoutez votre clé API OpenAI dans .env (optionnel)
echo 3. Lancez 'npm run db:push' pour initialiser la base de données
echo 4. Lancez 'npm run dev' pour démarrer l'application
echo.
echo L'application sera accessible à l'adresse : http://localhost:5000
pause