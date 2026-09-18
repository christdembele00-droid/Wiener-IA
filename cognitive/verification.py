from dataclasses import dataclass
from typing import Any

@dataclass
class VerificationResult:
    valid: bool
    confidence: float
    issues: list[str]

class VerificationEngine:
    def verify(self, objective: str, response: str, uncertainty: float = 0.0) -> VerificationResult:
        issues: list[str] = []
        if not response.strip():
            issues.append("Réponse vide.")
        if not objective.strip():
            issues.append("Objectif absent.")
        confidence = max(0.0, min(1.0, 1.0 - uncertainty))
        return VerificationResult(not issues, confidence, issues)

    def snapshot(self, result: VerificationResult) -> dict[str, Any]:
        return {"valid": result.valid, "confidence": result.confidence, "issues": result.issues}
