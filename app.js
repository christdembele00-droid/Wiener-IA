"use strict";

/* =========================================================
WIENER IA — APP.JS FINAL
Frontend GitHub Pages → Serveur Render
========================================================= */

const API_URL = "https://wiener-ia.onrender.com";

/* =========================================================
ÉLÉMENTS HTML
========================================================= */

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

const menuButtons = document.querySelectorAll(".menu-item");

/* =========================================================
ÉTAT
========================================================= */

let currentMode = "chat";
let history = [];
let isLoading = false;

/* =========================================================
INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
setupMenu();
setupInput();
setupNewChat();
checkServer();
});

/* =========================================================
MENU
========================================================= */

function setupMenu() {
menuButtons.forEach((button) => {

```
    button.addEventListener("click", () => {

        menuButtons.forEach((btn) => {
            btn.style.background = "#202020";
        });

        button.style.background = "#10A37F";

        currentMode =
            button.dataset.mode || "chat";

        updatePlaceholder();

        /*
         * Pour les modes spécialisés, on garde
         * l'interface de chat afin de rester compatible
         * avec le HTML actuel.
         */

        if (userInput) {
            userInput.focus();
        }
    });
});

/*
 * Active Chat IA par défaut
 */

const defaultButton =
    document.querySelector(
        '.menu-item[data-mode="chat"]'
    );

if (defaultButton) {
    defaultButton.style.background = "#10A37F";
}
```

}

/* =========================================================
PLACEHOLDER
========================================================= */

function updatePlaceholder() {

```
if (!userInput) {
    return;
}

const placeholders = {

    chat:
        "Envoyez un message à Wiener IA...",

    exercise:
        "Écrivez ou collez votre exercice...",

    search:
        "Que voulez-vous rechercher sur Internet ?",

    image:
        "Décrivez l'image que vous voulez créer...",

    pdf:
        "Indiquez ce que vous voulez analyser...",

    calculator:
        "Exemple : 25 × 4 ou 120/5"
};

userInput.placeholder =
    placeholders[currentMode] ||
    placeholders.chat;
```

}

/* =========================================================
ENTRÉE CLAVIER
========================================================= */

function setupInput() {

```
if (!userInput) {
    return;
}

userInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            sendMessage();
        }
    }
);

/*
 * Ajustement automatique de la hauteur
 */

userInput.addEventListener(
    "input",
    () => {

        userInput.style.height = "auto";

        userInput.style.height =
            Math.min(
                userInput.scrollHeight,
                200
            ) + "px";
    }
);
```

}

/* =========================================================
NOUVELLE CONVERSATION
========================================================= */

function setupNewChat() {

```
if (!newChatBtn) {
    return;
}

newChatBtn.addEventListener(
    "click",
    () => {

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

        if (welcome) {
            welcome.style.display = "block";
        }

        if (userInput) {
            userInput.value = "";
            userInput.style.height = "auto";
            userInput.focus();
        }
    }
);
```

}

/* =========================================================
TEST DU SERVEUR
========================================================= */

async function checkServer() {

```
try {

    const response =
        await fetch(
            `${API_URL}/api/health`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Serveur HTTP ${response.status}`
        );
    }

    const data =
        await response.json();

    console.log(
        "✅ Wiener IA connecté au serveur :",
        data
    );

} catch (error) {

    console.error(
        "❌ Impossible de contacter le serveur Wiener IA :",
        error
    );
}
```

}

/* =========================================================
AJOUT MESSAGE
========================================================= */

function addMessage(content, role = "assistant") {

```
if (!messages) {
    return null;
}

const div =
    document.createElement("div");

div.className =
    role === "user"
        ? "message user"
        : "message assistant";

if (role === "assistant") {
    div.innerHTML =
        formatResponse(content);
} else {
    /*
     * textContent pour empêcher l'injection HTML
     * dans les messages utilisateur.
     */
    div.textContent = content;
}

messages.appendChild(div);

scrollToBottom();

return div;
```

}

/* =========================================================
FORMATAGE DES RÉPONSES
========================================================= */

function escapeHtml(text) {

```
return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
```

}

function formatResponse(text) {

````
if (text === null || text === undefined) {
    return "";
}

let html =
    escapeHtml(String(text));

/*
 * Blocs de code
 */

html =
    html.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

/*
 * Gras
 */

html =
    html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

/*
 * Italique simple
 */

html =
    html.replace(
        /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );

/*
 * Titres Markdown
 */

html =
    html.replace(
        /^### (.*)$/gm,
        "<h4>$1</h4>"
    );

html =
    html.replace(
        /^## (.*)$/gm,
        "<h3>$1</h3>"
    );

html =
    html.replace(
        /^# (.*)$/gm,
        "<h2>$1</h2>"
    );

/*
 * Listes
 */

html =
    html.replace(
        /^[•\-] (.*)$/gm,
        "• $1"
    );

/*
 * Retours à la ligne
 */

html =
    html.replace(
        /\n/g,
        "<br>"
    );

return html;
````

}

/* =========================================================
SCROLL
========================================================= */

function scrollToBottom() {

```
if (!messages) {
    return;
}

