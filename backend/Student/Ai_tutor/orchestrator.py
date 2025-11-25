"""
Orchestrator node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import json
import re
from typing import Dict, Any, Optional

from langchain_core.messages import SystemMessage, HumanMessage

from backend.llm import get_llm
from backend.Student.Ai_tutor.graph_type import StudentGraphState


def load_orchestrator_prompt() -> str:
    prompt_file = Path(__file__).parent / "orchestrator_prompt.xml"
    try:
        return prompt_file.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"[Student Orchestrator] Prompt file missing at {prompt_file}, using fallback.")
    except Exception as exc:
        print(f"[Student Orchestrator] Failed to read prompt: {exc}")
    return """<system>
You coordinate routes for a student-facing AI tutor.
Return JSON with execution_order and reasoning.
</system>"""


STATIC_SYS = load_orchestrator_prompt()


def normalize_route(name: str) -> str:
    if not name:
        return "simple_llm"
    key = name.lower().strip()
    mapping = {
        "simplellm": "simple_llm",
        "simple_llm": "simple_llm",
        "llm": "simple_llm",
        "rag": "rag",
        "websearch": "websearch",
        "web_search": "websearch",
        "search": "websearch",
        "image": "image",
        "visual": "image",
        "end": "end",
    }
    return mapping.get(key, "simple_llm")


def _format_history(messages, max_turns=10):
    if not messages:
        return "(no previous conversation)"
    formatted = []
    for message in messages[-max_turns:]:
        role = (getattr(message, "type", None) or getattr(message, "role", None) or "").lower()
        content = getattr(message, "content", "") if hasattr(message, "content") else str(message)
        if not content:
            continue
        speaker = "Student" if role in ("human", "user") else "Buddy"
        formatted.append(f"{speaker}: {content}")
    return "\n".join(formatted) or "(no previous conversation)"


async def analyze_query(
    user_message: str,
    conversation_history: str,
    session_summary: str,
    last_route: Optional[str],
    doc_url: Optional[str],
    has_assignments: bool,
) -> Dict[str, Any]:
    dynamic_context = f"""<context>
<student_message>{user_message}</student_message>
<conversation_history>{conversation_history[:2000]}</conversation_history>
<session_summary>{session_summary[:500] or '(none)'}</session_summary>
<last_route>{last_route or 'None'}</last_route>
<document_available>{bool(doc_url)}</document_available>
<assignments_available>{has_assignments}</assignments_available>
</context>

<task>
Return JSON with execution_order (list) and reasoning (≤2 sentences).
Nodes: SimpleLLM, RAG, WebSearch, Image, END.
</task>"""

    messages = [SystemMessage(content=STATIC_SYS), HumanMessage(content=dynamic_context)]
    try:
        llm = get_llm("x-ai/grok-4.1-fast", 0.35)
        response = await llm.ainvoke(messages)
        content = (response.content or "").strip()
        match = re.search(r"\{[\s\S]*\}", content)
        if match:
            return json.loads(match.group(0))
        return json.loads(content)
    except Exception as exc:
        print(f"[Student Orchestrator] analyze_query error: {exc}")
        if doc_url:
            return {"execution_order": ["RAG"], "reasoning": "Document referenced, defaulting to RAG."}
        return {"execution_order": ["SimpleLLM"], "reasoning": "Fallback to SimpleLLM."}


async def rewrite_query(state: StudentGraphState) -> str:
    user_query = state.get("user_query", "")
    current_task = state.get("current_task", "")
    intermediate_results = state.get("intermediate_results", [])

    if not intermediate_results:
        summary = state.get("context", {}).get("session", {}).get("summary", "")
        history = _format_history(state.get("messages", []), max_turns=2)
        context_text = f"{summary}\n{history}".strip() or user_query
    else:
        last_result = intermediate_results[-1]
        context_text = f"Previous node {last_result.get('node')}: {last_result.get('output', '')[:300]}"

    prompt = f"""<task>Rewrite the student's question for the next node.</task>
