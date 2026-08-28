```javascript
"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const crypto = require("crypto");

const {
  GoogleGenAI,
  createUserContent,
  createPartFromUri
} = require("@google/genai");


/* =========================================================
   WIENER IA
   Serveur Express + Google Gemini API
========================================================= */

const app = express();


/* =========================================================
   CONFIGURATION
========================================================= */

const PORT =
  Number(process.env.PORT) || 10000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;


/*
   Modèles.

   Le modèle texte est configurable avec une variable
   d'environnement GEMINI_TEXT_MODEL.

   Exemple :
   GEMINI_TEXT_MODEL=gemini-3.7-flash
*/

const TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL ||
  "gemini-3.7-flash";


/*
   Modèle de génération d'images.
*/

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ||
  "gemini-3.1-flash-image";


const MAX_JSON_SIZE =
  "50mb";

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

const MAX_MESSAGES =
  30;

const MAX_MESSAGE_LENGTH =
  20000;


/* =========================================================
   CLIENT GEMINI
========================================================= */

let ai = null;

if (GEMINI_API_KEY) {

  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });

}


/* =========================================================
   EXPRESS
========================================================= */

app.disable(
  "x-powered-by"
);


app.use(
  cors({
    origin: true,

    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type"
    ]
  })
);


app.use(
  express.json({
    limit: MAX_JSON_SIZE
  })
);


/*
   Fichiers statiques :
   index.html
   style.css
   app.js
*/

app.use(
  express.static(__dirname)
);


/* =========================================================
   INSTRUCTIONS WIENER IA
========================================================= */

const WIENER_INSTRUCTIONS = `
Tu es Wiener IA, un assistant généraliste intelligent,
précis, pédagogique, rapide et naturel.

IDENTITÉ
- Ton nom est Wiener IA.
- Réponds en français par défaut.
- Si l'utilisateur écrit principalement dans une autre langue,
  réponds dans cette langue.
- Ne prétends jamais être humain.
- Ne prétends jamais avoir effectué une action que tu n'as pas effectuée.

STYLE
- Comprends d'abord exactement la demande.
- Réponds directement.
- Évite les introductions inutiles.
- Sois clair et naturel.
- Pour une question simple, reste concis.
- Pour une question complexe, utilise des titres et des listes.
- Utilise Markdown lorsque cela améliore la lisibilité.

FIABILITÉ
- Ne fabrique jamais de faits.
- Ne fabrique jamais de sources.
- Ne présente jamais une hypothèse comme une certitude.
- Lorsque la recherche Web est activée, utilise les informations
  réellement trouvées.
- Si une information est incertaine, indique-le clairement.

ÉDUCATION
- Adapte ton explication au niveau de l'utilisateur.
- Pour un exercice, identifie les données.
- Donne les formules utiles.
- Montre les calculs importants.
- Vérifie le résultat final.
- En mathématiques, vérifie les signes et les unités.
- En physique, donne les formules et unités.
- En chimie, donne les équations et explique les transformations.
- En biologie, explique les mécanismes avec un vocabulaire adapté.

PROGRAMMATION
- Donne du code directement utilisable.
- Respecte le langage demandé.
- Explique brièvement les changements importants.
- Ne prétends jamais avoir testé un code si tu ne l'as pas réellement testé.

CONFIDENTIALITÉ
- Ne révèle jamais les clés API.
- Ne révèle jamais les secrets du serveur.
- Ne révèle jamais les variables d'environnement secrètes.
- Ne demande pas d'informations personnelles inutiles.

PRIORITÉ
Exactitude > pertinence > clarté > utilité.
`.trim();


/* =========================================================
   INSTRUCTIONS EXERCICES
========================================================= */

const EXERCISE_INSTRUCTIONS = `
Tu es le moteur de résolution d'exercices de Wiener IA.

Résous l'exercice avec rigueur.

