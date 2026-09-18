from dataclasses import dataclass
from typing import Any

@dataclass
class Decision:
    selected: str
    alternatives: list[str]
    rationale: str
    score: float

class DecisionEngine:
    def select(self, plan: dict[str, Any], uncertainty: float) -> Decision:
        candidates = ["direct", "step_by_step", "clarification"]
        if uncertainty >= 0.75:
            selected = "clarification"
            rationale = "incertitude élevée : réduire l'ambiguïté avant d'agir"
        elif len(plan.get("steps", [])) >= 3:
            selected = "step_by_step"
            rationale = "la demande bénéficie d'une décomposition structurée"
        else:
            selected = "direct"
            rationale = "la demande peut être traitée directement"
        return Decision(selected, [c for c in candidates if c != selected], rationale, 1.0 - uncertainty * 0.5)