<user_goal>{user_query}</user_goal>
<current_task>{current_task}</current_task>
<context>{context_text}</context>
<rules>Return a concise standalone query ≤ 150 words. No extra text.</rules>"""

    try:
        llm = get_llm("x-ai/grok-4.1-fast", 0.2)
        result = await llm.ainvoke(
            [
                SystemMessage(content="<system>You rewrite queries. Output only the rewritten text.</system>"),
                HumanMessage(content=prompt),
            ]
        )
        rewritten = (result.content or "").strip()
        words = rewritten.split()
        if len(words) > 150:
            rewritten = " ".join(words[:150])
        return rewritten or user_query
    except Exception as exc:
        print(f"[Student Orchestrator] rewrite error: {exc}")
        return user_query


async def orchestrator_node(state: StudentGraphState) -> StudentGraphState:
    messages = state.get("messages", [])
    user_query = state.get("user_query") or ""
    student_id = state.get("student_id", "")
    doc_url = state.get("doc_url")

    print(f"[Student Orchestrator] handling student_id={student_id}")

    if not user_query and messages:
        last = messages[-1]
        user_query = last.content if hasattr(last, "content") else str(last)
        state["user_query"] = user_query

    if not state.get("context"):
        state["context"] = {"session": {}}

    session_ctx = state["context"].get("session", {})
    last_route = session_ctx.get("last_route")
    has_assignments = bool(state.get("pending_assignments"))

    if not state.get("tasks"):
        conversation_history = _format_history(messages, max_turns=4)
        session_summary = session_ctx.get("summary", "")

        routing = await analyze_query(
            user_message=user_query,
            conversation_history=conversation_history,
            session_summary=session_summary,
            last_route=last_route,
            doc_url=doc_url,
            has_assignments=has_assignments,
        )

        plan = routing.get("execution_order") or ["SimpleLLM"]
        plan = [normalize_route(step) for step in plan if step]
        if not plan:
            plan = ["simple_llm"]

        state["tasks"] = plan
        state["task_index"] = 0
        state["current_task"] = plan[0]
        state["route"] = plan[0]
        state["next_node"] = plan[0]

        if plan[0] == "rag":
            state["resolved_query"] = user_query
        else:
            state["resolved_query"] = await rewrite_query(state)

        session_ctx["last_route"] = plan[0]
        state["context"]["session"] = session_ctx
    else:
        completed = state.get("current_task")
        if completed and state.get("response"):
            state.setdefault("intermediate_results", []).append(
                {"node": completed, "query": state.get("resolved_query") or user_query, "output": state["response"]}
            )
            state["response"] = None

        idx = state.get("task_index", 0)
        tasks = state.get("tasks", [])
        if idx + 1 < len(tasks):
            state["task_index"] = idx + 1
            next_task = tasks[idx + 1]
            state["current_task"] = next_task
            state["route"] = normalize_route(next_task)
            state["next_node"] = state["route"]
            state["resolved_query"] = await rewrite_query(state)
        else:
            if state.get("intermediate_results"):
                combined = []
                for result in state["intermediate_results"]:
                    combined.append(f"{result.get('node', 'step').title()}:\n{result.get('output', '')}")
                state["final_answer"] = "\n\n".join(combined)
            else:
                state["final_answer"] = state.get("response", "Task completed.")
            state["route"] = "end"
            state["next_node"] = "end"

    state["should_continue"] = True
    return state


def route_decision(state: StudentGraphState) -> str:
    route = state.get("route", "simple_llm")
    if isinstance(route, str):
        route_lower = route.lower()
        if route_lower in ("end", "finish", "done"):
            return "END"
        if route_lower in ("simplellm", "simple_llm", "llm"):
            return "simple_llm"
        if route_lower == "rag":
            return "rag"
        if route_lower in ("websearch", "web_search", "search"):
            return "websearch"
        if route_lower in ("image", "visual", "diagram"):
            return "image"
    return "simple_llm"