Méthode :
1. Identifier ce qui est demandé.
2. Extraire les données.
3. Donner la formule, règle ou propriété.
4. Effectuer les calculs étape par étape.
5. Vérifier le résultat.
6. Donner clairement la réponse finale.

Ne crée aucune donnée absente de l'énoncé.

Si une information importante manque,
indique précisément ce qui manque.
`.trim();


/* =========================================================
   INSTRUCTIONS DOCUMENTS
========================================================= */

const FILE_INSTRUCTIONS = `
Tu es le moteur d'analyse de documents de Wiener IA.

Analyse précisément le fichier fourni.

Si c'est un exercice :
- lis l'énoncé ;
- identifie les données ;
- applique la méthode appropriée ;
- résous étape par étape ;
- donne la réponse finale.

Si c'est un document :
- identifie les informations importantes ;
- résume sans déformer ;
- explique les passages difficiles.

Si c'est une image :
- analyse uniquement les éléments réellement visibles ;
- lis le texte lorsque nécessaire ;
- ne prétends jamais voir une information absente.

Réponds en français sauf demande contraire.
`.trim();


/* =========================================================
   OUTILS
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


/* =========================================================
   ERREURS GEMINI
========================================================= */

function getErrorStatus(error) {

  return (
    Number(error?.status) ||
    Number(error?.statusCode) ||
    Number(error?.response?.status) ||
    500
  );

}


function getErrorMessage(error) {

  if (!error) {
    return "Erreur inconnue.";
  }

  if (
    typeof error.message === "string" &&
    error.message.trim()
  ) {

    return error.message.trim();

  }

  return "Une erreur est survenue avec Gemini.";
}


function sendGeminiError(
  res,
  error
) {

  console.error(
    "======================================"
  );

  console.error(
    "WIENER IA / GEMINI ERROR"
  );

  console.error(error);

  console.error(
    "======================================"
  );


  const status =
    getErrorStatus(error);


  if (
    status === 400
  ) {

    return res.status(400).json({
      error:
        getErrorMessage(error) ||
        "Requête Gemini invalide."
    });

  }


  if (
    status === 401 ||
    status === 403
  ) {

    return res.status(status).json({
      error:
        "La clé Gemini est invalide, absente ou non autorisée."
    });

  }


  if (
    status === 404
  ) {

    return res.status(404).json({
      error:
        "Le modèle Gemini demandé est introuvable ou indisponible."
    });

  }


  if (
    status === 429
  ) {

    return res.status(429).json({
      error:
        "La limite d'utilisation de Gemini a été atteinte. Réessaie plus tard."
    });

  }


  if (
    status === 408 ||
    status === 504
  ) {

    return res.status(504).json({
      error:
        "Gemini met trop de temps à répondre. Réessaie."
    });

  }


  return res.status(500).json({
    error:
      getErrorMessage(error) ||
      "Une erreur est survenue avec Gemini."
  });

}


/* =========================================================
   NETTOYAGE DES MESSAGES
========================================================= */

function cleanMessages(
  messages
) {

  if (!Array.isArray(messages)) {
    return [];
  }


  return messages

    .filter((message) => {

      if (
        !message ||
        typeof message !== "object"
      ) {
        return false;
      }


      if (
        message.role !== "user" &&
        message.role !== "assistant" &&
        message.role !== "model"
      ) {
        return false;
      }


      if (
        typeof message.content !== "string"
      ) {
        return false;
      }


      if (
        !message.content.trim()
      ) {
        return false;
      }


      return true;

    })


    .map((message) => ({

      role:
        message.role === "assistant" ||
        message.role === "model"
          ? "model"
          : "user",

      content:
        message.content
          .trim()
          .slice(
            0,
            MAX_MESSAGE_LENGTH
          )

    }))


    .slice(
      -MAX_MESSAGES
    );

}


/* =========================================================
   CONVERSION GEMINI
========================================================= */

function messagesToGemini(
  messages
) {

  return messages.map(
    (message) => ({

      role:
        message.role,

      parts: [
        {
          text:
            message.content
        }
      ]

    })
  );

}


/* =========================================================
   EXTRACTION DU TEXTE
========================================================= */

function extractText(
  response
) {

  if (!response) {
    return "";
  }


  if (
    typeof response.text === "string" &&
    response.text.trim()
  ) {

    return response.text.trim();

  }


  const candidates =
    Array.isArray(
      response.candidates
    )
      ? response.candidates
      : [];


  const chunks = [];


  for (
    const candidate
    of candidates
  ) {

    const parts =
      candidate?.content?.parts;


    if (!Array.isArray(parts)) {
      continue;
    }


    for (
      const part
      of parts
    ) {

      if (
        typeof part?.text === "string" &&
        part.text.trim()
      ) {

        chunks.push(
          part.text
        );

      }

    }

  }


  return chunks
    .join("\n")
    .trim();

}


/* =========================================================
   PAGE PRINCIPALE
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok: true,

      service:
        "Wiener IA",

      geminiConfigured:
        Boolean(
          GEMINI_API_KEY &&
          ai
        ),

      textModel:
        TEXT_MODEL,

      imageModel:
        IMAGE_MODEL,

      time:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   CHAT
========================================================= */

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      if (
        !requireGemini(res)
      ) {
        return;
      }


      /*
         Nouveau format :
         {
           messages: [...]
         }

         Compatibilité :
         {
           message: "...",
           history: [...]
         }
      */

      let messages =
        cleanMessages(
          req.body?.messages
        );


      if (
        !messages.length &&
        Array.isArray(
          req.body?.history
        )
      ) {

        messages =
          cleanMessages(
            req.body.history
          );

      }


      if (
        !messages.length &&
        typeof req.body?.message === "string" &&
        req.body.message.trim()
      ) {

        messages = [
          {
            role: "user",
            content:
              req.body.message
          }
        ];

      }


      if (
        !messages.length
      ) {

        return res.status(400).json({
          error:
            "Aucun message valide n'a été reçu."
        });

      }


      const response =
        await ai.models.generateContent({

          model:
            TEXT_MODEL,

          contents:
            messagesToGemini(
              messages
            ),

          config: {

            systemInstruction:
              WIENER_INSTRUCTIONS,

            temperature:
              0.45,

            maxOutputTokens:
              4096

          }

        });


      const answer =
        extractText(
          response
        );


      if (!answer) {

        return res.status(500).json({
          error:
            "Wiener IA n'a retourné aucune réponse."
        });

      }


      return res.json({

        answer,

        model:
          TEXT_MODEL

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

      if (
        !requireGemini(res)
      ) {
        return;
      }


      const question =
        typeof req.body?.question === "string"
          ? req.body.question.trim()
          : (
              typeof req.body?.message === "string"
                ? req.body.message.trim()
                : ""
            );


      const level =
        typeof req.body?.level === "string"
          ? req.body.level.trim()
          : "non précisé";


      const subject =
        typeof req.body?.subject === "string"
          ? req.body.subject.trim()
          : "non précisée";


      if (!question) {

        return res.status(400).json({
          error:
            "Aucun exercice n'a été reçu."
        });

      }


      if (
        question.length > 30000
      ) {

        return res.status(413).json({
          error:
            "L'exercice est trop long."
        });

      }


      const prompt = `
