# Infrastructure Wiener-IA

## Règle de déploiement

**Render n'est pas utilisé.**

### Frontend
Le frontend Next.js statique peut rester déployé sur GitHub Pages.

### Backend
Le backend FastAPI est conteneurisé dans le `Dockerfile` et est prévu pour **Google Cloud Run**.

### Services

- **Firebase Authentication** : identité et authentification.
- **Firebase Cloud Messaging** : notifications.
- **Cloudinary** : stockage des médias.
- **PostgreSQL** : mémoire persistante.
- **Google Cloud Run** : hébergement du backend FastAPI.
- **Cloudflare** : DNS, HTTPS et protection edge si nécessaire.
- **GitHub Actions** : CI/CD.

Aucun secret n'est stocké dans le dépôt.

## Variables backend

- `DATABASE_URL`
- `WIENER_MODEL_API_URL`
- `WIENER_MODEL_API_KEY`
- `WIENER_MODEL_NAME`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `WIENER_ALLOWED_ORIGINS`

## Variable frontend

- `WIENER_API_URL` : URL HTTPS publique du backend Cloud Run, utilisée par le workflow GitHub Pages comme `NEXT_PUBLIC_WIENER_API_URL`.

Sans URL backend publique, GitHub Pages ne peut pas exécuter FastAPI directement et l'interface indiquera explicitement que le backend n'est pas configuré.
