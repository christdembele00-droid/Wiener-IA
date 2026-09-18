from fastapi import FastAPI

app = FastAPI(title="Wiener-IA API", version="4.0.0")

@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "Wiener-IA", "version": "4.0.0"}

@app.get("/api")
async def api_root() -> dict[str, str]:
    return {"service": "Wiener-IA", "status": "foundation"}
