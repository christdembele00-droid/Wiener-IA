```javascript
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test du serveur
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    openai_key: !!process.env.OPENAI_API_KEY
  });
});

// Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY n'est pas configurée."
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Aucun message reçu."
      });
    }

    const cleanMessages = messages
      .filter(m =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
      )
      .slice(-30);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            `Tu es Wiener IA, un assistant intelligent.
Réponds en français par défaut.
Sois clair, précis, pédagogique et utile.
Tu peux utiliser Markdown pour structurer tes réponses.
Si tu ne connais pas une information, indique-le honnêtement.
Ne prétends pas avoir accès à Internet, aux fichiers ou aux appareils de l'utilisateur si ce n'est pas réellement disponible.`
        },
        ...cleanMessages
      ],
      temperature: 0.7
    });

    const answer = response.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(500).json({
        error: "Aucune réponse reçue de l'IA."
      });
    }

    res.json({
      answer
    });

  } catch (error) {
    console.error("ERREUR OPENAI :", error);

    res.status(500).json({
      error: error?.message || "Erreur inconnue avec OpenAI."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wiener IA démarré sur le port ${PORT}`);
});
```

