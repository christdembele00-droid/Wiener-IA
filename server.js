"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { CausalEngine } = require("./causal_engine");
const { MemoryStore } = require("./memory_store");

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
const FALLBACK_MODELS = [TEXT_MODEL, "gemini-2.5-flash", "gemini-3.7-flash", "gemini-3.8-flash"].filter((v, i, a) => v && a.indexOf(v) === i);
const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 20000;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const causal = new CausalEngine();
const memory = new MemoryStore();

app.disable("x-powered-by");
app.use(cors({ origin: true, methods: ["GET", "POST", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const WIENER_INSTRUCTIONS = `Tu es Wiener IA, un assistant généraliste intelligent, précis, pédagogique et naturel. Réponds en français par défaut. Comprends la demande avant de répondre. Pour une question simple, sois concis; pour une question complexe, structure la réponse. Ne fabrique jamais de faits, de sources ou d'actions réalisées. N'expose jamais les secrets ou clés API. Adapte les explications au niveau de l'utilisateur. Pour le code, donne du code directement utilisable et ne prétends pas l'avoir testé si ce n'est pas le cas. Utilise la politique fonctionnelle reçue par le serveur comme guide de profondeur, vérification et recherche.`;
const EXERCISE_INSTRUCTIONS = `Résous l'exercice avec rigueur. Identifie la demande, les données, la formule ou propriété utile, effectue les calculs étape par étape, vérifie le résultat et donne clairement la réponse finale. N'invente aucune donnée manquante.`;
const ANALYSIS_INSTRUCTIONS = `Effectue une analyse fonctionnelle et auditable de la demande: intention, complexité, incertitudes, informations nécessaires, stratégie de réponse et points à vérifier. Ne présente jamais cette analyse comme une conscience biologique, une expérience subjective ou un sentiment.`;

function requireGemini(res) {
  if (!ai) {
    res.status(500).json({ error: "GEMINI_API_KEY n'est pas configurée sur le serveur." });
    return false;
  }
  return true;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter(m => m && typeof m === "object" && ["user", "assistant", "model"].includes(m.role) && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role === "assistant" || m.role === "model" ? "model" : "user", content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH) }))
    .slice(-MAX_MESSAGES);
}

function toGemini(messages) { return messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })); }

function extractText(response) {
  if (typeof response?.text === "string" && response.text.trim()) return response.text.trim();
  const parts = response?.candidates?.flatMap(c => Array.isArray(c?.content?.parts) ? c.content.parts : []) || [];
  return parts.filter(p => typeof p?.text === "string").map(p => p.text).join("\n").trim();
}

function errorStatus(error) {
  return Number(error?.status) || Number(error?.statusCode) || Number(error?.response?.status) || 500;
}

function sendError(res, error) {
  console.error("Wiener IA error:", error);
  const status = errorStatus(error);
  if (status === 401 || status === 403) return res.status(status).json({ error: "La clé Gemini est invalide ou non autorisée." });
  if (status === 404) return res.status(404).json({ error: "Aucun modèle Gemini disponible pour cette clé. Vérifie le projet Google AI utilisé par GEMINI_API_KEY." });
  if (status === 429) return res.status(429).json({ error: "La limite Gemini a été atteinte. Réessaie plus tard." });
  return res.status(500).json({ error: error?.message || "Une erreur est survenue avec Gemini." });
}

async function generateContent(options) {
  let lastError = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({ ...options, model });
      return { response, model };
    } catch (error) {
      lastError = error;
      const status = errorStatus(error);
      if (![404, 400].includes(status)) throw error;
      console.warn(`Modèle Gemini indisponible: ${model}; tentative suivante.`);
    }
  }
  throw lastError || new Error("Aucun modèle Gemini disponible.");
}

function memoryContext(query) {
  const matches = memory.search(query, 6);
  if (!matches.length) return "";
  return "\nMémoire pertinente de Wiener IA (utilise-la comme contexte, pas comme vérité absolue):\n" + matches.map(m => `- ${m.role}: ${m.content}`).join("\n");
}

function causalContext(state) {
  return `\nPolitique fonctionnelle: tâche=${state.D.task}, profondeur=${state.F.depth}, vérification=${state.F.verify ? "oui" : "non"}, recherche=${state.F.search ? "oui" : "non"}.`;
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/api/health", (req, res) => res.status(200).json({ ok: true, service: "Wiener IA", geminiConfigured: Boolean(ai), textModel: TEXT_MODEL, availableModelCandidates: FALLBACK_MODELS, memoryCount: memory.count(), causalAudit: causal.audit(), time: new Date().toISOString() }));
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: "Wiener IA" }));
app.get("/api/causal/state", (req, res) => res.json(causal.snapshot()));
app.get("/api/causal/audit", (req, res) => res.json(causal.audit()));
app.get("/api/memory", (req, res) => res.json({ count: memory.count(), items: memory.recent(50) }));
app.post("/api/memory", (req, res) => {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const role = req.body?.role === "assistant" ? "assistant" : "user";
  if (!content) return res.status(400).json({ error: "Mémoire vide." });
  const item = memory.add(role, content, { source: "manual" });
  res.json({ ok: true, item, count: memory.count() });
});
app.delete("/api/memory", (req, res) => { memory.clear(); res.json({ ok: true, count: 0 }); });

