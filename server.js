const express = require("express");
const cors = require("cors");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { GoogleGenAI, createPartFromUri } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TEXT_MODEL = "gemini-3.6-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

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
// MIDDLEWARE
// ================================

app.use(cors());

app.use(
  express.json({
    limit: "30mb"
  })
);

app.use(express.static(__dirname));

// ================================
// INSTRUCTIONS WIENER IA
// ================================

const WIENER_INSTRUCTIONS = `
Tu es Wiener IA, un assistant intelligent.

Tu réponds en français par défaut.

Règles générales :
- Sois clair, précis et pédagogique.
- Réponds directement à la question.
- Structure les réponses longues avec des titres et des listes.
- Utilise Markdown lorsque cela améliore la lisibilité.
- Si l'utilisateur utilise une autre langue, réponds dans cette langue.

Éducation :
- Explique les exercices étape par étape.
- En mathématiques, montre les calculs.
- En physique et chimie, indique les formules et les étapes.
- En biologie, explique clairement les mécanismes.
- Adapte les explications au niveau scolaire de l'utilisateur.

Programmation :
- Donne du code directement utilisable.
- Utilise des blocs de code Markdown.
- N'affirme jamais avoir exécuté un code si tu ne l'as pas réellement exécuté.

Fiabilité :
- Ne fabrique pas de faits.
- Ne fabrique pas de sources.
- Si une information est incertaine, indique-le clairement.

Confidentialité :
- Ne révèle jamais les clés API ou les secrets du serveur.
- Ne demande pas inutilement de données personnelles.
`.trim();

// ================================
// UTILITAIRES
// ================================

function requireGemini(res) {
  if (!GEMINI_API_KEY || !ai) {
    res.status(500).json({
      error: "GEMINI_API_KEY n'est pas configurée sur Render."
    });

    return false;
  }

  return true;
}

function getErrorStatus(error) {
  return error?.status || error?.statusCode || 500;
}

function sendGeminiError(res, error) {
  console.error("================================");
  console.error("WIENER IA / GEMINI ERROR");
  console.error(error);
  console.error("================================");

  const status = getErrorStatus(error);

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
      "Une erreur est survenue avec Gemini."
  });
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
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
}

function messagesToGemini(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [
      {
        text: message.content
      }
    ]
  }));
}

// ================================
// PAGE PRINCIPALE
// ================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================================
// CHAT
// ================================

app.post("/api/chat", async (req, res) => {
  try {
    if (!requireGemini(res)) return;

    const { messages } = req.body;

    const cleanMessagesList = cleanMessages(messages);

    if (cleanMessagesList.length === 0) {
      return res.status(400).json({
        error: "Les messages reçus sont invalides."
      });
    }

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: messagesToGemini(cleanMessagesList),
      config: {
        systemInstruction: WIENER_INSTRUCTIONS,
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    });

    const answer = response?.text;

    if (!answer || !answer.trim()) {
      return res.status(500).json({
        error: "Wiener IA n'a retourné aucune réponse."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: TEXT_MODEL
    });

  } catch (error) {
    return sendGeminiError(res, error);
  }
});

// ================================
// RÉSOLUTION D'EXERCICES
// ================================

app.post("/api/exercises", async (req, res) => {
  try {
    if (!requireGemini(res)) return;

    const { question, level, subject } = req.body;

    if (
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Aucun exercice reçu."
      });
    }

    const prompt = `
Résous cet exercice scolaire.

Matière : ${subject || "non précisée"}
Niveau : ${level || "non précisé"}

Consignes :
1. Identifie les données importantes.
2. Explique la méthode.
3. Montre les calculs étape par étape si nécessaire.
4. Donne le résultat final clairement.
5. Vérifie le résultat lorsque c'est possible.
6. Ne saute pas les étapes importantes.

Exercice :
${question.trim()}
`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: WIENER_INSTRUCTIONS,
        temperature: 0.3,
        maxOutputTokens: 4096
      }
    });

    const answer = response?.text;

    if (!answer || !answer.trim()) {
      return res.status(500).json({
        error: "Aucune solution n'a été générée."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: TEXT_MODEL
    });

  } catch (error) {
    return sendGeminiError(res, error);
  }
});

