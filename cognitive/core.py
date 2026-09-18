from dataclasses import dataclass, field
from typing import Any

from cognitive.perception import PerceptionProcessor, PerceptionResult
from cognitive.state import InternalState

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
    internal: InternalState = field(default_factory=InternalState)

    def perceive(self, input_data: Any) -> PerceptionResult:
        if not isinstance(input_data, str):
            raise TypeError("La perception attend actuellement une entrée texte.")
        result = self.perception.perceive(input_data)
        self.state.context["perception"] = result.to_dict()
        self.internal.set_phase("perception")
        self.internal.update_from_perception(result.to_dict())
        return result

    def begin(self, goal: str, strategy: str) -> None:
        self.state.goal = goal
        self.state.current_strategy = strategy
        self.internal.begin_cycle(goal, strategy)

    def act(self, action: dict[str, Any]) -> None:
        self.internal.record_action(action)
        self.state.context["last_action"] = action

    def reflect(self, result: Any) -> dict[str, Any]:
        reflection = {"result": result, "evaluated": True}
        self.state.history.append(reflection)
        self.internal.set_phase("reflection")
        return reflection

    def evolve(self, reflection: dict[str, Any]) -> None:
        if reflection.get("evaluated"):
            self.state.uncertainty = max(0.0, self.state.uncertainty - 0.05)
            self.internal.complete_cycle(self.state.uncertainty)
