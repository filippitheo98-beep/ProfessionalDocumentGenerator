# Import des données Replit

Placez ici les fichiers CSV exportés de Replit (même noms que les tables) :

- `companies.csv`
- `duerp_documents.csv`
- `risk_library.csv`
- `risk_families.csv`
- `sectors.csv`
- `users.csv`, `actions.csv`, `comments.csv`, etc.

Puis exécutez en local (avec `DATABASE_URL` dans `.env` ou en variable) :

```bash
npm run db:import-csv
```

Ou en pointant un autre dossier :

```bash
npm run db:import-csv ./mes-csv
```

Si après un import vous avez des erreurs « duplicate key » à la création (ex. nouvelle société), resynchronisez les séquences :

```bash
npm run db:fix-sequence
```

### Bibliothèque de risques

Les risques ajoutés depuis l’application (générateur ou page Bibliothèque) sont enregistrés en base et **restent après redémarrage** : la base s’agrandit au fil du temps.

- **Si vous avez** `risk_library.csv` et que le reste de la base est déjà rempli (sociétés, etc.), importez **uniquement** la bibliothèque pour éviter les conflits d’id :

```bash
npm run db:import-csv -- risk_library --replace
npm run db:fix-sequence
```

Avec `--replace`, la table est vidée avant import (utile si vous avez des doublons). **Les risques ajoutés à la main depuis l’application seront supprimés** ; n’utilisez `--replace` que pour repartir du CSV. Sans `--replace`, les risques créés depuis l’app restent en base et persistent après redémarrage.

- **Import complet** (base vide) : placez tous les CSV dans `data/`, puis `npm run db:import-csv` (puis `npm run db:fix-sequence`).
- **Sans CSV** : exécutez une fois le seed pour réinstaller un jeu de base (familles, secteurs, ~15 risques type INRS) :

```bash
npm run db:seed-risk-library
```
