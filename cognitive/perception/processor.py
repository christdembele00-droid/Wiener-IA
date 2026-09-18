from dataclasses import dataclass, asdict
import re
from typing import Any

@dataclass
class PerceptionResult:
    raw_text: str
    normalized_text: str
    language: str
    intent: str
    message_type: str
    question: bool
    urgency: str
    topics: list[str]
    entities: list[str]
    length: int
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

class PerceptionProcessor:
    """Converts raw user input into structured signals without generating an answer."""

    INTENT_PATTERNS = {
        "question": r"\b(qui|que|quoi|comment|pourquoi|quand|où|quel|quelle|combien|est-ce)\b|\?$",
        "explanation": r"\b(explique|expliquer|définis|définir|signifie|comprendre|cours)\b",
        "creation": r"\b(crée|créer|construis|construire|développe|développer|écris|écrire)\b",
        "analysis": r"\b(analyse|analyser|compare|comparer|étudie|étudier|évalue|évaluer)\b",
        "instruction": r"\b(fais|faire|donne|donner|montre|montrer|calcule|calculer|résous|résoudre)\b",
    }

    def perceive(self, text: str) -> PerceptionResult:
        raw = text.strip()
        normalized = re.sub(r"\s+", " ", raw.lower())
        language = self._detect_language(normalized)
        intent = self._detect_intent(normalized)
        message_type = self._message_type(normalized)
        urgency = self._detect_urgency(normalized)
        topics = self._extract_topics(normalized)
        entities = self._extract_entities(raw)
        confidence = self._confidence(intent, language)

        return PerceptionResult(
            raw_text=raw,
            normalized_text=normalized,
            language=language,
            intent=intent,
            message_type=message_type,
            question=bool("?" in raw or intent == "question"),
            urgency=urgency,
            topics=topics,
            entities=entities,
            length=len(raw),
            confidence=confidence,
        )

    def _detect_language(self, text: str) -> str:
        french = len(re.findall(r"\b(le|la|les|un|une|des|est|avec|pour|dans|que|je|tu|vous)\b", text))
        english = len(re.findall(r"\b(the|a|an|is|are|with|for|in|what|how|you|can)\b", text))
        if french > english and french > 0:
            return "fr"
        if english > french and english > 0:
            return "en"
        return "unknown"

    def _detect_intent(self, text: str) -> str:
        for intent, pattern in self.INTENT_PATTERNS.items():
            if re.search(pattern, text):
                return intent
        return "conversation"

    def _message_type(self, text: str) -> str:
        if not text:
            return "empty"
        if text.endswith("?") or re.search(r"^(qui|que|quoi|comment|pourquoi|quand|où|quel|quelle|combien)\b", text):
            return "question"
        if re.search(r"^(fais|donne|montre|calcule|explique|analyse|aide)\b", text):
            return "command"
        return "statement"

    def _detect_urgency(self, text: str) -> str:
        if re.search(r"\b(urgent|urgence|immédiatement|vite|asap)\b", text):
            return "high"
        return "normal"

    def _extract_topics(self, text: str) -> list[str]:
        topics = []
        vocabulary = {
            "mathématiques": ("math", "mathématique", "équation", "fonction", "limite"),
            "chimie": ("chimie", "alcool", "oxydation", "réaction", "molécule"),
            "informatique": ("code", "python", "javascript", "github", "api", "logiciel"),
            "projet": ("projet", "application", "système", "architecture"),
            "études": ("cours", "exercice", "devoir", "bac", "étude"),
        }
        for topic, words in vocabulary.items():
            if any(word in text for word in words):
                topics.append(topic)
        return topics

    def _extract_entities(self, text: str) -> list[str]:
        candidates = re.findall(r"\b[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{2,}\b", text)
        return list(dict.fromkeys(candidates))[:10]

    def _confidence(self, intent: str, language: str) -> float:
        score = 0.5
        if language != "unknown":
            score += 0.25
        if intent != "conversation":
            score += 0.2
        return min(score, 0.95)
