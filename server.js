const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    openai_key: Boolean(process.env.OPENAI_API_KEY)
  });
});

/* =========================
   CHAT
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY n'est pas configurée sur Render."
      });
    }

    const { messages, model } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Aucun message reçu."
      });
    }

    const allowedModels = [
      "gpt-4o-mini",
      "gpt-4o"
    ];

    const selectedModel =
      allowedModels.includes(model)
        ? model
        : "gpt-4o-mini";

    const cleanMessages = messages
      .filter(message =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .slice(-40);

    const systemMessage = {
      role: "system",
      content: `
Tu es Wiener IA, un assistant intelligent moderne.

Règles :
- Réponds en français par défaut.
- Si l'utilisateur écrit dans une autre langue, réponds dans cette langue si c'est approprié.
- Sois précis, clair et pédagogique.
- Structure les longues réponses avec Markdown.
- Utilise des listes et des titres lorsque cela améliore la compréhension.
- Pour le code, utilise des blocs Markdown.
- Ne prétends jamais avoir accès à Internet, à un fichier, à une caméra, à un microphone ou à un appareil si cette capacité n'est pas réellement disponible.
- Si une information est incertaine, indique-le clairement.
- Ne fabrique pas de sources ou de faits.
- Pour les exercices scolaires, explique le raisonnement étape par étape.
- Pour les questions de programmation, donne des solutions directement utilisables.
      `.trim()
    };

    const response =
      await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          systemMessage,
          ...cleanMessages
        ],
        temperature: 0.7
      });

    const answer =
      response.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(500).json({
        error: "Wiener IA n'a retourné aucune réponse."
      });
    }

    res.json({
      answer,
      model: selectedModel
    });

  } catch (error) {

    console.error("OPENAI ERROR:", error);

    let message =
      "Une erreur est survenue avec Wiener IA.";

    if (error?.status === 401) {
      message =
        "La clé OpenAI est invalide ou incorrecte.";
    }

    if (error?.status === 429) {
      message =
        "La limite d'utilisation de l'API a été atteinte.";
    }

    if (error?.status === 400) {
      message =
        error?.message || "Requête invalide.";
    }

    res.status(500).json({
      error: message
    });
  }
});

/* =========================
   404 API
========================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

/* =========================
   START
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Wiener IA démarré sur le port ${PORT}`
  );
});
