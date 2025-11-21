"""
Simple LLM + KBRAG node for AI Tutor.
Uses a simple LLM with knowledge base RAG.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from backend.llm import get_llm, stream_with_token_tracking
from backend.teacher.Ai_Tutor.graph_type import GraphState


async def simple_llm_node(state: GraphState) -> GraphState:
    """
    Simple LLM + KBRAG node.
    Uses a simple LLM with knowledge base context.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    grade = student_data.get("grade", "") if isinstance(student_data, dict) else ""
    language = state.get("language", "English")
    chunk_callback = state.get("chunk_callback")
    
    kb_context = f"""
    Topic: {topic}
    Subject: {subject}
    Grade Level: {grade}
    Language: {language}
    """
    
    system_prompt = f"""You are an expert AI tutor helping teachers create educational content.
    You have access to knowledge base information about the topic.
    
    Context from Knowledge Base:
    {kb_context}
    
    Provide clear, educational, and age-appropriate responses based on the knowledge base.
    """
    
    user_message = state.get("resolved_query") or state.get("user_query", "")
    if not user_message and messages:
        user_message = messages[-1].content if hasattr(messages[-1], 'content') else str(messages[-1])
    
    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.6)
    
    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message)
    ]
    
    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state
    )
    
    state["simple_llm_response"] = full_response
    state["response"] = full_response
    
    return state

