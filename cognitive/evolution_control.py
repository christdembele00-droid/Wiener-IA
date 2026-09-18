from dataclasses import dataclass
from typing import Any

@dataclass
class EvolutionProposal:
    changes: dict[str, Any]
    reason: str
    expected_gain: float

class EvolutionController:
    ALLOWED = {"strategy_preferences", "routing_preferences", "memory_policy"}

    def validate(self, proposal: EvolutionProposal) -> bool:
        return bool(proposal.changes) and set(proposal.changes).issubset(self.ALLOWED) and 0 <= proposal.expected_gain <= 1

    def simulate(self, current: dict[str, Any], proposal: EvolutionProposal) -> dict[str, Any]:
        result = dict(current)
        if self.validate(proposal):
            result.update(proposal.changes)
        return result

    def apply(self, current: dict[str, Any], proposal: EvolutionProposal) -> dict[str, Any]:
        if not self.validate(proposal):
            raise ValueError("Proposition d'évolution refusée.")
        return self.simulate(current, proposal)
