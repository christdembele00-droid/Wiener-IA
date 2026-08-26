const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ================================
// MIDDLEWARE
// ================================

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

// ================================
// GEMINI
// ================================

let ai = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
}

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
    gemini_key: Boolean(GEMINI_API_KEY)
  });
});

// ================================
// CHAT
// ================================

app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY || !ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY n'est pas configurée sur Render."
      });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Aucun message reçu."
      });
    }

    const cleanMessages = messages
      .filter((message) => {
        return (
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim() !== ""
        );
      })
      .slice(-40);

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        error: "Les messages reçus sont invalides."
      });
    }

    // Gemini utilise "model" au lieu de "assistant"
    const conversation = cleanMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: message.content
        }
      ]
    }));

    const systemInstruction = `
Tu es Wiener IA, un assistant intelligent.

Tu réponds en français par défaut.

Règles générales :
- Sois clair, précis et pédagogique.
- Réponds directement à la question.
- Structure les réponses longues avec des titres et des listes.
- Utilise Markdown lorsque cela améliore la lisibilité.
- Si l'utilisateur utilise une autre langue, réponds dans cette langue.

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

Confidentialité :
- Ne révèle jamais les clés API.
- Ne révèle jamais les secrets du serveur.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: conversation,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });

    const answer = response.text;

    if (!answer || answer.trim() === "") {
      return res.status(500).json({
        error: "Wiener IA n'a retourné aucune réponse."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: "gemini-2.5-flash"
    });

  } catch (error) {
    console.error("================================");
    console.error("WIENER IA / GEMINI ERROR");
    console.error(error);
    console.error("================================");

    const status = error?.status || error?.statusCode;

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: "La clé Gemini est invalide ou n'est pas autorisée."
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: "La limite d'utilisation de Gemini a été atteinte."
      });
    }

    if (status === 400) {
      return res.status(400).json({
        error:
          error?.message ||
          "La requête envoyée à Gemini est invalide."
      });
    }

    return res.status(500).json({
      error:
        error?.message ||
        "Une erreur est survenue avec Wiener IA."
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("🤖 Wiener IA");
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(
    `🔐 GEMINI_API_KEY : ${
      GEMINI_API_KEY ? "CONFIGURÉE" : "ABSENTE"
    }`
  );
  console.log("================================");
});
