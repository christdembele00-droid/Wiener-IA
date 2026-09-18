class ToolPolicy:
    ALLOWED = {"calculator", "web_search", "vision", "memory", "file_analysis"}

    def can_use(self, name: str) -> bool:
        return name in self.ALLOWED

    def select(self, need: str) -> str | None:
        text = need.lower()
        if any(x in text for x in ("calcul", "équation", "math")):
            return "calculator"
        if any(x in text for x in ("internet", "web", "actualité", "source")):
            return "web_search"
        if any(x in text for x in ("image", "photo", "vidéo")):
            return "vision"
        return None
