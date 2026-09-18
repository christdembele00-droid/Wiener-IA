import os
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cognitive.core import CognitiveCycle, CognitiveState
from cognitive.context_engine import ContextEngine
from cognitive.memory_layers import MemoryLayers
from cognitive.strategy import StrategyEngine
from cognitive.tool_policy import ToolPolicy
from cognitive.verification import VerificationEngine
from cognitive.knowledge_genome import KnowledgeGenome
from cognitive.router import ModelProvider
from database.repository import PostgresMemoryRepository
from services.authentication.firebase_admin import FirebaseAuthService
from services.model.model_provider import ExternalModelProvider
from services.storage.cloudinary_service import CloudinaryService

app = FastAPI(title="Wiener-IA API", version="6.1.0")
origins = [origin.strip() for origin in os.getenv("WIENER_ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=origins != ["*"], allow_methods=["*"], allow_headers=["*"])

cycle = CognitiveCycle(CognitiveState())
database = PostgresMemoryRepository()
model_provider = ExternalModelProvider()
firebase = FirebaseAuthService()
cloudinary_service = CloudinaryService()
context_engine = ContextEngine()
memory_layers = MemoryLayers()
strategy_engine = StrategyEngine()
tool_policy = ToolPolicy()
verification_engine = VerificationEngine()
connections: list[WebSocket] = []

if model_provider.configured:
    cycle.router.register(ModelProvider(name="configured-model", capabilities={"chat", "reasoning"}, priority=10))

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    session_id: str = Field(default="default", min_length=1, max_length=200)
    id_token: str | None = None

class ChatResponse(BaseModel):
    text: str
    stage: str
    cognitive: dict[str, str]
    provider: str

class PerceptionRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)

class MemoryRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    importance: float = Field(default=0.5, ge=0, le=1)
    topics: list[str] = Field(default_factory=list)
    session_id: str = Field(default="default", min_length=1, max_length=200)

class ToolRequest(BaseModel):
    name: str
    arguments: dict[str, object] = Field(default_factory=dict)

async def broadcast(event: str, payload: dict) -> None:
    dead = []
    for websocket in connections:
        try:
            await websocket.send_json({"event": event, **payload})
        except Exception:
            dead.append(websocket)
    for websocket in dead:
        if websocket in connections:
            connections.remove(websocket)

@app.on_event("startup")
async def startup() -> None:
    if database.configured:
        database.ensure_schema()

@app.get("/health")
async def health() -> dict[str, object]:
    db_ok = database.health() if database.configured else False
    return {"ok": True, "service": "Wiener-IA", "version": "6.1.0", "integrations": {"postgresql": db_ok, "model": model_provider.configured, "firebase": firebase.configured, "cloudinary": cloudinary_service.configured}}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "cognitive-backend"}

@app.get("/api/integrations")
async def integrations() -> dict[str, object]:
    db_ok = database.health() if database.configured else False
    return {"postgresql": {"configured": database.configured, "healthy": db_ok}, "model_router": {"configured": bool(cycle.router.snapshot()), "providers": cycle.router.snapshot()}, "firebase": {"configured": firebase.configured}, "cloudinary": {"configured": cloudinary_service.configured}}

@app.get("/api/status")
async def status() -> dict[str, object]:
    return {"service": "Wiener-IA", "state": cycle.state.__dict__, "internal": cycle.internal.snapshot(), "context_sessions": len(context_engine.frames), "memory_count": database.count() if database.configured else cycle.memory.count(), "tools": cycle.tools.list(), "models": cycle.router.snapshot(), "learning": cycle.learning.snapshot(), "evolution": {"generation": cycle.evolution.generation, "strategy_preferences": cycle.evolution.strategy_preferences}, "pipeline": ["perception", "context", "memory", "reasoning", "planning", "selection", "action", "model", "reflection", "learning", "evolution", "inheritance"]}

@app.post("/api/perception")
async def perception(request: PerceptionRequest) -> dict[str, object]:
    result = cycle.perceive(request.message)
    return {"stage": "perception", "perception": result.to_dict(), "internal": cycle.internal.snapshot()}

@app.post("/api/memory")
async def remember(request: MemoryRequest) -> dict[str, object]:
    item = cycle.memory.remember(request.content, request.importance, request.topics)
    if database.configured:
        database.remember(request.session_id, request.content, request.importance, request.topics)
    return {"stage": "memory", "memory": item.__dict__, "persistent": database.configured, "count": database.count(request.session_id) if database.configured else cycle.memory.count()}

@app.get("/api/memory")
async def recent_memory(limit: int = 10, session_id: str = "default") -> dict[str, object]:
    limit = max(1, min(limit, 100))
    if database.configured:
        return {"stage": "memory", "persistent": True, "items": database.recent(session_id, limit)}
    return {"stage": "memory", "persistent": False, "items": [item.__dict__ for item in cycle.memory.recent(limit)]}

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
    return {"providers": cycle.router.snapshot(), "external_configured": model_provider.configured}

