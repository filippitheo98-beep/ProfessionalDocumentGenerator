# Générateur de DUERP - Installation et Démarrage

## Description
Application web professionnelle pour la génération de Documents Uniques d'Évaluation des Risques Professionnels (DUERP). L'application permet de créer des évaluations complètes des risques en milieu de travail avec analyse IA, génération de rapports PDF et système de suivi des révisions.

## Prérequis
- Node.js 18 ou supérieur
- PostgreSQL 12 ou supérieur
- npm ou yarn

## Installation

### 1. Télécharger et extraire le projet
```bash
# Téléchargez tous les fichiers du projet dans un dossier
# Exemple : duerp-generator/
```

### 2. Installer Node.js
Si vous n'avez pas Node.js installé :
- Rendez-vous sur https://nodejs.org/
- Téléchargez la version LTS (recommandée)
- Installez en suivant les instructions

### 3. Installer les dépendances
```bash
cd duerp-generator
npm install
```

### 4. Configuration de la base de données PostgreSQL

#### Option A : Installation locale de PostgreSQL
1. Téléchargez PostgreSQL depuis https://www.postgresql.org/download/
2. Installez avec les paramètres par défaut
3. Créez une base de données :
```sql
CREATE DATABASE duerp_db;
CREATE USER duerp_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE duerp_db TO duerp_user;
```

#### Option B : Utiliser un service cloud (Neon, Supabase, etc.)
1. Créez un compte sur https://neon.tech (gratuit)
2. Créez une nouvelle base de données
3. Copiez l'URL de connection fournie

### 5. Variables d'environnement
Créez un fichier `.env` à la racine du projet :
```env
# Base de données
DATABASE_URL=postgresql://duerp_user:votre_mot_de_passe@localhost:5432/duerp_db

# OU pour un service cloud (exemple Neon) :
# DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Clé API OpenAI (pour l'analyse IA des risques)
OPENAI_API_KEY=votre_cle_openai_ici

# Port (optionnel, par défaut 5000)
PORT=5000
```

### 6. Initialiser la base de données
```bash
npm run db:push
```

## Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm run build
npm start
```

L'application sera accessible à l'adresse : `http://localhost:5000`

## Fonctionnalités principales

### 1. Création de documents DUERP
- Informations d'entreprise complètes
- Gestion des lieux et postes de travail
- Génération automatique de risques par IA

### 2. Analyse des risques
- Upload et analyse de photos
- Suggestions intelligentes de mesures de prévention
- Tableaux de risques consolidés

### 3. Exports et rapports
- Export PDF professionnel avec graphiques
- Export Excel des données
- Historique des versions

### 4. Système de révisions
- Suivi automatique des dates de révision
- Notifications 30 jours avant échéance
- Cycle de révision annuel légal

## Structure du projet

```
duerp-generator/
├── client/               # Frontend React
│   ├── src/
│   │   ├── components/   # Composants réutilisables
│   │   ├── pages/        # Pages principales
│   │   └── lib/          # Utilitaires
├── server/               # Backend Express
│   ├── db.ts            # Configuration base de données
│   ├── routes.ts        # Routes API
│   ├── storage.ts       # Couche d'accès aux données
│   └── exportUtils.ts   # Génération PDF/Excel
├── shared/               # Types partagés
│   └── schema.ts        # Schémas de données
├── package.json
└── README.md
```

## Scripts disponibles

```bash
# Développement
npm run dev              # Démarre le serveur de développement

# Base de données
npm run db:push          # Synchronise le schéma avec la base
npm run db:studio        # Interface graphique base de données

# Production
npm run build            # Compile l'application
npm start                # Lance en production
```

## Dépannage

### Problème : "Database connection failed"
- Vérifiez que PostgreSQL est démarré
- Vérifiez l'URL de connection dans `.env`
- Testez la connection avec un client SQL

### Problème : "Port already in use"
- Changez le port dans `.env` : `PORT=3000`
- Ou arrêtez l'application qui utilise le port 5000

### Problème : "OpenAI API key invalid"
- Vérifiez votre clé API sur https://platform.openai.com/
- Assurez-vous d'avoir du crédit disponible
- L'application fonctionne sans IA mais avec des données prédéfinies

### Problème : "npm install" échoue
- Supprimez `node_modules` et `package-lock.json`
- Réexécutez `npm install`
- Vérifiez votre version de Node.js

## Obtenir une clé API OpenAI

1. Rendez-vous sur https://platform.openai.com/
2. Créez un compte ou connectez-vous
3. Allez dans "API Keys"
4. Créez une nouvelle clé secrète
5. Copiez-la dans votre fichier `.env`

Note : Un crédit gratuit est généralement fourni pour les nouveaux comptes.

## Support

Pour toute question ou problème :
1. Vérifiez que toutes les dépendances sont installées
2. Consultez les logs dans la console
3. Assurez-vous que la base de données est accessible
4. Vérifiez les variables d'environnement

## Sécurité

- Ne partagez jamais votre fichier `.env`
- Utilisez des mots de passe forts pour la base de données
- Gardez vos clés API secrètes
- Mettez à jour régulièrement les dépendances

## Licence

Ce projet est destiné à un usage professionnel pour la génération de documents DUERP conformes à la réglementation française.