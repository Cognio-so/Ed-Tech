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
from typing import Dict, Any, Optional, List

from langchain_core.messages import SystemMessage, HumanMessage

try:
    from backend.llm import get_llm
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
except ImportError:
    from llm import get_llm
    from Student.Ai_tutor.graph_type import StudentGraphState


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
    is_image: bool = False,
    uploaded_images: List[str] = None,
    new_uploaded_docs: List[dict] = None,
    is_websearch: bool = False,
) -> Dict[str, Any]:
    # Build uploaded images context
    uploaded_images_text = ""
    if uploaded_images and len(uploaded_images) > 0:
        uploaded_images_text = f"\nUploaded Images: {len(uploaded_images)} image URL(s) available in session"
    
    # Build document context from new_uploaded_docs
    doc_context_text = ""
    if new_uploaded_docs and len(new_uploaded_docs) > 0:
        doc_types = {}
        for doc in new_uploaded_docs:
            if isinstance(doc, dict):
                file_type = doc.get("file_type", "unknown")
                doc_types[file_type] = doc_types.get(file_type, 0) + 1
        
        doc_summary = []
        for doc_type, count in doc_types.items():
            doc_summary.append(f"{count} {doc_type}(s)")
        
        doc_context_text = f"\nNewly Uploaded Documents: {', '.join(doc_summary)}"
    
    dynamic_context = f"""<context>
<student_message>{user_message}</student_message>
<conversation_history>{conversation_history[:2000]}</conversation_history>
<session_summary>{session_summary[:500] or '(none)'}</session_summary>
<last_route>{last_route or 'None'}</last_route>
<system_state>
<document_available>{bool(doc_url)}</document_available>
<websearch_enabled>{is_websearch}</websearch_enabled>{uploaded_images_text}{doc_context_text}
</system_state>
<assignments_available>{has_assignments}</assignments_available>
</context>

<task>
Return JSON with execution_order (list) and reasoning (≤2 sentences).
Nodes: SimpleLLM, RAG, WebSearch, Image, END.
Route to Image node when user explicitly requests image generation/editing with action verbs (generate, create, make, edit, modify, etc.).
Consider the conversation context and uploaded documents when making routing decisions.
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
        if doc_url or new_uploaded_docs:
            return {"execution_order": ["RAG"], "reasoning": "Document available, using RAG"}
        return {"execution_order": ["SimpleLLM"], "reasoning": "Default to SimpleLLM"}


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
    
    # Enhanced state fields
    uploaded_doc = state.get("uploaded_doc", False)
    new_uploaded_docs = state.get("new_uploaded_docs", [])
    print(f"[Student Orchestrator] 📂 new_uploaded_docs: {len(new_uploaded_docs) if new_uploaded_docs else 0} files")
    is_image = state.get("is_image", False)

    print(f"[Student Orchestrator] handling student_id={student_id}")

    if not user_query and messages:
        last = messages[-1]
        user_query = last.content if hasattr(last, "content") else str(last)
        state["user_query"] = user_query

    if not state.get("context"):
        state["context"] = {"session": {}}

    # Initialize active_docs if not present
    if not state.get("active_docs"):
        state["active_docs"] = None
        print("[Student Orchestrator] Initialized active_docs as None.")
    
    # Update active_docs with new uploads
    if new_uploaded_docs:
        state["active_docs"] = new_uploaded_docs
        print(f"[Student Orchestrator] Updated active_docs with {len(new_uploaded_docs)} new documents")

    session_ctx = state["context"].get("session", {})
    last_route = session_ctx.get("last_route")
    has_assignments = bool(state.get("pending_assignments"))
    
    # Extract image URLs from new_uploaded_docs
    edit_img_urls = []
    if new_uploaded_docs:
        for doc in new_uploaded_docs:
            if isinstance(doc, dict):
                file_type = doc.get("file_type", "")
                file_url = doc.get("file_url") or doc.get("url")
                if file_type == "image" and file_url:
                    edit_img_urls.append(file_url)
    
    if edit_img_urls:
        state["edit_img_urls"] = edit_img_urls
        print(f"[Student Orchestrator] Extracted {len(edit_img_urls)} image URL(s): {edit_img_urls}")

    if not state.get("tasks"):
        conversation_history = _format_history(messages, max_turns=6)
        session_summary = session_ctx.get("summary", "")

        routing = await analyze_query(
            user_message=user_query,
            conversation_history=conversation_history,
            session_summary=session_summary,
            last_route=last_route,
            doc_url=doc_url,
            has_assignments=has_assignments,
            is_image=is_image,
            uploaded_images=edit_img_urls,
            new_uploaded_docs=new_uploaded_docs,
            is_websearch=True,
        )

        plan = routing.get("execution_order") or ["SimpleLLM"]
        plan = [normalize_route(step) for step in plan if step]
        if not plan:
            plan = ["simple_llm"]
        
        # Check for image node in plan
        has_image_in_plan = any(task.lower() in ["image", "img"] for task in plan)
        if not has_image_in_plan:
            print(f"[Student Orchestrator] No image node in plan, clearing img_urls")
            state["img_urls"] = []
        
        # Handle image editing scenario
        if len(edit_img_urls) == len(new_uploaded_docs) and plan[0].lower() == "image":
            state["img_urls"] = edit_img_urls
            print(f"[Student Orchestrator] Image editing scenario detected")
        elif uploaded_doc:
            state["img_urls"] = []
            print(f"[Student Orchestrator] Document uploaded scenario")
            
            # Force RAG routing for new document uploads
            if len(plan) == 1 and plan[0].lower() == "rag":
                pass  # Already routing to RAG
            elif len(plan) == 1 and plan[0].lower() != "rag":
                plan = ["rag"]
            elif len(plan) == 0:
                plan = ["rag"]
            
            print(f"[Student Orchestrator] New doc uploaded → updated plan = {plan}")

        state["tasks"] = plan
        state["task_index"] = 0
        state["current_task"] = plan[0]
        state["route"] = plan[0]
        state["next_node"] = plan[0]
        state["resolved_query"] = user_query

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
            state["resolved_query"] = user_query
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


