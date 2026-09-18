from dataclasses import dataclass, field
from typing import Any

@dataclass
class MemoryLayers:
    short_term: list[dict[str, Any]] = field(default_factory=list)
    episodic: list[dict[str, Any]] = field(default_factory=list)
    semantic: dict[str, Any] = field(default_factory=dict)

    def add(self, item: dict[str, Any], importance: float = 0.5) -> None:
        self.short_term.append(item)
        self.short_term = self.short_term[-20:]
        if importance >= 0.7:
            self.episodic.append(item)
            self.episodic = self.episodic[-500:]
        for topic in item.get("topics", []):
            self.semantic[topic] = item.get("content", "")

    def consolidate(self) -> None:
        self.short_term = self.short_term[-10:]

    def forget(self, max_episodic: int = 500) -> None:
        self.episodic = self.episodic[-max_episodic:]
