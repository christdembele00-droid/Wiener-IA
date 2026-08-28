```javascript
"use strict";

/*
=========================================================
 WIENER IA — APP.JS FINAL
 Compatible avec le serveur Express + SDK Gemini actuel
=========================================================
*/

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

const menuButtons = document.querySelectorAll(".menu-item");

let currentMode = "chat";
let history = [];

/*
=========================================================
 UTILITAIRES
=========================================================
*/

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatText(text) {
    if (text === null || text === undefined) {
        return "";
    }

    let html = escapeHTML(String(text));

    /*
    Markdown simple
    */

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    html = html.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );

    html = html.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    html = html.replace(
        /\n/g,
        "<br>"
    );

    return html;
}

function scrollMessages() {
    if (!messages) return;

    messages.scrollTop =
        messages.scrollHeight;
}

function showWelcome(show) {
    if (!welcome) return;

    welcome.style.display =
        show ? "block" : "none";
}

function setLoading(button, loading) {
    if (!button) return;

    if (loading) {
        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "⏳";

        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText ||
            "Envoyer";

        button.disabled = false;
    }
}

/*
=========================================================
 MESSAGES
=========================================================
*/

function addMessage(content, role = "assistant") {
    if (!messages) return null;

    const div =
        document.createElement("div");

    div.className =
        role === "user"
            ? "message user"
            : "message assistant";

    div.innerHTML =
        formatText(content);

    messages.appendChild(div);

    scrollMessages();

    return div;
}

function addImageMessage(image, text = "") {
    if (!messages) return;

    const div =
        document.createElement("div");

    div.className =
        "message assistant";

    let html = "";

    if (text) {
        html +=
            `<div>${formatText(text)}</div>`;
    }

    if (image) {
        html += `
            <div style="
                margin-top:15px;
                display:flex;
                flex-direction:column;
                gap:12px;
            ">
                <img
                    src="${image}"
                    alt="Image générée par Wiener IA"
                    style="
                        max-width:100%;
                        width:512px;
                        border-radius:16px;
                        display:block;
                    "
                >

                <a
                    href="${image}"
                    download="wiener-ia-image.png"
                    style="
                        display:inline-block;
                        width:max-content;
                        padding:10px 15px;
                        border-radius:10px;
                        background:#10A37F;
                        color:white;
                        text-decoration:none;
                        font-weight:600;
                    "
                >
                    ⬇️ Enregistrer l'image
                </a>
            </div>
        `;
    }

    div.innerHTML = html;

    messages.appendChild(div);

    scrollMessages();
}

function addSources(sources) {
    if (
        !Array.isArray(sources) ||
        !sources.length ||
        !messages
    ) {
        return;
    }

    const div =
        document.createElement("div");

    div.className =
        "message assistant";

    let html =
        "<strong>🔎 Sources :</strong><br><br>";

    sources.forEach((source, index) => {
        if (!source || !source.url) {
            return;
        }

        const title =
            escapeHTML(
                source.title ||
                `Source ${index + 1}`
            );

        const url =
            escapeHTML(source.url);

        html += `
            <div style="margin-bottom:10px;">
                <a
                    href="${url}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="
                        color:#10A37F;
                        text-decoration:none;
                    "
                >
                    ${index + 1}. ${title}
                </a>
            </div>
        `;
    });

    div.innerHTML = html;

    messages.appendChild(div);

    scrollMessages();
}

/*
=========================================================
 MESSAGE DE CHARGEMENT
=========================================================
*/

function createLoadingMessage() {
    if (!messages) return null;

    const loading =
        document.createElement("div");

    loading.className =
        "message assistant";

    loading.innerHTML =
        "⏳ Wiener IA réfléchit...";

    messages.appendChild(loading);

    scrollMessages();

    return loading;
}

/*
=========================================================
 GESTION DES MODES
=========================================================
*/

function setMode(mode) {
    currentMode = mode;

    menuButtons.forEach(button => {
        const active =
            button.dataset.mode === mode;

        button.style.background =
            active
                ? "#10A37F"
                : "#202020";
    });

    const placeholders = {
        chat:
            "Envoyez un message à Wiener IA...",

        exercise:
            "Entrez l'exercice à résoudre...",

        search:
            "Que voulez-vous rechercher sur Internet ?",

        image:
            "Décrivez l'image que vous voulez générer...",

        pdf:
            "Ajoutez un fichier puis indiquez ce que Wiener IA doit analyser...",

        calculator:
            "Exemple : 25 × 4 + 10"
    };

    if (userInput) {
        userInput.placeholder =
            placeholders[mode] ||
            placeholders.chat;
    }
}

menuButtons.forEach(button => {
    button.addEventListener(
        "click",
        () => {
            setMode(
                button.dataset.mode ||
                "chat"
            );
        }
    );
});

/*
=========================================================
 NOUVELLE CONVERSATION
=========================================================
*/

function newConversation() {
    history = [];

    if (messages) {
        messages.innerHTML = `
            <div class="message assistant">
                👋 Bonjour !
                <br><br>
                Je suis <b>Wiener IA</b>.
                <br><br>
                Comment puis-je vous aider aujourd'hui ?
            </div>
        `;
    }

    showWelcome(true);

    if (userInput) {
        userInput.value = "";
        userInput.focus();
    }
}

if (newChatBtn) {
    newChatBtn.addEventListener(
        "click",
        newConversation
    );
}

/*
=========================================================
 REQUÊTES API
=========================================================
*/

async function apiRequest(endpoint, body) {
    const response =
        await fetch(endpoint, {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify(body)
        });

    let data = null;

    try {
        data =
            await response.json();
    } catch {
        throw new Error(
            "Le serveur a retourné une réponse invalide."
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.error ||
            "Une erreur serveur est survenue."
        );
    }

    return data;
}

/*
=========================================================
 CHAT
=========================================================
*/

async function sendChat(text) {
    const newHistory = [
        ...history,
        {
            role: "user",
            content: text
        }
    ];

    const data =
        await apiRequest(
            "/api/chat",
            {
                messages:
                    newHistory
            }
        );

    const answer =
        data?.answer ||
        data?.response ||
        data?.text ||
        data?.message;

    if (!answer) {
        throw new Error(
            "Wiener IA n'a retourné aucune réponse."
        );
    }

    history = [
        ...newHistory,
        {
            role: "assistant",
            content: answer
        }
    ];

    addMessage(
        answer,
        "assistant"
    );
}

/*
=========================================================
 EXERCICE
=========================================================
*/

async function sendExercise(text) {
    const data =
        await apiRequest(
            "/api/exercises",
            {
                question: text,

                level:
                    "niveau scolaire non précisé",

                subject:
                    "matière non précisée"
            }
        );

    const answer =
        data?.answer ||
        data?.response ||
        data?.text;

    if (!answer) {
        throw new Error(
            "Aucune solution n'a été générée."
        );
    }

    addMessage(
        answer,
        "assistant"
    );

    history.push({
        role: "user",
        content: text
    });

    history.push({
        role: "assistant",
        content: answer
    });
}

/*
=========================================================
 RECHERCHE WEB
=========================================================
*/

async function sendSearch(text) {
    const data =
        await apiRequest(
            "/api/search",
            {
                query: text
            }
        );

    const answer =
        data?.answer ||
        data?.response ||
        data?.text;

    if (!answer) {
        throw new Error(
            "La recherche n'a retourné aucune réponse."
        );
    }

    addMessage(
        answer,
        "assistant"
    );

    if (
        Array.isArray(data.sources) &&
        data.sources.length
    ) {
        addSources(
            data.sources
        );
    }

    history.push({
        role: "user",
        content: text
    });

    history.push({
        role: "assistant",
        content: answer
    });
}

/*
=========================================================
 GÉNÉRATION D'IMAGE
=========================================================
*/

async function sendImage(text) {
    const data =
        await apiRequest(
            "/api/image",
            {
                prompt: text
            }
        );

    if (!data?.image) {
        throw new Error(
            "Wiener IA n'a généré aucune image."
        );
    }

    addImageMessage(
        data.image,
        data.text || ""
    );

    history.push({
        role: "user",
        content: text
    });

    history.push({
        role: "assistant",
        content:
            "[Image générée par Wiener IA]"
    });
}

/*
=========================================================
 CALCULATRICE
=========================================================
*/

async function sendCalculator(text) {
    const data =
        await apiRequest(
            "/api/calculate",
            {
                expression: text
            }
        );

    if (
        data?.result === undefined
    ) {
        throw new Error(
            data?.error ||
            "Aucun résultat."
        );
    }

    const result =
        data.result;

    addMessage(
        `🧮 <b>Calcul</b><br><br>
         ${escapeHTML(text)}
         <br><br>
         <strong>Résultat : ${escapeHTML(result)}</strong>`,
        "assistant"
    );

    history.push({
        role: "user",
        content: text
    });

    history.push({
        role: "assistant",
        content:
            `Résultat : ${result}`
    });
}

/*
=========================================================
 FICHIER
=========================================================
*/

function createFileInput() {
    let fileInput =
        document.getElementById(
            "wienerFileInput"
        );

    if (fileInput) {
        return fileInput;
    }

    fileInput =
        document.createElement("input");

    fileInput.type = "file";

    fileInput.id =
        "wienerFileInput";

    fileInput.accept =
        ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

    fileInput.style.display =
        "none";

    document.body.appendChild(
        fileInput
    );

    return fileInput;
}

function fileToDataURL(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload = () =>
                resolve(
                    reader.result
                );

            reader.onerror = () =>
                reject(
                    new Error(
                        "Impossible de lire le fichier."
                    )
                );

            reader.readAsDataURL(
                file
            );
        }
    );
}

async function selectAndAnalyzeFile() {
    const fileInput =
        createFileInput();

    fileInput.value = "";

    fileInput.click();

    return new Promise(resolve => {
        fileInput.onchange =
            async () => {
                const file =
                    fileInput.files?.[0];

                if (!file) {
                    resolve();
                    return;
                }

                const allowedTypes = [
                    "application/pdf",
                    "image/png",
                    "image/jpeg",
                    "image/webp"
                ];

                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {
                    addMessage(
                        "❌ Format non pris en charge. Utilise un PDF, PNG, JPEG ou WEBP.",
                        "assistant"
                    );

                    resolve();
                    return;
                }

                if (
                    file.size >
                    30 * 1024 * 1024
                ) {
                    addMessage(
                        "❌ Le fichier dépasse la limite de 30 MB.",
                        "assistant"
                    );

                    resolve();
                    return;
                }

                const prompt =
                    userInput.value.trim() ||
                    "Analyse ce fichier et explique-moi les informations importantes.";

                showWelcome(false);

                addMessage(
                    `📎 Fichier : <strong>${escapeHTML(file.name)}</strong><br><br>${formatText(prompt)}`,
                    "user"
                );

                userInput.value = "";

                const loading =
                    createLoadingMessage();

                try {
                    const dataURL =
                        await fileToDataURL(
                            file
                        );

                    const data =
                        await apiRequest(
                            "/api/analyze-file",
                            {
                                file:
                                    dataURL,

                                mimeType:
                                    file.type,

                                prompt
                            }
                        );

                    if (loading) {
                        loading.remove();
                    }

                    const answer =
                        data?.answer;

                    if (!answer) {
                        throw new Error(
                            "Aucune analyse n'a été retournée."
                        );
                    }

                    addMessage(
                        answer,
                        "assistant"
                    );

                    history.push({
                        role: "user",
                        content:
                            `[Fichier : ${file.name}] ${prompt}`
                    });

                    history.push({
                        role: "assistant",
                        content: answer
                    });

                } catch (error) {
                    if (loading) {
                        loading.remove();
                    }

                    addMessage(
                        `❌ ${error.message}`,
                        "assistant"
                    );
                }

                resolve();
            };
    });
}

/*
=========================================================
 ENVOI PRINCIPAL
=========================================================
*/

async function sendMessage() {
    if (!userInput) return;

    const text =
        userInput.value.trim();

    /*
    Mode PDF / fichier
    */

    if (
        currentMode === "pdf"
    ) {
        await selectAndAnalyzeFile();
        return;
    }

    if (!text) {
        return;
    }

    showWelcome(false);

    addMessage(
        text,
        "user"
    );

    userInput.value = "";

    const loading =
        createLoadingMessage();

    sendBtn.disabled = true;

    try {
        switch (currentMode) {

            case "chat":
                await sendChat(text);
                break;

            case "exercise":
                await sendExercise(text);
                break;

            case "search":
                await sendSearch(text);
                break;

            case "image":
                await sendImage(text);
                break;

            case "calculator":
                await sendCalculator(text);
                break;

            default:
                await sendChat(text);
                break;
        }

    } catch (error) {

        console.error(
            "WIENER IA ERROR:",
            error
        );

        addMessage(
            `❌ ${error.message || "Erreur de connexion avec Wiener IA."}`,
            "assistant"
        );

    } finally {

        if (loading) {
            loading.remove();
        }

        sendBtn.disabled =
            false;

        userInput.focus();

        scrollMessages();
    }
}

/*
=========================================================
 BOUTON ENVOYER
=========================================================
*/

if (sendBtn) {
    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}

/*
=========================================================
 ENTRÉE CLAVIER
=========================================================
*/

if (userInput) {
    userInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {
                event.preventDefault();

                sendMessage();
            }
        }
    );
}

/*
=========================================================
 AUTO-AGRANDISSEMENT TEXTAREA
=========================================================
*/

if (userInput) {
    userInput.addEventListener(
        "input",
        () => {

            userInput.style.height =
                "auto";

            userInput.style.height =
                Math.min(
                    userInput.scrollHeight,
                    180
                ) + "px";
        }
    );
}

/*
=========================================================
 INITIALISATION
=========================================================
*/

setMode("chat");

console.log(
    "🤖 Wiener IA — application chargée."
);

console.log(
    "🧠 Mode actuel :",
    currentMode
);
```
