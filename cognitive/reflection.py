from typing import Any

class ReflectionEngine:
    def evaluate(self, perception: dict[str, Any], plan: dict[str, Any], decision: dict[str, Any], result: Any) -> dict[str, Any]:
        checks = {
            "goal_defined": bool(plan.get("objective")),
            "plan_defined": bool(plan.get("steps")),
            "strategy_defined": bool(decision.get("selected")),
            "result_present": result is not None,
        }
        passed = sum(checks.values())
        quality = passed / len(checks)
        return {
            "checks": checks,
            "quality": quality,
            "uncertainty_delta": -(quality * 0.05),
            "needs_revision": quality < 0.75,
        }