// ================================
// RECHERCHE INTERNET
// ================================

app.post("/api/search", async (req, res) => {
  try {
    if (!requireGemini(res)) return;

    const { query } = req.body;

    if (
      typeof query !== "string" ||
      query.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Aucune recherche reçue."
      });
    }

    const prompt = `
Recherche les informations les plus pertinentes sur Internet
pour répondre à la question suivante :

${query.trim()}

Consignes :
- Utilise les informations trouvées grâce à la recherche Google.
- Donne une réponse claire et structurée.
- Privilégie les informations récentes lorsque la question concerne l'actualité.
- Ne présente pas une information incertaine comme un fait certain.
- Lorsque des sources sont disponibles dans les métadonnées de recherche,
  indique les sources importantes à la fin.
`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: WIENER_INSTRUCTIONS,
        temperature: 0.4,
        maxOutputTokens: 4096,

        tools: [
          {
            googleSearch: {}
          }
        ]
      }
    });

    const answer = response?.text;

    if (!answer || !answer.trim()) {
      return res.status(500).json({
        error: "La recherche n'a retourné aucune réponse."
      });
    }

    const metadata =
      response?.candidates?.[0]?.groundingMetadata;

    const sources = [];

    if (metadata?.groundingChunks) {
      for (const chunk of metadata.groundingChunks) {
        if (chunk?.web?.uri) {
          sources.push({
            title: chunk.web.title || "Source",
            url: chunk.web.uri
          });
        }
      }
    }

    return res.json({
      answer: answer.trim(),
      sources,
      model: TEXT_MODEL
    });

  } catch (error) {
    return sendGeminiError(res, error);
  }
});

// ================================
// CALCULATRICE
// ================================

app.post("/api/calculate", async (req, res) => {
  try {
    const { expression } = req.body;

    if (
      typeof expression !== "string" ||
      expression.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Aucune expression reçue."
      });
    }

    let expr = expression
      .trim()
      .replace(/,/g, ".")
      .replace(/\s+/g, "");

    // Autorise uniquement les caractères nécessaires
    if (!/^[0-9+\-*/().%^]+$/.test(expr)) {
      return res.status(400).json({
        error:
          "Expression invalide. Utilise uniquement des nombres et les opérateurs +, -, *, /, %, ^."
      });
    }

    // Protection contre quelques constructions dangereuses
    if (
      expr.includes("..") ||
      expr.includes("++") ||
      expr.includes("--") ||
      expr.length > 200
    ) {
      return res.status(400).json({
        error: "Expression invalide."
      });
    }

    // Conversion de ^ en puissance JavaScript
    expr = expr.replace(/\^/g, "**");

    // Calcul avec une expression strictement filtrée
    const result = Function(
      `"use strict"; return (${expr})`
    )();

    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      return res.status(400).json({
        error: "Impossible de calculer cette expression."
      });
    }

    return res.json({
      expression,
      result
    });

  } catch (error) {
    return res.status(400).json({
      error: "Expression mathématique invalide."
    });
  }
});

// ================================
// GÉNÉRATION D'IMAGE
// ================================

app.post("/api/image", async (req, res) => {
  try {
    if (!requireGemini(res)) return;

    const { prompt } = req.body;

    if (
      typeof prompt !== "string" ||
      prompt.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Aucune description d'image reçue."
      });
    }

    const interaction = await ai.interactions.create({
      model: IMAGE_MODEL,
      input: prompt.trim(),
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
        image_size: "1K"
      }
    });

    const generatedImage = interaction?.output_image;

    if (!generatedImage?.data) {
      return res.status(500).json({
        error: "Gemini n'a généré aucune image."
      });
    }

    return res.json({
      image: `data:${generatedImage.mime_type || "image/png"};base64,${generatedImage.data}`,
      text: interaction?.output_text || "",
      model: IMAGE_MODEL
    });

  } catch (error) {
    return sendGeminiError(res, error);
  }
});

// ================================
// ANALYSE PDF / IMAGE
// ================================

