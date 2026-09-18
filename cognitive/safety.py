class EvolutionSafety:
    """Guards changes to cognitive policy; no arbitrary self-modifying code."""

    ALLOWED_FIELDS = {"strategy_preferences"}

    def validate(self, proposal: dict) -> bool:
        return set(proposal).issubset(self.ALLOWED_FIELDS)

    def apply(self, current: dict, proposal: dict) -> dict:
        if not self.validate(proposal):
            raise ValueError("Évolution non autorisée.")
        merged = dict(current)
        merged.update(proposal)
        return merged
