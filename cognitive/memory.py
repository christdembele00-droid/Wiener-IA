from dataclasses import dataclass, field
from typing import Any

@dataclass
class MemoryItem:
    content: str
    importance: float = 0.5
    topics: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

class MemoryStore:
    def __init__(self, max_items: int = 1000):
        self.items: list[MemoryItem] = []
        self.max_items = max_items

    def remember(self, content: str, importance: float = 0.5, topics: list[str] | None = None, metadata: dict[str, Any] | None = None) -> MemoryItem:
        item = MemoryItem(content.strip(), max(0.0, min(1.0, importance)), topics or [], metadata or {})
        if item.content:
            self.items.append(item)
            self.items = self.items[-self.max_items:]
        return item

    def recall(self, query: str, limit: int = 5) -> list[MemoryItem]:
        words = {w for w in query.lower().split() if len(w) > 2}
        scored = []
        for item in self.items:
            score = sum(1 for w in words if w in item.content.lower())
            if score:
                scored.append((score + item.importance * 0.1, item))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def recent(self, limit: int = 10) -> list[MemoryItem]:
        return self.items[-limit:]

    def count(self) -> int:
        return len(self.items)
