from dataclasses import dataclass
from typing import Any

@dataclass
class KnowledgeGenome:
    generation: int
    strategy_preferences: dict[str, float]
    trajectory: list[dict[str, Any]]
    dependencies: list[str]
    instability: float

    def export(self) -> dict[str, Any]:
        return self.__dict__.copy()

class InheritanceEngine:
    def build(self, evolution: dict[str, Any], trajectory: list[dict[str, Any]]) -> KnowledgeGenome:
        return KnowledgeGenome(
            evolution["generation"],
            evolution["preferences"],
            trajectory[-20:],
            ["memory", "learning", "selection"],
            self._instability(evolution["preferences"]),
        )

    def _instability(self, preferences: dict[str, float]) -> float:
        if not preferences:
            return 1.0
        return round(1.0 - sum(preferences.values()) / len(preferences), 4)
