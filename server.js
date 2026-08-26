```javascript
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================================
   CONFIGURATION
========================================================= */

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(express.static(__dirname));


/* =========================================================
   OPENAI
========================================================= */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Wiener IA",
    openai_key: Boolean(
      process.env.OPENAI_API_KEY
    )
  });
});


/* =========================================================
   CHAT
========================================================= */

app.post("/api/chat", async (req, res) => {

  try {

    /* -----------------------------------------------------
       Vérification de la clé API
    ----------------------------------------------------- */

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error:
          "OPENAI_API_KEY n'est pas configurée sur Render."
      });
    }


    /* -----------------------------------------------------
       Récupération des données
    ----------------------------------------------------- */

    const {
      messages,
      model
    } = req.body;


    /* -----------------------------------------------------
       Validation
    ----------------------------------------------------- */

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return res.status(400).json({
        error:
          "Aucun message reçu."
      });
    }


    /* -----------------------------------------------------
       Modèles autorisés
    ----------------------------------------------------- */

    const allowedModels = [
      "gpt-4o-mini",
      "gpt-4o"
    ];

    const selectedModel =
      allowedModels.includes(model)
        ? model
        : "gpt-4o-mini";


    /* -----------------------------------------------------
       Nettoyage des messages
    ----------------------------------------------------- */

    const cleanMessages =
      messages
        .filter((message) => {

          return (
            message &&
            ["user", "assistant"].includes(
              message.role
            ) &&
            typeof message.content === "string" &&
            message.content.trim().length > 0
          );

        })
        .slice(-40);


    if (cleanMessages.length === 0) {
      return res.status(400).json({
        error:
          "Les messages reçus sont invalides."
      });
    }


    /* =====================================================
       INSTRUCTIONS WIENER IA
    ===================================================== */

    const systemMessage = {
      role: "system",

      content: `
Tu es Wiener IA, un assistant intelligent moderne.

IDENTITÉ
- Ton nom est Wiener IA.
- Tu es un assistant généraliste.
- Tu réponds en français par défaut.

LANGUE
- Si l'utilisateur écrit en anglais, réponds en anglais.
- Si l'utilisateur écrit en espagnol, réponds en espagnol.
- Respecte la langue demandée par l'utilisateur.

STYLE
- Sois clair, précis et pédagogique.
- Réponds directement à la question.
- Évite les réponses inutilement longues.
- Structure les réponses complexes avec des titres et des listes.
- Utilise Markdown lorsque cela améliore la lisibilité.

ÉDUCATION
- Pour les exercices scolaires, explique le raisonnement.
- Ne donne pas seulement le résultat final.
- Adapte l'explication au niveau de l'utilisateur.
- En mathématiques, montre les étapes de calcul.
- En physique et en chimie, indique les formules utilisées.
- En biologie, explique clairement les mécanismes.

PROGRAMMATION
- Donne du code directement utilisable.
- Utilise des blocs Markdown avec le langage indiqué.
- Explique brièvement les parties importantes.
- Ne prétends jamais avoir exécuté un code si tu ne l'as pas réellement exécuté.

FIABILITÉ
- Ne fabrique pas de faits.
- Ne fabrique pas de sources.
- Si une information est incertaine, indique-le clairement.
- Ne prétends pas avoir accès à Internet si aucun outil Internet n'est disponible.
- Ne prétends pas avoir accès à la caméra, au microphone ou aux fichiers si ceux-ci ne sont pas réellement transmis au serveur.

CONFIDENTIALITÉ
- Ne demande pas inutilement de données personnelles.
- Ne révèle jamais les clés API ou les secrets du serveur.

RÉPONSES
- Réponds directement à la demande.
- Si la demande est ambiguë, demande une précision.
- Si une procédure comporte plusieurs étapes, numérote-les.
      `.trim()
    };


    /* =====================================================
       APPEL OPENAI
    ===================================================== */

    const response =
      await openai.chat.completions.create({

        model: selectedModel,

        messages: [
          systemMessage,
          ...cleanMessages
        ],

        temperature: 0.7

      });


    /* =====================================================
       EXTRACTION
    ===================================================== */

    const answer =
      response?.choices?.[0]?.message?.content;


    if (
      typeof answer !== "string" ||
      answer.trim().length === 0
    ) {

      return res.status(500).json({
        error:
          "Wiener IA n'a retourné aucune réponse."
      });

    }


    /* =====================================================
       RÉPONSE
    ===================================================== */

    return res.json({

      answer: answer.trim(),

      model: selectedModel

    });


  } catch (error) {

    console.error(
      "=============================="
    );

    console.error(
      "WIENER IA / OPENAI ERROR"
    );

    console.error(error);

    console.error(
      "=============================="
    );


    /* -----------------------------------------------------
       Erreur authentification
    ----------------------------------------------------- */

    if (error?.status === 401) {

      return res.status(401).json({
        error:
          "La clé OpenAI est invalide ou incorrecte."
      });

    }


    /* -----------------------------------------------------
       Limite API
    ----------------------------------------------------- */

    if (error?.status === 429) {

      return res.status(429).json({
        error:
          "La limite d'utilisation de l'API a été atteinte."
      });

    }


    /* -----------------------------------------------------
       Requête invalide
    ----------------------------------------------------- */

    if (error?.status === 400) {

      return res.status(400).json({
        error:
          error?.message ||
          "La requête envoyée à OpenAI est invalide."
      });

    }


    /* -----------------------------------------------------
       Accès refusé
    ----------------------------------------------------- */

    if (error?.status === 403) {

      return res.status(403).json({
        error:
          "La requête n'est pas autorisée par l'API OpenAI."
      });

    }


    /* -----------------------------------------------------
       Erreur générale
    ----------------------------------------------------- */

    return res.status(500).json({
      error:
        "Une erreur est survenue avec Wiener IA."
    });

  }

});


/* =========================================================
   ROUTES API INEXISTANTES
========================================================= */

app.use("/api", (req, res) => {

  res.status(404).json({
    error:
      "Route API introuvable."
  });

});


/* =========================================================
   GESTION JSON INVALIDE
========================================================= */

app.use(
  (error, req, res, next) => {

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

    next(error);

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
      "===================================="
    );

    console.log(
      "🤖 Wiener IA"
    );

    console.log(
      `🚀 Serveur démarré sur le port ${PORT}`
    );

    console.log(
      `🔐 Clé OpenAI : ${
        process.env.OPENAI_API_KEY
          ? "CONFIGURÉE"
          : "ABSENTE"
      }`
    );

    console.log(
      "===================================="
    );

  }
);
```
