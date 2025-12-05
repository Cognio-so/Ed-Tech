"""
Simple LLM node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from Student.Ai_tutor.graph_type import StudentGraphState


def _format_assignments(pending_assignments):
    if not pending_assignments:
        return "No pending assignments logged."
    formatted = []
    for assignment in pending_assignments[:5]:
        title = assignment.get("title") or assignment.get("name") or "Assignment"
        due = assignment.get("due_date") or assignment.get("deadline") or "No due date"
        status = assignment.get("status", "pending")
        formatted.append(f"- {title} (due: {due}, status: {status})")
    return "\n".join(formatted)


def _format_achievements(achievements):
    if not achievements:
        return "No recent achievements noted."
    return "\n".join(f"- {achievement}" for achievement in achievements[:5])


async def simple_llm_node(state: StudentGraphState) -> StudentGraphState:
    """
    Student-friendly LLM node that uses student profile + assignments context.
    """
    messages = state.get("messages", [])
    student_profile = state.get("student_profile") or {}
    subject = state.get("subject") or student_profile.get("subject", "")
    topic = state.get("topic", "")
    language = state.get("language", "English")
    pending_assignments = state.get("pending_assignments") or student_profile.get("pending_assignments") or []
    achievements = state.get("achievements") or student_profile.get("achievements") or []
    chunk_callback = state.get("chunk_callback")

    student_name = student_profile.get("name") or student_profile.get("student_name") or "Student"
    grade = student_profile.get("grade", "")
    learning_style = student_profile.get("learning_style", "Balanced")

    profile_context = f"""
Student: {student_name}
Grade: {grade or 'Not specified'}
Preferred Learning Style: {learning_style}
Subject Focus: {subject or 'General'}
Topic: {topic or 'General learning support'}

Pending Assignments:
{_format_assignments(pending_assignments)}

Recent Achievements:
{_format_achievements(achievements)}
    """.strip()

    system_prompt = f"""You are a supportive AI study buddy.
- Speak directly to {student_name} in {language}.
- Keep explanations clear, step-by-step, and encouraging.
- Connect answers to their pending assignments when possible.
- Celebrate progress and keep motivation high.

Context:
{profile_context}
"""

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.55)

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
    else:
        user_message = state.get("resolved_query") or state.get("user_query", "")
        if user_message:
            llm_messages.append(HumanMessage(content=user_message))

    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state,
    )

    state["simple_llm_response"] = full_response
    state["response"] = full_response
    state["token_usage"] = token_usage

    return state


