const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");

const app = express();

// Render fournit automatiquement PORT
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Fichiers du site
app.use(express.static(__dirname));

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================================
// PAGE PRINCIPALE
// ================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================================
// HEALTH CHECK
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Wiener IA",
    openai_key: Boolean(process.env.OPENAI_API_KEY)
  });
});

// ================================
// CHAT
// ================================

app.post("/api/chat", async (req, res) => {
  try {
    // Vérification de la clé
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY n'est pas configurée sur Render."
      });
    }

    const { messages } = req.body;

    // Vérification des messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Aucun message reçu."
      });
    }

    // Nettoyage des messages
    const cleanMessages = messages
      .filter((message) => {
        return (
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
        );
      })
      .slice(-40);

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        error: "Les messages reçus sont invalides."
      });
    }

    // ================================
    // INSTRUCTIONS DE WIENER IA
    // ================================

    const systemMessage = {
      role: "system",
      content: `
Tu es Wiener IA, un assistant intelligent.

Tu réponds en français par défaut.

Règles générales :
- Sois clair, précis et pédagogique.
- Réponds directement à la question.
- Structure les réponses longues avec des titres et des listes.
- Utilise Markdown lorsque cela améliore la lisibilité.
- Si l'utilisateur utilise une autre langue, réponds dans cette langue si nécessaire.

Éducation :
- Pour les exercices scolaires, explique le raisonnement étape par étape.
- Pour les mathématiques, montre les calculs.
- Pour la physique et la chimie, indique les formules et les étapes.
- Pour la biologie, explique clairement les mécanismes.

Programmation :
- Donne du code directement utilisable.
- Utilise des blocs de code Markdown.
- N'affirme jamais avoir exécuté un code si tu ne l'as pas réellement exécuté.

Fiabilité :
- Ne fabrique pas de faits.
- Ne fabrique pas de sources.
- Si une information est incertaine, indique-le clairement.
- Ne prétends pas avoir accès à Internet, à une caméra, à un microphone ou à des fichiers si ces capacités ne sont pas réellement disponibles.

Confidentialité :
- Ne révèle jamais les clés API ou les secrets du serveur.
- Ne demande pas inutilement de données personnelles.
      `.trim()
    };

    // ================================
    // APPEL OPENAI
    // ================================

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        systemMessage,
        ...cleanMessages
      ],
      temperature: 0.7
    });

    // Récupération de la réponse
    const answer =
      response?.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(500).json({
        error: "Wiener IA n'a retourné aucune réponse."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: "gpt-4o-mini"
    });

  } catch (error) {
    console.error("================================");
    console.error("WIENER IA / OPENAI ERROR");
    console.error(error);
    console.error("================================");

    // Clé invalide
    if (error?.status === 401) {
      return res.status(401).json({
        error: "La clé OpenAI est invalide ou incorrecte."
      });
    }

    // Limite API
    if (error?.status === 429) {
      return res.status(429).json({
        error: "La limite d'utilisation de l'API a été atteinte."
      });
    }

    // Requête invalide
    if (error?.status === 400) {
      return res.status(400).json({
        error:
          error?.message ||
          "La requête envoyée à OpenAI est invalide."
      });
    }

    // Autorisation
    if (error?.status === 403) {
      return res.status(403).json({
        error:
          "La requête n'est pas autorisée par l'API OpenAI."
      });
    }

    return res.status(500).json({
      error: "Une erreur est survenue avec Wiener IA."
    });
  }
});

// ================================
// ROUTES API INEXISTANTES
// ================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

// ================================
// ERREURS JSON
// ================================

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    error.body
  ) {
    return res.status(400).json({
      error: "JSON invalide."
    });
  }

  next(error);
});

// ================================
// DÉMARRAGE
// ================================
