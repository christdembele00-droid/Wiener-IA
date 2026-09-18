from dataclasses import dataclass, field
from typing import Any

@dataclass
class EvolutionEngine:
    generation: int = 1
    strategy_preferences: dict[str, float] = field(default_factory=dict)

    def evolve(self, learning: list[dict[str, Any]]) -> dict[str, Any]:
        for record in learning:
            self.strategy_preferences[record["strategy"]] = record["quality"]
        self.generation += 1
        return {"generation": self.generation, "preferences": dict(self.strategy_preferences)}

