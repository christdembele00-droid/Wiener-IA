"use client";

import { useMemo, useState } from "react";
import { sendToWiener } from "../lib/api";

type Message = { role: "user" | "assistant"; text: string };

const cognitiveSteps = ["Perception", "Contexte", "Mémoire", "Raisonnement", "Planification", "Sélection", "Action", "Réflexion", "Évolution"];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);

  const lastStep = useMemo(() => (thinking ? 4 : messages.length ? 6 : 0), [thinking, messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setThinking(true);
    try {
      const result = await sendToWiener(text);
      setMessages((m) => [...m, { role: "assistant", text: result.text }]);
    } catch (error) {
      setMessages((m) => [...m, { role: "assistant", text: error instanceof Error ? error.message : "Connexion au moteur Wiener-IA impossible." }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><span>Wiener-IA</span></div>
        <button className="new-chat" onClick={() => setMessages([])}>+ Nouvelle réflexion</button>
        <div className="side-section">
          <span>ÉTAT COGNITIF</span>
          {cognitiveSteps.map((step, i) => (
            <div className={i === lastStep ? "state active" : "state"} key={step}><i /> {step}</div>
          ))}
        </div>
        <div className="side-footer">Système v5.0 · moteur FastAPI</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><strong>Wiener-IA</strong><span> · système cognitif</span></div>
          <div className="online"><i /> opérationnel</div>
        </header>

        <div className="conversation">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-mark">W</div>
              <h1>Que veux-tu explorer ?</h1>
              <p>Wiener-IA organise le contexte, mobilise sa mémoire et sélectionne une stratégie avant d'agir.</p>
              <div className="suggestions">
                <button onClick={() => setInput("Explique-moi un concept simplement.")}>Expliquer un concept</button>
                <button onClick={() => setInput("Aide-moi à construire un projet.")}>Construire un projet</button>
                <button onClick={() => setInput("Analyse ce problème étape par étape.")}>Analyser un problème</button>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m, i) => (
                <div className={m.role === "user" ? "message user" : "message assistant"} key={i}>
                  <div className="message-label">{m.role === "user" ? "TOI" : "WIENER-IA"}</div>
                  <div className="message-text">{m.text}</div>
                </div>
              ))}
              {thinking && <div className="thinking"><span /> <span /> <span /> Wiener-IA réfléchit…</div>}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Écris à Wiener-IA…" rows={1} />
            <button className="send" onClick={() => void send()} disabled={!input.trim() || thinking} aria-label="Envoyer">↑</button>
          </div>
          <small>Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</small>
        </div>
      </section>
    </main>
  );
}