Matière : ${subject}

Niveau : ${level}

EXERCICE :
${question}

Résous maintenant cet exercice avec une méthode claire et complète.
`.trim();


      const response =
        await ai.models.generateContent({

          model:
            TEXT_MODEL,

          contents:
            prompt,

          config: {

            systemInstruction:
              WIENER_INSTRUCTIONS +
              "\n\n" +
              EXERCISE_INSTRUCTIONS,

            temperature:
              0.2,

            maxOutputTokens:
              5000

          }

        });


      const answer =
        extractText(
          response
        );


      if (!answer) {

        return res.status(500).json({
          error:
            "Aucune solution n'a été générée."
        });

      }


      return res.json({

        answer,

        model:
          TEXT_MODEL

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

      if (
        !requireGemini(res)
      ) {
        return;
      }


      const query =
        typeof req.body?.query === "string"
          ? req.body.query.trim()
          : (
              typeof req.body?.message === "string"
                ? req.body.message.trim()
                : ""
            );


      if (!query) {

        return res.status(400).json({
          error:
            "Aucune recherche n'a été reçue."
        });

      }


      if (
        query.length > 10000
      ) {

        return res.status(413).json({
          error:
            "La recherche est trop longue."
        });

      }


      const prompt = `
Réponds à la question suivante en utilisant la recherche Google :

