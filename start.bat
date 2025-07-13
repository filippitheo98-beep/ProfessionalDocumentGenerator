@echo off
echo 🚀 Démarrage du Générateur DUERP...

REM Vérifier si .env existe
if not exist ".env" (
    echo ⚠️  Fichier .env manquant. Copie du fichier exemple...
    copy .env.example .env
    echo 🔧 Veuillez éditer le fichier .env avec vos paramètres avant de continuer
    echo Appuyez sur Entrée pour continuer une fois le fichier .env configuré...
    pause
)

REM Vérifier si les dépendances sont installées
if not exist "node_modules" (
    echo 📦 Installation des dépendances...
    npm install
)

REM Initialiser la base de données
echo 🗄️  Initialisation de la base de données...
npm run db:push

REM Démarrer l'application
echo 🎉 Démarrage de l'application...
echo L'application sera accessible à l'adresse : http://localhost:5000
echo Appuyez sur Ctrl+C pour arrêter l'application
npm run dev