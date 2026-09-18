# Wiener-IA — industrialisation

## Services réellement intégrables

- PostgreSQL: DATABASE_URL
- Modèle: WIENER_MODEL_API_URL, WIENER_MODEL_API_KEY, WIENER_MODEL_NAME
- Firebase: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON
- Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- Frontend: NEXT_PUBLIC_WIENER_API_URL
- CORS: WIENER_ALLOWED_ORIGINS

Aucune clé ou credential n'est stocké dans Git.

## Cycle de production

Utilisateur → perception → mémoire PostgreSQL → raisonnement → planification → sélection → Model Router → modèle → action → réflexion → apprentissage → évolution → héritage.

## Validation

GitHub Actions exécute:
1. installation des dépendances Python;
2. compilation backend/cognitive/database/services;
3. tests pytest;
4. tests de contrat API et cycle cognitif.

Les tests des services externes deviennent actifs lorsque les variables d'environnement correspondantes sont fournies par l'environnement de déploiement.

## Déploiement

Le backend peut être construit avec le Dockerfile racine. Le frontend Next.js est exporté statiquement pour GitHub Pages.

Le déploiement production reste dépendant d'un hébergeur backend et de ses credentials: GitHub Pages ne peut pas exécuter FastAPI.

## Sécurité

- aucune clé secrète dans le dépôt;
- authentification Firebase vérifiée côté backend lorsqu'un ID token est fourni;
- évolution limitée aux préférences de stratégie;
- fournisseur de modèle non exposé comme identité publique de Wiener-IA.
