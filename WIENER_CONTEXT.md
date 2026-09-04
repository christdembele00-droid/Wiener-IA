# Wiener IA — couche de contexte gouvernée

Wiener IA 2.5 ajoute une couche de contexte inspirée des principes de WrenAI, sans remplacer le moteur conversationnel existant.

## Architecture

- `context-layer.js` : stockage, indexation lexicale légère, recherche, validation et construction du contexte.
- `context-preload.js` : intégration transparente avec le serveur Express existant.
- `wiener-context.json` : créé automatiquement au premier ajout de contexte.

Le démarrage charge la couche avec `node -r ./context-preload.js server.js`.

## API

### État

`GET /api/context/status`

Retourne les compteurs et les erreurs/avertissements de validation.

### Recherche

`POST /api/context/search`

```json
{"query":"revenu client", "limit":8}
```

### Ajout

`POST /api/context/ingest`

```json
{
  "type":"metrics",
  "item":{
    "name":"revenu_net",
    "definition":"Revenu après remises et retours"
  }
}
```

Types disponibles : `models`, `metrics`, `relationships`, `instructions`, `examples`, `facts`.

## Intégration IA

Pour `/api/chat`, `/api/exercises`, `/api/analyze` et `/api/consciousness`, les éléments sémantiquement pertinents sont récupérés avant l'exécution du handler existant. Le contexte est explicitement présenté comme une source interne à considérer, et non comme une nouvelle instruction utilisateur.

## Principes

1. Ne jamais inventer une définition absente du contexte.
2. Séparer connaissance interne, entrée utilisateur et réponse du modèle.
3. Valider les métriques, modèles et relations avant de les considérer comme gouvernés.
4. Garder le contexte versionnable et inspectable.
5. Conserver l'interface actuelle de Wiener IA inchangée.

Cette implémentation reprend les idées de couche sémantique/contexte de WrenAI, mais reste une implémentation native et légère de Wiener IA.
