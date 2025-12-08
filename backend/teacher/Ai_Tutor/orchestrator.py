"""
Orchestrator node for AI Tutor with enhanced routing.
Supports: Documents (PDF, DOCX, TXT, Images), Image Generation/Editing, WebSearch, SimpleLLM
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
try:
    from backend.llm import get_llm
    from backend.teacher.Ai_Tutor.graph_type import GraphState
except ImportError:
    from llm import get_llm
    from teacher.Ai_Tutor.graph_type import GraphState


def load_orchestrator_prompt() -> str:
    """Load orchestrator prompt from XML file."""
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
- RAG: For questions requiring document/image analysis
- WebSearch: For current events, latest information
- Image: For image generation/editing
</available_nodes>

<output_format>
Return JSON: {"execution_order": ["node1", "node2"], "reasoning": "explanation"}
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
        "img": "image",
        "end": "end",
    }
    return mapping.get(key, "simple_llm")


def _format_conversation_history(messages, max_turns=3, max_words_assistant=300):
    """Format conversation history with truncation for assistant messages."""
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
        
        # Truncate assistant messages to avoid overwhelming context
        if speaker == "Assistant":
            words = content.split()
            if len(words) > max_words_assistant:
                content = " ".join(words[:max_words_assistant]) + " ..."
        
        formatted.append(f"{speaker}: {content.strip()}")
    
    return "\n".join(formatted) if formatted else "(no previous conversation)"


def _format_last_turns(messages, k=3):
    """Format last k messages for context (backward compatibility)."""
    return _format_conversation_history(messages, max_turns=k)


async def summarizer(state: GraphState, keep_last=2):
    """
    Summarizes older conversation and keeps only last `keep_last` turns.
    Each turn is truncated to max 300 words.
    """
    msgs = state.get("messages") or []
    if len(msgs) <= keep_last:
        return

    older = msgs[:-keep_last]
    recent = msgs[-keep_last:]

    print(f"[Orchestrator] 📝 Session summary called, summarizing {len(older)} older messages")
    
    def truncate_text(text: str, word_limit: int = 300):
        words = text.split()
        return " ".join(words[:word_limit]) + ("..." if len(words) > word_limit else "")

    for m in recent:
        if isinstance(m, dict):
            if "content" in m and isinstance(m["content"], str):
                m["content"] = truncate_text(m["content"])
        else:
            # Handle LangChain message objects
            content = getattr(m, "content", "")
            if isinstance(content, str):
                try:
                    m.content = truncate_text(content)
                except Exception:
                    pass

    # Build old conversation text
    old_text = []
    for m in older:
        if isinstance(m, dict):
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content") or ""
        else:
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "") if hasattr(m, "content") else str(m)
        
        if not content:
            continue
        speaker = "User" if role in ("human", "user") else "Assistant"
        old_text.append(f"{speaker}: {content}")
    full_old_text = "\n".join(old_text)[:8000]
    
    system_prompt = (
        "You are a summarization agent. Summarize the following chat history into <300 words, "
        "preserving key intents, facts, and unresolved items. Output only plain text."
    )
    user_prompt = f"Summarize this conversation:\n\n{full_old_text}"

    try:
        llm = ChatGroq(
            model="openai/gpt-oss-20b",
            temperature=0.4,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )
        result = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        summary = (result.content or "").strip()
    except Exception as e:
        print(f"[Orchestrator] Summarization error: {e}")
        summary = "Summary of earlier conversation: user and assistant discussed multiple related topics."

    # Store summary in context
    ctx = state.get("context") or {}
    sess = ctx.get("session") or {}
    sess["summary"] = summary
    ctx["session"] = sess
    state["context"] = ctx
    state["messages"] = recent


async def analyze_query(
    user_message: str,
    recent_messages_text: str,
    session_summary: str,
    last_route: Optional[str],
    is_image: bool = False,
    uploaded_images: List[str] = None,
    new_uploaded_docs: List[dict] = None,
    doc_url: Optional[str] = None,
    is_websearch: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Analyze user query using LLM to decide routing.
    Supports: RAG, WebSearch, SimpleLLM, Image
    Note: Image routing is based on explicit generation/editing verbs in query, not is_image flag.
    """
    try:
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
<websearch_enabled>{is_websearch}</websearch_enabled>{uploaded_images_text}{doc_context_text}
</system_state>
</context>

