from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from cognitive.core import CognitiveCycle, CognitiveState

app = FastAPI(title="Wiener-IA API", version="4.4.0")
cycle = CognitiveCycle(CognitiveState())

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

class ChatResponse(BaseModel):
    text: str
    stage: str
    cognitive: dict[str, str]

class PerceptionRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

class MemoryRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    importance: float = Field(default=0.5, ge=0, le=1)
    topics: list[str] = Field(default_factory=list)

@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "Wiener-IA", "version": "4.4.0"}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "cognitive-backend"}

@app.get("/api/status")
async def status() -> dict[str, object]:
    return {
        "service": "Wiener-IA",
        "state": cycle.state.__dict__,
        "internal": cycle.internal.snapshot(),
        "memory_count": cycle.memory.count(),
        "pipeline": ["perception", "context", "memory", "reasoning", "planning", "selection", "action", "reflection", "evolution"],
    }

@app.post("/api/perception")
async def perception(request: PerceptionRequest) -> dict[str, object]:
    result = cycle.perceive(request.message)
    return {"stage": "perception", "perception": result.to_dict(), "internal": cycle.internal.snapshot()}

@app.post("/api/memory")
async def remember(request: MemoryRequest) -> dict[str, object]:
    item = cycle.memory.remember(request.content, request.importance, request.topics)
    return {"stage": "memory", "memory": item.__dict__, "count": cycle.memory.count()}

@app.get("/api/memory")
async def recent_memory(limit: int = 10) -> dict[str, object]:
    limit = max(1, min(limit, 100))
    return {"stage": "memory", "items": [item.__dict__ for item in cycle.memory.recent(limit)]}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message vide.")

    perceived = cycle.perceive(message)
    cycle.state.context["last_input"] = perceived.to_dict()
    cycle.begin("répondre à la demande de l'utilisateur", "préparation cognitive")

    cognition = cycle.think(perceived)
    selected = cognition["decision"]["selected"]
    cycle.state.current_strategy = selected
    cycle.act({"type": "prepare_response", "strategy": selected, "plan": cognition["plan"]["steps"]})

    cycle.remember(message, importance=0.4, topics=perceived.topics)
    reflection = cycle.reflect({"perception": perceived.to_dict(), "cognition": cognition})
    cycle.evolve(reflection)

    return ChatResponse(
        text=(
            f"Cycle cognitif préparé. Stratégie sélectionnée : « {selected} ». "
            f"Plan : {' → '.join(cognition['plan']['steps'])}."
        ),
        stage="selection",
        cognitive={
            "perception": "done",
            "context": "done",
            "memory": "done",
            "reasoning": "done",
            "planning": "done",
            "selection": "done",
            "action": "ready",
            "reflection": "done",
            "evolution": "done",
        },
    )
