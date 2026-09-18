from dataclasses import dataclass
from typing import Any

@dataclass
class LearningRecord:
    strategy: str
    quality: float
    uses: int = 1

class LearningEngine:
    def __init__(self):
        self.records: dict[str, LearningRecord] = {}

    def learn(self, strategy: str, quality: float) -> LearningRecord:
        quality = max(0.0, min(1.0, quality))
        record = self.records.get(strategy)
        if record is None:
            record = LearningRecord(strategy, quality)
            self.records[strategy] = record
        else:
            record.quality = (record.quality * record.uses + quality) / (record.uses + 1)
            record.uses += 1
        return record

    def snapshot(self) -> list[dict[str, Any]]:
        return [r.__dict__ for r in self.records.values()]
