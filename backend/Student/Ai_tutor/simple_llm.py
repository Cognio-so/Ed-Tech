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
    """Format last k messages (2-4 messages) for context."""
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


def _is_greeting(text: str) -> bool:
    """Detect simple greeting messages to use a lightweight prompt."""
    if not text:
        return False
    t = text.strip().lower()
    
    # Educational request keywords - if these are present, it's NOT a greeting
    educational_keywords = [
        "explain", "teach", "help", "what is", "what are", "how does", "why does",
        "tell me about", "describe", "define", "show me", "learn", "study",
        "understand", "example", "examples", "question", "questions"
    ]
    
    # If it contains educational keywords, it's NOT a greeting
    if any(keyword in t for keyword in educational_keywords):
        return False
    
    # Only check for greetings if it's not an educational request
    greetings = [
        "hi",
        "hello",
        "hey",
        "hi!",
        "hello!",
        "hey!",
        "good morning",
        "good afternoon",
        "good evening",
    ]
    return any(t == g or t.startswith(g + " ") for g in greetings)


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
    
    # Format KB context - this is the curriculum knowledge base content
    formatted_kb_context = ""
    has_kb_context = False
    if kb_retrieved_contexts:
        formatted_kb_context = "\n\n".join(kb_retrieved_contexts[:5])
        has_kb_context = True
        print(f"[STUDENT SIMPLE_LLM] 📚 KB Context retrieved: {len(kb_retrieved_contexts)} chunks, total length: {len(formatted_kb_context)} chars")
    
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

    # Check if this is an educational request (should NOT show student data)
    is_educational_request = any(keyword in topic.lower() for keyword in [
        "explain", "teach", "what is", "what are", "help with", "describe", "define", 
        "show me", "learn", "study", "understand", "tell me about", "how does", "why does"
    ])
    print(f"[STUDENT SIMPLE_LLM] 🎓 Is educational request: {is_educational_request}")

    # Lightweight path for first-turn greetings to reduce token usage
    # ONLY use this if it's a greeting AND NOT an educational request
    last_user_text = topic
    if messages:
        # Find last human/user message content if available
        for m in reversed(messages):
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            if role in ("human", "user") and getattr(m, "content", None):
                last_user_text = m.content
                break

    is_first_turn = len(messages) <= 1
    # Only use greeting path if it's actually a greeting AND not an educational request
    if _is_greeting(last_user_text) and is_first_turn and not is_educational_request:
        # Build a much smaller prompt focused only on greeting + student info
        greeting_prompt = f"""
You are a supportive AI study buddy.

Student profile (for context, do not restate everything verbatim):
{student_context if student_context != "No student profile provided." else "No student profile available."}

Pending assignments:
{assignments_text}

Completed assignments:
{completed_assignments_text}

Recent achievements:
{achievements_text}

Low-score assessments (if any):
{", ".join([f"{assess['topic']} ({assess['score']}%)" for assess in low_score_assessments]) if low_score_assessments else "None"}

The student just said: "{last_user_text}".

Respond with a short, friendly greeting to {student_name} in {language}, then:
- Briefly summarize pending and completed assignments only at a high level (no long lists).
- If there are low-scoring assessments, gently ask which topic they'd like to review.
- End with: "How can I help you today?".
Use concise Markdown with at most two headings and a few bullet points.
"""
        model_name = state.get("model") if state.get("model") else "x-ai/grok-4.1-fast"
        llm = get_llm(model_name, temperature=0.55)
        llm_messages = [
            SystemMessage(content="You are a supportive AI study buddy. Keep responses concise and student-friendly."),
            HumanMessage(content=greeting_prompt),
        ]
        try:
            full_response, token_usage = await stream_with_token_tracking(
                llm,
                llm_messages,
                chunk_callback=chunk_callback,
                state=state,
            )
            state["simple_llm_response"] = full_response
            state["response"] = full_response
            if token_usage:
                current_usage = state.get("token_usage", {})
                if isinstance(current_usage, dict):
                    for key, value in token_usage.items():
                        current_usage[key] = current_usage.get(key, 0) + value
                    state["token_usage"] = current_usage
                else:
                    state["token_usage"] = token_usage
        except asyncio.CancelledError:
            print(f"[Student SimpleLLM] ⚠️ LLM streaming was cancelled (greeting path)")
            raise
        except Exception as e:
            print(f"[Student SimpleLLM] ❌ Error during LLM streaming (greeting path): {e}")
            import traceback
            traceback.print_exc()
            state["simple_llm_response"] = f"Error: {str(e)}"
            state["response"] = f"Error: {str(e)}"
        return state

    # Build concise prompt based on request type
    if is_educational_request:
        # Minimal prompt for educational requests - no student data
        if has_kb_context:
            kb_section = f"""
<curriculum_knowledge_base>
This is the official curriculum content retrieved from the knowledge base for Grade {grade}, Subject: {subject}, Language: {language}.
This content is the PRIMARY and AUTHORITATIVE source for your answer. You MUST base your response on this curriculum content.

CURRICULUM CONTENT:
{formatted_kb_context}

CRITICAL INSTRUCTIONS:
- Your answer MUST be based on the curriculum content above.
- Use the exact concepts, definitions, and explanations from the curriculum knowledge base.
- Ensure your answer aligns with the grade level ({grade}) and subject ({subject}) curriculum.
- If the curriculum content covers the topic, use it as the foundation of your explanation.
- Do NOT make up information that contradicts the curriculum content.
</curriculum_knowledge_base>
"""
        else:
            kb_section = f"""
<curriculum_knowledge_base>
No curriculum content was found in the knowledge base for this query.
You may use your general knowledge, but ensure it's appropriate for Grade {grade} level.
</curriculum_knowledge_base>
"""
        
        xml_prompt = f"""You are a supportive AI tutor for {student_name} (Grade {grade}, {language}).

<recent_conversation>
{conversation_history}
</recent_conversation>

<current_user_query>
{topic}
</current_user_query>

{kb_section}

<instructions>
CRITICAL PRIORITY RULES:
1. If curriculum knowledge base content is provided above, it is the PRIMARY source. Base your answer 100% on that content.
2. Answer the educational question directly. Focus 100% on teaching/explaining.
3. Use Markdown formatting (headers, lists, bold, code blocks).
4. DO NOT mention assignments, achievements, or student profile.
5. Ensure the answer is appropriate for Grade {grade} level and aligns with {subject} curriculum.

<diagram_requirements>
MANDATORY: When explaining any of the following, you MUST include a Mermaid.js diagram:
- Processes (e.g., water cycle, photosynthesis, how a bill becomes a law)
- Systems (e.g., digestive system, government branches, computer architecture)
- Hierarchies (e.g., classification systems, organizational structures)
- Timelines or sequences (e.g., historical events, steps in a procedure)
- Cycles (e.g., life cycles, economic cycles, chemical cycles)
- Relationships (e.g., cause and effect, dependencies, interactions)
- Workflows or decision trees

HOW TO CREATE MERMAID DIAGRAMS:
1. Wrap the Mermaid code in a markdown code block with language "mermaid":
   ```mermaid
   graph TD
       A[Start] --> B[Process]
       B --> C[End]
   ```

2. Use appropriate Mermaid diagram types:
   - graph TD (Top-Down) or graph LR (Left-Right) for flowcharts
   - sequenceDiagram for interactions over time
   - flowchart TD/LR for modern flowcharts
   - mindmap for hierarchical concepts

3. Keep diagrams simple and clear:
   - Use short, descriptive labels in square brackets: [Label]
   - Use arrows (--> or ---) to show flow
   - Use curly braces for decisions: {{Decision}}
   - Use clear, grade-appropriate language
   - CRITICAL: NEVER use arrows (-->) or special characters inside node labels.
     * BAD: [Acids + Bases --> Salt + Water] or [pH < 7]
     * GOOD: [Acids plus Bases produce Salt and Water] or [pH less than 7]
   - Sanitize ALL text inside square brackets [ ]:
     * Replace '-->' with 'produces' or 'to'
     * Replace '<' with 'less than', '>' with 'greater than'
     * Replace '+' with 'plus', '=' with 'equals'
     * Remove ':', ';', '"', "'", '(', ')'
   - Keep node IDs simple (A, B, C, D1).
   - Edge labels should be simple text without special characters

4. Always explain the diagram in text before or after showing it.

EXAMPLE FORMAT:
Here's how the water cycle works:

The water cycle involves several key stages...

```mermaid
graph TD
    A[Evaporation] --> B[Condensation]
    B --> C[Precipitation]
    C --> D[Collection]
    D --> A
```

BAD EXAMPLE (DO NOT USE):
```mermaid
graph TD
    A[pH < 7] --> B[Acidic]
    C[Acids + Bases --> Salt + Water] --> D[Result]
```
This will FAIL because of special characters and arrows in labels.

GOOD EXAMPLE (USE THIS):
```mermaid
graph TD
    A[pH less than 7] --> B[Acidic]
    C[Acids plus Bases produce Salt and Water] --> D[Result]
```

As you can see, the cycle repeats continuously...
</diagram_requirements>
</instructions>
"""
    else:
        # Full prompt for greetings/follow-ups with student data
        if has_kb_context:
            kb_section = f"""
<curriculum_knowledge_base>
This is the official curriculum content retrieved from the knowledge base for Grade {grade}, Subject: {subject}, Language: {language}.
If the user's query relates to educational content, use this curriculum knowledge as the PRIMARY source for your answer.

CURRICULUM CONTENT:
{formatted_kb_context}

IMPORTANT: If the query is educational and curriculum content is available, base your answer on this curriculum content.
</curriculum_knowledge_base>
"""
        else:
            kb_section = f"""
<curriculum_knowledge_base>
No curriculum content was found in the knowledge base for this query.
</curriculum_knowledge_base>
"""
        
        profile_summary = student_context[:200] if student_context != "No student profile provided." else "N/A"
        pending_summary = assignments_text[:300] if assignments_text != "No pending assignments logged." else "None"
        completed_summary = completed_assignments_text[:300] if completed_assignments_text != "No recently completed assignments." else "None"
        achievements_summary = achievements_text[:200] if achievements_text != "No recent achievements noted." else "None"
        low_scores_text = ""
        if low_score_assessments:
            low_scores_list = [f"{a['topic']} ({a['score']}%)" for a in low_score_assessments[:3]]
            low_scores_text = f"- Low scores: {', '.join(low_scores_list)}"
        
        xml_prompt = f"""You are a supportive AI study buddy for {student_name} (Grade {grade}, {language}).

<recent_conversation>
{conversation_history}
</recent_conversation>

<current_user_query>
{topic}
</current_user_query>

{kb_section}

<student_information>
- Profile: {profile_summary}
- Pending: {pending_summary}
- Completed: {completed_summary}
- Achievements: {achievements_summary}
{low_scores_text}
</student_information>

<response_rules>
1. If curriculum knowledge base content is provided and the query is educational, use that curriculum content as the PRIMARY source.
2. Educational query (explain/teach/help/what is) → Answer directly based on curriculum content if available, NO student data.
3. Greeting (hi/hello/hey only) → Greet + show assignments/achievements + ask about low scores.
4. Follow-up (yes/tell me more) → Continue previous topic, NO greeting/stats. Use curriculum content if relevant.

Format: Markdown with headers, lists, bold, code blocks.

<diagram_requirements>
MANDATORY: When explaining any of the following, you MUST include a Mermaid.js diagram:
- Processes (e.g., water cycle, photosynthesis, how a bill becomes a law)
- Systems (e.g., digestive system, government branches, computer architecture)
- Hierarchies (e.g., classification systems, organizational structures)
- Timelines or sequences (e.g., historical events, steps in a procedure)
- Cycles (e.g., life cycles, economic cycles, chemical cycles)
- Relationships (e.g., cause and effect, dependencies, interactions)
- Workflows or decision trees

HOW TO CREATE MERMAID DIAGRAMS:
1. Wrap the Mermaid code in a markdown code block with language "mermaid":
   ```mermaid
   graph TD
       A[Start] --> B[Process]
       B --> C[End]
   ```

2. Use appropriate Mermaid diagram types:
   - graph TD (Top-Down) or graph LR (Left-Right) for flowcharts
   - sequenceDiagram for interactions over time
   - flowchart TD/LR for modern flowcharts
   - mindmap for hierarchical concepts

3. Keep diagrams simple and clear:
   - Use short, descriptive labels in square brackets: [Label]
   - Use arrows (--> or ---) to show flow
   - Use curly braces for decisions: {{Decision}}
   - Use clear, grade-appropriate language
   - CRITICAL: NEVER use arrows (-->) or special characters inside node labels.
     * BAD: [Acids + Bases --> Salt + Water] or [pH < 7]
     * GOOD: [Acids plus Bases produce Salt and Water] or [pH less than 7]
   - Sanitize ALL text inside square brackets [ ]:
     * Replace '-->' with 'produces' or 'to'
     * Replace '<' with 'less than', '>' with 'greater than'
     * Replace '+' with 'plus', '=' with 'equals'
     * Remove ':', ';', '"', "'", '(', ')'
   - Keep node IDs simple (A, B, C, D1).
   - Edge labels should be simple text without special characters

4. Always explain the diagram in text before or after showing it.

EXAMPLE FORMAT:
Here's how the water cycle works:

The water cycle involves several key stages...

```mermaid
graph TD
    A[Evaporation] --> B[Condensation]
    B --> C[Precipitation]
    C --> D[Collection]
    D --> A
```

BAD EXAMPLE (DO NOT USE):
```mermaid
graph TD
    A[pH < 7] --> B[Acidic]
    C[Acids + Bases --> Salt + Water] --> D[Result]
```
This will FAIL because of special characters and arrows in labels.

GOOD EXAMPLE (USE THIS):
```mermaid
graph TD
    A[pH less than 7] --> B[Acidic]
    C[Acids plus Bases produce Salt and Water] --> D[Result]
```

As you can see, the cycle repeats continuously...
</diagram_requirements>
</response_rules>
"""
    
    model_name = state.get("model") if state.get("model") else "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.55)
    
    # Build LLM messages: System message with XML prompt, then conversation history
    llm_messages = [
        SystemMessage(content="You are a supportive AI study buddy. Process the following XML request and provide helpful, educational responses. When explaining processes, systems, or complex concepts, always include Mermaid.js diagrams in markdown code blocks labeled 'mermaid'.")
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
