```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TEXT_MODEL = "gemini-3.6-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

const MAX_BODY_SIZE = "30mb";
const MAX_FILE_SIZE = 30 * 1024 * 1024;

let ai = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
}

/* =========================================================
   WIENER IA — INSTRUCTIONS
========================================================= */

const WIENER_INSTRUCTIONS = `
Tu es Wiener IA, un assistant intelligent, rapide, précis et pédagogique.

LANGUE
- Réponds en français par défaut.
- Si l'utilisateur écrit dans une autre langue, réponds dans cette langue.
- Adapte ton vocabulaire au niveau de l'utilisateur.

QUALITÉ DES RÉPONSES
- Comprends d'abord précisément la demande.
- Réponds directement sans longue introduction inutile.
- Ne répète pas la question.
- Donne les informations réellement utiles.
- Si plusieurs interprétations sont possibles, indique brièvement celle que tu retiens.
- Ne fabrique jamais une information.
- Si tu n'es pas certain, dis-le clairement.
- Ne fabrique jamais de source ou de citation.

ÉDUCATION
- Explique les exercices étape par étape.
- En mathématiques : formule, remplacement des données, calcul, résultat.
- En physique : données, formule, unités, application numérique, résultat.
- En chimie : équations, formules, calculs et interprétation.
- En SVT/biologie : explique les mécanismes de manière structurée.
- Adapte les explications au niveau scolaire.

PROGRAMMATION
- Donne du code directement utilisable.
- Explique uniquement les parties importantes.
- Signale les erreurs probables.
- Ne prétends jamais avoir exécuté un code si tu ne l'as pas réellement exécuté.

RECHERCHE
- Pour les informations récentes ou susceptibles d'avoir changé, utilise la recherche Web lorsqu'elle est disponible.
- Distingue les faits vérifiés des informations incertaines.
- Donne les sources importantes lorsque la recherche en fournit.

STYLE
- Sois naturel.
- Évite les phrases répétitives.
- Utilise Markdown lorsque cela améliore la lisibilité.
- Utilise des titres courts pour les réponses longues.
- Ne surcharge pas chaque réponse avec des listes.
- Donne une réponse concise lorsque la question est simple.
- Donne une réponse détaillée lorsque la question nécessite une explication.

CONFIDENTIALITÉ
- Ne révèle jamais la clé API.
- Ne révèle jamais les secrets ou variables d'environnement du serveur.
- Ne demande pas inutilement de données personnelles.
`.trim();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());

app.use(
  express.json({
    limit: MAX_BODY_SIZE
  })
);

app.use(express.static(__dirname));

/* =========================================================
   UTILITAIRES
========================================================= */

function requireGemini(res) {
  if (!GEMINI_API_KEY || !ai) {
    res.status(500).json({
      error:
        "GEMINI_API_KEY n'est pas configurée sur le serveur."
    });

    return false;
  }

  return true;
}

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    500
  );
}

function sendGeminiError(res, error) {
  console.error("================================");
  console.error("WIENER IA / GEMINI ERROR");
  console.error(error);
  console.error("================================");

  const status = getErrorStatus(error);

  if (status === 401 || status === 403) {
    return res.status(status).json({
      error:
        "La clé Gemini est invalide ou n'est pas autorisée."
    });
  }

  if (status === 429) {
    return res.status(429).json({
      error:
        "La limite d'utilisation de Gemini a été atteinte. Réessaie dans quelques instants."
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
    .slice(-30);
}

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content.trim();
    }
  }

  return "";
}

function shouldSearchWeb(text) {
  const query = text.toLowerCase();

  const indicators = [
    "aujourd'hui",
    "actualité",
    "actualités",
    "maintenant",
    "actuellement",
    "dernier",
    "dernière",
    "derniers",
    "récent",
    "récente",
    "en 2026",
    "prix",
    "tarif",
    "résultat",
    "classement",
    "calendrier",
    "date",
    "quand",
    "qui est actuellement",
    "latest",
    "today",
    "current",
    "recent"
  ];

  return indicators.some((word) =>
    query.includes(word)
  );
}

/* =========================================================
   PAGE PRINCIPALE
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Wiener IA",
    model: TEXT_MODEL,
    gemini: Boolean(ai)
  });
});

/* =========================================================
   CHAT RAPIDE
========================================================= */

app.post("/api/chat", async (req, res) => {
  try {
    if (!requireGemini(res)) return;

    const {
      messages,
      previousInteractionId,
      useSearch
    } = req.body;

    const cleanMessagesList =
      cleanMessages(messages);

    if (cleanMessagesList.length === 0) {
      return res.status(400).json({
        error: "Les messages reçus sont invalides."
      });
    }

    const userMessage =
      getLastUserMessage(
        cleanMessagesList
      );

    if (!userMessage) {
      return res.status(400).json({
        error: "Aucun message utilisateur trouvé."
      });
    }

    /*
      Avec previousInteractionId, Gemini conserve le contexte
      côté serveur.

      Pour une nouvelle conversation, on envoie les derniers
      messages utiles afin que Wiener puisse également
      fonctionner avec l'historique déjà présent dans l'interface.
    */

    let input = userMessage;

    if (!previousInteractionId) {
      const previousMessages =
        cleanMessagesList.slice(
          0,
          -1
        );

      if (previousMessages.length > 0) {
        const context =
          previousMessages
            .map((message) => {
              const role =
                message.role === "assistant"
                  ? "Wiener IA"
                  : "Utilisateur";

              return `${role} : ${message.content}`;
            })
            .join("\n\n");

        input = `
