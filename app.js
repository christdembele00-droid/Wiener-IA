```javascript
"use strict";

/* =========================================================
   ÉLÉMENTS DE L'INTERFACE
========================================================= */

const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

let currentMode = "chat";
let history = [];


/* =========================================================
   MODES
========================================================= */

document.querySelectorAll(".menu-item").forEach((btn) => {

    btn.addEventListener("click", () => {

        document.querySelectorAll(".menu-item").forEach((b) => {
            b.style.background = "#202020";
        });

        btn.style.background = "#10A37F";

        currentMode = btn.dataset.mode;

        updatePlaceholder();

    });

});


function updatePlaceholder() {

    const placeholders = {

        chat:
            "Envoyez un message à Wiener IA...",

        exercise:
            "Entrez votre exercice à résoudre...",

        search:
            "Que voulez-vous rechercher sur Internet ?",

        image:
            "Décrivez l'image que vous voulez générer...",

        pdf:
            "Ajoutez un fichier puis indiquez ce que Wiener IA doit analyser...",

        calculator:
            "Exemple : (25 + 15) × 2"

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

    updatePlaceholder();

    userInput.focus();

});


/* =========================================================
   ENTRÉE CLAVIER
========================================================= */

userInput.addEventListener("keydown", (e) => {

    if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        sendMessage();

    }

});


/* =========================================================
   BOUTON ENVOYER
========================================================= */

sendBtn.addEventListener("click", sendMessage);


/* =========================================================
   AJOUTER UN MESSAGE
========================================================= */

function addMessage(content, role) {

    const div = document.createElement("div");

    div.className =
        role === "user"
            ? "message user"
            : "message assistant";

    /*
       Pour les réponses de l'utilisateur,
       on utilise textContent afin d'éviter
       l'injection HTML.
    */

    if (role === "user") {

        div.textContent = content;

    } else {

        /*
           Les réponses Gemini peuvent contenir
           du Markdown simple.

           Conversion légère du Markdown en HTML.
        */

        div.innerHTML = formatAssistantMessage(content);

    }

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;

    return div;

}


/* =========================================================
   FORMATAGE DES RÉPONSES
========================================================= */

function formatAssistantMessage(text) {

    if (typeof text !== "string") {
        return String(text);
    }

    /*
       Échapper d'abord le HTML.
    */

    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    /*
       Code inline
    */

    html = html.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    /*
       Gras
    */

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    /*
       Titres Markdown
    */

    html = html.replace(
        /^### (.*)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^## (.*)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^# (.*)$/gm,
        "<h2>$1</h2>"
    );

    /*
       Listes
    */

    html = html.replace(
        /^\s*[-•]\s+(.*)$/gm,
        "• $1"
    );

    /*
       Retours à la ligne
    */

    html = html.replace(
        /\n/g,
        "<br>"
    );

    return html;

}


/* =========================================================
   MESSAGE DE CHARGEMENT
========================================================= */

function createLoadingMessage(text = "⏳ Wiener IA réfléchit...") {

    const loading =
        document.createElement("div");

    loading.className =
        "message assistant";

    loading.textContent = text;

    messages.appendChild(loading);

    messages.scrollTop =
        messages.scrollHeight;

    return loading;

}


/* =========================================================
   REQUÊTE API
========================================================= */

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
            "Une erreur est survenue."
        );

    }


    return data;

}


/* =========================================================
   CHAT
========================================================= */

async function sendChat(text) {

    return await apiRequest(
        "/api/chat",
        {
            messages: history
        }
    );

}


/* =========================================================
   EXERCICES
========================================================= */

async function sendExercise(text) {

    return await apiRequest(
        "/api/exercises",
        {
            question: text,
            level: "non précisé",
            subject: "non précisée"
        }
    );

}


/* =========================================================
   RECHERCHE WEB
========================================================= */

async function sendSearch(text) {

    return await apiRequest(
        "/api/search",
        {
            query: text
        }
    );

}


/* =========================================================
   GÉNÉRATION D'IMAGE
========================================================= */

async function sendImage(text) {

    return await apiRequest(
        "/api/image",
        {
            prompt: text
        }
    );

}


/* =========================================================
   CALCULATRICE
========================================================= */

async function sendCalculator(text) {

    return await apiRequest(
        "/api/calculate",
        {
            expression: text
        }
    );

}


/* =========================================================
   AFFICHER LES SOURCES
========================================================= */

function displaySources(sources) {

    if (
        !Array.isArray(sources) ||
        sources.length === 0
    ) {
        return;
    }

    const container =
        document.createElement("div");

    container.className =
        "message assistant";

    let html =
        "<strong>🔗 Sources :</strong><br><br>";

    sources.forEach((source, index) => {

        if (
            !source ||
            !source.url
        ) {
            return;
        }

        const safeTitle =
            String(
                source.title ||
                `Source ${index + 1}`
            )
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        /*
           L'URL est utilisée uniquement
           comme destination du lien.
        */

        html += `
            <div style="margin-bottom:8px;">
                ${index + 1}.
                <a
                    href="${encodeURI(source.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="color:#10A37F;"
                >
                    ${safeTitle}
                </a>
            </div>
        `;

    });

    container.innerHTML = html;

    messages.appendChild(container);

    messages.scrollTop =
        messages.scrollHeight;

}


/* =========================================================
   AFFICHER UNE IMAGE
========================================================= */

function displayGeneratedImage(data) {

    if (
        !data ||
        typeof data.image !== "string"
    ) {
        return false;
    }

    const container =
        document.createElement("div");

    container.className =
        "message assistant";

    const image =
        document.createElement("img");

    image.src =
        data.image;

    image.alt =
        "Image générée par Wiener IA";

    image.style.maxWidth =
        "100%";

    image.style.borderRadius =
        "16px";

    image.style.display =
        "block";

    image.style.marginTop =
        "10px";


    container.innerHTML =
        "<strong>🎨 Image générée :</strong>";

    container.appendChild(image);


    if (
        data.text &&
        typeof data.text === "string"
    ) {

        const description =
            document.createElement("div");

        description.style.marginTop =
            "12px";

        description.innerHTML =
            formatAssistantMessage(
                data.text
            );

        container.appendChild(
            description
        );

    }


    messages.appendChild(
        container
    );

    messages.scrollTop =
        messages.scrollHeight;

    return true;

}


/* =========================================================
   TRAITER LA RÉPONSE
========================================================= */

function getAnswer(data) {

    if (!data) {
        return "";
    }

    return (
        data.answer ||
        data.result ||
        data.response ||
        data.text ||
        data.message ||
        ""
    );

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


    /*
       Masquer l'accueil.
    */

    welcome.style.display =
        "none";


    /*
       Afficher le message utilisateur.
    */

    addMessage(
        text,
        "user"
    );


    /*
       Historique uniquement
       pour le mode Chat.
    */

    if (currentMode === "chat") {

        history.push({
            role: "user",
            content: text
        });

    }


    userInput.value = "";


    /*
       Désactiver temporairement
       le bouton.
    */

    sendBtn.disabled = true;

    const oldButtonText =
        sendBtn.textContent;

    sendBtn.textContent =
        "⏳";


    const loading =
        createLoadingMessage();


    try {

        let data = null;


        /* =============================================
           CHAT
        ============================================= */

        if (currentMode === "chat") {

            data =
                await sendChat(text);

        }


        /* =============================================
           EXERCICES
        ============================================= */

        else if (
            currentMode === "exercise"
        ) {

            loading.textContent =
                "📚 Wiener IA résout l'exercice...";

            data =
                await sendExercise(text);

        }


        /* =============================================
           RECHERCHE
        ============================================= */

        else if (
            currentMode === "search"
        ) {

            loading.textContent =
                "🌐 Wiener IA recherche sur Internet...";

            data =
                await sendSearch(text);

        }


        /* =============================================
           IMAGE
        ============================================= */

        else if (
            currentMode === "image"
        ) {

            loading.textContent =
                "🎨 Wiener IA génère l'image...";

            data =
                await sendImage(text);

        }


        /* =============================================
           CALCULATRICE
        ============================================= */

        else if (
            currentMode === "calculator"
        ) {

            loading.textContent =
                "🧮 Calcul en cours...";

            data =
                await sendCalculator(text);

        }


        /* =============================================
           PDF
           
           Le mode PDF nécessite un fichier.
           Le serveur attend :
           file + mimeType + prompt.
        ============================================= */

        else if (
            currentMode === "pdf"
        ) {

            loading.remove();

            addMessage(
                "📄 Pour analyser un PDF ou une image, il faut d'abord ajouter un fichier. Ton interface HTML actuelle ne possède pas encore de bouton de sélection de fichier.",
                "assistant"
            );

            return;

        }


        /*
           Supprimer le chargement.
        */

        loading.remove();


        /* =============================================
           IMAGE
        ============================================= */

        if (
            currentMode === "image" &&
            displayGeneratedImage(data)
        ) {

            /*
               L'image est déjà affichée.
            */

            if (
                data.text &&
                typeof data.text === "string"
            ) {

                history.push({
                    role: "assistant",
                    content: data.text
                });

            }

            return;

        }


        /* =============================================
           RÉPONSE TEXTE
        ============================================= */

        const answer =
            getAnswer(data);


        if (!answer) {

            addMessage(
                "⚠️ Wiener IA n'a retourné aucune réponse.",
                "assistant"
            );

            return;

        }


        addMessage(
            String(answer),
            "assistant"
        );


        /*
           Ajouter à l'historique uniquement
           pour le mode Chat.
        */

        if (
            currentMode === "chat"
        ) {

            history.push({
                role: "assistant",
                content: String(answer)
            });

        }


        /* =============================================
           SOURCES DE RECHERCHE
        ============================================= */

        if (
            currentMode === "search" &&
            Array.isArray(data?.sources)
        ) {

            displaySources(
                data.sources
            );

        }


    } catch (error) {

        /*
           Supprimer le chargement.
        */

        loading.remove();


        console.error(
            "WIENER IA ERROR:",
            error
        );


        addMessage(
            `❌ ${error?.message || "Erreur de connexion avec le serveur Wiener IA."}`,
            "assistant"
        );

    } finally {

        /*
           Réactiver le bouton.
        */

        sendBtn.disabled =
            false;

        sendBtn.textContent =
            oldButtonText;

        userInput.focus();

    }

}


/* =========================================================
   INITIALISATION
========================================================= */

updatePlaceholder();


/*
   Sélectionner Chat IA au démarrage.
*/

const firstMenu =
    document.querySelector(
        '.menu-item[data-mode="chat"]'
    );

if (firstMenu) {
    firstMenu.style.background =
        "#10A37F";
}


/* =========================================================
   VÉRIFICATION DU SERVEUR
========================================================= */

async function checkServer() {

    try {

        const response =
            await fetch(
                "/api/health"
            );

        if (!response.ok) {
            throw new Error();
        }

        const data =
            await response.json();

        console.log(
            "🤖 Wiener IA connecté",
            data
        );

    } catch (error) {

        console.warn(
            "⚠️ Impossible de vérifier le serveur Wiener IA."
        );

    }

}

checkServer();
```
