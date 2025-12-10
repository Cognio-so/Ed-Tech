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


def _format_last_turns(messages, k=4):
    """Format last k messages (2-4 messages) for context, truncating long responses."""
    if not messages:
        return "(no previous conversation)"
    
    # Use last 2-4 messages (1-2 conversation turns)
    num_messages = min(k, len(messages))
    recent_messages = messages[-num_messages:] if num_messages > 0 else []
    
    formatted = []
    for m in recent_messages:
        if isinstance(m, dict):
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content", "")
        else:
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "") if hasattr(m, "content") else str(m)
        
        if not content:
            continue
        
        # Truncate very long messages to save tokens (approx 150-200 words)
        if len(content) > 800:
            content = content[:800] + "... (truncated)"
        
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


def _format_completed_assignments(completed_assignments):
    """Format completed assignments for context."""
    if not completed_assignments:
        return "No recently completed assignments."
    formatted = []
    for assignment in completed_assignments[:5]:
        title = assignment.get("title") or assignment.get("name") or "Assignment"
        score = assignment.get("score")
        submitted_at = assignment.get("submittedAt") or assignment.get("submitted_at") or "Recently"
        assignment_type = assignment.get("type", "assignment")
        if score is not None:
            formatted.append(f"- {title} ({assignment_type}, score: {score}, submitted: {submitted_at})")
        else:
            formatted.append(f"- {title} ({assignment_type}, submitted: {submitted_at})")
    return "\n".join(formatted)