<task>
Analyze the query and full conversation history, then return JSON with execution_order (list of node names) and reasoning.
Available nodes: SimpleLLM, RAG, WebSearch, Image
Route to Image node when user explicitly requests image generation/editing with action verbs (generate, create, make, edit, modify, etc.).
Consider the conversation context and uploaded documents when making routing decisions.
</task>"""
        
        messages = [
            SystemMessage(content=STATIC_SYS),
            HumanMessage(content=dynamic_context)
        ]

        chat = ChatGroq(
            model="openai/gpt-oss-120b",
            temperature=0.4,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )
        response = await chat.ainvoke(messages)
        content = (response.content or "").strip()
        
        print(f"[Orchestrator] 🤖 Analyzer Raw Output: {content}")
        
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            json_str = json_match.group(0).replace("{{", "{").replace("}}", "}")
            print(f"[Orchestrator] 📋 Extracted JSON: {json_str}")
            return json.loads(json_str)
        
        return json.loads(content)
        
    except Exception as e:
        print(f"[Orchestrator] ❌ Error in analyze_query: {e}")
        import traceback
        traceback.print_exc()
        if doc_url or new_uploaded_docs:
            return {"execution_order": ["RAG"], "reasoning": "Document available, using RAG"}
        return {"execution_order": ["SimpleLLM"], "reasoning": "Default to SimpleLLM"}



async def orchestrator_node(state: GraphState) -> GraphState:
    """
    Enhanced orchestrator node with document and image routing support.
    Handles: Documents, Images, WebSearch, SimpleLLM
    """
    user_query = state.get("user_query", "")
    doc_url = state.get("doc_url")
    messages = state.get("messages", [])
    teacher_id = state.get("teacher_id", "")
    
    # Enhanced state fields
    uploaded_doc = state.get("uploaded_doc", False)
    new_uploaded_docs = state.get("new_uploaded_docs", [])
    print(f"[ORCHESTRATOR] 📂 new_uploaded_docs: {len(new_uploaded_docs) if new_uploaded_docs else 0} files")
    is_image = state.get("is_image", False)
    
    if not user_query and messages:
        last_msg = messages[-1]
        user_query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
        state["user_query"] = user_query
    
    if not state.get("context"):
        state["context"] = {"session": {}}
    
    # Initialize active_docs if not present
    if not state.get("active_docs"):
        state["active_docs"] = None
        print("[Orchestrator] Initialized active_docs as None.")
    
    # Update active_docs with new uploads
    if new_uploaded_docs:
        state["active_docs"] = new_uploaded_docs
        print(f"[Orchestrator] Updated active_docs with {len(new_uploaded_docs)} new documents")
    
    ctx = state.get("context", {})
    sess = ctx.get("session", {})
    last_route = sess.get("last_route")
    print(f"[ORCHESTRATOR] 🔄 Last route: {last_route}")
    
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
        print(f"[Orchestrator] Extracted {len(edit_img_urls)} image URL(s): {edit_img_urls}")
    
    if not state.get("tasks"):
        conversation_history = _format_conversation_history(messages, max_turns=6)
        session_summary = sess.get("summary", "")
        
        print(f"[ORCHESTRATOR] 📜 Conversation history: {len(messages)} messages")
        print(f"[ORCHESTRATOR] 🤖 Analyzing query to determine routing...")
        
        # Parallel execution of analyze and tentative rewrite
        analyze_task = analyze_query(
            user_message=user_query,
            recent_messages_text=conversation_history,
            session_summary=session_summary,
            last_route=last_route,
            is_image=is_image,
            uploaded_images=edit_img_urls,
            new_uploaded_docs=new_uploaded_docs,
            doc_url=doc_url,
            is_websearch=True,
        )
        
        result = await analyze_task
        resolved_query = user_query  # Use original query directly since rewrite was removed
        
        plan = result.get("execution_order", ["SimpleLLM"]) if result else ["SimpleLLM"]
        if not plan:
            plan = ["SimpleLLM"]
        
        # Check for image node in plan
        has_image_in_plan = any(task.lower() in ["image", "img"] for task in plan)
        if not has_image_in_plan:
            print(f"[Orchestrator] No image node in plan, clearing img_urls")
            state["img_urls"] = []
        
        # Handle image editing scenario
        if len(edit_img_urls) == len(new_uploaded_docs) and plan[0].lower() == "image":
            state["img_urls"] = edit_img_urls
            print(f"[Orchestrator] Image editing scenario detected")
        elif uploaded_doc:
            state["img_urls"] = []
            print(f"[Orchestrator] Document uploaded scenario")
            
            # Force RAG routing for new document uploads
            if len(plan) == 1 and plan[0].lower() == "rag":
                pass  # Already routing to RAG
            elif len(plan) == 1 and plan[0].lower() != "rag":
                plan = ["rag"]
            elif len(plan) == 0:
                plan = ["rag"]
            
            print(f"[Orchestrator] New doc uploaded → updated plan = {plan}")
        
        plan = [normalize_route(task) for task in plan]
        
        print(f"[ORCHESTRATOR] 🗺️ Routing decision: {plan}")
        print(f"[ORCHESTRATOR] 📋 Execution plan: {plan}")
        
        state["tasks"] = plan
        state["task_index"] = 0
        state["current_task"] = plan[0]
        
        # Use original query for all cases (rewrite removed)
        state["resolved_query"] = user_query
        print(f"[ORCHESTRATOR] ✅ Using original query: {user_query[:100]}...")
        
        route = normalize_route(plan[0])
        state["route"] = route
        state["next_node"] = route
        
        print(f"[ORCHESTRATOR] ➡️ Next node: {route}")
        
        sess["last_route"] = route
        ctx["session"] = sess
        state["context"] = ctx
        
    else:
        # Multi-step execution: move to next task
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
            # Use original query for next task (rewrite removed)
            state["resolved_query"] = user_query
            state["route"] = route
            state["next_node"] = route
            print(f"[ORCHESTRATOR] ⏭️ Moving to next task: {route}")
        else:
            # All tasks completed
            if len(state["tasks"]) > 1:
                print(f"[ORCHESTRATOR] ✅ Multi-step plan ({len(state['tasks'])} steps) finished")
                if state.get("intermediate_results"):
                    combined = []
                    for result in state["intermediate_results"]:
                        combined.append(f"**{result.get('node', 'Unknown')} Result:**\n{result.get('output', '')}")
                    state["final_answer"] = "\n\n".join(combined)
                else:
                    state["final_answer"] = state.get("response", "Task completed.")
            else:
                print(f"[ORCHESTRATOR] ✅ Single-step plan finished")
                if state.get("intermediate_results"):
                    state["final_answer"] = state["intermediate_results"][-1]["output"]
                else:
                    state["final_answer"] = state.get("response", "Task completed.")
            
            state["route"] = "end"
            state["next_node"] = "end"
    
    # Summarize session if ending
    if state.get("route") == "end":
        await summarizer(state, keep_last=2)
    
    state["should_continue"] = True
    return state


def route_decision(state: GraphState) -> str:
    """
    Route decision function for graph conditional edges.
    Returns the next node name based on state.route.
    Supports: simple_llm, rag, websearch, image, END
    """
    route = state.get("route", "simple_llm")
    
    if isinstance(route, str):
        route_lower = route.lower()
        if route_lower in ["end", "finish", "done"]:
            return "END"
        if route_lower in ["simplellm", "simple_llm", "llm"]:
            return "simple_llm"
        if route_lower in ["rag"]:
            return "rag"
        if route_lower in ["websearch", "web_search", "search"]:
            return "websearch"
        if route_lower in ["image", "img"]:
            return "image"
    
    return "simple_llm"
