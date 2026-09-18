from dataclasses import dataclass
from typing import Any

@dataclass
class ModelProvider:
    name: str
    capabilities: set[str]
    priority: int = 100
    enabled: bool = True

class ModelRouter:
    def __init__(self, providers: list[ModelProvider] | None = None):
        self.providers = providers or []

    def register(self, provider: ModelProvider) -> None:
        self.providers.append(provider)

    def select(self, capability: str, complexity: str = "normal") -> ModelProvider | None:
        candidates = [p for p in self.providers if p.enabled and capability in p.capabilities]
        if not candidates:
            return None
        candidates.sort(key=lambda p: (0 if complexity == "high" and "reasoning" in p.capabilities else 1, p.priority))
        return candidates[0]

    def snapshot(self) -> list[dict[str, Any]]:
        return [{"name": p.name, "capabilities": sorted(p.capabilities), "priority": p.priority, "enabled": p.enabled} for p in self.providers]