CONTEXTE DE LA CONVERSATION :

${context}

NOUVELLE DEMANDE DE L'UTILISATEUR :

${userMessage}

Réponds à la nouvelle demande en tenant compte du contexte précédent.
`;
      }
    }

    const config = {
      systemInstruction:
        WIENER_INSTRUCTIONS
    };

    /*
      Recherche Web seulement lorsque demandée
      explicitement ou lorsqu'elle semble nécessaire.
    */

    if (
      useSearch === true ||
      shouldSearchWeb(userMessage)
    ) {
      config.tools = [
        {
          type: "google_search"
        }
      ];
    }

    /*
      Streaming :
      le navigateur reçoit les morceaux de texte
      dès qu'ils sont générés.
    */

    const stream =
      await ai.interactions.create({
        model: TEXT_MODEL,
        input,
        previous_interaction_id:
          previousInteractionId || undefined,
        ...config,
        stream: true
      });

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    let interactionId = null;
    let finalText = "";

    for await (const event of stream) {

      /*
        ID de l'interaction.
      */

      if (
        event.event_type ===
        "interaction.created"
      ) {
        interactionId =
          event.interaction?.id ||
          null;
      }

      /*
        Texte généré.
      */

      if (
        event.event_type ===
          "step.delta" &&
        event.delta?.type === "text"
      ) {
        const text =
          event.delta.text || "";

        if (text) {
          finalText += text;

          res.write(
            `data: ${JSON.stringify({
              type: "text",
              text
            })}\n\n`
          );
        }
      }

      /*
        Interaction terminée.
      */

      if (
        event.event_type ===
        "interaction.completed"
      ) {
        interactionId =
          event.interaction?.id ||
          interactionId;

        res.write(
          `data: ${JSON.stringify({
            type: "done",
            interactionId,
            model: TEXT_MODEL,
            answer: finalText
          })}\n\n`
        );
      }
    }

    res.write(
      "data: [DONE]\n\n"
    );

    res.end();

  } catch (error) {

    /*
      Si le streaming a déjà commencé,
      on ne peut plus envoyer une réponse JSON classique.
    */

    if (!res.headersSent) {
      return sendGeminiError(
        res,
        error
      );
    }

    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error:
            error?.message ||
            "Erreur Gemini."
        })}\n\n`
      );

      res.end();
    } catch {
      res.end();
    }
  }
});

/* =========================================================
   CHAT NON STREAMING
   Utile pour certaines fonctions internes.
========================================================= */