${query}

Consignes :
- Recherche des informations fiables.
- Privilégie les sources officielles et reconnues.
- Vérifie les informations récentes.
- Ne présente pas une supposition comme un fait.
- Réponds directement à la question.
`.trim();


      const response =
        await ai.models.generateContent({

          model:
            TEXT_MODEL,

          contents:
            prompt,

          config: {

            systemInstruction:
              WIENER_INSTRUCTIONS,

            temperature:
              0.3,

            maxOutputTokens:
              4500,

            tools: [
              {
                googleSearch: {}
              }
            ]

          }

        });


      const answer =
        extractText(
          response
        );


      if (!answer) {

        return res.status(500).json({
          error:
            "La recherche n'a retourné aucune réponse."
        });

      }


      /*
         Récupération des sources
         de grounding.
      */

      const metadata =
        response
          ?.candidates?.[0]
          ?.groundingMetadata;


      const sources = [];


      const chunks =
        metadata?.groundingChunks;


      if (
        Array.isArray(chunks)
      ) {

        for (
          const chunk
          of chunks
        ) {

          const uri =
            chunk?.web?.uri;


          if (!uri) {
            continue;
          }


          sources.push({

            title:
              chunk?.web?.title ||
              "Source",

            url:
              uri

          });

        }

      }


      const uniqueSources =
        Array.from(

          new Map(

            sources.map(
              (source) => [
                source.url,
                source
              ]
            )

          ).values()

        ).slice(
          0,
          10
        );


      return res.json({

        answer,

        sources:
          uniqueSources,

        model:
          TEXT_MODEL

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

function tokenizeExpression(
  expression
) {

  const tokens = [];

  let i = 0;


  while (
    i < expression.length
  ) {

    const char =
      expression[i];


    if (
      /\d|\./.test(char)
    ) {

      let number = "";


      while (
        i < expression.length &&
        /[\d.]/.test(
          expression[i]
        )
      ) {

        number +=
          expression[i];

        i++;

      }


      if (
        (number.match(/\./g) || [])
          .length > 1
      ) {

        throw new Error(
          "Nombre invalide."
        );

      }


      if (
        number === "."
      ) {

        throw new Error(
          "Nombre invalide."
        );

      }


      tokens.push({

        type:
          "number",

        value:
          Number(number)

      });


      continue;

    }


    if (
      "+-*/%^()".includes(
        char
      )
    ) {

      tokens.push({

        type:
          "operator",

        value:
          char

      });


      i++;

      continue;

    }


    throw new Error(
      "Caractère non autorisé."
    );

  }


  return tokens;

}


function parseExpressionTokens(
  tokens
) {

  let position = 0;


  function peek() {

    return tokens[
      position
    ];

  }


  function consume(
    value
  ) {

    const token =
      peek();


    if (
      !token ||
      token.value !== value
    ) {

      throw new Error(
        "Expression invalide."
      );

    }


    position++;

  }


  function parsePrimary() {

    const token =
      peek();


    if (!token) {

      throw new Error(
        "Expression incomplète."
      );

    }


    if (
      token.type === "number"
    ) {

      position++;

      return token.value;

    }


    if (
      token.value === "("
    ) {

      position++;

      const value =
        parseAdditive();

      consume(")");

      return value;

    }


    if (
      token.value === "+"
    ) {

      position++;

      return +parsePrimary();

    }


    if (
      token.value === "-"
    ) {

      position++;

      return -parsePrimary();

    }


    throw new Error(
      "Expression invalide."
    );

  }


  function parsePower() {

    let left =
      parsePrimary();


    if (
      peek()?.value === "^"
    ) {

      position++;


      const right =
        parsePower();


      left =
        Math.pow(
          left,
          right
        );

    }


    return left;

  }


  function parseMultiplicative() {

    let value =
      parsePower();


    while (true) {

      const operator =
        peek()?.value;


      if (
        operator !== "*" &&
        operator !== "/" &&
        operator !== "%"
      ) {

        break;

      }


      position++;


      const right =
        parsePower();


      if (
        operator === "*"
      ) {

        value *= right;

      }


      if (
        operator === "/"
      ) {

        if (
          right === 0
        ) {

          throw new Error(
            "Division par zéro."
          );

        }


        value /=
          right;

      }


      if (
        operator === "%"
      ) {

        if (
          right === 0
        ) {

          throw new Error(
            "Modulo par zéro."
          );

        }


        value %=
          right;

      }

    }


    return value;

  }


  function parseAdditive() {

    let value =
      parseMultiplicative();


    while (true) {

      const operator =
        peek()?.value;


      if (
        operator !== "+" &&
        operator !== "-"
      ) {

        break;

      }


      position++;


      const right =
        parseMultiplicative();


      if (
        operator === "+"
      ) {

        value += right;

      } else {

        value -= right;

      }

    }


    return value;

  }


  const result =
    parseAdditive();


  if (
    position !==
    tokens.length
  ) {

    throw new Error(
      "Expression invalide."
    );

  }


  return result;

}


app.post(
  "/api/calculate",
  async (req, res) => {

    try {

      const original =
        typeof req.body?.expression === "string"
          ? req.body.expression.trim()
          : (
              typeof req.body?.message === "string"
                ? req.body.message.trim()
                : ""
            );


      if (!original) {

        return res.status(400).json({
          error:
            "Aucune expression reçue."
        });

      }


      if (
        original.length > 200
      ) {

        return res.status(400).json({
          error:
            "Expression trop longue."
        });

      }


      const expression =
        original
          .replace(/,/g, ".")
          .replace(/\s+/g, "");


      if (
        !/^[0-9+\-*/().%^]+$/.test(
          expression
        )
      ) {

        return res.status(400).json({
          error:
            "Expression invalide."
        });

      }


      const tokens =
        tokenizeExpression(
          expression
        );


      const result =
        parseExpressionTokens(
          tokens
        );


      if (
        typeof result !== "number" ||
        !Number.isFinite(result)
      ) {

        return res.status(400).json({
          error:
            "Résultat mathématique invalide."
        });

      }


      return res.json({

        expression:
          original,

        result

      });


    } catch (error) {

      return res.status(400).json({

        error:
          error?.message ||
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

      if (
        !requireGemini(res)
      ) {
        return;
      }


      const prompt =
        typeof req.body?.prompt === "string"
          ? req.body.prompt.trim()
          : (
              typeof req.body?.message === "string"
                ? req.body.message.trim()
                : ""
            );


      if (!prompt) {

        return res.status(400).json({
          error:
            "Aucune description d'image reçue."
        });

      }


      if (
        prompt.length > 10000
      ) {

        return res.status(413).json({
          error:
            "La description de l'image est trop longue."
        });

      }


      /*
         API generateContent actuelle
         pour le modèle image.
      */

      const response =
        await ai.models.generateContent({

          model:
            IMAGE_MODEL,

          contents:
            prompt,

          config: {

            responseModalities: [
              "TEXT",
              "IMAGE"
            ]

          }

        });


      let image = null;

      let text = "";


      const parts =
        response
          ?.candidates?.[0]
          ?.content?.parts || [];


      for (
        const part
        of parts
      ) {

        if (
          typeof part?.text === "string"
        ) {

          text +=
            part.text;

        }


        if (
          part?.inlineData?.data
        ) {

          const mimeType =
            part.inlineData.mimeType ||
            "image/png";


          image =
            `data:${mimeType};base64,${part.inlineData.data}`;

        }

      }


      if (!image) {

        return res.status(500).json({
          error:
            "Gemini n'a généré aucune image."
        });

      }


      return res.json({

        image,

        text:
          text.trim(),

        model:
          IMAGE_MODEL

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
   FICHIERS
========================================================= */

const ALLOWED_MIME_TYPES =
  new Set([

    "application/pdf",

    "image/png",

    "image/jpeg",

    "image/webp"

  ]);


function getExtensionFromMime(
  mimeType
) {

  switch (mimeType) {

    case "application/pdf":
      return ".pdf";

    case "image/png":
      return ".png";

    case "image/jpeg":
      return ".jpg";

    case "image/webp":
      return ".webp";

    default:
      return "";

  }

}


/* =========================================================
   EXTRACTION BASE64
========================================================= */

function extractBase64Data(
  file
) {

  if (
    typeof file !== "string"
  ) {

    throw new Error(
      "Fichier invalide."
    );

  }


  if (
    file.startsWith("data:")
  ) {

    const comma =
      file.indexOf(",");


    if (
      comma === -1
    ) {

      throw new Error(
        "Format base64 invalide."
      );

    }


    return file.slice(
      comma + 1
    );

  }


  return file;

}


/* =========================================================
   ANALYSE PDF / IMAGE
========================================================= */

app.post(
  "/api/analyze-file",
  async (req, res) => {

    let temporaryFile = null;

    let uploadedFileName = null;


    try {

      if (
        !requireGemini(res)
      ) {
        return;
      }


      const file =
        req.body?.file;


      const mimeType =
        typeof req.body?.mimeType === "string"
          ? req.body.mimeType.trim()
          : "";


      const prompt =
        typeof req.body?.prompt === "string"
          ? req.body.prompt.trim()
          : "";


      if (
        typeof file !== "string" ||
        !file.trim()
      ) {

        return res.status(400).json({
          error:
            "Aucun fichier reçu."
        });

      }


      if (!mimeType) {

        return res.status(400).json({
          error:
            "Le type du fichier est manquant."
        });

      }


      if (
        !ALLOWED_MIME_TYPES.has(
          mimeType
        )
      ) {

        return res.status(400).json({
          error:
            "Type de fichier non pris en charge. Utilise PDF, PNG, JPEG ou WEBP."
        });

      }


      const base64Data =
        extractBase64Data(
          file
        );


      const buffer =
        Buffer.from(
          base64Data,
          "base64"
        );


      if (
        !buffer.length
      ) {

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
            "Le fichier est trop volumineux. Maximum : 50 MB."
        });

      }


      const extension =
        getExtensionFromMime(
          mimeType
        );


      temporaryFile =
        path.join(

          os.tmpdir(),

          `wiener-${Date.now()}-${crypto
            .randomBytes(8)
            .toString("hex")}${extension}`

        );


      await fs.writeFile(
        temporaryFile,
        buffer
      );


      /*
         Upload Gemini Files API.
      */

      const uploadedFile =
        await ai.files.upload({

          file:
            temporaryFile,

          config: {

            mimeType,

            displayName:
              `Wiener IA ${Date.now()}`

          }

        });


      uploadedFileName =
        uploadedFile?.name ||
        null;


      if (
        !uploadedFile ||
        !uploadedFile.name
      ) {

        return res.status(500).json({
          error:
            "Gemini n'a pas accepté le fichier."
        });

      }


      /*
         Attendre ACTIVE.
      */

      let processedFile =
        uploadedFile;


      const maxChecks =
        30;


      for (
        let i = 0;
        i < maxChecks;
        i++
      ) {

        const state =
          String(
            processedFile?.state ||
            ""
          ).toUpperCase();


        if (
          state === "ACTIVE"
        ) {

          break;

        }


        if (
          state === "FAILED"
        ) {

          return res.status(500).json({
            error:
              "Gemini n'a pas réussi à traiter le fichier."
          });

        }


        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1500
            )
        );


        processedFile =
          await ai.files.get({

            name:
              uploadedFile.name

          });

      }


      const finalState =
        String(
          processedFile?.state ||
          ""
        ).toUpperCase();


      if (
        finalState !== "ACTIVE"
      ) {

        return res.status(504).json({
          error:
            "Le traitement du fichier prend trop de temps."
        });

      }


      if (
        !processedFile.uri
      ) {

        return res.status(500).json({
          error:
            "Gemini n'a pas fourni l'URI du fichier."
        });

      }


      const userPrompt =
        prompt ||

        `
