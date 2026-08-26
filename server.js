```javascript
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* =========================
   PAGE PRINCIPALE
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Wiener IA",
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

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Aucun message reçu."
      });
    }

    const model =
      req.body.model === "gpt-4o"
        ? "gpt-4o"
        : "gpt-4o-mini";

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

    const response =
      await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "Tu es Wiener IA, un assistant intelligent. Réponds en français par défaut. Sois clair, précis, pédagogique et utile. Pour les exercices scolaires, explique les étapes du raisonnement. Pour le code, donne des solutions directement utilisables. Ne fabrique pas de faits ou de sources."
          },
          ...cleanMessages
        ],
        temperature: 0.7
      });

    const answer =
      response.choices &&
      response.choices[0] &&
      response.choices[0].message &&
      response.choices[0].message.content;

    if (!answer) {
      return res.status(500).json({
        error: "Wiener IA n'a retourné aucune réponse."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: model
    });

  } catch (error) {
    console.error("WIENER IA ERROR:", error);

    if (error && error.status === 401) {
      return res.status(401).json({
        error: "La clé OpenAI est invalide ou incorrecte."
      });
    }

    if (error && error.status === 429) {
      return res.status(429).json({
        error: "La limite d'utilisation de l'API a été atteinte."
      });
    }

    if (error && error.status === 400) {
      return res.status(400).json({
        error: error.message || "Requête invalide."
      });
    }

    return res.status(500).json({
      error: "Une erreur est survenue avec Wiener IA."
    });
  }
});

/* =========================
   ROUTES API INEXISTANTES
========================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

/* =========================
   DÉMARRAGE
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("Wiener IA démarré.");
  console.log("Port:", PORT);
  console.log(
    "OPENAI_API_KEY:",
    process.env.OPENAI_API_KEY
      ? "CONFIGURÉE"
      : "ABSENTE"
  );
});
```
