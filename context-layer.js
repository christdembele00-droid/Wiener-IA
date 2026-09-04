"use strict";

const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "wiener-context.json");
const MAX_ITEMS = 2000;
const MAX_TEXT = 12000;

const DEFAULT_CONTEXT = {
  version: 1,
  models: [],
  metrics: [],
  relationships: [],
  instructions: [],
  examples: [],
  facts: []
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE, "utf8"));
    return { ...DEFAULT_CONTEXT, ...parsed };
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULT_CONTEXT));
  }
}

function save(data) {
  const tmp = `${STORE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, STORE);
}

function tokenize(text) {
  return [...new Set(normalizeText(text).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9_]+/).filter(t => t.length > 2))];
}

function score(query, text) {
  const q = tokenize(query);
  const t = new Set(tokenize(text));
  if (!q.length) return 0;
  let hits = 0;
  for (const token of q) if (t.has(token)) hits++;
  return hits / q.length;
}

function allEntries(data) {
  const groups = [
    ["model", data.models], ["metric", data.metrics],
    ["relationship", data.relationships], ["instruction", data.instructions],
    ["example", data.examples], ["fact", data.facts]
  ];
  return groups.flatMap(([type, items]) => (Array.isArray(items) ? items : []).map(item => ({ ...item, type })));
}

function validate(data) {
  const errors = [];
  const warnings = [];
  for (const field of Object.keys(DEFAULT_CONTEXT)) {
    if (field === "version") continue;
    if (!Array.isArray(data[field])) errors.push(`${field} doit être une liste.`);
  }
  for (const model of data.models || []) {
    if (!normalizeText(model.name)) errors.push("Chaque modèle doit avoir un nom.");
    if (!normalizeText(model.source)) warnings.push(`Modèle ${model.name || "sans nom"}: source non définie.`);
  }
  for (const metric of data.metrics || []) {
    if (!normalizeText(metric.name)) errors.push("Chaque métrique doit avoir un nom.");
    if (!normalizeText(metric.definition)) errors.push(`Métrique ${metric.name || "sans nom"}: définition manquante.`);
  }
  for (const rel of data.relationships || []) {
    if (!normalizeText(rel.from) || !normalizeText(rel.to)) errors.push("Chaque relation doit définir from et to.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

function add(type, item) {
  const data = load();
  const allowed = new Set(["models", "metrics", "relationships", "instructions", "examples", "facts"]);
  if (!allowed.has(type)) throw new Error("Type de contexte non pris en charge.");
  if (!item || typeof item !== "object") throw new Error("Entrée de contexte invalide.");
  const copy = { ...item };
  for (const key of Object.keys(copy)) if (typeof copy[key] === "string") copy[key] = normalizeText(copy[key]);
  data[type].push({ id: copy.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...copy, updatedAt: new Date().toISOString() });
  data[type] = data[type].slice(-MAX_ITEMS);
  save(data);
  return data[type][data[type].length - 1];
}

function search(query, limit = 8) {
  const data = load();
  return allEntries(data)
    .map(item => ({ ...item, score: score(query, JSON.stringify(item)) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 8, 30)));
}

function buildPromptContext(query, limit = 8) {
  const matches = search(query, limit);
  if (!matches.length) return "";
  return [
    "CONTEXTE WIENER IA — couche sémantique gouvernée.",
    "Utilise ces éléments comme contexte vérifiable; si une information manque, ne l'invente pas.",
    ...matches.map((m, i) => `${i + 1}. [${m.type}] ${JSON.stringify(m)}`)
  ].join("\n");
}

function status() {
  const data = load();
  return {
    version: data.version,
    counts: Object.fromEntries(Object.keys(DEFAULT_CONTEXT).filter(k => k !== "version").map(k => [k, Array.isArray(data[k]) ? data[k].length : 0])),
    validation: validate(data)
  };
}

module.exports = { load, save, add, search, buildPromptContext, validate, status, STORE };
