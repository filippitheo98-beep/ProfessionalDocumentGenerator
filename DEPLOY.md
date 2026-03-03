# Déploiement Railway

Ce document décrit la configuration nécessaire pour déployer l'application sur [Railway](https://railway.app).

## Variables d'environnement

| Variable        | Requis | Description                                   |
|-----------------|--------|-----------------------------------------------|
| `DATABASE_URL`  | Oui    | URL de connexion PostgreSQL (Railway provisionne automatiquement si vous ajoutez un service Postgres) |
| `SESSION_SECRET`| Non    | Secret pour les sessions (si auth Replit activée) |

## Configuration du port (Target Port)

**Important** : Railway injecte la variable `PORT` au démarrage (souvent 8080). Vous devez configurer le **Target Port** dans les paramètres du service pour qu'il corresponde.

1. Ouvrez votre service dans le dashboard Railway
2. Allez dans **Settings** → **Public Networking**
3. Modifiez le domaine et assurez-vous que le **Target Port** est identique à la valeur de `PORT` (typiquement **8080**)
4. Si le Target Port est configuré sur 5000 alors que l'app écoute sur 8080, vous obtiendrez des erreurs 502

## Migrations base de données

Les migrations ne sont pas exécutées automatiquement au démarrage. Pour pousser le schéma :

```bash
railway run npx drizzle-kit push
```

Exécutez cette commande après avoir provisionné la base et configuré `DATABASE_URL`.

## Build Docker

L'application utilise un Dockerfile multi-stage. Railway détecte le Dockerfile et build automatiquement. Le build :

1. Installe les dépendances et exécute `npm run build`
2. Copie uniquement `dist/` et `package.json` dans l'image finale
3. Démarre avec `node dist/index.js`

## Health check

L'endpoint `/health` vérifie la connexion à la base de données. Il retourne :
- **200** si l'app et la DB sont opérationnelles
- **503** si la base est injoignable
