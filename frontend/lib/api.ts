export type CognitiveStatus = {
  perception: "idle" | "active";
  memory: "idle" | "active";
  reasoning: "idle" | "active";
  selection: "idle" | "active";
  action: "idle" | "active";
  reflection: "idle" | "active";
  evolution: "idle" | "active";
};

const API_URL = (process.env.NEXT_PUBLIC_WIENER_API_URL ?? "").replace(/\/$/, "");

function backendRequired(): string {
  if (!API_URL) {
    throw new Error("Backend Wiener-IA non configuré. Déploie FastAPI puis renseigne WIENER_API_URL.");
  }
  return API_URL;
}

export async function checkBackend(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendToWiener(message: string) {
  const base = backendRequired();
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    let detail = "Le moteur Wiener-IA est indisponible.";
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") detail = payload.detail;
    } catch {}
    throw new Error(detail);
  }
  return response.json();
}
