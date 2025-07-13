# Guide d'Installation Rapide - Générateur DUERP

## Installation Automatique (Recommandée)

### Sur Windows
1. Double-cliquez sur `scripts/install.bat`
2. Suivez les instructions à l'écran
3. Éditez le fichier `.env` qui sera créé
4. Double-cliquez sur `start.bat` pour démarrer

### Sur Mac/Linux
1. Ouvrez un terminal dans le dossier du projet
2. Exécutez : `chmod +x scripts/install.sh && ./scripts/install.sh`
3. Éditez le fichier `.env` qui sera créé
4. Exécutez : `chmod +x start.sh && ./start.sh` pour démarrer

## Installation Manuelle

### 1. Prérequis
- Node.js 18+ (https://nodejs.org/)
- PostgreSQL ou un compte sur service cloud (Neon, Supabase, etc.)

### 2. Configuration
```bash
# 1. Installer les dépendances
npm install

# 2. Copier le fichier de configuration
cp .env.example .env

# 3. Éditer .env avec vos paramètres de base de données
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# OPENAI_API_KEY=sk-...

# 4. Initialiser la base de données
npm run db:push

# 5. Démarrer l'application
npm run dev
```

## Configuration Base de Données

### Option 1 : PostgreSQL Local
```bash
# Créer la base de données
createdb duerp_db

# Dans .env
DATABASE_URL=postgresql://username:password@localhost:5432/duerp_db
```

### Option 2 : Neon (Cloud - Gratuit)
1. Créez un compte sur https://neon.tech
2. Créez une base de données
3. Copiez l'URL de connexion dans `.env`

### Option 3 : Docker
```bash
# Démarrer PostgreSQL avec Docker
docker-compose up -d db

# Dans .env
DATABASE_URL=postgresql://duerp_user:duerp_password@localhost:5432/duerp_db
```

## Démarrage Rapide

Une fois configuré, démarrez avec :
- Windows : `start.bat`
- Mac/Linux : `./start.sh`

L'application sera accessible à : http://localhost:5000

## Dépannage

### Erreur "Port already in use"
Changez le port dans `.env` : `PORT=3000`

### Erreur de connexion base de données
Vérifiez l'URL dans `.env` et que PostgreSQL est démarré

### Erreur Node.js
Assurez-vous d'avoir Node.js 18+ installé