from dataclasses import dataclass
from typing import Any

@dataclass
class StrategyRecord:
    name: str
    uses: int = 0
    success: float = 0.0

class StrategyEngine:
    def __init__(self):
        self.records: dict[str, StrategyRecord] = {}

    def choose(self, candidates: list[str], complexity: str = "normal") -> str:
        if not candidates:
            return "direct"
        known = [self.records.get(c) for c in candidates]
        known = [r for r in known if r]
        if known:
            return max(known, key=lambda r: r.success).name
        return "step_by_step" if complexity == "high" and "step_by_step" in candidates else candidates[0]

    def learn(self, name: str, quality: float) -> dict[str, Any]:
        record = self.records.setdefault(name, StrategyRecord(name))
        record.uses += 1
        record.success += (max(0.0, min(1.0, quality)) - record.success) / record.uses
        return record.__dict__.copy()
