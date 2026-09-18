from dataclasses import asdict, dataclass, field
from typing import Any

@dataclass
class InternalState:
    """Runtime state of one Wiener-IA cognitive process."""

    session_id: str = "default"
    phase: str = "idle"
    goal: str | None = None
    strategy: str | None = None
    uncertainty: float = 1.0
    attention: list[str] = field(default_factory=list)
    active_context: dict[str, Any] = field(default_factory=dict)
    last_perception: dict[str, Any] | None = None
    last_action: dict[str, Any] | None = None
    cycle_count: int = 0
    state_version: int = 1

    def set_phase(self, phase: str) -> None:
        self.phase = phase

    def update_from_perception(self, perception: dict[str, Any]) -> None:
        self.last_perception = perception
        self.active_context["language"] = perception.get("language")
        self.active_context["intent"] = perception.get("intent")
        self.active_context["topics"] = perception.get("topics", [])
        self.attention = list(perception.get("topics", []))

    def begin_cycle(self, goal: str, strategy: str) -> None:
        self.cycle_count += 1
        self.goal = goal
        self.strategy = strategy
        self.phase = "reasoning"

    def record_action(self, action: dict[str, Any]) -> None:
        self.last_action = action
        self.phase = "action"

    def complete_cycle(self, uncertainty: float | None = None) -> None:
        if uncertainty is not None:
            self.uncertainty = max(0.0, min(1.0, uncertainty))
        self.phase = "idle"

    def snapshot(self) -> dict[str, Any]:
        return asdict(self)
