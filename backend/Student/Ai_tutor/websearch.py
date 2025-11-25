"""
Web search node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
import os

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch

from backend.llm import get_llm, stream_with_token_tracking
from backend.Student.Ai_tutor.graph_type import StudentGraphState


async def _web_search(topic: str, subject: str, grade: str, language: str) -> str:
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key:
        return "Web search unavailable: TAVILY_API_KEY not configured."

    try:
        tavily_tool = TavilySearch(
            max_results=5,
            api_key=tavily_api_key,
            search_depth="advanced",
            topic="general",
        )

        query = " ".join(filter(None, [topic, subject, grade, language]))
        results = await tavily_tool.ainvoke(query.strip() or "latest education news")

        if isinstance(results, list):
            formatted = []
            for result in results[:5]:
                if isinstance(result, dict):
                    formatted.append(
                        f"Title: {result.get('title', '')}\nURL: {result.get('url', '')}\nContent: {result.get('content', '')}\n"
                    )
                else:
                    formatted.append(str(result))
            return "\n".join(formatted)
        return str(results)
    except Exception as exc:
        return f"Web search error: {exc}"


async def _retrieve_kb_information(topic: str, subject: str, grade: str) -> str:
    if not any([topic, subject, grade]):
        return "General study tips for balanced learning."
    return f"Knowledge base insights for {topic or 'current topic'} in {subject or 'general studies'} for grade {grade or 'mixed levels'}."


async def websearch_node(state: StudentGraphState) -> StudentGraphState:
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    grade = student_profile.get("grade", "")
    language = state.get("language", "English")
    chunk_callback = state.get("chunk_callback")

    websearch_task = _web_search(topic, subject, grade, language)
    kb_task = _retrieve_kb_information(topic, subject, grade)

    websearch_results, kb_information = await asyncio.gather(websearch_task, kb_task)

    combined_context = f"""
Web Search Results:
{websearch_results}

Knowledge Base:
{kb_information}
""".strip()

    messages = state.get("messages", [])
    user_message = ""
    if messages:
        last = messages[-1]
        user_message = last.content if hasattr(last, "content") else str(last)
    else:
        user_message = state.get("resolved_query") or state.get("user_query", "")

    system_prompt = f"""You are a real-time study buddy.
Blend current information with trusted knowledge base details.
Explain clearly, cite key facts, and relate them to the student's studies.
Language: {language}
Grade: {grade or 'General'}
"""

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.65)
    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Context:\n{combined_context}\n\nStudent question: {user_message}"),
    ]

    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state,
    )

    state["websearch_results"] = full_response
    state["response"] = full_response
    state["kb_information"] = kb_information
    state["token_usage"] = token_usage

    return state


