const API_URL = "https://wiener-ia.onrender.com";

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

let history = [];
let currentMode = "chat";
let lastCausalState = null;
let memoryCount = 0;

function addMessage(content, role) {
  const div = document.createElement("div");
  div.className = role === "user" ? "message user" : "message assistant";
  div.textContent = String(content ?? "");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function addImageMessage(dataUrl) {
  const div = document.createElement("div");
  div.className = "message assistant";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Image générée par Wiener IA";
  img.style.maxWidth = "100%";
  img.style.maxHeight = "700px";
  img.style.borderRadius = "12px";
  img.style.display = "block";
  div.appendChild(img);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showCausalTrace(causal, extra = {}) {
  if (!causal || !messages) return;
  lastCausalState = causal;
  const d = causal.D || {};
  const f = causal.F || {};
  const s = causal.S || {};
  const count = Number(extra.memoryCount ?? memoryCount ?? 0);
  const trace = document.createElement("div");
  trace.className = "message assistant";
  trace.textContent = `Analyse fonctionnelle — D: ${d.task || "unknown"} | pertinence: ${d.relevance || "unknown"} | complexité: ${Number(d.complexity || 0).toFixed(2)} | F: profondeur=${f.depth || "normal"}, vérification=${f.verify ? "oui" : "non"}, recherche=${f.search ? "oui" : "non"} | mémoire: ${count} éléments | épisodes: ${Number(s.episodes || 0)}.`;
  trace.style.opacity = "0.72";
  trace.style.fontSize = "0.82em";
  messages.appendChild(trace);
  messages.scrollTop = messages.scrollHeight;
}

document.querySelectorAll(".menu-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode || "chat";
    if (currentMode === "image") addMessage("Mode image activé. Décris l'image que tu veux générer.", "assistant");
    if (currentMode === "pdf") addMessage("Mode documents activé. Ajoute un PDF ou une image avec le trombone, puis pose ta question.", "assistant");
    if (currentMode === "search") addMessage("Mode Recherche Web activé. Wiener IA utilisera la recherche Google lorsque nécessaire.", "assistant");
  });
});

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    history = [];
    lastCausalState = null;
    messages.innerHTML = `<div class="message assistant">👋 Bonjour !<br><br>Je suis <b>Wiener IA</b>.<br><br>Comment puis-je vous aider aujourd'hui ?</div>`;
    if (welcome) welcome.style.display = "block";
    if (userInput) { userInput.value = ""; userInput.focus(); }
  });
}

if (userInput) {
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}
if (sendBtn) sendBtn.addEventListener("click", sendMessage);

async function sendFile(file, prompt) {
  const form = new FormData();
  form.append("file", file);
  form.append("prompt", prompt || "Analyse ce fichier et réponds à ma question.");
  const response = await fetch(API_URL + "/api/analyze-file", { method: "POST", body: form, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur fichier HTTP ${response.status}`);
  if (data.causal) showCausalTrace(data.causal, data);
  return data;
}

async function sendImage(prompt) {
  const response = await fetch(API_URL + "/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur image HTTP ${response.status}`);
  if (data.image) addImageMessage(data.image);
  if (data.causal) showCausalTrace(data.causal, data);
  return data;
}

async function sendMessage() {
  if (!userInput || !messages) return;
  const text = userInput.value.trim();
  const selectedFile = window.wienerSelectedFile || null;
  if (!text && !selectedFile) return;

  if (welcome) welcome.style.display = "none";
  if (text) addMessage(text, "user");
  userInput.value = "";
  const loading = document.createElement("div");
  loading.className = "message assistant";
  loading.textContent = "⏳ Wiener IA réfléchit...";
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;

  try {
    if (selectedFile) {
      const data = await sendFile(selectedFile, text);
      loading.remove();
      addMessage(data.answer, "assistant");
      removeSelectedFile();
      return;
    }

    if (currentMode === "image") {
      const data = await sendImage(text);
      loading.remove();
      if (!data.image) addMessage("Le modèle image n'a pas retourné d'image.", "assistant");
      return;
    }

    let endpoint = "/api/chat";
    let body;
    let shouldAddToHistory = false;
    if (currentMode === "exercise") {
      endpoint = "/api/exercises";
      body = { question: text, level: "Non précisé", subject: "Non précisée" };
    } else if (currentMode === "search") {
      endpoint = "/api/search";
      body = { query: text };
    } else if (currentMode === "calculator") {
      endpoint = "/api/calculate";
      body = { expression: text };
    } else if (currentMode === "pdf") {
      endpoint = "/api/analyze";
      body = { text };
    } else {
      shouldAddToHistory = true;
      history.push({ role: "user", content: text });
      body = { messages: history };
    }

    const response = await fetch(API_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    loading.remove();
    if (!response.ok) throw new Error(data.error || `Erreur serveur HTTP ${response.status}`);
    const answer = data.answer ?? data.result ?? data.response ?? data.analysis ?? data.text ?? data.message;
    if (answer === undefined || answer === null || String(answer).trim() === "") throw new Error("Le serveur n'a retourné aucune réponse.");
    addMessage(answer, "assistant");
    if (shouldAddToHistory) history.push({ role: "assistant", content: String(answer) });
    if (Number.isFinite(Number(data.memoryCount))) memoryCount = Number(data.memoryCount);
    if (data.causal) showCausalTrace(data.causal, data);
  } catch (error) {
    loading.remove();
    addMessage("❌ " + (error.message || "Serveur Wiener IA inaccessible."), "assistant");
    console.error("Wiener IA:", error);
  }
}

function removeSelectedFile() {
  const input = document.getElementById("fileInput");
  const preview = document.getElementById("filePreview");
  if (input) input.value = "";
  window.wienerSelectedFile = null;
  if (preview) preview.hidden = true;
  if (userInput) userInput.placeholder = "Envoyez un message à Wiener IA...";
}

async function analyzeFunctionally(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const response = await fetch(API_URL + "/api/consciousness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur analyse HTTP ${response.status}`);
  if (data.causal) showCausalTrace(data.causal, data);
  return data;
}

async function getCausalState() {
  const response = await fetch(API_URL + "/api/causal/state", { cache: "no-store" });
  if (!response.ok) throw new Error(`Erreur état causal HTTP ${response.status}`);
  return response.json();
}

async function getMemory() {
  const response = await fetch(API_URL + "/api/memory", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur mémoire HTTP ${response.status}`);
  memoryCount = Number(data.count || 0);
  return data;
}

async function remember(content, role = "user") {
  const value = String(content || "").trim();
  if (!value) return null;
  const response = await fetch(API_URL + "/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value, role }), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur mémoire HTTP ${response.status}`);
  memoryCount = Number(data.count || memoryCount);
  return data;
}

async function clearMemory() {
  const response = await fetch(API_URL + "/api/memory", { method: "DELETE", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur suppression mémoire HTTP ${response.status}`);
  memoryCount = 0;
  return data;
}

async function checkServer() {
  try {
    const response = await fetch(API_URL + "/api/health", { cache: "no-store" });
    const data = await response.json();
    memoryCount = Number(data.memoryCount || 0);
    console.log("Wiener IA connectée :", data);
    return response.ok && data.ok === true;
  } catch (error) {
    console.error("Serveur Wiener IA inaccessible :", error);
    return false;
  }
}

window.WienerIA = { sendMessage, checkServer, analyzeFunctionally, getCausalState, getMemory, remember, clearMemory, sendFile, sendImage };
checkServer();
