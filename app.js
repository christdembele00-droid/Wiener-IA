const API_URL = "https://wiener-ia.onrender.com";

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

let history = [];
let currentMode = "chat";

/* ==========================
MODES
========================== */

document.querySelectorAll(".menu-item").forEach((btn) => {
btn.addEventListener("click", () => {

```
    document.querySelectorAll(".menu-item").forEach((b) => {
        b.style.background = "#202020";
    });

    btn.style.background = "#10A37F";
    currentMode = btn.dataset.mode;
});
```

});

/* ==========================
AJOUTER MESSAGE
========================== */

function addMessage(content, role) {

```
const div = document.createElement("div");

div.className =
    role === "user"
        ? "message user"
        : "message assistant";

div.innerHTML = content;

messages.appendChild(div);

messages.scrollTop = messages.scrollHeight;
```

}

/* ==========================
NOUVELLE CONVERSATION
========================== */

if (newChatBtn) {

```
newChatBtn.addEventListener("click", () => {

    history = [];

    messages.innerHTML = `
        <div class="message assistant">
            👋 Bonjour !
            <br><br>
            Je suis <b>Wiener IA</b>.
            <br><br>
            Comment puis-je vous aider aujourd'hui ?
        </div>
    `;

    if (welcome) {
        welcome.style.display = "block";
    }

    if (userInput) {
        userInput.value = "";
        userInput.focus();
    }
});
```

}

/* ==========================
ENVOI PAR ENTRÉE
========================== */

if (userInput) {

```
userInput.addEventListener("keydown", (e) => {

    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
```

}

/* ==========================
BOUTON ENVOYER
========================== */

if (sendBtn) {
sendBtn.addEventListener("click", sendMessage);
}

/* ==========================
ENVOI MESSAGE
========================== */

async function sendMessage() {

```
const text = userInput.value.trim();

if (!text) {
    return;
}

if (welcome) {
    welcome.style.display = "none";
}

addMessage(text, "user");

userInput.value = "";

const loading = document.createElement("div");

loading.className = "message assistant";
loading.innerHTML = "⏳ Wiener IA réfléchit...";

messages.appendChild(loading);

messages.scrollTop = messages.scrollHeight;

try {

    let endpoint = "/api/chat";
    let body = {};

    switch (currentMode) {

        case "exercise":
            endpoint = "/api/exercises";

            body = {
                question: text,
                level: "Non précisé",
                subject: "Non précisée"
            };
            break;

        case "search":
            endpoint = "/api/search";

            body = {
                query: text
            };
            break;

        case "calculator":
            endpoint = "/api/calculate";

            body = {
                expression: text
            };
            break;

        default:

            history.push({
                role: "user",
                content: text
            });

            body = {
                messages: history
            };
    }

    const response = await fetch(
        API_URL + endpoint,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(body)
        }
    );

    const data = await response.json();

    loading.remove();

    const answer =
        data.answer ||
        data.result ||
        data.response ||
        data.text ||
        data.message ||
        data.error ||
        "Aucune réponse.";

    addMessage(answer, "assistant");

    if (currentMode === "chat") {

        history.push({
            role: "assistant",
            content: answer
        });
    }

} catch (error) {

    loading.remove();

    addMessage(
        "❌ Serveur Wiener IA inaccessible.",
        "assistant"
    );

    console.error(
        "❌ Impossible de contacter Wiener IA :",
        error
    );
}
```

}

/* ==========================
TEST SERVEUR
========================== */

async function checkServer() {

```
try {

    const response = await fetch(
        API_URL + "/api/health"
    );

    const data = await response.json();

    console.log(
        "✅ Wiener IA connectée :",
        data
    );

} catch (error) {

    console.error(
        "❌ Serveur Wiener IA inaccessible :",
        error
    );
}
```

}

checkServer();