app.post(
  "/api/chat-sync",
  async (req, res) => {
    try {
      if (!requireGemini(res)) return;

      const {
        messages,
        previousInteractionId,
        useSearch
      } = req.body;

      const clean =
        cleanMessages(messages);

      if (clean.length === 0) {
        return res.status(400).json({
          error: "Messages invalides."
        });
      }

      const userMessage =
        getLastUserMessage(clean);

      const config = {
        systemInstruction:
          WIENER_INSTRUCTIONS
      };

      if (
        useSearch === true ||
        shouldSearchWeb(userMessage)
      ) {
        config.tools = [
          {
            type: "google_search"
          }
        ];
      }

      const interaction =
        await ai.interactions.create({
          model: TEXT_MODEL,
          input: userMessage,
          previous_interaction_id:
            previousInteractionId ||
            undefined,
          ...config
        });

      return res.json({
        answer:
          interaction.output_text ||
          "",
        interactionId:
          interaction.id,
        model: TEXT_MODEL
      });

    } catch (error) {
      return sendGeminiError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   EXERCICES
========================================================= */

app.post(
  "/api/exercises",
  async (req, res) => {
    try {
      if (!requireGemini(res)) return;

      const {
        question,
        level,
        subject
      } = req.body;

      if (
        typeof question !== "string" ||
        !question.trim()
      ) {
        return res.status(400).json({
          error: "Aucun exercice reçu."
        });
      }

      const prompt = `
Résous l'exercice suivant avec une méthode pédagogique.

Matière : ${
        subject || "non précisée"
      }

Niveau : ${
        level || "non précisé"
      }

EXERCICE :
${question.trim()}

MÉTHODE OBLIGATOIRE :

1. Identifie les données importantes.
2. Identifie ce qui est demandé.
3. Donne la formule, la propriété ou la règle utilisée.
4. Fais les calculs étape par étape.
5. Explique les étapes difficiles.
6. Donne la réponse finale clairement.
7. Vérifie le résultat si possible.

Ne saute pas les étapes importantes.
`;

      const interaction =
        await ai.interactions.create({
          model: TEXT_MODEL,
          input: prompt,
          systemInstruction:
            WIENER_INSTRUCTIONS
        });

      const answer =
        interaction.output_text;

      if (
        !answer ||
        !answer.trim()
      ) {
        return res.status(500).json({
          error:
            "Aucune solution n'a été générée."
        });
      }

      return res.json({
        answer: answer.trim(),
        model: TEXT_MODEL,
        interactionId:
          interaction.id
      });

    } catch (error) {
      return sendGeminiError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   RECHERCHE WEB
========================================================= */

app.post(
  "/api/search",
  async (req, res) => {
    try {
      if (!requireGemini(res)) return;

      const {
        query
      } = req.body;

      if (
        typeof query !== "string" ||
        !query.trim()
      ) {
        return res.status(400).json({
          error: "Aucune recherche reçue."
        });
      }

      const prompt = `
Recherche sur Internet les informations nécessaires
pour répondre précisément à cette question :

${query.trim()}

Consignes :
- Utilise la recherche Google.
- Privilégie les informations récentes.
- Compare les informations lorsque nécessaire.
- Ne présente pas une information incertaine comme un fait.
- Réponds clairement.
- Mentionne les sources importantes lorsque les informations de recherche
  permettent de les identifier.
`;

      const interaction =
        await ai.interactions.create({
          model: TEXT_MODEL,
          input: prompt,
          systemInstruction:
            WIENER_INSTRUCTIONS,
          tools: [
            {
              type: "google_search"
            }
          ]
        });

      const answer =
        interaction.output_text ||
        "";

      /*
        Extraction des résultats Web
        lorsque Gemini les fournit.
      */

      const sources = [];

      const steps =
        interaction.steps || [];

      for (const step of steps) {

        if (
          step.type ===
          "google_search_result"
        ) {
          const results =
            step.results ||
            [];

          for (const result of results) {

            if (
              result.url
            ) {
              sources.push({
                title:
                  result.title ||
                  "Source",
                url:
                  result.url
              });
            }
          }
        }
      }

      return res.json({
        answer: answer.trim(),
        sources,
        model: TEXT_MODEL,
        interactionId:
          interaction.id
      });

    } catch (error) {
      return sendGeminiError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   CALCULATRICE
========================================================= */

app.post(
  "/api/calculate",
  async (req, res) => {

    try {

      const {
        expression
      } = req.body;

      if (
        typeof expression !== "string" ||
        !expression.trim()
      ) {
        return res.status(400).json({
          error:
            "Aucune expression reçue."
        });
      }

      let expr =
        expression
          .trim()
          .replace(/,/g, ".")
          .replace(/\s+/g, "");

      if (
        !/^[0-9+\-*/().%^]+$/.test(
          expr
        )
      ) {
        return res.status(400).json({
          error:
            "Expression invalide."
        });
      }

      if (
        expr.length > 200 ||
        expr.includes("..") ||
        expr.includes("++") ||
        expr.includes("--")
      ) {
        return res.status(400).json({
          error:
            "Expression invalide."
        });
      }

      expr =
        expr.replace(
          /\^/g,
          "**"
        );

      const result =
        Function(
          `"use strict"; return (${expr})`
        )();

      if (
        typeof result !== "number" ||
        !Number.isFinite(result)
      ) {
        return res.status(400).json({
          error:
            "Impossible de calculer cette expression."
        });
      }

      return res.json({
        expression,
        result
      });

    } catch {
      return res.status(400).json({
        error:
          "Expression mathématique invalide."
      });
    }
  }
);

/* =========================================================
   GÉNÉRATION D'IMAGE
========================================================= */

app.post(
  "/api/image",
  async (req, res) => {

    try {

      if (!requireGemini(res))
        return;

      const {
        prompt
      } = req.body;

      if (
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          error:
            "Aucune description d'image reçue."
        });
      }

      const interaction =
        await ai.interactions.create({
          model: IMAGE_MODEL,
          input: prompt.trim(),
          response_format: [
            {
              type: "image"
            },
            {
              type: "text"
            }
          ]
        });

      /*
        Recherche de l'image générée
        dans les étapes de l'interaction.
      */

      let image = null;
      let text = "";

      if (
        Array.isArray(
          interaction.steps
        )
      ) {

        for (
          const step
          of interaction.steps
        ) {

          const content =
            step.content;

          if (
            !Array.isArray(
              content
            )
          ) {
            continue;
          }

          for (
            const item
            of content
          ) {

            if (
              item.type ===
              "image"
            ) {
              image = item;
            }

            if (
              item.type ===
              "text"
            ) {
              text +=
                item.text ||
                "";
            }
          }
        }
      }

      /*
        Compatibilité avec certaines réponses
        du SDK.
      */

      if (
        !image &&
        interaction.output_image
      ) {
        image =
          interaction.output_image;
      }

      if (
        !text &&
        interaction.output_text
      ) {
        text =
          interaction.output_text;
      }

      if (
        !image ||
        !image.data
      ) {
        return res.status(500).json({
          error:
            "Gemini n'a généré aucune image."
        });
      }

      return res.json({
        image:
          `data:${
            image.mime_type ||
            "image/png"
          };base64,${
            image.data
          }`,
        text,
        model: IMAGE_MODEL,
        interactionId:
          interaction.id
      });

    } catch (error) {

      return sendGeminiError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   ANALYSE PDF / IMAGE
========================================================= */

app.post(
  "/api/analyze-file",
  async (req, res) => {

    let temporaryFile = null;

    try {

      if (!requireGemini(res))
        return;

      const {
        file,
        mimeType,
        prompt
      } = req.body;

      if (
        typeof file !== "string" ||
        !file.trim()
      ) {
        return res.status(400).json({
          error:
            "Aucun fichier reçu."
        });
      }

      const allowedMimeTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp"
      ];

      if (
        !allowedMimeTypes.includes(
          mimeType
        )
      ) {
        return res.status(400).json({
          error:
            "Type de fichier non pris en charge."
        });
      }

      let base64Data = file;

      if (
        file.startsWith("data:")
      ) {

        const commaIndex =
          file.indexOf(",");

        if (
          commaIndex === -1
        ) {
          return res.status(400).json({
            error:
              "Format base64 invalide."
          });
        }

        base64Data =
          file.substring(
            commaIndex + 1
          );
      }

      const buffer =
        Buffer.from(
          base64Data,
          "base64"
        );

      if (!buffer.length) {
        return res.status(400).json({
          error:
            "Le fichier est vide ou invalide."
        });
      }

      if (
        buffer.length >
        MAX_FILE_SIZE
      ) {
        return res.status(413).json({
          error:
            "Fichier trop volumineux. Maximum : 30 MB."
        });
      }

      let extension =
        ".jpg";

      if (
        mimeType ===
        "application/pdf"
      ) {
        extension = ".pdf";
      }

      if (
        mimeType ===
        "image/png"
      ) {
        extension = ".png";
      }

      if (
        mimeType ===
        "image/webp"
      ) {
        extension = ".webp";
      }

      temporaryFile =
        path.join(
          os.tmpdir(),
          `wiener-${Date.now()}${extension}`
        );

      await fs.writeFile(
        temporaryFile,
        buffer
      );

      /*
        Pour l'analyse multimodale,
        on transmet directement les données
        au modèle via l'Interactions API.
      */

      const base64 =
        buffer.toString(
          "base64"
        );

      const userPrompt =
        typeof prompt ===
          "string" &&
        prompt.trim()
          ? prompt.trim()
          : `
Analyse ce fichier.

Si c'est un exercice :
- lis précisément l'énoncé ;
- identifie les données ;
- résous l'exercice étape par étape ;
- donne le résultat final.

Si c'est un document :
- résume les informations essentielles ;
- explique les points importants ;
- signale les informations difficiles à comprendre.

Si c'est une image :
- analyse précisément ce qui est visible ;
- lis le texte lorsque c'est nécessaire ;
- réponds à la demande de l'utilisateur.

Réponds en français.
`;

      const interaction =
        await ai.interactions.create({
          model: TEXT_MODEL,
          input: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image",
              data: base64,
              mime_type: mimeType
            }
          ],
          systemInstruction:
            WIENER_INSTRUCTIONS
        });

      const answer =
        interaction.output_text ||
        "";

      if (!answer.trim()) {
        return res.status(500).json({
          error:
            "Gemini n'a retourné aucune analyse."
        });
      }

      return res.json({
        answer: answer.trim(),
        model: TEXT_MODEL,
        interactionId:
          interaction.id
      });

    } catch (error) {

      return sendGeminiError(
        res,
        error
      );

    } finally {

      if (
        temporaryFile
      ) {
        try {
          await fs.unlink(
            temporaryFile
          );
        } catch {
          // Rien à faire.
        }
      }
    }
  }
);

/* =========================================================
   ROUTES API INEXISTANTES
========================================================= */

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      error:
        "Route API introuvable."
    });

  }
);

/* =========================================================
   ERREURS JSON
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error instanceof
        SyntaxError &&
      error.status === 400 &&
      error.body
    ) {
      return res.status(400).json({
        error:
          "JSON invalide."
      });
    }

    console.error(
      "WIENER SERVER ERROR:",
      error
    );

    if (
      !res.headersSent
    ) {
      res.status(500).json({
        error:
          "Erreur interne du serveur."
      });
    }
  }
);

/* =========================================================
   DÉMARRAGE
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "🤖 WIENER IA V2"
    );

    console.log(
      `🚀 Port : ${PORT}`
    );

    console.log(
      `🧠 Modèle : ${TEXT_MODEL}`
    );

    console.log(
      `🎨 Image : ${IMAGE_MODEL}`
    );

    console.log(
      `🔐 Gemini : ${
        GEMINI_API_KEY
          ? "CONFIGURÉ"
          : "ABSENT"
      }`
    );

    console.log(
      "⚡ Streaming : ACTIVÉ"
    );

    console.log(
      "================================"
    );
  }
);
```
