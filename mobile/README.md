# Wiener IA Mobile

Application mobile officielle de Wiener IA basée sur Expo / React Native.

## Fonctionnalités

- Chat Wiener IA avec streaming
- Connexion au backend Render existant
- Historique local
- Recherche Web, exercices, génération d'images et analyse de fichiers présentés comme modules
- Navigation mobile Chat / Outils / Historique / Paramètres
- Préparation Android et iOS

## Lancer en développement

```bash
cd mobile
npm install
npx expo start
```

Installe Expo Go sur le téléphone puis scanne le QR code affiché par Expo.

## Générer un APK Android

Installer EAS CLI :

```bash
npm install -g eas-cli
```

Puis :

```bash
cd mobile
eas login
eas build:configure
eas build -p android --profile preview
```

Pour une publication Play Store, utiliser ensuite un profil de production avec un identifiant Android définitif.

## Backend

L'application utilise actuellement :

`https://wiener-ia.onrender.com`

Le chat utilise `/api/chat` et son streaming SSE. Les modules supplémentaires pourront être branchés directement sur les endpoints existants (`/api/search`, `/api/exercises`, `/api/image`, `/api/analyze-file`).
