from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from cognitive.core import CognitiveCycle, CognitiveState

app = FastAPI(title="Wiener-IA API", version="4.3.0")
cycle = CognitiveCycle(CognitiveState())

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

class ChatResponse(BaseModel):
    text: str
    stage: str
    cognitive: dict[str, str]

class PerceptionRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "Wiener-IA", "version": "4.3.0"}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "cognitive-backend"}

@app.get("/api/status")
async def status() -> dict[str, object]:
    return {
        "service": "Wiener-IA",
        "state": cycle.state.__dict__,
        "internal": cycle.internal.snapshot(),
        "pipeline": ["perception", "context", "memory", "reasoning", "selection", "action", "reflection", "evolution"],
    }

@app.post("/api/perception")
async def perception(request: PerceptionRequest) -> dict[str, object]:
    result = cycle.perceive(request.message)
    return {"stage": "perception", "perception": result.to_dict(), "internal": cycle.internal.snapshot()}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message vide.")

    perceived = cycle.perceive(message)
    cycle.state.context["last_input"] = perceived.to_dict()
    cycle.begin("répondre à la demande de l'utilisateur", "analyse directe")
    cycle.act({"type": "prepare_response", "input_length": perceived.length})

    reflection = cycle.reflect(perceived.to_dict())
    cycle.evolve(reflection)

    return ChatResponse(
        text=(
            "État interne mis à jour. Wiener-IA a perçu l'entrée, défini un objectif, "
            f"sélectionné la stratégie « {cycle.state.current_strategy} » et enregistré le cycle."
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
