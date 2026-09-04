"use strict";

const express = require("express");
const { GoogleGenAI: OriginalGoogleGenAI } = require("@google/genai");
const brain = require("./brain-orchestrator");
const capabilities = require("./brain-capabilities");
const fs = require("fs");
const path = require("path");

const BRAIN_VERSION = "2.1.0";
const DATA_DIR = path.join(__dirname, "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const SELF_CHECK = `\nMODELE COGNITIF WIENER IA:\nAvant de répondre, effectue silencieusement une boucle rapide: comprendre l'intention → vérifier le contexte → choisir les outils pertinents → contrôler les hypothèses → répondre → contrôler la cohérence. Cette préparation interne est limitée à 2 secondes maximum et doit rester proportionnée à la difficulté: demande simple = contrôle minimal et réponse immédiate; demande complexe = utiliser le temps disponible efficacement. Si une information est incertaine, récente ou susceptible d'avoir changé, utilise une source réellement disponible plutôt que de la deviner. Distingue faits, déductions et incertitudes. Ne prétends jamais avoir exécuté une action ou vérifié une source si ce n'est pas réellement le cas. Cette capacité est une auto-surveillance fonctionnelle, pas une conscience biologique ou une expérience subjective.`;

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

function loadConversations() {
  try {
    if (!fs.existsSync(CONVERSATIONS_FILE)) return [];
    const value = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}
function saveConversations(items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${CONVERSATIONS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items.slice(-500), null, 2));
  fs.renameSync(tmp, CONVERSATIONS_FILE);
}
function conversationId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function cleanTitle(value) { return String(value || "Nouvelle conversation").replace(/\s+/g, " ").trim().slice(0, 160) || "Nouvelle conversation"; }

function installGoogleBrain() {
  class WienerGoogleGenAI extends OriginalGoogleGenAI {
    constructor(...args) {
      super(...args);
      if (!this.models || typeof this.models.generateContent !== "function") return;
      const original = this.models.generateContent.bind(this.models);
      this.models.generateContent = async options => {
        const query = textFromContents(options?.contents);
        const reflection = brain.reflect(query);
        const instruction = brain.buildInstruction(query, reflection.state) + SELF_CHECK;
        const config = { ...(options?.config || {}) };
        config.systemInstruction = [config.systemInstruction, instruction].filter(Boolean).join("\n");
        if (reflection.state.search) {
          const tools = Array.isArray(config.tools) ? [...config.tools] : [];
          if (!tools.some(t => t && typeof t === "object" && Object.prototype.hasOwnProperty.call(t, "googleSearch"))) tools.push({ googleSearch: {} });
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

const originalExpress = express;
function wrappedExpress(...args) {
  const app = originalExpress(...args);
  const originalGet = app.get.bind(app);
  const originalPost = app.post.bind(app);
  const originalDelete = app.delete.bind(app);
  const originalPatch = app.patch.bind(app);

  app.get = function patchedGet(route, ...handlers) {
    if (route === "/api/brain/status") {
      return originalGet(route, (_req, res) => res.json({ ok: true, version: BRAIN_VERSION, ...capabilities.status(), orchestration: true, automaticGrounding: true, conversationStore: true, fastReflection: true, reflectionBudgetMs: brain.REFLECTION_MAX_MS }));
    }
    if (route === "/api/conversations") {
      return originalGet(route, (_req, res) => res.json({ ok: true, conversations: loadConversations().map(({ messages, ...meta }) => meta) }));
    }
    if (route === "/api/conversations/:id") {
      return originalGet(route, (req, res) => {
        const item = loadConversations().find(x => x.id === req.params.id);
        if (!item) return res.status(404).json({ error: "Conversation introuvable." });
        res.json({ ok: true, conversation: item });
      });
    }
    return originalGet(route, ...handlers);
  };

  app.post = function patchedPost(route, ...handlers) {
    if (route === "/api/brain/analyze") {
      return originalPost(route, (req, res) => {
        const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
        if (!query) return res.status(400).json({ error: "Requête vide." });
        const reflection = brain.reflect(query);
        res.json({ ok: true, query, state: reflection.state, plan: reflection.plan, reflection: { elapsedMs: reflection.elapsedMs, budgetMs: reflection.budgetMs, withinBudget: reflection.withinBudget, mode: reflection.mode }, instruction: brain.buildInstruction(query, reflection.state) });
      });
    }
    if (route === "/api/brain/verify") {
      return originalPost(route, (req, res) => {
        const query = typeof req.body?.query === "string" ? req.body.query : "";
        const answer = typeof req.body?.answer === "string" ? req.body.answer : "";
        const state = brain.classify(query);
        res.json({ ok: true, verification: brain.verifyResponse(answer, state) });
      });
    }
    if (route === "/api/conversations") {
      return originalPost(route, (req, res) => {
        const items = loadConversations();
        const now = new Date().toISOString();
        const item = { id: conversationId(), title: cleanTitle(req.body?.title), messages: Array.isArray(req.body?.messages) ? req.body.messages.slice(-200) : [], createdAt: now, updatedAt: now, archived: false, pinned: false, temporary: Boolean(req.body?.temporary), folder: String(req.body?.folder || "").slice(0, 80) };
        items.push(item); saveConversations(items); res.status(201).json({ ok: true, conversation: item });
      });
    }
    return originalPost(route, ...handlers);
  };

  app.patch = function patchedPatch(route, ...handlers) {
    if (route === "/api/conversations/:id") {
      return originalPatch(route, (req, res) => {
        const items = loadConversations();
        const item = items.find(x => x.id === req.params.id);
        if (!item) return res.status(404).json({ error: "Conversation introuvable." });
        if (req.body?.title !== undefined) item.title = cleanTitle(req.body.title);
        if (Array.isArray(req.body?.messages)) item.messages = req.body.messages.slice(-200);
        if (req.body?.archived !== undefined) item.archived = Boolean(req.body.archived);
        if (req.body?.pinned !== undefined) item.pinned = Boolean(req.body.pinned);
        if (req.body?.temporary !== undefined) item.temporary = Boolean(req.body.temporary);
        if (req.body?.folder !== undefined) item.folder = String(req.body.folder || "").slice(0, 80);
        item.updatedAt = new Date().toISOString();
        saveConversations(items); res.json({ ok: true, conversation: item });
      });
    }
    return originalPatch(route, ...handlers);
  };

  app.delete = function patchedDelete(route, ...handlers) {
    if (route === "/api/conversations/:id") {
      return originalDelete(route, (req, res) => {
        const items = loadConversations();
        const next = items.filter(x => x.id !== req.params.id);
        if (next.length === items.length) return res.status(404).json({ error: "Conversation introuvable." });
        saveConversations(next); res.json({ ok: true });
      });
    }
    if (route === "/api/conversations") {
      return originalDelete(route, (_req, res) => { saveConversations([]); res.json({ ok: true }); });
    }
    return originalDelete(route, ...handlers);
  };

  const brainMiddleware = (req, _res, next) => {
    try {
      const query = typeof req.body?.message === "string" ? req.body.message : typeof req.body?.text === "string" ? req.body.text : typeof req.body?.question === "string" ? req.body.question : Array.isArray(req.body?.messages) ? req.body.messages.map(m => m?.content || "").join(" ") : "";
      if (query) {
        const reflection = brain.reflect(query);
        req.wienerBrain = { state: reflection.state, plan: reflection.plan, instruction: brain.buildInstruction(query, reflection.state), reflection: { elapsedMs: reflection.elapsedMs, budgetMs: reflection.budgetMs, withinBudget: reflection.withinBudget, mode: reflection.mode } };
        if (Array.isArray(req.body?.messages)) req.body.messages = [...req.body.messages, { role: "user", content: `[Orchestration interne Wiener IA]\n${req.wienerBrain.instruction}` }];
      }
    } catch (_) {}
    next();
  };

  const protectedRoutes = ["/api/chat", "/api/exercises", "/api/search", "/api/analyze", "/api/consciousness"];
  protectedRoutes.forEach(route => originalPost(route, brainMiddleware));
  return app;
}
Object.assign(wrappedExpress, originalExpress);
Object.setPrototypeOf(wrappedExpress, Object.getPrototypeOf(originalExpress));
require.cache[require.resolve("express")].exports = wrappedExpress;
