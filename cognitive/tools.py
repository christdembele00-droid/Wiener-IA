from dataclasses import dataclass
from typing import Any, Callable

@dataclass
class Tool:
    name: str
    description: str
    handler: Callable[..., Any]

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, name: str, description: str, handler: Callable[..., Any]) -> None:
        self._tools[name] = Tool(name, description, handler)

    def list(self) -> list[dict[str, str]]:
        return [{"name": t.name, "description": t.description} for t in self._tools.values()]

    def execute(self, name: str, **kwargs: Any) -> Any:
        tool = self._tools.get(name)
        if not tool:
            raise KeyError(f"Outil inconnu: {name}")
        return tool.handler(**kwargs)

def calculate(expression: str) -> dict[str, Any]:
    allowed = set("0123456789+-*/(). %")
    if not expression or any(c not in allowed for c in expression):
        return {"ok": False, "error": "Expression non autorisée."}
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return {"ok": True, "result": result}
    except Exception:
        return {"ok": False, "error": "Expression invalide."}

def default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register("calculator", "Calcul arithmétique contrôlé.", calculate)
    return registry
