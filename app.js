````javascript
"use strict";

/*
 * =========================================================
 * WIENER IA — APP.JS FINAL
 * Frontend GitHub Pages → Backend Node.js/Gemini
 * =========================================================
 *
 * IMPORTANT :
 * Remplace API_BASE_URL par l'URL HTTPS publique de ton
 * serveur Node.js.
 *
 * Exemple :
 * const API_BASE_URL = "https://wiener-ia.onrender.com";
 */

const API_BASE_URL = "https://TON-SERVEUR-BACKEND.com";

/* =========================================================
   ÉLÉMENTS HTML
========================================================= */

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

const menuItems = document.querySelectorAll(".menu-item");

/* =========================================================
   ÉTAT
========================================================= */

let currentMode = "chat";
let history = [];

/* =========================================================
   MODES
========================================================= */

menuItems.forEach((button) => {
    button.addEventListener("click", () => {
        menuItems.forEach((item) => {
            item.style.background = "#202020";
        });

        button.style.background = "#10A37F";

        currentMode = button.dataset.mode;

        updatePlaceholder();
    });
});

/* =========================================================
   PLACEHOLDER
========================================================= */

function updatePlaceholder() {
    const placeholders = {
        chat: "Envoyez un message à Wiener IA...",
        exercise: "Entrez votre exercice...",
        search: "Que voulez-vous rechercher sur Internet ?",
        image: "Décrivez l'image que vous voulez créer...",
        pdf: "Décrivez ce que vous voulez analyser...",
        calculator: "Exemple : (25 + 5) * 2"
    };

    userInput.placeholder =
        placeholders[currentMode] ||
        placeholders.chat;
}

/* =========================================================
   NOUVELLE CONVERSATION
========================================================= */

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

    welcome.style.display = "block";

    userInput.value = "";
    userInput.focus();
});

/* =========================================================
   ENTRÉE CLAVIER
========================================================= */

userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

/* =========================================================
   BOUTON ENVOYER
========================================================= */

sendBtn.addEventListener("click", sendMessage);

/* =========================================================
   ÉCHAPPEMENT HTML
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   MARKDOWN SIMPLE
========================================================= */

function formatResponse(text) {
    if (!text) {
        return "";
    }

    let html = escapeHTML(text);

    /*
     * Code blocks
     */
    html = html.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

    /*
     * Gras
     */
    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    /*
     * Italique
     */
    html = html.replace(
        /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );

    /*
     * Liens
     */
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    /*
     * Retours à la ligne
     */
    html = html.replace(/\n/g, "<br>");

    return html;
}

/* =========================================================
   AJOUTER MESSAGE
========================================================= */

function addMessage(content, role) {
    const div = document.createElement("div");

    div.className =
        role === "user"
            ? "message user"
            : "message assistant";

    if (role === "user") {
        div.textContent = content;
    } else {
        div.innerHTML = formatResponse(content);
    }

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;

    return div;
}

/* =========================================================
   LOADING
========================================================= */

function addLoadingMessage() {
    const loading = document.createElement("div");

    loading.className = "message assistant";

    loading.innerHTML =
        "⏳ <b>Wiener IA réfléchit...</b>";

    messages.appendChild(loading);

    messages.scrollTop = messages.scrollHeight;

    return loading;
}

/* =========================================================
   REQUÊTE API
========================================================= */

async function apiRequest(endpoint, body) {
    const url =
        API_BASE_URL.replace(/\/$/, "") +
        endpoint;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `Le serveur a retourné une réponse invalide (${response.status}).`
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.error ||
            data?.message ||
            `Erreur serveur (${response.status}).`
        );
    }

    return data;
}

/* =========================================================
   CHAT
========================================================= */

async function sendChat(text) {
    const updatedHistory = [
        ...history,
        {
            role: "user",
            content: text
        }
    ];

    const data = await apiRequest(
        "/api/chat",
        {
            messages: updatedHistory
        }
    );

    return (
        data.answer ||
        data.response ||
        data.text ||
        data.message ||
        "Wiener IA n'a retourné aucune réponse."
    );
}

/* =========================================================
   EXERCICES
========================================================= */

async function sendExercise(text) {
    const data = await apiRequest(
        "/api/exercises",
        {
            question: text,
            level: "non précisé",
            subject: "non précisée"
        }
    );

    return (
        data.answer ||
        data.response ||
        data.text ||
        data.message ||
        "Aucune solution n'a été retournée."
    );
}

/* =========================================================
   RECHERCHE WEB
========================================================= */

async function sendSearch(text) {
    const data = await apiRequest(
        "/api/search",
        {
            query: text
        }
    );

    let answer =
        data.answer ||
        data.response ||
        data.text ||
        data.message ||
        "Aucun résultat retourné.";

    /*
     * Afficher les sources retournées par Gemini.
     */

    if (
        Array.isArray(data.sources) &&
        data.sources.length
    ) {
        answer += "\n\n### Sources\n\n";

        data.sources.forEach((source) => {
            if (
                source &&
                source.url
            ) {
                answer +=
                    `- ${source.title || "Source"} : ${source.url}\n`;
            }
        });
    }

    return answer;
}

