"use strict";

const fs = require("fs");
const path = require("path");

class MemoryStore {
  constructor(filePath = process.env.WIENER_MEMORY_FILE || path.join(__dirname, "data", "memory.json")) {
    this.filePath = filePath;
    this.maxItems = 500;
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
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: role === "assistant" ? "assistant" : "user",
      content: text.slice(0, 20000),
      metadata,
      timestamp: new Date().toISOString()
    };
    this.items.push(item);
    this.items = this.items.slice(-this.maxItems);
    this.save();
    return item;
  }

  search(query, limit = 8) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return [];
    const tokens = [...new Set(q.split(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/i).filter(t => t.length >= 3))];
    if (!tokens.length) return [];
    return this.items
      .map(item => {
        const text = item.content.toLowerCase();
        const score = tokens.reduce((n, token) => n + (text.includes(token) ? 1 : 0), 0);
        return { item, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.item.timestamp.localeCompare(a.item.timestamp))
      .slice(0, limit)
      .map(x => x.item);
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
