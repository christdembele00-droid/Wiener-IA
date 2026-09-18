from dataclasses import dataclass, field
from typing import Any

@dataclass
class ContextFrame:
    session_id: str
    topic: str | None = None
    references: list[str] = field(default_factory=list)
    facts: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

class ContextEngine:
    def __init__(self):
        self.frames: dict[str, ContextFrame] = {}

    def update(self, session_id: str, message: str, perception: dict[str, Any]) -> ContextFrame:
        frame = self.frames.setdefault(session_id, ContextFrame(session_id=session_id))
        topics = perception.get("topics", [])
        if topics:
            frame.topic = topics[0]
        frame.metadata["last_message"] = message
        frame.metadata["language"] = perception.get("language")
        return frame

    def resolve(self, session_id: str, reference: str) -> str | None:
        frame = self.frames.get(session_id)
        return frame.metadata.get("last_message") if frame and reference else None
