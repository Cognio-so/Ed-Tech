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
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
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
    
    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.6)
    
    llm_messages = [SystemMessage(content=system_prompt)]
    
    if messages:
        for msg in messages:
            if hasattr(msg, 'content') and msg.content:
                if hasattr(msg, 'type') or hasattr(msg, 'role'):
                    msg_type = getattr(msg, 'type', None) or getattr(msg, 'role', None)
                    if msg_type and msg_type.lower() in ('human', 'user'):
                        llm_messages.append(HumanMessage(content=msg.content))
                    elif msg_type and msg_type.lower() in ('ai', 'assistant'):
                        llm_messages.append(AIMessage(content=msg.content))
                else:
                    llm_messages.append(HumanMessage(content=msg.content))
    else:
        user_message = state.get("resolved_query") or state.get("user_query", "")
        if user_message:
            llm_messages.append(HumanMessage(content=user_message))
    
    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state
    )
    
    state["simple_llm_response"] = full_response
    state["response"] = full_response
    
    return state

