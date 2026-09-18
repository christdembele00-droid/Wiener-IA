from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from cognitive.core import CognitiveCycle, CognitiveState

app = FastAPI(title="Wiener-IA API", version="4.1.0")
cycle = CognitiveCycle(CognitiveState())

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

class ChatResponse(BaseModel):
    text: str
    stage: str
    cognitive: dict[str, str]

@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "Wiener-IA", "version": "4.1.0"}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "cognitive-backend"}

@app.get("/api/status")
async def status() -> dict[str, object]:
    return {
        "service": "Wiener-IA",
        "state": {
            "goal": cycle.state.goal,
            "uncertainty": cycle.state.uncertainty,
            "strategy": cycle.state.current_strategy,
        },
        "pipeline": ["perception", "context", "memory", "reasoning", "selection", "action", "reflection", "evolution"],
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message vide.")

    perceived = cycle.perceive(message)
    cycle.state.context["last_input"] = perceived
    cycle.state.goal = "répondre à la demande de l'utilisateur"
    cycle.state.current_strategy = "analyse directe"
    cycle.state.uncertainty = 0.5

    reflection = cycle.reflect(perceived)
    cycle.evolve(reflection)

    return ChatResponse(
        text=(
            "Entrée reçue par le moteur cognitif Wiener-IA. "
            "Le pipeline perception → contexte → mémoire → raisonnement → sélection → action → réflexion → évolution est actif. "
            "Le fournisseur de modèle de langage sera branché à l'étape dédiée, sans changer l'identité Wiener-IA."
        ),
        stage="reflection",
        cognitive={
            "perception": "done",
            "context": "done",
            "memory": "ready",
            "reasoning": "ready",
            "selection": "ready",
            "action": "done",
            "reflection": "done",
            "evolution": "done",
        },
    )
