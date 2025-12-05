"""
AI Tutor package for LangGraph-based tutoring system.
"""
try:
    from backend.teacher.Ai_Tutor.graph import create_ai_tutor_graph
except ImportError:
    from teacher.Ai_Tutor.graph import create_ai_tutor_graph

__all__ = ["create_ai_tutor_graph"]
