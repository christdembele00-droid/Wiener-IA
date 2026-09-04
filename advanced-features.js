"use strict";

(() => {
  const API_URL = window.WienerIA?.API_URL || "https://wiener-ia.onrender.com";
  const messages = document.getElementById("messages");
  const userInput = document.getElementById("userInput");

  async function json(url, options = {}) {
    const response = await fetch(url, { ...options, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur HTTP ${response.status}`);
    return data;
  }

  function addCopyButtons() {
    if (!messages || messages.dataset.copyReady === "1") return;
    messages.dataset.copyReady = "1";

    const addToMessage = message => {
      if (!message || !message.classList.contains("assistant") || message.dataset.copyReady === "1") return;
      const body = message.querySelector(".message-content");
      if (!body || message.querySelector(".wiener-message-actions")) return;

      message.dataset.copyReady = "1";
      const actions = document.createElement("div");
      actions.className = "wiener-message-actions";
      actions.setAttribute("aria-label", "Actions de la réponse");

      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "wiener-copy-btn";
      copy.title = "Copier";
      copy.setAttribute("aria-label", "Copier la réponse");
      copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9z"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

      copy.addEventListener("click", async event => {
        event.stopPropagation();
        const text = body.innerText || body.textContent || "";
        try {
          await navigator.clipboard.writeText(text);
          copy.title = "Copié";
          copy.setAttribute("aria-label", "Réponse copiée");
          copy.classList.add("is-copied");
          copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
          window.setTimeout(() => {
            copy.title = "Copier";
            copy.setAttribute("aria-label", "Copier la réponse");
            copy.classList.remove("is-copied");
            copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9z"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1400);
        } catch (_) {
          copy.title = "Copie impossible";
          window.setTimeout(() => { copy.title = "Copier"; }, 1400);
        }
      });

      actions.appendChild(copy);
      message.appendChild(actions);
    };

    messages.querySelectorAll(".message.assistant").forEach(addToMessage);
    const observer = new MutationObserver(() => {
      messages.querySelectorAll(".message.assistant").forEach(addToMessage);
    });
    observer.observe(messages, { childList: true, subtree: true });
  }

  function exportConversation() {
    if (!messages) return;
    const rows = [...messages.querySelectorAll(".message")].map(m => {
      const role = m.classList.contains("user") ? "Vous" : "Wiener IA";
      const text = m.querySelector(".message-content")?.innerText || m.innerText || "";
      return `${role}\n${text.trim()}`;
    }).filter(Boolean);
    if (!rows.length) return;
    const blob = new Blob([`Wiener IA — Conversation\n\n${rows.join("\n\n")}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wiener-ia-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshCapabilities() {
    try {
      const data = await json(`${API_URL}/api/health`);
      document.documentElement.dataset.wienerOnline = data.ok ? "true" : "false";
      document.documentElement.dataset.wienerMemory = String(data.memoryCount ?? 0);
      window.WienerCapabilities = data;
      return data;
    } catch (_) {
      document.documentElement.dataset.wienerOnline = "false";
      return null;
    }
  }

  async function contextStatus() {
    try { return await json(`${API_URL}/api/context/status`); }
    catch (_) { return null; }
  }

  async function searchContext(query, limit = 8) {
    return json(`${API_URL}/api/context/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit })
    });
  }

  async function ingestContext(entry) {
    return json(`${API_URL}/api/context/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  }

  function shortcuts() {
    document.addEventListener("keydown", event => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "e") { event.preventDefault(); exportConversation(); }
      if (key === "n") { event.preventDefault(); document.getElementById("newChatBtn")?.click(); }
      if (key === "k") { event.preventDefault(); userInput?.focus(); }
    });
  }

  window.WienerAdvanced = { exportConversation, refreshCapabilities, contextStatus, searchContext, ingestContext };
  addCopyButtons();
  shortcuts();
  refreshCapabilities();
})();
