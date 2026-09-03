const API_URL = "https://wiener-ia.onrender.com";

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

let history = [];
let currentMode = "chat";

function addMessage(content, role) {
  const div = document.createElement("div");
  div.className = role === "user" ? "message user" : "message assistant";
  div.textContent = String(content ?? "");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

document.querySelectorAll(".menu-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-item").forEach((b) => {
      b.style.background = "#202020";
    });
    btn.style.background = "#10A37F";
    currentMode = btn.dataset.mode || "chat";
  });
});

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    history = [];
    messages.innerHTML = `<div class="message assistant">👋 Bonjour !<br><br>Je suis <b>Wiener IA</b>.<br><br>Comment puis-je vous aider aujourd'hui ?</div>`;
    if (welcome) welcome.style.display = "block";
    if (userInput) {
      userInput.value = "";
      userInput.focus();
    }
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

async function sendMessage() {
  if (!userInput || !messages) return;
  const text = userInput.value.trim();
  if (!text) return;

  if (welcome) welcome.style.display = "none";
  addMessage(text, "user");
  userInput.value = "";

  const loading = document.createElement("div");
  loading.className = "message assistant";
  loading.textContent = "⏳ Wiener IA réfléchit...";
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;

  try {
    let endpoint = "/api/chat";
    let body;

    if (currentMode === "exercise") {
      endpoint = "/api/exercises";
      body = { question: text, level: "Non précisé", subject: "Non précisée" };
    } else if (currentMode === "search") {
      endpoint = "/api/search";
      body = { query: text };
    } else if (currentMode === "calculator") {
      endpoint = "/api/calculate";
      body = { expression: text };
    } else {
      history.push({ role: "user", content: text });
      body = { messages: history };
    }

    const response = await fetch(API_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}
    loading.remove();

    if (!response.ok) {
      throw new Error(data.error || `Erreur serveur HTTP ${response.status}`);
    }

    const answer = data.answer ?? data.result ?? data.response ?? data.text ?? data.message;
    if (answer === undefined || answer === null || String(answer).trim() === "") {
      throw new Error("Le serveur n'a retourné aucune réponse.");
    }

    addMessage(answer, "assistant");
    if (currentMode === "chat") history.push({ role: "assistant", content: String(answer) });
  } catch (error) {
    loading.remove();
    addMessage("❌ " + (error.message || "Serveur Wiener IA inaccessible."), "assistant");
    console.error("Wiener IA:", error);
  }
}

async function checkServer() {
  try {
    const response = await fetch(API_URL + "/api/health", { cache: "no-store" });
    const data = await response.json();
    console.log("Wiener IA connectée :", data);
    return response.ok && data.ok === true;
  } catch (error) {
    console.error("Serveur Wiener IA inaccessible :", error);
    return false;
  }
}

window.WienerIA = { sendMessage, checkServer };
checkServer();
