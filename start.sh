#!/bin/bash

echo "🚀 Démarrage du Générateur DUERP..."

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env manquant. Copie du fichier exemple..."
    cp .env.example .env
    echo "🔧 Veuillez éditer le fichier .env avec vos paramètres avant de continuer"
    echo "Appuyez sur Entrée pour continuer une fois le fichier .env configuré..."
    read
fi

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Initialiser la base de données
echo "🗄️  Initialisation de la base de données..."
npm run db:push

# Démarrer l'application
echo "🎉 Démarrage de l'application..."
echo "L'application sera accessible à l'adresse : http://localhost:5000"
echo "Appuyez sur Ctrl+C pour arrêter l'application"
npm run dev