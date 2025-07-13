# DUERP Generator - Version Simplifiée

## 🚀 Démarrage Ultra-Rapide

**Pas de base de données à configurer !**

1. **Téléchargez Node.js** : https://nodejs.org/
2. **Double-cliquez** sur `start-simple.bat`
3. **Ouvrez** : http://localhost:5000

C'est tout !

## ✅ Avantages Version Simplifiée

- **Aucune configuration** : Pas de PostgreSQL, pas de .env complexe
- **Démarrage instantané** : Prêt en 30 secondes
- **Zéro maintenance** : Pas de base de données à gérer
- **Portable** : Copiez le dossier, ça marche partout

## ⚠️ Limitations

- **Données temporaires** : Perdues quand vous fermez l'application
- **Un utilisateur** : Pas de système multi-utilisateurs
- **Pas de persistance** : Idéal pour tests et démonstrations

## 📋 Fonctionnalités Incluses

✅ **Toutes les fonctionnalités DUERP** :
- Création d'entreprise
- Gestion des lieux et postes
- Génération de risques (avec ou sans IA)
- Tableaux de risques
- Export PDF et Excel
- Analyse de photos
- Graphiques et statistiques

✅ **IA OpenAI** (optionnel) :
- Ajoutez votre clé dans `.env` si vous voulez l'analyse IA
- Sinon, utilise des modèles prédéfinis

## 🔧 Configuration IA (Optionnel)

Si vous voulez l'analyse IA des risques :

1. Créez un fichier `.env`
2. Ajoutez : `OPENAI_API_KEY=sk-votre-cle-ici`
3. Redémarrez l'application

## 🆚 Comparaison des Versions

| Fonctionnalité | Version Simple | Version Complète |
|---|---|---|
| Installation | 1 clic | Configuration DB |
| Démarrage | 30 secondes | 5 minutes |
| Persistance | ❌ | ✅ |
| Multi-utilisateurs | ❌ | ✅ |
| Fonctionnalités DUERP | ✅ | ✅ |
| Export PDF/Excel | ✅ | ✅ |
| IA OpenAI | ✅ | ✅ |

## 📞 Support

- **Problème** : Vérifiez que Node.js est installé
- **Port occupé** : Fermez les autres applications sur le port 5000
- **Erreur** : Relancez `start-simple.bat`

---

**Parfait pour** : Tests, démonstrations, usage personnel occasionnel
**Utilisez la version complète pour** : Production, équipes, données persistantes