messages.scrollTop =
    messages.scrollHeight;
```

}

/* =========================================================
LOADING
========================================================= */

function createLoadingMessage() {

```
if (!messages) {
    return null;
}

const loading =
    document.createElement("div");

loading.className =
    "message assistant";

loading.innerHTML =
    "⏳ Wiener IA réfléchit...";

messages.appendChild(loading);

scrollToBottom();

return loading;
```

}

/* =========================================================
ERREUR API
========================================================= */

async function getApiError(response) {

```
let data = null;

try {
    data = await response.json();
} catch {
    data = null;
}

if (data && data.error) {
    return data.error;
}

return `Erreur serveur HTTP ${response.status}.`;
```

}

/* =========================================================
ENVOI PRINCIPAL
========================================================= */

async function sendMessage() {

```
if (isLoading) {
    return;
}

const text =
    userInput
        ? userInput.value.trim()
        : "";

if (!text) {
    return;
}

isLoading = true;

if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "⏳";
}

if (welcome) {
    welcome.style.display = "none";
}

/*
 * Message utilisateur
 */

addMessage(text, "user");

/*
 * Historique pour le chat
 */

history.push({
    role: "user",
    content: text
});

if (userInput) {
    userInput.value = "";
    userInput.style.height = "auto";
}

const loading =
    createLoadingMessage();

try {

    let answer = "";

    /*
     * =====================================================
     * CHAT
     * =====================================================
     */

    if (currentMode === "chat") {

        const response =
            await fetch(
                `${API_URL}/api/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        messages:
                            history
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        answer =
            data.answer ||
            data.response ||
            data.text ||
            data.message ||
            "";
    }

    /*
     * =====================================================
     * EXERCICES
     * =====================================================
     */

    else if (
        currentMode === "exercise"
    ) {

        const response =
            await fetch(
                `${API_URL}/api/exercises`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        question: text,

                        level:
                            "niveau scolaire non précisé",

                        subject:
                            "matière non précisée"
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        answer =
            data.answer ||
            data.response ||
            data.text ||
            "";
    }

    /*
     * =====================================================
     * RECHERCHE WEB
     * =====================================================
     */

    else if (
        currentMode === "search"
    ) {

        const response =
            await fetch(
                `${API_URL}/api/search`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        query: text
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        answer =
            data.answer ||
            data.response ||
            data.text ||
            "";

        /*
         * Sources
         */

        if (
            Array.isArray(data.sources) &&
            data.sources.length
        ) {

            answer +=
                "\n\n### Sources\n";

            data.sources.forEach(
                (source) => {

                    if (
                        source &&
                        source.url
                    ) {

                        const title =
                            source.title ||
                            "Source";

                        answer +=
                            `\n- ${title} — ${source.url}`;
                    }
                }
            );
        }
    }

    /*
     * =====================================================
     * GÉNÉRATION IMAGE
     * =====================================================
     */

    else if (
        currentMode === "image"
    ) {

        const response =
            await fetch(
                `${API_URL}/api/image`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        prompt: text
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        if (data.image) {

            if (loading) {
                loading.remove();
            }

            const imageMessage =
                document.createElement("div");

            imageMessage.className =
                "message assistant";

            imageMessage.innerHTML = `
                <div>
                    🎨 <strong>Image générée par Wiener IA</strong>
                    <br><br>
                    <img
                        src="${data.image}"
                        alt="Image générée par Wiener IA"
                        style="
                            max-width:100%;
                            border-radius:16px;
                            display:block;
                            margin-top:10px;
                        "
                    >
                </div>
            `;

            messages.appendChild(
                imageMessage
            );

            scrollToBottom();

            if (data.text) {

                addMessage(
                    data.text,
                    "assistant"
                );
            }

            history.push({
                role: "assistant",
                content:
                    data.text ||
                    "Image générée avec succès."
            });

            return;
        }

        answer =
            data.text ||
            "Image générée.";
    }

    /*
     * =====================================================
     * CALCULATRICE
     * =====================================================
     */

    else if (
        currentMode === "calculator"
    ) {

        const response =
            await fetch(
                `${API_URL}/api/calculate`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        expression: text
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        answer =
            `🧮 **Calcul**
```

Expression : `${data.expression}`

Résultat : **${data.result}**`;
}

```
    /*
     * =====================================================
     * PDF / IMAGE
     *
     * Le HTML actuel ne possède pas de bouton fichier.
     * On affiche donc une indication claire.
     * Le support sera utilisé automatiquement lorsqu'un
     * input file sera présent dans le HTML.
     * =====================================================
     */

    else if (
        currentMode === "pdf"
    ) {

        answer =
            "📄 Pour analyser un PDF ou une image, ajoutez un fichier avec le bouton de pièce jointe. Le serveur Wiener IA prend en charge les fichiers PDF, PNG, JPEG et WEBP.";
    }

    /*
     * =====================================================
     * MODE INCONNU
     * =====================================================
     */

    else {

        const response =
            await fetch(
                `${API_URL}/api/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        messages:
                            history
                    })
                }
            );

        if (!response.ok) {
            throw new Error(
                await getApiError(response)
            );
        }

        const data =
            await response.json();

        answer =
            data.answer ||
            "";
    }

    /*
     * =====================================================
     * AFFICHAGE
     * =====================================================
     */

    if (loading) {
        loading.remove();
    }

    if (!answer) {
        answer =
            "Wiener IA n'a retourné aucune réponse.";
    }

    addMessage(
        answer,
        "assistant"
    );

    /*
     * Historique
     */

    history.push({
        role: "assistant",
        content: answer
    });

} catch (error) {

    console.error(
        "WIENER IA ERROR:",
        error
    );

    if (loading) {
        loading.remove();
    }

    const errorMessage =
        error?.message ||
        "Erreur de connexion au serveur Wiener IA.";

    addMessage(
        `❌ ${errorMessage}`,
        "assistant"
    );

} finally {

    isLoading = false;

    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Envoyer";
    }

    if (userInput) {
        userInput.focus();
    }
}
```

}

/* =========================================================
SUPPORT FICHIER AUTOMATIQUE
========================================================= */

function setupFileUpload() {

```
const fileInput =
    document.getElementById(
        "fileInput"
    );

