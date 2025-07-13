#!/bin/bash

echo "🚀 Installation du Générateur DUERP..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $REQUIRED_VERSION ou supérieure requise. Version actuelle: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION détectée"

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env manquant. Copie du fichier exemple..."
    cp .env.example .env
    echo "🔧 Veuillez éditer le fichier .env avec vos paramètres de base de données"
fi

# Vérifier PostgreSQL
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL détecté"
else
    echo "⚠️  PostgreSQL non détecté. Vous pouvez :"
    echo "   1. Installer PostgreSQL localement"
    echo "   2. Utiliser Docker avec 'docker-compose up -d db'"
    echo "   3. Utiliser un service cloud (Neon, Supabase, etc.)"
fi

echo ""
echo "🎉 Installation terminée !"
echo ""
echo "Prochaines étapes :"
echo "1. Configurez votre base de données dans le fichier .env"
echo "2. Ajoutez votre clé API OpenAI dans .env (optionnel)"
echo "3. Lancez 'npm run db:push' pour initialiser la base de données"
echo "4. Lancez 'npm run dev' pour démarrer l'application"
echo ""
echo "L'application sera accessible à l'adresse : http://localhost:5000"