import os
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from cognitive.core import CognitiveCycle, CognitiveState

app = FastAPI(title="Wiener-IA API", version="5.0.1")
origins = [origin.strip() for origin in os.getenv("WIENER_ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=origins != ["*"], allow_methods=["*"], allow_headers=["*"])
cycle = CognitiveCycle(CognitiveState())
connections: list[WebSocket] = []

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
class ToolRequest(BaseModel):
    name: str
    arguments: dict[str, object] = Field(default_factory=dict)

@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "Wiener-IA", "version": "5.0.1"}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "cognitive-backend"}

@app.get("/api/status")
async def status() -> dict[str, object]:
    return {"service": "Wiener-IA", "state": cycle.state.__dict__, "internal": cycle.internal.snapshot(), "memory_count": cycle.memory.count(), "tools": cycle.tools.list(), "models": cycle.router.snapshot(), "learning": cycle.learning.snapshot(), "evolution": {"generation": cycle.evolution.generation, "strategy_preferences": cycle.evolution.strategy_preferences}, "pipeline": ["perception", "context", "memory", "reasoning", "planning", "selection", "action", "reflection", "learning", "evolution", "inheritance"]}

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

@app.get("/api/tools")
async def tools() -> dict[str, object]:
    return {"tools": cycle.tools.list()}

@app.post("/api/tools/execute")
async def execute_tool(request: ToolRequest) -> dict[str, object]:
    try:
        return {"ok": True, "tool": request.name, "result": cycle.tools.execute(request.name, **request.arguments)}
    except KeyError:
        raise HTTPException(status_code=404, detail="Outil inconnu.")
    except Exception:
        raise HTTPException(status_code=400, detail="Exécution de l'outil impossible.")

@app.get("/api/models")
async def models() -> dict[str, object]:
    return {"providers": cycle.router.snapshot()}

@app.get("/api/evolution")
async def evolution() -> dict[str, object]:
    return {"generation": cycle.evolution.generation, "preferences": cycle.evolution.strategy_preferences, "genome": cycle.inheritance.build({"generation": cycle.evolution.generation, "preferences": cycle.evolution.strategy_preferences}, cycle.state.history).export()}

@app.get("/api/metrics")
async def metrics() -> dict[str, object]:
    return {"cycles": cycle.internal.cycle_count, "memory_items": cycle.memory.count(), "generation": cycle.evolution.generation, "history_items": len(cycle.state.history), "active_websockets": len(connections)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    try:
        await websocket.send_json({"event": "connected", "service": "Wiener-IA"})
        while True:
            message = await websocket.receive_text()
            await websocket.send_json({"event": "ack", "message": message})
    except Exception:
        pass
    finally:
        if websocket in connections:
            connections.remove(websocket)

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
    cycle.evolve_cycle(cognition, {"cycle": "prepared"})
    return ChatResponse(text=f"Cycle cognitif préparé. Stratégie : « {selected} ». Plan : {' → '.join(cognition['plan']['steps'])}.", stage="reflection", cognitive={"perception": "done", "context": "done", "memory": "done", "reasoning": "done", "planning": "done", "selection": "done", "action": "done", "reflection": "done", "learning": "done", "evolution": "done", "inheritance": "ready"})
