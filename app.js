const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const welcome = document.getElementById("welcome");

let currentMode = "chat";
let history = [];

/* Modes */

document.querySelectorAll(".menu-item").forEach(btn => {
    btn.addEventListener("click", () => {

        document.querySelectorAll(".menu-item")
        .forEach(b => b.style.background = "#202020");

        btn.style.background = "#10A37F";

        currentMode = btn.dataset.mode;

    });
});

/* Nouveau chat */

newChatBtn.addEventListener("click", () => {

    history = [];

    messages.innerHTML = `
    <div class="message assistant">
    👋 Bonjour !

    <br><br>

    Je suis <b>Wiener IA</b>.

    Comment puis-je vous aider aujourd'hui ?
    </div>
    `;

    welcome.style.display = "block";
});

/* Entrée */

userInput.addEventListener("keydown", e => {

    if(e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        sendMessage();
    }

});

/* Bouton */

sendBtn.addEventListener("click", sendMessage);

/* Ajouter message */

function addMessage(content, role){

    const div = document.createElement("div");

    div.className =
    role === "user"
    ? "message user"
    : "message assistant";

    div.innerHTML = content;

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;

}

/* Message */

async function sendMessage(){

    const text = userInput.value.trim();

    if(!text) return;

    welcome.style.display = "none";

    addMessage(text, "user");

    history.push({
        role: "user",
        content: text
    });

    userInput.value = "";

    const loading = document.createElement("div");

    loading.className = "message assistant";

    loading.innerHTML = "⏳ Wiener IA réfléchit...";

    messages.appendChild(loading);

    messages.scrollTop = messages.scrollHeight;

    try{

        let endpoint = "/api/chat";

        if(currentMode === "exercise"){
            endpoint = "/api/exercises";
        }

        if(currentMode === "search"){
            endpoint = "/api/search";
        }

        if(currentMode === "image"){
            endpoint = "/api/image";
        }

        if(currentMode === "pdf"){
            endpoint = "/api/analyze-file";
        }

        if(currentMode === "calculator"){
            endpoint = "/api/calculate";
        }

        const response = await fetch(endpoint, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: text,
                history: history
            })

        });

        const data = await response.json();

        loading.remove();

        const answer =
        data.answer ||
        data.result ||
        data.response ||
        data.text ||
        data.message ||
        JSON.stringify(data);

        addMessage(answer, "assistant");

        history.push({
            role: "assistant",
            content: answer
        });

    }

    catch(error){

        loading.remove();

        addMessage(
        "❌ Erreur de connexion avec le serveur Wiener IA.",
        "assistant"
        );

        console.error(error);

    }

}