if (!fileInput) {
    return;
}

fileInput.addEventListener(
    "change",
    async () => {

        const file =
            fileInput.files?.[0];

        if (!file) {
            return;
        }

        await analyzeFile(file);

        fileInput.value = "";
    }
);
```

}

/* =========================================================
ANALYSE FICHIER
========================================================= */

async function analyzeFile(file) {

```
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
        "❌ Type de fichier non pris en charge. Utilisez PDF, PNG, JPEG ou WEBP.",
        "assistant"
    );

    return;
}

const maxSize =
    30 * 1024 * 1024;

if (file.size > maxSize) {

    addMessage(
        "❌ Le fichier est trop volumineux. Taille maximale : 30 MB.",
        "assistant"
    );

    return;
}

const loading =
    createLoadingMessage();

try {

    const base64 =
        await fileToBase64(file);

    const prompt =
        userInput?.value.trim() ||
        "Analyse ce fichier et explique les informations importantes.";

    if (userInput) {
        userInput.value = "";
    }

    const response =
        await fetch(
            `${API_URL}/api/analyze-file`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    file: base64,

                    mimeType:
                        file.type,

                    prompt
                })
            }
        );

    if (!response.ok) {
        throw new Error(
            await getApiError(response)
        );
    }

    const data =
        await response.json();

    if (loading) {
        loading.remove();
    }

    const answer =
        data.answer ||
        "Aucune analyse reçue.";

    addMessage(
        answer,
        "assistant"
    );

    history.push({
        role: "assistant",
        content: answer
    });

} catch (error) {

    if (loading) {
        loading.remove();
    }

    console.error(
        "WIENER IA FILE ERROR:",
        error
    );

    addMessage(
        `❌ ${error?.message || "Impossible d'analyser le fichier."}`,
        "assistant"
    );

}
```

}

/* =========================================================
FICHIER → BASE64
========================================================= */

function fileToBase64(file) {

```
return new Promise(
    (resolve, reject) => {

        const reader =
            new FileReader();

        reader.onload = () => {
            resolve(
                reader.result
            );
        };

        reader.onerror = () => {
            reject(
                new Error(
                    "Impossible de lire le fichier."
                )
            );
        };

        reader.readAsDataURL(file);
    }
);
```

}

/* =========================================================
INITIALISATION FICHIER
========================================================= */

setupFileUpload();

/* =========================================================
EXPOSITION OPTIONNELLE
========================================================= */

window.WienerIA = {
sendMessage,
analyzeFile,
checkServer
};

console.log(
"🤖 Wiener IA frontend chargé."
);

console.log(
"🔗 API :",
API_URL
);
