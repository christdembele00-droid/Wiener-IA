from cognitive.core import CognitiveCycle, CognitiveState

def test_cognitive_cycle():
    cycle = CognitiveCycle(CognitiveState())
    perception = cycle.perceive("Explique les mathématiques")
    assert perception.intent in {"question", "explanation", "conversation"}
    result = cycle.think(perception)
    assert result["plan"]["steps"]
    assert result["decision"]["selected"]
