export type CognitiveStatus = {
  perception: "idle" | "active";
  memory: "idle" | "active";
  reasoning: "idle" | "active";
  selection: "idle" | "active";
  action: "idle" | "active";
  reflection: "idle" | "active";
  evolution: "idle" | "active";
};

const API_URL = process.env.NEXT_PUBLIC_WIENER_API_URL ?? "";

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
  if (!API_URL) {
    return {
      text: "Le moteur FastAPI n'est pas encore connecté à cette interface. La couche frontend est prête pour son branchement.",
      status: "frontend-ready" as const,
    };
  }

  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) throw new Error("Le moteur Wiener-IA est temporairement indisponible.");
  return response.json();
}