@app.get("/api/evolution")
async def evolution() -> dict[str, object]:
    return {"generation": cycle.evolution.generation, "preferences": cycle.evolution.strategy_preferences, "genome": cycle.inheritance.build({"generation": cycle.evolution.generation, "preferences": cycle.evolution.strategy_preferences}, cycle.state.history).export()}

@app.get("/api/cognition")
async def cognition_status() -> dict[str, object]:
    genome = KnowledgeGenome.build(cycle.evolution.generation, cycle.state.history, cycle.evolution.strategy_preferences)
    return {"context_sessions": len(context_engine.frames), "memory_layers": memory_layers.__dict__, "strategies": {k: v.__dict__ for k, v in strategy_engine.records.items()}, "genome": genome.export(), "tool_policy": sorted(tool_policy.ALLOWED)}

@app.get("/api/metrics")
async def metrics() -> dict[str, object]:
    return {"cycles": cycle.internal.cycle_count, "memory_items": database.count() if database.configured else cycle.memory.count(), "generation": cycle.evolution.generation, "history_items": len(cycle.state.history), "active_websockets": len(connections)}

@app.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...)) -> dict[str, object]:
    if not cloudinary_service.configured:
        raise HTTPException(status_code=503, detail="Cloudinary non configuré.")
    suffix = os.path.splitext(file.filename or "")[1]
    temp_path = f"/tmp/wiener_upload{suffix}"
    with open(temp_path, "wb") as output:
        output.write(await file.read())
    try:
        result = cloudinary_service.upload(temp_path)
        return {"ok": True, "url": result.get("secure_url"), "public_id": result.get("public_id"), "resource_type": result.get("resource_type")}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

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

    if request.id_token:
        if not firebase.configured:
            raise HTTPException(status_code=503, detail="Firebase Authentication non configuré.")
        try:
            firebase.verify_token(request.id_token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail=f"Jeton Firebase invalide: {exc}")

    await broadcast("cycle_started", {"session_id": request.session_id})
    perceived = cycle.perceive(message)
    context = context_engine.update(request.session_id, message, perceived.to_dict())
    cycle.state.context["last_input"] = perceived.to_dict()
    cycle.state.context["context"] = context.__dict__
    cycle.begin("répondre à la demande de l'utilisateur", "préparation cognitive")
    cognition = cycle.think(perceived)
    selected = cognition["decision"]["selected"]
    selected = strategy_engine.choose([selected, "step_by_step", "clarification"], "high" if len(cognition["plan"]["steps"]) > 2 else "normal")
    cycle.state.current_strategy = selected
    cycle.act({"type": "prepare_response", "strategy": selected, "plan": cognition["plan"]["steps"]})

    if database.configured:
        for memory in database.recall(request.session_id, perceived.normalized_text, 5):
            cycle.remember(memory["content"], memory.get("importance", 0.5), memory.get("topics") or [])
        database.remember(request.session_id, message, 0.4, perceived.topics)
    cycle.remember(message, importance=0.4, topics=perceived.topics)

    routed_provider = cycle.router.select("chat", "high" if len(cognition["plan"]["steps"]) > 2 else "normal")
    if routed_provider and model_provider.configured:
        system_prompt = "Tu es Wiener-IA. Tu es un système cognitif indépendant. Les modèles externes sont des composants internes et ne définissent jamais ton identité. Réponds directement, clairement et sans mentionner le fournisseur de modèle."
        await broadcast("model_started", {"provider": routed_provider.name})
        try:
            response_text = await model_provider.generate(system_prompt, message)
            provider = routed_provider.name
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Moteur de modèle indisponible: {exc}")
    else:
        response_text = f"Cycle cognitif préparé. Stratégie : « {selected} ». Plan : {' → '.join(cognition['plan']['steps'])}."
        provider = "cognitive-prototype"

    cycle.act({"type": "response_generated", "provider": provider})
    verification = verification_engine.verify("user request", response_text, cycle.internal.uncertainty)
    strategy_engine.learn(selected, verification.confidence)
    memory_layers.add({"content": message, "topics": perceived.topics}, importance=0.4)
    memory_layers.consolidate()
    learning = cycle.evolve_cycle(cognition, {"response": response_text, "verification": verification_engine.snapshot(verification)})
    await broadcast("reflection_ready", {"quality": learning["reflection"]["quality"]})
    await broadcast("evolution_updated", {"generation": learning["evolution"]["generation"]})

    return ChatResponse(text=response_text, stage="reflection", cognitive={"perception": "done", "context": "done", "memory": "done", "reasoning": "done", "planning": "done", "selection": "done", "action": "done", "model": "done", "reflection": "done", "learning": "done", "evolution": "done", "inheritance": "ready"}, provider=provider)