app.post("/api/chat", async (req, res) => {
  try {
    if (!requireGemini(res)) return;
    let messages = cleanMessages(req.body?.messages);
    if (!messages.length && Array.isArray(req.body?.history)) messages = cleanMessages(req.body.history);
    if (!messages.length && typeof req.body?.message === "string" && req.body.message.trim()) messages = [{ role: "user", content: req.body.message.trim() }];
    if (!messages.length) return res.status(400).json({ error: "Aucun message valide n'a été reçu." });
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const query = lastUser?.content || "";
    const state = causal.step(query, "chat", messages);
    const context = memoryContext(query);
    const result = await generateContent({ contents: toGemini(messages), config: { systemInstruction: WIENER_INSTRUCTIONS + causalContext(state) + context, temperature: 0.45, maxOutputTokens: 4096 } });
    const answer = extractText(result.response);
    if (!answer) return res.status(500).json({ error: "Wiener IA n'a retourné aucune réponse." });
    memory.add("user", query, { mode: "chat" });
    memory.add("assistant", answer, { mode: "chat", model: result.model });
    res.json({ answer, model: result.model, memoryCount: memory.count(), memoryUsed: Boolean(context), causal: { K: state.K, D: state.D, F: state.F, S: state.S } });
  } catch (e) { sendError(res, e); }
});

app.post("/api/exercises", async (req, res) => {
  try {
    if (!requireGemini(res)) return;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : (typeof req.body?.message === "string" ? req.body.message.trim() : "");
    if (!question) return res.status(400).json({ error: "Aucun exercice n'a été reçu." });
    const level = typeof req.body?.level === "string" ? req.body.level.trim() : "non précisé";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "non précisée";
    const state = causal.step(question, "exercise", []);
    const result = await generateContent({ contents: [{ role: "user", parts: [{ text: `Niveau: ${level}\nMatière: ${subject}\n\nExercice:\n${question}` }] }], config: { systemInstruction: EXERCISE_INSTRUCTIONS + causalContext(state), temperature: 0.2, maxOutputTokens: 4096 } });
    const answer = extractText(result.response);
    if (!answer) return res.status(500).json({ error: "Aucune solution n'a été retournée." });
    res.json({ answer, model: result.model, causal: { D: state.D, F: state.F } });
  } catch (e) { sendError(res, e); }
});

app.post("/api/calculate", (req, res) => {
  const expression = typeof req.body?.expression === "string" ? req.body.expression.trim() : "";
  if (!expression) return res.status(400).json({ error: "Expression vide." });
  if (!/^[0-9+\-*/().,%\s^]+$/.test(expression)) return res.status(400).json({ error: "Expression non prise en charge." });
  try {
    const state = causal.step(expression, "calculator", []);
    const normalized = expression.replace(/,/g, ".").replace(/\^/g, "**").replace(/%/g, "/100");
    const result = Function(`"use strict"; return (${normalized})`)();
    if (!Number.isFinite(result)) throw new Error("Résultat non fini");
    res.json({ result: String(result), causal: { D: state.D, F: state.F } });
  } catch { res.status(400).json({ error: "Expression mathématique invalide." }); }
});

app.post("/api/search", async (req, res) => {
  try {
    if (!requireGemini(res)) return;
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) return res.status(400).json({ error: "Recherche vide." });
    const state = causal.step(query, "search", []);
    const result = await generateContent({ contents: query, config: { systemInstruction: WIENER_INSTRUCTIONS + causalContext(state), tools: [{ googleSearch: {} }], temperature: 0.2, maxOutputTokens: 4096 } });
    const answer = extractText(result.response);
    if (!answer) return res.status(500).json({ error: "Aucun résultat de recherche." });
    const groundingMetadata = result.response?.candidates?.[0]?.groundingMetadata || null;
    res.json({ answer, response: answer, model: result.model, search: true, groundingMetadata, causal: { D: state.D, F: state.F } });
  } catch (e) { sendError(res, e); }
});

app.post("/api/consciousness", async (req, res) => {
  try {
    if (!requireGemini(res)) return;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Texte manquant." });
    const state = causal.step(text, "analysis", []);
    const result = await generateContent({ contents: text, config: { systemInstruction: ANALYSIS_INSTRUCTIONS + causalContext(state), temperature: 0.2, maxOutputTokens: 2048 } });
    res.json({ analysis: extractText(result.response), functional: true, model: result.model, causal: { K: state.K, D: state.D, F: state.F, S: state.S } });
  } catch (e) { sendError(res, e); }
});

app.post("/api/analyze", async (req, res) => {
  try {
    if (!requireGemini(res)) return;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Texte à analyser manquant." });
    const state = causal.step(text, "analysis", []);
    const result = await generateContent({ contents: text, config: { systemInstruction: ANALYSIS_INSTRUCTIONS + causalContext(state), temperature: 0.2, maxOutputTokens: 2048 } });
    const analysis = extractText(result.response);
    res.json({ answer: analysis, analysis, functional: true, model: result.model, causal: { K: state.K, D: state.D, F: state.F, S: state.S } });
  } catch (e) { sendError(res, e); }
});

app.use((req, res) => res.status(404).json({ error: "Route introuvable." }));
app.listen(PORT, "0.0.0.0", () => console.log(`Wiener IA démarré sur 0.0.0.0:${PORT}`));
