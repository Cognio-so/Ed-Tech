"""
Orchestrator node for AI Tutor with LLM-based routing.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import os
import json
import re
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.llm import get_llm
from backend.teacher.Ai_Tutor.graph_type import GraphState


def load_orchestrator_prompt() -> str:
    """Load orchestrator prompt from XML file and pass it directly to the LLM."""
    prompt_file = Path(__file__).parent / "orchestrator_prompt.xml"
    try:
        return prompt_file.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"[Orchestrator] Warning: Prompt file not found at {prompt_file}, using default")
    except Exception as e:
        print(f"[Orchestrator] Error loading XML prompt: {e}, using default")
    return get_default_prompt()


def get_default_prompt() -> str:
    """Fallback default prompt if XML loading fails."""
    return """<system>
You are an AI Orchestrator for an educational AI Tutor system.
Your job is to analyze user queries and decide which processing node should handle them.

<available_nodes>
- SimpleLLM: For straightforward questions, explanations, definitions
- RAG: For questions requiring document analysis, when user documents are available
- WebSearch: For current events, latest information, real-time data
- Image: For image generation requests
</available_nodes>

<output_format>
Analyze the user query and conversation context, then return JSON with:
{
    "execution_order": ["node1", "node2", ...],
    "reasoning": "brief explanation"
}

Return only valid JSON.
</output_format>
</system>"""


STATIC_SYS = load_orchestrator_prompt()


def normalize_route(name: str) -> str:
    """Normalize route name to graph node names."""
    if not name:
        return "simple_llm"
    key = name.lower().strip()
    mapping = {
        "web_search": "websearch",
        "websearch": "websearch",
        "search": "websearch",
        "rag": "rag",
        "simple_llm": "simple_llm",
        "simplellm": "simple_llm",
        "llm": "simple_llm",
        "image": "image",
        "end": "end",
    }
    return mapping.get(key, "simple_llm")


def _format_conversation_history(messages, max_turns=10):
    """Format full conversation history for context."""
    if not messages:
        return "(no previous conversation)"
    
    formatted = []
    for m in messages[-max_turns:]:
        if isinstance(m, dict):
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content", "")
        else:
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "") if hasattr(m, "content") else str(m)
        
        if not content:
            continue
        
        speaker = "User" if role in ("human", "user") else "Assistant"
        formatted.append(f"{speaker}: {content}")
    
    return "\n".join(formatted) if formatted else "(no previous conversation)"


def _format_last_turns(messages, k=3):
    """Format last k messages for context (backward compatibility)."""
    return _format_conversation_history(messages, max_turns=k)


async def analyze_query(
    user_message: str,
    recent_messages_text: str,
    session_summary: str,
    last_route: Optional[str],
    doc_url: Optional[str] = None,
    is_websearch: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Analyze user query using LLM to decide routing.
    """
    try:
        dynamic_context = f"""<context>
<user_message>
{user_message}
</user_message>

<conversation_history>
{recent_messages_text[:2000] or '(no previous conversation)'}
</conversation_history>

<session_summary>
{session_summary[:500] or '(none)'}
</session_summary>

<last_route>
{last_route or 'None'}
</last_route>

<system_state>
<document_available>{bool(doc_url)}</document_available>
<websearch_enabled>{is_websearch}</websearch_enabled>
</system_state>
</context>

<task>
Analyze the query and full conversation history, then return JSON with execution_order (list of node names) and reasoning.
Available nodes: SimpleLLM, RAG, WebSearch, Image
Consider the conversation context when making routing decisions.
</task>"""
        
        messages = [
            SystemMessage(content=STATIC_SYS),
            HumanMessage(content=dynamic_context)
        ]


        
        chat = get_llm("x-ai/grok-4.1-fast", 0.4)
        
        response = await chat.ainvoke(messages)
        content = (response.content or "").strip()
        
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            json_str = json_match.group(0).replace("{{", "{").replace("}}", "}")
            return json.loads(json_str)
        
        return json.loads(content)
        
    except Exception as e:
        print(f"[Orchestrator] Error in analyze_query: {e}")
        import traceback
        traceback.print_exc()
        if doc_url:
            return {"execution_order": ["RAG"], "reasoning": "Document available, using RAG"}
        return {"execution_order": ["SimpleLLM"], "reasoning": "Default to SimpleLLM"}


async def rewrite_query(state: GraphState) -> str:
    """Rewrite query for current task context."""
    user_query = state.get("user_query", "")
    current_task = state.get("current_task", "")
    intermediate_results = state.get("intermediate_results", [])
    
    is_first_node = (not intermediate_results or len(intermediate_results) == 0)
    
    if is_first_node:
        summary = state.get("context", {}).get("session", {}).get("summary", "")
        messages = state.get("messages", [])
        recent_text = _format_last_turns(messages, k=2)
        
        context_text = (
            f"User Goal: {user_query}\n\n"
            f"Summary: {summary[:300]}\n\nRecent: {recent_text[:300]}"
            if summary or recent_text else f"User Query: {user_query}"
        )
    else:
        last_result = intermediate_results[-1]
        context_text = (
            f"Previous node ({last_result['node']}):\n"
            f"{last_result['output'][:300]}"
        )
    
    prompt = f"""<task>
Rewrite the query for the next step in the workflow.
</task>

<user_goal>
{user_query}
</user_goal>

<current_task>
{current_task}
</current_task>

<context>
{context_text}
</context>

<instructions>
Create a concise, self-contained query (≤150 words) for the next step.
Output ONLY the rewritten query, no explanation.
</instructions>"""
    
    try:
        groq_api_key = os.getenv("GROQ_API_KEY")
        
        llm = get_llm("x-ai/grok-4.1-fast", 0.4)
        
        result = await llm.ainvoke([
            SystemMessage(content="<system>You are a query rewriter. Output only the rewritten query.</system>"),
            HumanMessage(content=prompt)
        ])
        
        rewritten = (result.content or "").strip()
        words = rewritten.split()
        if len(words) > 150:
            rewritten = " ".join(words[:150])
        
        return rewritten
        
    except Exception as e:
        print(f"[Orchestrator] Rewrite error: {e}")
        return user_query


