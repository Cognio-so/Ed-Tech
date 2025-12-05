"""
RAG node for AI Tutor.
Retrieves documents from Qdrant with session scoping and document filtering.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
try:
    from backend.llm import get_llm, stream_with_token_tracking
except ImportError:
    from llm import get_llm, stream_with_token_tracking
try:
    from backend.teacher.Ai_Tutor.graph_type import GraphState
except ImportError:
    from teacher.Ai_Tutor.graph_type import GraphState

try:
    from backend.teacher.Ai_Tutor.qdrant_utils import retrieve_relevant_documents
    from backend.teacher.Ai_Tutor.simple_llm import format_teacher_data, format_student_data
except ImportError:
    from teacher.Ai_Tutor.qdrant_utils import retrieve_relevant_documents
    from teacher.Ai_Tutor.simple_llm import format_teacher_data, format_student_data

def _format_last_turns(messages, k=3):
    """Format last k messages for context."""
    if not messages:
        return "(no previous conversation)"
    
    formatted = []
    for m in messages[-k:]:
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

async def rag_node(state: GraphState) -> GraphState:
    """
    RAG node: Retrieves docs -> Generates Answer.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    teacher_id = state.get("teacher_id", "")
    session_id = state.get("session_id")
    chunk_callback = state.get("chunk_callback")
    
    # 1. Get Query
    query = state.get("resolved_query") or state.get("user_query", "")
    if not query and messages:
        last_msg = messages[-1]
        query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
    
    # 2. Get Specific Document URL (This comes from Frontend)
    doc_url = state.get("doc_url")
    
    print(f"[RAG] 🔍 Retrieval | Session: {session_id} | Doc Filter: {doc_url or 'None'}")
    
    user_docs = []
    if teacher_id and session_id:
        try:
            # 3. Retrieve with Filtering
            user_docs = await retrieve_relevant_documents(
                teacher_id=teacher_id,
                session_id=session_id,
                query=query,
                top_k=5,
                score_threshold=0.45,
                filter_doc_url=doc_url  # Pass the URL to filter!
            )
            print(f"[RAG] ✅ Found {len(user_docs)} relevant chunks")
        except Exception as e:
            print(f"[RAG] ❌ Retrieval failed: {e}")

    # 4. Build Context
    context_parts = []
    
    if user_docs:
        doc_texts = [f"[Page/Chunk {i+1}]: {d.page_content}" for i, d in enumerate(user_docs)]
        context_parts.append("=== UPLOADED DOCUMENT CONTEXT ===\n" + "\n\n".join(doc_texts))
    elif doc_url:
        # If a specific doc was requested but no chunks found
        context_parts.append(f"=== DOCUMENT CONTEXT ===\nThe user is asking about {doc_url}, but no specific text matched the query in the index. Use general knowledge.")

    # Add other context (Teacher/Student data)
    teacher_data = state.get("teacher_data", {})
    if teacher_data:
        context_parts.append("=== TEACHER INFO ===\n" + format_teacher_data(teacher_data))

    combined_context = "\n\n".join(context_parts)
    
    # 5. System Prompt
    system_prompt = f"""You are an expert AI Tutor Assistant.
    
    CONTEXT:
    {combined_context}

    CONVERSATION HISTORY:
    {_format_last_turns(messages, k=3)}
    
    INSTRUCTIONS:
    - If the user asks about the uploaded document, prioritize the 'UPLOADED DOCUMENT CONTEXT'.
    - Use the 'CONVERSATION HISTORY' to understand follow-up questions (e.g., "what is it?", "explain more").
    - If the answer is not in the context, politely say so.
    - Be concise and helpful.
    """
    
    # 6. Call LLM
    model_name = state.get("model") or "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.7)
    
    llm_messages = [SystemMessage(content=system_prompt)]
    if messages:
        # Append history (last 5 messages)
        for m in messages[-5:]:
            if hasattr(m, 'content'):
                if isinstance(m, HumanMessage) or (hasattr(m, 'type') and m.type=='human'):
                    llm_messages.append(HumanMessage(content=m.content))
                else:
                    llm_messages.append(AIMessage(content=m.content))
    else:
        llm_messages.append(HumanMessage(content=query))
        
    full_response, _ = await stream_with_token_tracking(
        llm, llm_messages, chunk_callback=chunk_callback, state=state
    )
    
    state["response"] = full_response
    return state