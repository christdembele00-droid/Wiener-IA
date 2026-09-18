from dataclasses import dataclass
from typing import Any

@dataclass
class Plan:
    objective: str
    steps: list[str]
    strategy: str
    confidence: float

class PlanningEngine:
    def build(self, reasoning_frame: dict[str, Any]) -> Plan:
        objective = reasoning_frame["objective"]
        if objective == "répondre à la question":
            steps = ["identifier les éléments utiles", "formuler une réponse", "vérifier la cohérence"]
        elif objective == "analyser le problème":
            steps = ["décomposer le problème", "examiner les relations", "formuler une conclusion"]
        elif objective == "expliquer clairement":
            steps = ["identifier le concept", "ordonner les idées", "adapter l'explication"]
        else:
            steps = ["comprendre la demande", "produire une réponse", "vérifier le résultat"]
        return Plan(objective, steps, "direct", 0.65)
