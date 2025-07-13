# 🚀 Comment accéder à l'application DUERP

## 📍 Selon votre environnement

### 🌐 **Environnement Replit (actuel)**
L'application est accessible directement via l'interface Replit :
- **Port** : 5000 (par défaut)
- **URL** : Utilisez l'aperçu intégré de Replit ou le lien fourni par l'interface

### 💻 **Déploiement local (sur votre PC)**

#### Configuration requise :
1. **Base de données** : PostgreSQL sur port 5000
2. **Application** : Port 3001 (pour éviter les conflits)

#### Étapes :
1. **Éditez le fichier `.env`** :
   ```env
   DATABASE_URL=postgresql://duerp_user:1234@localhost:5000/duerp_db
   OPENAI_API_KEY=sk-votre-cle-ici
   PORT=3001
   ```

2. **Lancez l'application** :
   ```bash
   # Via script Windows
   double-clic sur start.bat
   
   # Ou via terminal
   npm run dev
   ```

3. **Accédez à l'application** :
   - **URL** : http://localhost:3001

## 🔧 Diagnostic des problèmes

### Si "Ce site est inaccessible" :
1. Vérifiez que PostgreSQL fonctionne sur le port 5000
2. Vérifiez que l'application utilise un port différent (3001)
3. Essayez d'accéder à http://localhost:3001 au lieu de localhost:5000

### Si erreur de base de données :
1. Vérifiez les identifiants dans le fichier `.env`
2. Assurez-vous que l'utilisateur `duerp_user` existe avec le mot de passe `1234`
3. Vérifiez que la base de données `duerp_db` existe

## 📞 Support
Si vous rencontrez des problèmes, vérifiez d'abord que :
- PostgreSQL est démarré et accessible
- Le fichier `.env` contient les bonnes informations
- Vous utilisez le bon port selon votre environnement