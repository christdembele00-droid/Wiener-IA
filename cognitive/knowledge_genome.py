from dataclasses import dataclass, asdict
from typing import Any

@dataclass
class KnowledgeGenome:
    generation: int
    trajectory: list[dict[str, Any]]
    strategies: dict[str, float]
    dependencies: list[str]
    instability: float
    meta_impact: float

    def export(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def build(cls, generation: int, trajectory: list[dict[str, Any]], strategies: dict[str, float]) -> "KnowledgeGenome":
        values = list(strategies.values())
        instability = round(1.0 - (sum(values) / len(values) if values else 0.0), 4)
        return cls(generation, trajectory[-50:], strategies, ["memory", "learning", "selection"], instability, min(1.0, len(trajectory) / 100.0))
