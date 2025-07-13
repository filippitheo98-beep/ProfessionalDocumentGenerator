# Démarrage Rapide - Générateur DUERP

## Installation Express (3 minutes)

### 1. Prérequis
- Node.js 18+ : https://nodejs.org/
- Base de données PostgreSQL (locale ou cloud)

### 2. Installation automatique

#### Windows :
```bash
# Double-cliquez sur install.bat
scripts\install.bat
```

#### Mac/Linux :
```bash
chmod +x scripts/install.sh && ./scripts/install.sh
```

### 3. Configuration base de données

Éditez le fichier `.env` créé automatiquement :

```env
# Base de données (choisir une option)
DATABASE_URL=postgresql://user:password@localhost:5432/duerp_db

# Clé OpenAI (optionnel)
OPENAI_API_KEY=sk-votre-cle-ici
```

### 4. Démarrage

#### Windows :
```bash
start.bat
```

#### Mac/Linux :
```bash
./start.sh
```

## Accès à l'application

Une fois démarré, ouvrez : **http://localhost:5000**

## Solutions rapides pour la base de données

### Option 1 : Neon (Cloud - Gratuit)
1. Allez sur https://neon.tech
2. Créez un compte gratuit
3. Créez une base de données
4. Copiez l'URL de connexion dans `.env`

### Option 2 : Docker (Local)
```bash
docker-compose up -d db
```

### Option 3 : PostgreSQL local
```bash
# Installez PostgreSQL puis :
createdb duerp_db
# Utilisez : postgresql://username:password@localhost:5432/duerp_db
```

## Dépannage Express

### Erreur "Port already in use"
Changez le port dans `.env` :
```env
PORT=3000
```

### Erreur base de données
Vérifiez votre `DATABASE_URL` dans `.env`

### Erreur Node.js
Installez Node.js 18+ depuis https://nodejs.org/

## Fonctionnalités

✅ Création de documents DUERP complets
✅ Analyse IA des photos (avec OpenAI)
✅ Export PDF professionnel
✅ Système de révisions automatique
✅ Interface moderne avec thème sombre
✅ Validation des noms de documents

Pour une documentation complète, consultez `README.md`