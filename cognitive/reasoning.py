from typing import Any

class ReasoningEngine:
    """Builds a structured reasoning frame; it does not claim hidden chain-of-thought."""

    def prepare(self, perception: dict[str, Any], memories: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "objective": self._objective(perception),
            "facts": {
                "language": perception.get("language"),
                "intent": perception.get("intent"),
                "topics": perception.get("topics", []),
                "entities": perception.get("entities", []),
            },
            "relevant_memory": memories,
            "constraints": ["respecter le contexte fourni", "signaler l'incertitude"],
        }

    def _objective(self, perception: dict[str, Any]) -> str:
        intent = perception.get("intent", "conversation")
        return {
            "question": "répondre à la question",
            "explanation": "expliquer clairement",
            "creation": "produire le résultat demandé",
            "analysis": "analyser le problème",
            "instruction": "exécuter ou expliquer l'instruction",
        }.get(intent, "comprendre et poursuivre la conversation")
