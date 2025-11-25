"""
RAG node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from backend.llm import get_llm, stream_with_token_tracking
from backend.Student.Ai_tutor.graph_type import StudentGraphState
from backend.Student.Ai_tutor.qdrant_utils import retrieve_relevant_documents


async def rag_node(state: StudentGraphState) -> StudentGraphState:
    """
    Retrieve student-specific documents and craft a grounded answer.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    grade = student_profile.get("grade", "")
    language = state.get("language", "English")
    student_id = state.get("student_id", "")
    chunk_callback = state.get("chunk_callback")

    query = state.get("resolved_query") or state.get("user_query", "")
    if not query and messages:
        last_message = messages[-1]
        query = last_message.content if hasattr(last_message, "content") else str(last_message)

    print(f"[Student RAG] Starting retrieval for student_id={student_id}, query={query[:80]}...")

    user_docs = []
    if student_id:
        try:
            user_docs = await retrieve_relevant_documents(
                student_id=student_id,
                query=query,
                collection_type="user_docs",
                top_k=5,
                score_threshold=0.65,
                is_hybrid=False,
            )
            print(f"[Student RAG] Retrieved {len(user_docs)} docs from Qdrant")
        except Exception as exc:
            print(f"[Student RAG] Error retrieving documents: {exc}")

    context_parts = []
    if user_docs:
        doc_texts = [f"[Doc {index + 1}]\n{doc.page_content}" for index, doc in enumerate(user_docs)]
        context_parts.append("=== Uploaded Resources ===\n" + "\n\n".join(doc_texts))

    profile_summary = []
    if student_profile:
        for key, value in student_profile.items():
            if isinstance(value, (str, int, float)):
                profile_summary.append(f"- {key}: {value}")
    if profile_summary:
        context_parts.append("=== Student Profile ===\n" + "\n".join(profile_summary))

    combined_context = "\n\n".join(context_parts) if context_parts else "No additional resources found."

    system_prompt = f"""You are an AI study companion.
Ground your answer in the supplied documents and student profile.
If documents lack the answer, be honest and guide the student on what to do next.

Subject: {subject or 'General'}
Topic: {topic or 'General Learning'}
Grade: {grade or 'Mixed levels'}
Language: {language}

Context:
{combined_context}
"""

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.6)

    llm_messages = [SystemMessage(content=system_prompt)]
    if messages:
        for message in messages:
            if hasattr(message, "content") and message.content:
                msg_type = getattr(message, "type", None) or getattr(message, "role", None)
                if msg_type and msg_type.lower() in ("human", "user"):
                    llm_messages.append(HumanMessage(content=message.content))
                elif msg_type and msg_type.lower() in ("ai", "assistant"):
                    llm_messages.append(AIMessage(content=message.content))
                else:
                    llm_messages.append(HumanMessage(content=message.content))
    elif query:
        llm_messages.append(HumanMessage(content=query))

    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state,
    )

    state["rag_response"] = full_response
    state["response"] = full_response
    state["token_usage"] = token_usage

    return state