app.post("/api/analyze-file", async (req, res) => {
  let temporaryFile = null;

  try {
    if (!requireGemini(res)) return;

    const {
      file,
      mimeType,
      prompt
    } = req.body;

    if (
      typeof file !== "string" ||
      file.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Aucun fichier reçu."
      });
    }

    if (
      typeof mimeType !== "string" ||
      mimeType.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Le type du fichier est manquant."
      });
    }

    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        error:
          "Type de fichier non pris en charge. Utilise PDF, PNG, JPEG ou WEBP."
      });
    }

    // Accepte :
    // data:application/pdf;base64,XXXXX
    // ou directement XXXXX
    let base64Data = file;

    if (file.startsWith("data:")) {
      const commaIndex = file.indexOf(",");

      if (commaIndex === -1) {
        return res.status(400).json({
          error: "Format de fichier base64 invalide."
        });
      }

      base64Data = file.substring(commaIndex + 1);
    }

    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer.length) {
      return res.status(400).json({
        error: "Le fichier est vide ou invalide."
      });
    }

    // Taille maximale côté serveur : 30 MB
    if (buffer.length > 30 * 1024 * 1024) {
      return res.status(413).json({
        error: "Le fichier est trop volumineux. Maximum : 30 MB."
      });
    }

    const extension =
      mimeType === "application/pdf"
        ? ".pdf"
        : mimeType === "image/png"
        ? ".png"
        : mimeType === "image/webp"
        ? ".webp"
        : ".jpg";

    temporaryFile = path.join(
      os.tmpdir(),
      `wiener-${Date.now()}${extension}`
    );

    await fs.writeFile(temporaryFile, buffer);

    // Upload vers Gemini Files API
    const uploadedFile = await ai.files.upload({
      file: temporaryFile,
      config: {
        mimeType,
        displayName: `Wiener IA ${Date.now()}`
      }
    });

    // Attendre que Gemini termine le traitement
    let processedFile = uploadedFile;

    for (let i = 0; i < 30; i++) {
      if (
        processedFile.state !== "PROCESSING"
      ) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      processedFile = await ai.files.get({
        name: uploadedFile.name
      });
    }

    if (processedFile.state === "FAILED") {
      return res.status(500).json({
        error: "Gemini n'a pas réussi à traiter le fichier."
      });
    }

    if (!processedFile.uri) {
      return res.status(500).json({
        error: "Gemini n'a pas fourni l'URI du fichier."
      });
    }

    const userPrompt =
      typeof prompt === "string" &&
      prompt.trim().length > 0
        ? prompt.trim()
        : `
Analyse ce fichier.

Si c'est un exercice :
- identifie l'énoncé ;
- résous-le étape par étape ;
- explique les calculs ;
- donne la réponse finale.

Si c'est un document :
- résume les informations importantes ;
- explique les points difficiles ;
- indique les informations importantes.

Si c'est une image :
- décris ce qui est utile pour répondre à la demande ;
- lis le texte visible si nécessaire.

Réponds en français.
`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        createPartFromUri(
          processedFile.uri,
          processedFile.mimeType || mimeType
        ),
        {
          text: userPrompt
        }
      ],
      config: {
        systemInstruction: WIENER_INSTRUCTIONS,
        temperature: 0.3,
        maxOutputTokens: 4096
      }
    });

    const answer = response?.text;

    if (!answer || !answer.trim()) {
      return res.status(500).json({
        error: "Gemini n'a retourné aucune analyse."
      });
    }

    return res.json({
      answer: answer.trim(),
      model: TEXT_MODEL
    });

  } catch (error) {
    return sendGeminiError(res, error);

  } finally {
    if (temporaryFile) {
      try {
        await fs.unlink(temporaryFile);
      } catch {
        // Le fichier temporaire peut déjà avoir été supprimé.
      }
    }
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

  console.error(error);

  res.status(500).json({
    error: "Erreur interne du serveur."
  });
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
      GEMINI_API_KEY
        ? "CONFIGURÉE"
        : "ABSENTE"
    }`
  );
  console.log("================================");
});
  console.log("================================");
});
