"""
Websearch + KB Information node for AI Tutor.
Runs web search and KB retrieval in parallel.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
import os
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch
try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.teacher.Ai_Tutor.graph_type import GraphState
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from teacher.Ai_Tutor.graph_type import GraphState


async def _web_search(topic: str, subject: str, grade: str, language: str) -> str:
    """
    Perform web search using Tavily.
    """
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key:
        return "Web search unavailable: TAVILY_API_KEY not configured."
    
    try:
        tavily_tool = TavilySearch(
            max_results=3,
            api_key=tavily_api_key,
            search_depth="advanced",
            topic="general"
        )
        
        query = f"{topic} {subject} grade {grade} {language}"
        results = await tavily_tool.ainvoke(query)
        
        # Format results
        if isinstance(results, list):
            formatted_results = []
            for result in results[:5]:
                if isinstance(result, dict):
                    title = result.get("title", "")
                    url = result.get("url", "")
                    content = result.get("content", "")
                    formatted_results.append(f"Title: {title}\nURL: {url}\nContent: {content}\n")
                else:
                    formatted_results.append(str(result))
            return "\n".join(formatted_results)
        else:
            return str(results)
    except Exception as e:
        return f"Web search error: {str(e)}"


async def _retrieve_kb_information(topic: str, subject: str, grade: str) -> str:
    """
    Retrieve knowledge base information.
    This is a placeholder - implement actual KB retrieval logic.
    """
    # TODO: Implement actual KB retrieval
    return f"KB information for {topic} in {subject} for grade {grade}"


async def websearch_node(state: GraphState) -> GraphState:
    """
    Websearch + KB Information node.
    Runs web search and KB retrieval in parallel.
    """
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    teacher_data = state.get("teacher_data", {})
    grade = student_data.get("grade", "") if isinstance(student_data, dict) else ""
    
    # Extract grade from teacher_data if not in student_data
    if not grade and isinstance(teacher_data, dict):
        grades = teacher_data.get("grades", [])
        if grades and isinstance(grades, list) and len(grades) > 0:
            grade = str(grades[0])
    
    language = state.get("language", "English")
    chunk_callback = state.get("chunk_callback")
    
    # Get user query from state
    user_query = state.get("resolved_query") or state.get("user_query", "")
    
    print(f"[WEBSEARCH] 🔍 Query: {user_query}")
    print(f"[WEBSEARCH] 📚 Grade: {grade}, Subject: {subject}")
    
    # Run web search and KB retrieval in parallel
    # Use user_query for search instead of just topic
    search_query = user_query if user_query else f"{topic} {subject} grade {grade}"
    websearch_task = _web_search(search_query, subject, grade, language)
    kb_task = _retrieve_kb_information(topic, subject, grade)
    
    websearch_results, kb_information = await asyncio.gather(
        websearch_task,
        kb_task
    )
    
    # Combine results
    combined_context = f"""
    Web Search Results:
    {websearch_results}
    
    Knowledge Base Information:
    {kb_information}
    """
    
    # Get the latest user message
    messages = state.get("messages", [])
    user_message = ""
    if messages:
        user_message = messages[-1].content if hasattr(messages[-1], 'content') else str(messages[-1])
    
    system_prompt = f"""You are an expert AI tutor. You have access to:
    1. Real-time web search results
    2. Knowledge base information
    
    Synthesize the information from both sources to provide comprehensive, up-to-date responses.
    
    Language: {language}
    Grade Level: {grade}
    """
    
    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.7)
    
    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Context:\n{combined_context}\n\nUser Question: {user_query}")
    ]
    
    # Stream response
    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state
    )
    
    # Update state - store both raw results and the LLM response
    state["websearch_results"] = full_response  # Store the LLM's synthesized response
    state["response"] = full_response  # Store in response for orchestrator
    state["kb_information"] = kb_information
    
    return state

