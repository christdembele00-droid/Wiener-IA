"use strict";

const express = require("express");
const { GoogleGenAI: OriginalGoogleGenAI } = require("@google/genai");
const brain = require("./brain-orchestrator");

const BRAIN_VERSION = "1.0.0";
const SELF_CHECK = `\nMODELE COGNITIF WIENER IA:\nAvant de répondre, effectue silencieusement une boucle: comprendre l'intention → vérifier le contexte → choisir les outils pertinents → contrôler les hypothèses → répondre. Si une information est incertaine, récente ou susceptible d'avoir changé, utilise une source disponible plutôt que de la deviner. Distingue faits, déductions et incertitudes. Ne prétends jamais avoir exécuté une action ou vérifié une source si ce n'est pas réellement le cas. Cette capacité est une auto-surveillance fonctionnelle, pas une conscience biologique ou une expérience subjective.`;

function textFromContents(contents) {
  if (typeof contents === "string") return contents;
  if (!Array.isArray(contents)) return "";
  return contents.flatMap(item => {
    if (typeof item === "string") return [item];
    if (typeof item?.content === "string") return [item.content];
    if (Array.isArray(item?.parts)) return item.parts.filter(p => typeof p?.text === "string").map(p => p.text);
    return [];
  }).join("\n");
}

function installGoogleBrain() {
  class WienerGoogleGenAI extends OriginalGoogleGenAI {
    constructor(...args) {
      super(...args);
      if (!this.models || typeof this.models.generateContent !== "function") return;
      const original = this.models.generateContent.bind(this.models);
      this.models.generateContent = async options => {
        const query = textFromContents(options?.contents);
        const state = brain.classify(query);
        const instruction = brain.buildInstruction(query, state) + SELF_CHECK;
        const config = { ...(options?.config || {}) };
        config.systemInstruction = [config.systemInstruction, instruction].filter(Boolean).join("\n");

        // Auto-ground conversational requests that need current information.
        // Explicit search routes keep their existing tools unchanged.
        if (state.search) {
          const tools = Array.isArray(config.tools) ? [...config.tools] : [];
          if (!tools.some(t => t && typeof t === "object" && Object.prototype.hasOwnProperty.call(t, "googleSearch"))) {
            tools.push({ googleSearch: {} });
          }
          config.tools = tools;
        }

        return original({ ...options, config });
      };
    }
  }

  const exported = require("@google/genai");
  require.cache[require.resolve("@google/genai")].exports = { ...exported, GoogleGenAI: WienerGoogleGenAI };
}

installGoogleBrain();

// Add lightweight, auditable brain endpoints without rewriting server.js.
const originalExpress = express;
function wrappedExpress(...args) {
  const app = originalExpress(...args);
  const originalGet = app.get.bind(app);
  const originalPost = app.post.bind(app);

  app.get = function patchedGet(route, ...handlers) {
    if (route === "/api/brain/status") {
      return originalGet(route, (req, res) => res.json({
        ok: true,
        version: BRAIN_VERSION,
        capabilities: [
          "classification", "planning", "context-awareness", "self-check",
          "uncertainty-detection", "automatic-google-grounding", "tool-selection"
        ],
        note: "Conscience fonctionnelle: auto-surveillance et orchestration, sans prétention de conscience subjective."
      }));
    }
    return originalGet(route, ...handlers);
  };

  app.post = function patchedPost(route, ...handlers) {
    if (route === "/api/brain/analyze") {
      return originalPost(route, (req, res) => {
        const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
        if (!query) return res.status(400).json({ error: "Requête vide." });
        const state = brain.classify(query);
        res.json({ ok: true, query, state, plan: brain.buildPlan(query, state), instruction: brain.buildInstruction(query, state) });
      });
    }
    return originalPost(route, ...handlers);
  };

  return app;
}
Object.assign(wrappedExpress, originalExpress);
Object.setPrototypeOf(wrappedExpress, Object.getPrototypeOf(originalExpress));
require.cache[require.resolve("express")].exports = wrappedExpress;
