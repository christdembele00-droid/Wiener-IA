"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class CausalEngine {
  constructor(options = {}) {
    this.logFile = options.logFile || path.join(__dirname, "data", "h_raw.jsonl");
    this.sequence = 0;
    this.previousHash = "GENESIS";
    this.K = { observations: [], count: 0 };
    this.D = { task: "unknown", relevance: "unknown", complexity: 0, uncertainty: 0, searchNeeded: false };
    this.F = { mode: "chat", depth: "normal", verify: true, search: false };
    this.S = { episodes: 0, revisionsD: 0, revisionsF: 0, lastCause: null, history: [] };
    this._loadJournal();
  }

  _loadJournal() {
    try {
      if (!fs.existsSync(this.logFile)) return;
      const lines = fs.readFileSync(this.logFile, "utf8").split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = JSON.parse(lines[lines.length - 1]);
      this.sequence = Number(last.sequence) || 0;
      this.previousHash = last.hash || "GENESIS";
    } catch (error) {
      console.error("H_RAW load warning:", error.message);
    }
  }

  _append(type, payload) {
    const event = {
      sequence: ++this.sequence,
      timestamp: new Date().toISOString(),
      type,
      previous_hash: this.previousHash,
      payload
    };
    const canonical = JSON.stringify(event);
    event.hash = crypto.createHash("sha256").update(canonical).digest("hex");
    this.previousHash = event.hash;
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      fs.appendFileSync(this.logFile, JSON.stringify(event) + "\n", "utf8");
    } catch (error) {
      console.error("H_RAW write warning:", error.message);
    }
    return event;
  }

  observe(text, mode = "chat", history = []) {
    const observation = {
      text: String(text || "").slice(0, 20000),
      mode,
      historyLength: Array.isArray(history) ? history.length : 0
    };
    this.K.observations.push(observation);
    this.K.observations = this.K.observations.slice(-50);
    this.K.count += 1;
    this.S.episodes += 1;
    this._append("OBSERVATION", { K: observation });
    return observation;
  }

  reviseD(observation) {
    const text = observation.text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean).length;
    const task = /\b(code|javascript|python|programme|programmation|bug|erreur)\b/.test(text) ? "code"
      : /\b(calcul|équation|exercice|math|physique|chimie|svt)\b/.test(text) ? "academic"
      : /\b(cherche|recherche|actualité|aujourd|dernier|latest|prix|date)\b/.test(text) ? "research"
      : /\b(analyse|explique|compare|pourquoi|comment)\b/.test(text) ? "analysis" : "general";
    const complexity = Math.max(0, Math.min(1, (words / 120) + (text.includes("?") ? 0.1 : 0)));
    const uncertainty = /\b(peut-être|probablement|incertain|inconnu|je ne sais|vérifie|source)\b/.test(text) ? 0.55 : 0.15;
    const searchNeeded = task === "research" || /\b(source|vérifie|internet|web|récent|actualité)\b/.test(text);
    const nextD = { task, relevance: searchNeeded ? "policy_relevant" : "task_relevant", complexity, uncertainty, searchNeeded };
    const changed = JSON.stringify(nextD) !== JSON.stringify(this.D);
    const previous = this.D;
    this.D = nextD;
    this.S.revisionsD += changed ? 1 : 0;
    this._append("REVISION_D", { previous, next: nextD, changed, cause: "OBSERVATION" });
    return { previous, next: nextD, changed };
  }

  reviseF(mode, dRevision) {
    const validCause = Boolean(dRevision && dRevision.next && dRevision.next.relevance);
    const previous = this.F;
    if (!validCause) {
      this._append("REVISION_F", { previous, next: previous, changed: false, validCause: false, cause: null });
      return { previous, next: previous, changed: false, validCause: false };
    }
    const d = dRevision.next;
    const next = {
      mode,
      depth: d.complexity > 0.65 ? "deep" : d.complexity > 0.3 ? "structured" : "normal",
      verify: d.uncertainty >= 0.35 || d.task === "research" || d.task === "academic",
      search: Boolean(d.searchNeeded)
    };
    const changed = JSON.stringify(next) !== JSON.stringify(previous);
    this.F = next;
    this.S.revisionsF += changed ? 1 : 0;
    this.S.lastCause = validCause ? "REVISION_D" : null;
    this.S.history.push({ at: new Date().toISOString(), changed, cause: "REVISION_D" });
    this.S.history = this.S.history.slice(-50);
    this._append("REVISION_F", { previous, next, changed, validCause, cause: "REVISION_D" });
    return { previous, next, changed, validCause };
  }

  step(text, mode = "chat", history = []) {
    const observation = this.observe(text, mode, history);
    const dRevision = this.reviseD(observation);
    const fRevision = this.reviseF(mode, dRevision);
    const behavior = {
      search: this.F.search,
      depth: this.F.depth,
      verify: this.F.verify,
      task: this.D.task
    };
    this._append("AGENT_STEP", { K: this.K.count, D: this.D, F: this.F, S: this.S, behavior });
    return { K: this.K, D: this.D, F: this.F, S: this.S, dRevision, fRevision, behavior };
  }

  audit() {
    try {
      if (!fs.existsSync(this.logFile)) return { valid: true, events: 0, checked: 0 };
      const lines = fs.readFileSync(this.logFile, "utf8").split(/\r?\n/).filter(Boolean);
      let previous = "GENESIS";
      let expectedSequence = 1;
      for (const line of lines) {
        const event = JSON.parse(line);
        if (event.sequence !== expectedSequence) return { valid: false, error: "sequence", at: event.sequence };
        if (event.previous_hash !== previous) return { valid: false, error: "previous_hash", at: event.sequence };
        const copy = { ...event };
        delete copy.hash;
        const expectedHash = crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex");
        if (event.hash !== expectedHash) return { valid: false, error: "hash", at: event.sequence };
        previous = event.hash;
        expectedSequence += 1;
      }
      return { valid: true, events: lines.length, checked: lines.length, lastHash: previous };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  snapshot() {
    return { K: this.K, D: this.D, F: this.F, S: this.S, audit: this.audit() };
  }
}

module.exports = { CausalEngine };
