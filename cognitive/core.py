from dataclasses import dataclass, field
from typing import Any

from cognitive.perception import PerceptionProcessor, PerceptionResult

@dataclass
class CognitiveState:
    context: dict[str, Any] = field(default_factory=dict)
    goal: str | None = None
    uncertainty: float = 1.0
    current_strategy: str | None = None
    history: list[dict[str, Any]] = field(default_factory=list)

@dataclass
class CognitiveCycle:
    state: CognitiveState
    perception: PerceptionProcessor = field(default_factory=PerceptionProcessor)

    def perceive(self, input_data: Any) -> PerceptionResult:
        if not isinstance(input_data, str):
            raise TypeError("La perception attend actuellement une entrée texte.")
        result = self.perception.perceive(input_data)
        self.state.context["perception"] = result.to_dict()
        return result

    def reflect(self, result: Any) -> dict[str, Any]:
        reflection = {"result": result, "evaluated": True}
        self.state.history.append(reflection)
        return reflection

    def evolve(self, reflection: dict[str, Any]) -> None:
        if reflection.get("evaluated"):
            self.state.uncertainty = max(0.0, self.state.uncertainty - 0.05)
