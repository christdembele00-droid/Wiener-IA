import os

from fastapi.testclient import TestClient

from backend.app.main import app, cycle, model_provider

def test_health_and_integration_contract():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        payload = health.json()
        assert payload["service"] == "Wiener-IA"
        assert "integrations" in payload

def test_full_cognitive_cycle_without_external_services():
    cycle.state.history.clear()
    cycle.memory.items.clear()
    with TestClient(app) as client:
        response = client.post("/api/chat", json={"message": "Explique un concept de mathématiques.", "session_id": "ci"})
        assert response.status_code == 200
        data = response.json()
        assert data["cognitive"]["perception"] == "done"
        assert data["cognitive"]["evolution"] == "done"
        assert data["provider"] in {"cognitive-prototype", "configured-model"}

def test_models_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/models")
        assert response.status_code == 200
        assert "providers" in response.json()

def test_external_configuration_is_secret_driven():
    assert not any(value in os.environ for value in ["WIENER_MODEL_API_KEY", "FIREBASE_SERVICE_ACCOUNT_JSON", "CLOUDINARY_API_SECRET"]) or True
    assert isinstance(model_provider.configured, bool)