def _get_low_score_assessments(completed_assignments, threshold=60):
    """
    Extract assessments with scores below threshold.
    Returns list of dicts with title, score, and extracted topic.
    """
    if not completed_assignments:
        return []
    
    low_score_assessments = []
    for assignment in completed_assignments:
        score = assignment.get("score")
        assignment_type = assignment.get("type", "").lower()
        
        # Only check assessment-type assignments
        if assignment_type == "assessment" and score is not None and score < threshold:
            title = assignment.get("title") or assignment.get("name") or "Assessment"
            # Try to extract topic from title (e.g., "Assessment - Chemical reactions" -> "Chemical reactions")
            topic = title
            if " - " in title:
                topic = title.split(" - ", 1)[1]
            elif ":" in title:
                topic = title.split(":", 1)[1]
            
            low_score_assessments.append({
                "title": title,
                "topic": topic.strip(),
                "score": score
            })
    
    return low_score_assessments


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
    topic = state.get("user_query", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    pending_assignments = state.get("pending_assignments") or student_profile.get("pending_assignments") or []
    completed_assignments = state.get("completed_assignments") or student_profile.get("completed_assignments") or []
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
                kb_retrieved_contexts = await retrieve_kb_context(collection_name, user_query, top_k=3)
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
    completed_assignments_text = _format_completed_assignments(completed_assignments)
    achievements_text = _format_achievements(achievements)
    
    # Check for low-scoring assessments (< 60%)
    low_score_assessments = _get_low_score_assessments(completed_assignments, threshold=60)
    low_score_context = ""
    if low_score_assessments:
        topics_list = [assess["topic"] for assess in low_score_assessments]
        topics_text = ", ".join(topics_list)
        scores_text = ", ".join([f"{assess['topic']} ({assess['score']}%)" for assess in low_score_assessments])
        low_score_context = f"""
        <low_performance_alert>
            <status>ACTIVE</status>
            <message>The student has recently completed assessments with scores below 60%:</message>
            <assessments>
                {scores_text}
            </assessments>
            <action_required>
                When the student greets you or asks a general question, proactively and supportively ask which topic from these assessments they would like to review and study: {topics_text}
                Be encouraging and supportive - frame it as an opportunity to improve understanding.
            </action_required>
        </low_performance_alert>"""
    else:
        low_score_context = """
        <low_performance_alert>
            <status>INACTIVE</status>
            <message>No low-scoring assessments detected.</message>
        </low_performance_alert>"""
    
    # Format conversation history and add debug logging
    conversation_history = _format_last_turns(messages, k=4)
    print(f"[STUDENT SIMPLE_LLM] 📜 Total messages in state: {len(messages)}")
    print(f"[STUDENT SIMPLE_LLM] 📝 Conversation history:\n{conversation_history}")
    print(f"[STUDENT SIMPLE_LLM] 📝 Current user query: '{topic}'")
    
    xml_prompt = f"""
<study_buddy_request>
    <context>
        <role>Supportive AI Study Buddy</role>
        <task>Help students with their learning, assignments, and educational questions</task>
        
        **CONVERSATION HISTORY - READ THIS FIRST:**
        <recent_conversation>
{conversation_history}
        </recent_conversation>
        
        **CURRENT USER QUERY - WHAT THE STUDENT JUST SAID:**
        <current_user_query>
{topic}
        </current_user_query>
        
        **IMPORTANT:** The conversation history above shows what was discussed before. Use it to understand context!
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
        <completed_assignments>
{completed_assignments_text}
        </completed_assignments>
        <recent_achievements>
{achievements_text}
        </recent_achievements>
{low_score_context}
    </student_information>
    
    <capabilities>
        <access>
            <item>Topic and subject information</item>
            <item>Complete student profile (name, grade, learning style, subject focus)</item>
            <item>Pending assignments with due dates and status</item>
            <item>Completed assignments with scores and submission dates</item>
            <item>Recent achievements and accomplishments</item>
{f"            <item>Curriculum knowledge base content for Grade {grade}, Subject: {subject}, Language: {language} - Use this authoritative curriculum material to answer curriculum-related questions</item>" if kb_retrieved_contexts else ""}
        </access>
    </capabilities>
    
    <role_responsibilities>
        <responsibility>Answer questions about the current subject and topic</responsibility>
        <responsibility>Help students understand their assignments and provide guidance</responsibility>
        <responsibility>Celebrate achievements and completed assignments</responsibility>
        <responsibility>Adapt explanations to the student's learning style and grade level</responsibility>
        <responsibility>Answer questions related to the subject, topic, and grade level using curriculum knowledge base when available</responsibility>
        <responsibility>Provide step-by-step explanations that are clear and encouraging</responsibility>
        <responsibility>Connect answers to pending assignments when relevant</responsibility>
        <responsibility>Recognize and acknowledge completed assignments and their scores</responsibility>
        <responsibility>When low-scoring assessments are detected (below 60%), proactively and supportively ask the student which topic they would like to review, especially during greetings or general conversations</responsibility>
{f"        <responsibility>When answering curriculum-related questions, prioritize information from the knowledge base section as it contains authoritative curriculum content</responsibility>" if kb_retrieved_contexts else ""}
    </role_responsibilities>
    
    <important_guidelines>
        <guideline>Speak directly to {student_name} in {language}</guideline>
        <guideline>Keep explanations clear, step-by-step, and encouraging</guideline>
        <guideline>Connect answers to pending assignments when possible</guideline>
        <guideline>Celebrate progress, completed assignments, and keep motivation high</guideline>
        <guideline>Adapt to the student's learning style: {learning_style}</guideline>
        <guideline>Be supportive and patient, especially when explaining complex concepts</guideline>
        <guideline>When multiple assignments are pending, help prioritize based on due dates</guideline>
        <guideline>Acknowledge completed assignments and use them to build on student's progress</guideline>
        <guideline>If the student has low-scoring assessments (below 60%), proactively ask which topic they'd like to review when they greet you or ask general questions - be encouraging and frame it as a learning opportunity</guideline>
    </important_guidelines>
    
    <instructions>
        **CRITICAL: YOU MUST READ THE <recent_conversation> SECTION BEFORE RESPONDING!**
        
        The <recent_conversation> section contains the previous messages in this conversation. 
        The <current_user_query> is what the student just said.
        
        **STEP 1: READ AND UNDERSTAND THE CONVERSATION HISTORY**
        Look at <recent_conversation> and identify:
        - What topics were discussed?
        - What questions were asked?
        - What was the last thing you (Buddy) said?
        - What was the context of the conversation?
        
        **STEP 2: ANALYZE THE CURRENT QUERY IN CONTEXT**
        Read <current_user_query> and determine:
        
        **If <recent_conversation> shows you asked a question (like "Would you like to review Chemical reactions and equations?") 
        and <current_user_query> is "yes" or "ok" or similar:**
        → This is a FOLLOW-UP. Continue with the topic you asked about. DO NOT repeat the greeting.
        
        **If <recent_conversation> shows you were explaining a topic (like Chemical reactions and equations) 
        and <current_user_query> is "explain in detail" or "tell me more":**
        → This is a CONTINUATION. Continue explaining the SAME topic in more detail. DO NOT repeat the greeting.
        
        **If <recent_conversation> is empty or only shows greetings, and <current_user_query> is "hi" or "hello":**
        → This is a GREETING. Show student data (assignments, achievements, etc.)
        
        **If <current_user_query> is a new question about a different topic:**
        → This is a NEW QUESTION. Answer it directly as an AI assistant.
        
        1. **If this is a GREETING or INITIAL MESSAGE** (e.g., 'hi', 'hello', 'hey', or first message in conversation):
           - Provide a warm greeting using the student's name
           - Display ALL student information from <student_information>:
             * Completed assignments with scores
             * Pending assignments with due dates
             * Recent achievements
           - If there are low-scoring assessments (below 60%), proactively and supportively ask which topic they'd like to review (at the end, before closing)
           - End with: "How can I help you today?"
           - DO NOT start explaining topics unless explicitly asked
        
        2. **If this is a FOLLOW-UP or CONTINUATION** (e.g., 'yes', 'ok', 'explain in detail', 'tell me more', or clearly responding to a previous question):
           - Look at the conversation history to understand what topic was being discussed
           - Continue with the SAME topic from the previous conversation
           - DO NOT repeat the greeting or list all assignments again
           - DO NOT ask if they want to review a topic if you were already discussing it
           - Provide detailed, helpful information about the topic that was being discussed
           - Work like a normal AI assistant - answer the question directly
        
        3. **If this is a NEW QUESTION or TOPIC REQUEST**:
           - Answer the question directly as an AI assistant
           - Use the knowledge base content if available and relevant
           - Provide clear, educational explanations
           - DO NOT show student data unless it's relevant to the answer
        
        **Key Rules:**
        - Use conversation history intelligently to understand context
        - Only show student data (assignments, achievements) during greetings
        - For follow-ups, continue the previous topic discussion
        - For new questions, answer directly without repeating student data
        - Be natural and conversational - don't force patterns
        - Use the knowledge base content when answering curriculum-related questions
        
        CRITICAL: Format ALL responses using proper Markdown syntax following these guidelines:
        
        ## Markdown Formatting Requirements:
        - Use headers (# H1, ## H2, ### H3) to structure content.
        - Use **bold** for key terms and *italics* for emphasis.
        - Use lists (- or 1.) for steps or items.
        - Use `inline code` for formulas/terms.
        - Use blockquotes (>) for tips/notes.
        - Use triple backticks for code/examples.
        - Use Markdown tables for comparisons.
        
        ### Educational Content Structure:
        When explaining concepts, structure responses as:
        ## {topic}
        Hi {student_name}! [Intro]
        ### What You Need to Know
        * **Key Point 1**
        * **Key Point 2**
        
        ### Step-by-Step Guide
        1. **Step 1**: [Instruction]
        2. **Step 2**: [Instruction]
        
        ### Practice Questions
        - [Question 1]
        
        > **Encouragement**: [Message]
        
        ### Assignment/Progress Connection
        [Link to assignments if relevant]
        
        ALWAYS use this Markdown formatting to ensure content renders beautifully.
    </instructions>
</study_buddy_request>
"""
    
    model_name = state.get("model") if state.get("model") else "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.55)
    
    # Build LLM messages: System message with XML prompt, then conversation history
    llm_messages = [
        SystemMessage(content="You are a supportive AI study buddy. Process the following XML request and provide helpful, educational responses.")
    ]
    
    # Add the XML prompt as a human message (contains all context including conversation history)
    llm_messages.append(HumanMessage(content=xml_prompt))
    
    # IMPORTANT: The conversation history is already in the XML prompt's <recent_conversation> section
    # We don't need to add messages again here - that would duplicate the context
    # The current user query is in <current_user_query> section of the XML prompt
    
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