async def orchestrator_node(state: GraphState) -> GraphState:
    """
    Orchestrator node with LLM-based routing.
    """
    doc_url = state.get("doc_url")
    messages = state.get("messages", [])
    user_query = state.get("user_query", "")
    teacher_id = state.get("teacher_id", "")
    
    print(f"[ORCHESTRATOR] 🎯 Orchestrator node called")
    print(f"[ORCHESTRATOR] 📝 User query: {user_query[:100]}...")
    print(f"[ORCHESTRATOR] 📎 doc_url: {doc_url}")
    print(f"[ORCHESTRATOR] 👤 teacher_id: {teacher_id}")
    
    if not user_query and messages:
        last_msg = messages[-1]
        user_query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
        state["user_query"] = user_query
    if not state.get("context"):
        state["context"] = {"session": {}}
    
    ctx = state.get("context", {})
    sess = ctx.get("session", {})
    last_route = sess.get("last_route")

    if not state.get("tasks"):
        conversation_history = _format_conversation_history(messages, max_turns=3)
        session_summary = sess.get("summary", "")
        
        print(f"[ORCHESTRATOR] 📜 Conversation history: {len(messages)} messages")
        print(f"[ORCHESTRATOR] 🤖 Analyzing query to determine routing (doc_url available: {bool(doc_url)})")
        result = await analyze_query(
            user_message=user_query,
            recent_messages_text=conversation_history,
            session_summary=session_summary,
            last_route=last_route,
            doc_url=doc_url,
            is_websearch=True,
        )
        
        plan = result.get("execution_order", ["SimpleLLM"]) if result else ["SimpleLLM"]
        if not plan:
            plan = ["SimpleLLM"]
        
        plan = [normalize_route(task) for task in plan]
        
        print(f"[ORCHESTRATOR] 🗺️ Routing decision: {plan}")
        print(f"[ORCHESTRATOR] 📋 Execution plan: {plan}")
        
        state["tasks"] = plan
        state["task_index"] = 0
        state["current_task"] = plan[0]
        
        if len(plan) == 1 and plan[0] == "rag":
            state["resolved_query"] = user_query
            print(f"[ORCHESTRATOR] ✅ Routing to RAG node with query: {user_query[:100]}...")
        else:
            state["resolved_query"] = await rewrite_query(state)
            print(f"[ORCHESTRATOR] ✏️ Rewritten query: {state['resolved_query'][:100]}...")
        
        route = normalize_route(plan[0])
        state["route"] = route
        state["next_node"] = route
        
        print(f"[ORCHESTRATOR] ➡️ Next node: {route}")
        
        sess["last_route"] = route
        ctx["session"] = sess
        state["context"] = ctx
        
    else:
        completed = state.get("current_task")
        if completed and state.get("response"):
            state.setdefault("intermediate_results", []).append({
                "node": completed,
                "query": state.get("resolved_query") or user_query,
                "output": state["response"]
            })
            state["response"] = None
        
        idx = state.get("task_index", 0)
        if idx + 1 < len(state["tasks"]):
            state["task_index"] = idx + 1
            next_task = state["tasks"][state["task_index"]]
            state["current_task"] = next_task
            route = normalize_route(next_task)
            clean_query = await rewrite_query(state)
            state["resolved_query"] = clean_query
            state["route"] = route
            state["next_node"] = route
        else:
            if len(state["tasks"]) > 1:
                if state.get("intermediate_results"):
                    combined = []
                    for result in state["intermediate_results"]:
                        combined.append(f"**{result.get('node', 'Unknown')} Result:**\n{result.get('output', '')}")
                    state["final_answer"] = "\n\n".join(combined)
                else:
                    state["final_answer"] = state.get("response", "Task completed.")
            else:
                if state.get("intermediate_results"):
                    state["final_answer"] = state["intermediate_results"][-1]["output"]
                else:
                    state["final_answer"] = state.get("response", "Task completed.")
            
            state["route"] = "end"
            state["next_node"] = "end"
    
    state["should_continue"] = True
    return state


def route_decision(state: GraphState) -> str:
    """
    Route decision function for graph conditional edges.
    Returns the next node name based on state.route.
    This is the single routing function used by the graph.
    """
    route = state.get("route", "simple_llm")
    
    if isinstance(route, str):
        route_lower = route.lower()
        if route_lower in ["end", "finish", "done"]:
            return "END"
        if route_lower in ["simplellm", "simple_llm", "llm", "simplellm"]:
            return "simple_llm"
        if route_lower in ["rag"]:
            return "rag"
        if route_lower in ["websearch", "web_search", "search", "websearch"]:
            return "websearch"
        if route_lower in ["image", "img"]:
            return "image"
    
    return "simple_llm"