Analyse ce fichier.

Si c'est un exercice :
- identifie l'énoncé ;
- identifie les données ;
- résous étape par étape ;
- explique les calculs ;
- donne la réponse finale.

Si c'est un document :
- résume les informations importantes ;
- explique les points difficiles ;
- indique les éléments essentiels.

Si c'est une image :
- lis le texte visible lorsque nécessaire ;
- analyse les éléments utiles.

Réponds en français.
`.trim();


      const response =
        await ai.models.generateContent({

          model:
            TEXT_MODEL,

          contents:
            createUserContent([

              createPartFromUri(
                processedFile.uri,

                processedFile.mimeType ||
                  mimeType
              ),

              userPrompt

            ]),

          config: {

            systemInstruction:
              WIENER_INSTRUCTIONS +
              "\n\n" +
              FILE_INSTRUCTIONS,

            temperature:
              0.25,

            maxOutputTokens:
              5000

          }

        });


      const answer =
        extractText(
          response
        );


      if (!answer) {

        return res.status(500).json({
          error:
            "Gemini n'a retourné aucune analyse."
        });

      }


      return res.json({

        answer,

        model:
          TEXT_MODEL

      });


    } catch (error) {

      return sendGeminiError(
        res,
        error
      );


    } finally {


      /*
         Supprimer le fichier local.
      */

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


      /*
         Supprimer le fichier Gemini.
      */

      if (
        uploadedFileName &&
        ai
      ) {

        try {

          await ai.files.delete({

            name:
              uploadedFileName

          });

        } catch {

          // Suppression non bloquante.

        }

      }

    }

  }
);


/* =========================================================
   ROUTE API INEXISTANTE
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
   ERREUR JSON / EXPRESS
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error instanceof SyntaxError &&
      error.status === 400 &&
      error.body
    ) {

      return res.status(400).json({

        error:
          "JSON invalide."

      });

    }


    console.error(
      "WIENER IA / EXPRESS ERROR",
      error
    );


    return res.status(500).json({

      error:
        "Erreur interne du serveur."

    });

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
      "======================================"
    );

    console.log(
      "🤖 WIENER IA"
    );

    console.log(
      "======================================"
    );

    console.log(
      `🚀 Serveur : port ${PORT}`
    );

    console.log(
      `🧠 Modèle texte : ${TEXT_MODEL}`
    );

    console.log(
      `🎨 Modèle image : ${IMAGE_MODEL}`
    );

    console.log(
      `🔐 Gemini API : ${
        GEMINI_API_KEY
          ? "CONFIGURÉE"
          : "ABSENTE"
      }`
    );

    console.log(
      "======================================"
    );

  }
);
```
