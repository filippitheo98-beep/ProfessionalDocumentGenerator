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

### Bibliothèque de risques (0 risque après vidage de la base)

- **Si vous avez** les CSV Replit : placez `risk_library.csv`, `risk_families.csv` et `sectors.csv` dans `data/`, puis `npm run db:import-csv` (puis `npm run db:fix-sequence`).
- **Sans CSV** : exécutez une fois le seed pour réinstaller un jeu de base (familles, secteurs, ~15 risques type INRS) :

```bash
npm run db:seed-risk-library
```
