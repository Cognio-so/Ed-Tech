import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from langgraph.graph import StateGraph, END

try:
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
    from backend.Student.Ai_tutor.observality import trace_node
    from backend.Student.Ai_tutor.orchestrator import orchestrator_node, route_decision
    from backend.Student.Ai_tutor.simple_llm import simple_llm_node
    from backend.Student.Ai_tutor.rag import rag_node
    from backend.Student.Ai_tutor.websearch import websearch_node
    from backend.Student.Ai_tutor.image import image_node
except ImportError:
    from Student.Ai_tutor.graph_type import StudentGraphState
    from Student.Ai_tutor.observality import trace_node
    from Student.Ai_tutor.orchestrator import orchestrator_node, route_decision
    from Student.Ai_tutor.simple_llm import simple_llm_node
    from Student.Ai_tutor.rag import rag_node
    from Student.Ai_tutor.websearch import websearch_node
    from Student.Ai_tutor.image import image_node


def create_student_ai_tutor_graph():
    graph = StateGraph(StudentGraphState)

    graph.add_node("orchestrator", trace_node(orchestrator_node, "student_orchestrator"))
    graph.add_node("simple_llm", trace_node(simple_llm_node, "student_simple_llm"))
    graph.add_node("rag", trace_node(rag_node, "student_rag"))
    graph.add_node("websearch", trace_node(websearch_node, "student_websearch"))
    graph.add_node("image", trace_node(image_node, "student_image"))

    graph.set_entry_point("orchestrator")

    graph.add_conditional_edges(
        "orchestrator",
        route_decision,
        {
            "simple_llm": "simple_llm",
            "rag": "rag",
            "websearch": "websearch",
            "image": "image",
            "END": END,
        },
    )

    graph.add_edge("simple_llm", "orchestrator")
    graph.add_edge("rag", "orchestrator")
    graph.add_edge("websearch", "orchestrator")
    graph.add_edge("image", "orchestrator")

    return graph.compile()
