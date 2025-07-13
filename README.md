# DUERP Generator

Application web pour créer des documents d'évaluation des risques professionnels.

## Installation

1. Installez Node.js : https://nodejs.org/
2. Double-cliquez sur `START.bat`
3. Ouvrez : http://localhost:5000 (version complète) ou http://localhost:5000/simple (version simplifiée)

## Fonctionnalités

- Création d'entreprise et gestion des lieux
- Génération automatique de risques
- Export PDF et Excel
- Analyse de photos (optionnel avec IA)

## Configuration IA (optionnel)

Créez un fichier `.env` avec :
```
OPENAI_API_KEY=sk-votre-cle-ici
```

## Note

Les données sont stockées en mémoire (perdues au redémarrage).