# Générateur DUERP - Version Locale

## Description

Application web professionnelle pour générer des Documents Uniques d'Évaluation des Risques Professionnels (DUERP). Version simplifiée pour usage local personnel sans authentification.

## Fonctionnalités

- **Accès direct** : Aucune connexion requise, utilisation immédiate
- **Génération DUERP complète** : Processus en 4 étapes intuitives
- **Analyse IA des photos** : Détection automatique des risques (avec OpenAI)
- **Export professionnel** : PDF avec graphiques et Excel
- **Système de révisions** : Notifications automatiques annuelles
- **Interface moderne** : Design responsive avec thème sombre/clair
- **Sauvegarde manuelle** : Contrôle total sur la persistence des données

## Installation Express (3 minutes)

### Prérequis
- Node.js 18+ : https://nodejs.org/
- Base de données PostgreSQL

### Installation Automatique

#### Windows
```bash
# Double-cliquer ou exécuter :
scripts\install.bat

# Puis démarrer :
start.bat
```

#### Mac/Linux
```bash
chmod +x scripts/install.sh && ./scripts/install.sh
./start.sh
```

### Configuration Rapide

Le fichier `.env` est créé automatiquement. Éditez-le selon vos besoins :

```env
# Base de données (obligatoire)
DATABASE_URL=postgresql://user:password@localhost:5000/duerp_db

# IA (optionnel)
OPENAI_API_KEY=sk-votre-cle-ici

# Port (optionnel)
PORT=3000
```

## Solutions Base de Données

### Option 1 : Neon (Cloud - Gratuit)
1. Compte sur https://neon.tech
2. Créer une base de données
3. Copier l'URL dans `.env`

### Option 2 : Docker (Rapide)
```bash
docker-compose up -d db
# Utiliser : postgresql://postgres:password@localhost:5432/duerp_db
```

### Option 3 : PostgreSQL Local
```bash
createdb duerp_db
# Utiliser : postgresql://username:password@localhost:5432/duerp_db
```

## Utilisation

L'application s'ouvre automatiquement à : **http://localhost:3000**

### Workflow Simple
1. **Informations entreprise** : Nom, secteur, employés
2. **Lieux et postes** : Ajouter les zones de travail
3. **Photos** : Télécharger pour analyse IA (optionnel)
4. **Génération** : Création automatique des risques
5. **Export** : PDF complet avec graphiques

### Gestion des Documents
- Consulter tous les documents
- Archiver/restaurer
- Suivre les révisions obligatoires
- Exporter en PDF/Excel

## Fonctionnalités Avancées

### Analyse IA
Avec une clé OpenAI, l'application peut :
- Analyser les photos de lieux de travail
- Détecter automatiquement les risques
- Suggérer des mesures de prévention

### Système de Révisions
- Calcul automatique des dates de révision
- Notifications 30 jours avant échéance
- Suivi de conformité réglementaire

### Export Professionnel
- PDF avec graphiques intégrés
- Tableaux de risques formatés
- Statistiques et analyses
- Export Excel pour traitement

## Architecture Technique

### Frontend
- React 18 + TypeScript
- Tailwind CSS + Shadcn/UI
- Vite pour le build
- React Query pour les données

### Backend
- Node.js + Express
- PostgreSQL + Drizzle ORM
- API REST sécurisée
- Hot-reload en développement

## Dépannage Express

### Erreurs Communes
```bash
# Port occupé
PORT=3000 npm run dev

# Erreur base de données
# Vérifier DATABASE_URL dans .env

# Erreur OpenAI
# Vérifier OPENAI_API_KEY dans .env
```

### Maintenance
```bash
# Mise à jour base de données
npm run db:push

# Redémarrage complet
npm run dev
```

## Sécurité et Confidentialité

- **Usage local uniquement** : Données sur votre machine
- **Pas d'authentification** : Accès direct simplifié
- **Pas de collecte de données** : Confidentialité totale
- **Base de données locale** : Contrôle complet

## Support

- **Documentation** : README.md + QUICK_START.md
- **Logs** : Consultez la console pour les erreurs
- **Scripts** : Utilisez les scripts d'installation automatique

---

**Version** : 2.0.0 - Usage local sans authentification  
**Générateur DUERP** - Solution complète pour l'évaluation des risques professionnels