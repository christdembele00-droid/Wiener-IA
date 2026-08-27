const messages = document.getElementById("messages");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("send");

let conversation = [];

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {
  const prompt = promptInput.value.trim();

  if (!prompt) return;

  addMessage(prompt, "user");

  conversation.push({
    role: "user",
    content: prompt
  });

  promptInput.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur serveur");
    }

    addMessage(data.answer, "ai");

    conversation.push({
      role: "assistant",
      content: data.answer
    });

  } catch (error) {
    addMessage(
      "Erreur : " + error.message,
      "ai"
    );
  }
}

sendBtn.addEventListener("click", sendMessage);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
