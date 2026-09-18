import os
import httpx

class ExternalModelProvider:
    name = "configured-model"

    def __init__(self):
        self.url = os.getenv("WIENER_MODEL_API_URL", "").rstrip("/")
        self.api_key = os.getenv("WIENER_MODEL_API_KEY", "")
        self.model = os.getenv("WIENER_MODEL_NAME", "")
        self.timeout = float(os.getenv("WIENER_MODEL_TIMEOUT", "30"))

    @property
    def configured(self) -> bool:
        return bool(self.url and self.api_key and self.model)

    async def generate(self, system_prompt: str, user_message: str) -> str:
        if not self.configured:
            raise RuntimeError("Model provider non configuré.")
        payload = {"model": self.model, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_message}]}
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(self.url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("Réponse du fournisseur de modèle invalide.") from exc
