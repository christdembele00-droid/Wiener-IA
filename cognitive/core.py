from dataclasses import dataclass, field
from typing import Any

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

    def perceive(self, input_data: Any) -> Any:
        self.state.context["perception"] = {"type": type(input_data).__name__}
        return input_data

    def reflect(self, result: Any) -> dict[str, Any]:
        reflection = {"result": result, "evaluated": True}
        self.state.history.append(reflection)
        return reflection

    def evolve(self, reflection: dict[str, Any]) -> None:
        if reflection.get("evaluated"):
            self.state.uncertainty = max(0.0, self.state.uncertainty - 0.05)
