from dataclasses import dataclass, field
from typing import Any

from cognitive.decision import DecisionEngine
from cognitive.evolution import EvolutionEngine
from cognitive.inheritance import InheritanceEngine
from cognitive.learning import LearningEngine
from cognitive.memory import MemoryStore
from cognitive.perception import PerceptionProcessor, PerceptionResult
from cognitive.planning import PlanningEngine
from cognitive.reasoning import ReasoningEngine
from cognitive.reflection import ReflectionEngine
from cognitive.router import ModelRouter
from cognitive.safety import EvolutionSafety
from cognitive.state import InternalState
from cognitive.tools import ToolRegistry, default_registry

@dataclass
class CognitiveState:
    context: dict[str, Any] = field(default_factory=dict)
    goal: str | None = None
    uncertainty: float = 1.0
    current_strategy: str | None = None
    history: list[dict[str, Any]] = field(default_factory=list)

@dataclass
class CognitiveCycle:
    state: CognitiveState
    perception: PerceptionProcessor = field(default_factory=PerceptionProcessor)
    internal: InternalState = field(default_factory=InternalState)
    memory: MemoryStore = field(default_factory=MemoryStore)
    reasoning: ReasoningEngine = field(default_factory=ReasoningEngine)
    planning: PlanningEngine = field(default_factory=PlanningEngine)
    decision: DecisionEngine = field(default_factory=DecisionEngine)
    reflection: ReflectionEngine = field(default_factory=ReflectionEngine)
    learning: LearningEngine = field(default_factory=LearningEngine)
    evolution: EvolutionEngine = field(default_factory=EvolutionEngine)
    inheritance: InheritanceEngine = field(default_factory=InheritanceEngine)
    safety: EvolutionSafety = field(default_factory=EvolutionSafety)
    tools: ToolRegistry = field(default_factory=default_registry)
    router: ModelRouter = field(default_factory=ModelRouter)

    def perceive(self, input_data: Any) -> PerceptionResult:
        if not isinstance(input_data, str):
            raise TypeError("La perception attend actuellement une entrée texte.")
        result = self.perception.perceive(input_data)
        self.state.context["perception"] = result.to_dict()
        self.internal.set_phase("perception")
        self.internal.update_from_perception(result.to_dict())
        return result

    def begin(self, goal: str, strategy: str) -> None:
        self.state.goal = goal
        self.state.current_strategy = strategy
        self.internal.begin_cycle(goal, strategy)

    def think(self, perceived: PerceptionResult) -> dict[str, Any]:
        memories = [item.__dict__ for item in self.memory.recall(perceived.normalized_text)]
        frame = self.reasoning.prepare(perceived.to_dict(), memories)
        plan = self.planning.build(frame)
        decision = self.decision.select({"steps": plan.steps}, self.state.uncertainty)
        return {"frame": frame, "plan": plan.__dict__, "decision": decision.__dict__}

    def remember(self, content: str, importance: float = 0.5, topics: list[str] | None = None) -> None:
        self.memory.remember(content, importance, topics)

    def act(self, action: dict[str, Any]) -> None:
        self.internal.record_action(action)
        self.state.context["last_action"] = action

    def reflect(self, result: Any) -> dict[str, Any]:
        reflection = self.reflection.evaluate(
            self.state.context.get("perception", {}),
            result.get("plan", {}) if isinstance(result, dict) else {},
            result.get("decision", {}) if isinstance(result, dict) else {},
            result,
        )
        self.state.history.append(reflection)
        self.internal.set_phase("reflection")
        return reflection

    def evolve_cycle(self, cognition: dict[str, Any], result: Any = None) -> dict[str, Any]:
        selected = cognition["decision"]["selected"]
        reflection = self.reflection.evaluate(
            self.state.context.get("perception", {}),
            cognition["plan"],
            cognition["decision"],
            result or {"cycle": "prepared"},
        )
        learned = self.learning.learn(selected, reflection["quality"])
        evolution = self.evolution.evolve(self.learning.snapshot())
        proposal = {"strategy_preferences": evolution["preferences"]}
        safe_preferences = self.safety.apply(self.evolution.strategy_preferences, proposal)
        self.evolution.strategy_preferences = safe_preferences
        genome = self.inheritance.build(evolution, self.state.history)
        self.state.history.append({"reflection": reflection, "learning": learned.__dict__, "evolution": evolution, "genome": genome.export()})
        self.state.uncertainty = max(0.0, min(1.0, self.state.uncertainty + reflection["uncertainty_delta"]))
        self.internal.complete_cycle(self.state.uncertainty)
        return {"reflection": reflection, "learning": learned.__dict__, "evolution": evolution, "genome": genome.export()}

    def evolve(self, reflection: dict[str, Any]) -> None:
        if reflection.get("quality") is not None:
            self.state.uncertainty = max(0.0, min(1.0, self.state.uncertainty + reflection["uncertainty_delta"]))
        self.internal.complete_cycle(self.state.uncertainty)