/* =========================================================
   GÉNÉRATION D'IMAGE
========================================================= */

async function sendImage(text) {
    const data = await apiRequest(
        "/api/image",
        {
            prompt: text
        }
    );

    if (data.image) {
        return {
            type: "image",
            image: data.image,
            text:
                data.text ||
                "Image générée par Wiener IA."
        };
    }

    return (
        data.text ||
        data.answer ||
        "Aucune image n'a été générée."
    );
}

/* =========================================================
   CALCULATRICE
========================================================= */

async function sendCalculator(text) {
    const data = await apiRequest(
        "/api/calculate",
        {
            expression: text
        }
    );

    if (
        typeof data.result !== "undefined"
    ) {
        return `🧮 Résultat : **${data.result}**`;
    }

    return (
        data.answer ||
        data.result ||
        "Aucun résultat."
    );
}

/* =========================================================
   PDF / IMAGE
========================================================= */

async function sendFileAnalysis(text) {
    /*
     * Cette fonction est utilisée si l'utilisateur écrit
     * dans le mode PDF mais n'a pas encore sélectionné de fichier.
     */

    throw new Error(
        "Pour analyser un PDF ou une image, sélectionne d'abord un fichier."
    );
}

/* =========================================================
   AFFICHAGE IMAGE
========================================================= */

function addGeneratedImage(result) {
    const div = document.createElement("div");

    div.className = "message assistant";

    const image = document.createElement("img");

    image.src = result.image;

    image.alt =
        "Image générée par Wiener IA";

    image.style.maxWidth = "100%";
    image.style.borderRadius = "14px";
    image.style.display = "block";
    image.style.marginBottom = "12px";

    div.appendChild(image);

    if (result.text) {
        const text = document.createElement("div");

        text.innerHTML =
            formatResponse(result.text);

        div.appendChild(text);
    }

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;
}

/* =========================================================
   ENVOI PRINCIPAL
========================================================= */

async function sendMessage() {
    const text =
        userInput.value.trim();

    if (!text) {
        return;
    }

    if (
        !API_BASE_URL ||
        API_BASE_URL.includes("TON-SERVEUR")
    ) {
        addMessage(
            "❌ L'URL du serveur backend n'est pas encore configurée dans app.js.",
            "assistant"
        );

        return;
    }

    welcome.style.display = "none";

    addMessage(text, "user");

    userInput.value = "";

    userInput.disabled = true;
    sendBtn.disabled = true;

    const loading =
        addLoadingMessage();

    try {
        let result;

        switch (currentMode) {
            case "chat":
                result =
                    await sendChat(text);
                break;

            case "exercise":
                result =
                    await sendExercise(text);
                break;

            case "search":
                result =
                    await sendSearch(text);
                break;

            case "image":
                result =
                    await sendImage(text);
                break;

            case "calculator":
                result =
                    await sendCalculator(text);
                break;

            case "pdf":
                result =
                    await sendFileAnalysis(text);
                break;

            default:
                result =
                    await sendChat(text);
        }

        loading.remove();

        /*
         * Image générée
         */
        if (
            result &&
            typeof result === "object" &&
            result.type === "image"
        ) {
            addGeneratedImage(result);

            history.push({
                role: "user",
                content: text
            });

            history.push({
                role: "assistant",
                content:
                    result.text ||
                    "Image générée."
            });

            return;
        }

        /*
         * Réponse normale
         */
        addMessage(
            String(result),
            "assistant"
        );

        /*
         * L'historique est utilisé principalement
         * pour le mode Chat.
         */
        history.push({
            role: "user",
            content: text
        });

        history.push({
            role: "assistant",
            content: String(result)
        });

    } catch (error) {
        console.error(
            "WIENER IA ERROR:",
            error
        );

        loading.remove();

        addMessage(
            `❌ ${error.message || "Erreur de connexion avec Wiener IA."}`,
            "assistant"
        );
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;

        userInput.focus();
    }
}

/* =========================================================
   TEST DU SERVEUR
========================================================= */

async function checkServer() {
    try {
        const url =
            API_BASE_URL.replace(/\/$/, "") +
            "/api/health";

        const response =
            await fetch(url, {
                method: "GET"
            });

        if (!response.ok) {
            throw new Error(
                "Serveur indisponible."
            );
        }

        const data =
            await response.json();

        console.log(
            "✅ Wiener IA backend connecté",
            data
        );

        return true;

    } catch (error) {
        console.warn(
            "⚠️ Backend Wiener IA inaccessible :",
            error.message
        );

        return false;
    }
}

/* =========================================================
   INITIALISATION
========================================================= */

updatePlaceholder();

if (
    API_BASE_URL &&
    !API_BASE_URL.includes("TON-SERVEUR")
) {
    checkServer();
}

console.log(
    "🤖 Wiener IA — frontend chargé."
);
````
