"""
Simple LLM + KBRAG node for Student AI Tutor.
Uses a simple LLM with knowledge base RAG.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
    from backend.teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from Student.Ai_tutor.graph_type import StudentGraphState
    from teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES


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
        
        speaker = "Student" if role in ("human", "user") else "Buddy"
        formatted.append(f"{speaker}: {content}")
    
    return "\n".join(formatted) if formatted else "(no previous conversation)"


def _format_assignments(pending_assignments):
    """Format pending assignments for context."""
    if not pending_assignments:
        return "No pending assignments logged."
    formatted = []
    for assignment in pending_assignments[:5]:
        title = assignment.get("title") or assignment.get("name") or "Assignment"
        due = assignment.get("due_date") or assignment.get("deadline") or assignment.get("due") or "No due date"
        status = assignment.get("status", "pending")
        formatted.append(f"- {title} (due: {due}, status: {status})")
    return "\n".join(formatted)


def _format_achievements(achievements):
    """Format achievements for context."""
    if not achievements:
        return "No recent achievements noted."
    return "\n".join(f"- {achievement}" for achievement in achievements[:5])


def format_student_profile(student_profile: Any) -> str:
    """Format student profile for context."""
    if not student_profile:
        return "No student profile provided."
    
    if isinstance(student_profile, dict):
        formatted = []
        name = student_profile.get("name") or student_profile.get("student_name", "Student")
        grade = student_profile.get("grade", "N/A")
        learning_style = student_profile.get("learning_style", "Balanced")
        subject = student_profile.get("subject", "N/A")
        
        formatted.append(f"Student Name: {name}")
        if grade and grade != "N/A":
            formatted.append(f"Grade: {grade}")
        if learning_style and learning_style != "Balanced":
            formatted.append(f"Learning Style: {learning_style}")
        if subject and subject != "N/A":
            formatted.append(f"Subject Focus: {subject}")
        
        return "\n".join(formatted) if formatted else "No student profile available."
    
    return str(student_profile)


async def simple_llm_node(state: StudentGraphState) -> StudentGraphState:
    """
    Simple LLM + KBRAG node for students.
    Uses a simple LLM with knowledge base context, student profile, and assignments.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    pending_assignments = state.get("pending_assignments") or student_profile.get("pending_assignments") or []
    achievements = state.get("achievements") or student_profile.get("achievements") or []
    language = state.get("language", "English")
    chunk_callback = state.get("chunk_callback")
    
    student_name = student_profile.get("name") or student_profile.get("student_name") or "Student"
    grade = student_profile.get("grade", "")
    learning_style = student_profile.get("learning_style", "Balanced")
    
    student_context = format_student_profile(student_profile)
    if not grade and isinstance(student_profile, dict):
        grade = student_profile.get("grade", "")
    
    kb_retrieved_contexts = []
    print(f"[STUDENT SIMPLE_LLM] 📊 Extracted grade: '{grade}', subject: '{subject}', language: '{language}'")
    if grade and subject and language:
        subject_normalized = subject.lower().replace(" ", "_")
        lang_code = LANGUAGES.get(language, language).lower()
        collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
        user_query = ""
        if messages:
            for msg in reversed(messages):
                if hasattr(msg, 'content') and msg.content:
                    msg_type = getattr(msg, 'type', None) or getattr(msg, 'role', None)
                    if msg_type and msg_type.lower() in ('human', 'user'):
                        user_query = msg.content
                        break
        if not user_query:
            user_query = state.get("resolved_query") or state.get("user_query", "")
        if user_query:
            try:
                print(f"[Student SimpleLLM KB] 🔍 Searching collection '{collection_name}' for query: {user_query[:120]}...")
                kb_retrieved_contexts = await retrieve_kb_context(collection_name, user_query, top_k=5)
                if kb_retrieved_contexts:
                    print(f"[Student SimpleLLM KB] ✅ Retrieved {len(kb_retrieved_contexts)} context chunk(s) from knowledge base")
                else:
                    print(f"[Student SimpleLLM KB] ⚠️ No knowledge base context found for collection '{collection_name}'")
            except asyncio.CancelledError:
                print(f"[Student SimpleLLM KB] ⚠️ KB search was cancelled")
                kb_retrieved_contexts = []
                raise
            except Exception as e:
                print(f"[Student SimpleLLM KB] ❌ Error retrieving KB context: {e}")
                import traceback
                traceback.print_exc()
                kb_retrieved_contexts = []
    else:
        missing = []
        if not grade:
            missing.append("grade")
        if not subject:
            missing.append("subject")
        if not language:
            missing.append("language")
        print(f"[Student SimpleLLM KB] ⚠️ Skipping KB search - missing: {', '.join(missing)}")
    
    formatted_kb_context = ""
    if kb_retrieved_contexts:
        formatted_kb_context = "\n\n".join(kb_retrieved_contexts[:5])
    
    assignments_text = _format_assignments(pending_assignments)
    achievements_text = _format_achievements(achievements)
    
    xml_prompt = f"""
<study_buddy_request>
    <context>
        <role>Supportive AI Study Buddy</role>
        <task>Help students with their learning, assignments, and educational questions</task>
        <recent_conversation>
{_format_last_turns(messages, k=3)}
        </recent_conversation>
    </context>
    
    <parameters>
        <topic>{topic if topic else "Not specified"}</topic>
        <subject>{subject if subject else "Not specified"}</subject>
        <grade>{grade if grade else "Not specified"}</grade>
        <language>{language}</language>
    </parameters>
    
    <knowledge_base>
{f"        <collection>kb_grad_{grade}_sub_{subject.lower().replace(' ', '_')}_lang_{LANGUAGES.get(language, language).lower()}</collection>" if kb_retrieved_contexts else "        <collection>None</collection>"}
        <reference_text>
{formatted_kb_context if formatted_kb_context else "            No knowledge base content available."}
        </reference_text>
        <guidance>
            {f"Use ONLY the reference material when answering curriculum-related questions. This is authoritative curriculum content for Grade {grade}, Subject: {subject}, Language: {language}." if kb_retrieved_contexts else "No knowledge base content available for this grade/subject/language combination."}
        </guidance>
    </knowledge_base>
    
    <student_information>
        <profile>
{student_context if student_context != "No student profile provided." else "No student profile available."}
        </profile>
        <pending_assignments>
{assignments_text}
        </pending_assignments>
        <recent_achievements>
{achievements_text}
        </recent_achievements>
    </student_information>
    
    <capabilities>
        <access>
            <item>Topic and subject information</item>
            <item>Complete student profile (name, grade, learning style, subject focus)</item>
            <item>Pending assignments with due dates and status</item>
            <item>Recent achievements and accomplishments</item>
{f"            <item>Curriculum knowledge base content for Grade {grade}, Subject: {subject}, Language: {language} - Use this authoritative curriculum material to answer curriculum-related questions</item>" if kb_retrieved_contexts else ""}
        </access>
    </capabilities>
    
    <role_responsibilities>
        <responsibility>Answer questions about the current subject and topic</responsibility>
        <responsibility>Help students understand their assignments and provide guidance</responsibility>
        <responsibility>Celebrate achievements and provide encouragement</responsibility>
        <responsibility>Adapt explanations to the student's learning style and grade level</responsibility>
        <responsibility>Answer questions related to the subject, topic, and grade level using curriculum knowledge base when available</responsibility>
        <responsibility>Provide step-by-step explanations that are clear and encouraging</responsibility>
        <responsibility>Connect answers to pending assignments when relevant</responsibility>
{f"        <responsibility>When answering curriculum-related questions, prioritize information from the knowledge base section as it contains authoritative curriculum content</responsibility>" if kb_retrieved_contexts else ""}
    </role_responsibilities>
    
    <important_guidelines>
        <guideline>Speak directly to {student_name} in {language}</guideline>
        <guideline>Keep explanations clear, step-by-step, and encouraging</guideline>
        <guideline>Connect answers to pending assignments when possible</guideline>
        <guideline>Celebrate progress and keep motivation high</guideline>
        <guideline>Adapt to the student's learning style: {learning_style}</guideline>
        <guideline>Be supportive and patient, especially when explaining complex concepts</guideline>
        <guideline>When multiple assignments are pending, help prioritize based on due dates</guideline>
    </important_guidelines>
    
    <instructions>
        Provide clear, educational, and contextually relevant responses based on all available information.
        Speak in a friendly, encouraging tone that motivates the student.
        {f"When answering curriculum-related questions, use the knowledge base reference material as the primary source of information." if kb_retrieved_contexts else ""}
        Output your responses in natural, conversational language that is helpful and supportive.
    </instructions>
</study_buddy_request>
"""
    
    model_name = state.get("model") if state.get("model") else "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.55)
    
    llm_messages = [
        SystemMessage(content="You are a supportive AI study buddy. Process the following XML request and provide helpful, educational responses."),
        HumanMessage(content=xml_prompt)
    ]
    
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
    
    # Await the async LLM streaming operation
    try:
        full_response, token_usage = await stream_with_token_tracking(
            llm,
            llm_messages,
            chunk_callback=chunk_callback,
            state=state
        )
        
        state["simple_llm_response"] = full_response
        state["response"] = full_response
        
        # Update token usage in state if available
        if token_usage:
            current_usage = state.get("token_usage", {})
            if isinstance(current_usage, dict):
                # Merge token usage
                for key, value in token_usage.items():
                    current_usage[key] = current_usage.get(key, 0) + value
                state["token_usage"] = current_usage
            else:
                state["token_usage"] = token_usage
        
    except asyncio.CancelledError:
        print(f"[Student SimpleLLM] ⚠️ LLM streaming was cancelled")
        raise
    except Exception as e:
        print(f"[Student SimpleLLM] ❌ Error during LLM streaming: {e}")
        import traceback
        traceback.print_exc()
        # Set error response in state
        state["simple_llm_response"] = f"Error: {str(e)}"
        state["response"] = f"Error: {str(e)}"
    
    return state
