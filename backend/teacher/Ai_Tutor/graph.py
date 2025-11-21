"""
LangGraph definition for AI Tutor.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Dict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
from backend.teacher.Ai_Tutor.graph_type import GraphState
from .observality import trace_node
from backend.teacher.Ai_Tutor.orchestrator import orchestrator_node, route_decision
from backend.teacher.Ai_Tutor.simple_llm import simple_llm_node
from backend.teacher.Ai_Tutor.rag import rag_node
from backend.teacher.Ai_Tutor.websearch import websearch_node
from backend.teacher.Ai_Tutor.image import image_node


def create_ai_tutor_graph():
    """
    Create and compile the AI Tutor LangGraph.
    """
    g = StateGraph(GraphState)
    
    # Add nodes with tracing
    g.add_node("orchestrator", trace_node(orchestrator_node, "orchestrator"))
    g.add_node("simple_llm", trace_node(simple_llm_node, "simple_llm"))
    g.add_node("rag", trace_node(rag_node, "rag"))
    g.add_node("websearch", trace_node(websearch_node, "websearch"))
    g.add_node("image", trace_node(image_node, "image"))
    
    # Set entry point
    g.set_entry_point("orchestrator")
    
    # Add conditional edges from orchestrator
    g.add_conditional_edges(
        "orchestrator",
        route_decision,
        {
            "simple_llm": "simple_llm",
            "rag": "rag",
            "websearch": "websearch",
            "image": "image",
            "END": END,
        }
    )
    
    # All nodes go back to orchestrator (simple edges)
    g.add_edge("simple_llm", "orchestrator")
    g.add_edge("rag", "orchestrator")
    g.add_edge("websearch", "orchestrator")
    g.add_edge("image", "orchestrator")
    
    return g.compile()
