"use strict";

const fs = require("fs");
const path = require("path");

class MemoryStore {
  constructor(filePath = process.env.WIENER_MEMORY_FILE || path.join(__dirname, "data", "memory.json")) {
    this.filePath = filePath;
    this.maxItems = 1000;
    this.items = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.items = parsed.slice(-this.maxItems);
      }
    } catch (error) {
      console.error("Wiener memory load error:", error.message);
      this.items = [];
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = this.filePath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.items.slice(-this.maxItems), null, 2), "utf8");
      fs.renameSync(tmp, this.filePath);
    } catch (error) {
      console.error("Wiener memory save error:", error.message);
    }
  }

  add(role, content, metadata = {}) {
    const text = String(content || "").trim();
    if (!text) return null;
    const importance = this._importance(text, role, metadata);
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: role === "assistant" ? "assistant" : "user",
      content: text.slice(0, 20000),
      metadata: { ...metadata, importance },
      importance,
      timestamp: new Date().toISOString(),
      accessCount: 0,
      lastAccessedAt: null
    };
    this.items.push(item);
    this.items = this.items.slice(-this.maxItems);
    this.save();
    return item;
  }

  _importance(text, role, metadata = {}) {
    const t = text.toLowerCase();
    let score = role === "user" ? 0.5 : 0.35;
    if (/\b(retiens|souviens[- ]toi|mémorise|memorise|n'oublie|important|préférence|preference|je veux|mon projet|mon objectif|toujours|jamais)\b/.test(t)) score += 0.35;
    if (metadata?.mode) score += 0.05;
    if (text.length > 300) score += 0.05;
    return Math.min(1, Number(score.toFixed(2)));
  }

  search(query, limit = 8) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return [];
    const tokens = [...new Set(q.split(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/i).filter(t => t.length >= 3))];
    if (!tokens.length) return [];
    const now = Date.now();
    const results = this.items.map(item => {
      const text = String(item.content || "").toLowerCase();
      const lexical = tokens.reduce((n, token) => n + (text.includes(token) ? 1 : 0), 0) / tokens.length;
      const importance = Number(item.importance || item.metadata?.importance || 0.3);
      const ageDays = Math.max(0, (now - Date.parse(item.timestamp || 0)) / 86400000);
      const recency = Math.exp(-ageDays / 14);
      const accessBoost = Math.min(0.15, Number(item.accessCount || 0) * 0.01);
      const score = lexical * 0.65 + importance * 0.2 + recency * 0.15 + accessBoost;
      return { item, score };
    }).filter(x => x.score > 0.08).sort((a, b) => b.score - a.score || b.item.timestamp.localeCompare(a.item.timestamp));
    const selected = results.slice(0, limit).map(x => {
      x.item.accessCount = Number(x.item.accessCount || 0) + 1;
      x.item.lastAccessedAt = new Date().toISOString();
      return x.item;
    });
    if (selected.length) this.save();
    return selected;
  }

  recent(limit = 10) {
    return this.items.slice(-limit);
  }

  clear() {
    this.items = [];
    this.save();
  }

  count() {
    return this.items.length;
  }
}

module.exports = { MemoryStore };
