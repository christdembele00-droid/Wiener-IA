from cognitive.context_engine import ContextEngine
from cognitive.memory_layers import MemoryLayers
from cognitive.strategy import StrategyEngine
from cognitive.tool_policy import ToolPolicy
from cognitive.verification import VerificationEngine
from cognitive.knowledge_genome import KnowledgeGenome

def test_advanced_cognitive_components():
    context = ContextEngine().update("s", "Explique les maths", {"topics": ["math"], "language": "fr"})
    assert context.topic == "math"

    memory = MemoryLayers()
    memory.add({"content": "important", "topics": ["math"]}, importance=0.9)
    assert memory.episodic

    strategy = StrategyEngine()
    assert strategy.choose(["direct", "step_by_step"], "high") == "step_by_step"

    assert ToolPolicy().select("cherche une source sur le web") == "web_search"

    verification = VerificationEngine().verify("objectif", "réponse")
    assert verification.valid

    genome = KnowledgeGenome.build(2, [{"strategy": "direct"}], {"direct": 0.8})
    assert genome.generation == 2
    assert genome.export()["dependencies"]
