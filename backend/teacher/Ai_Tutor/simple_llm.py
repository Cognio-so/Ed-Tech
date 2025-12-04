"""
Simple LLM + KBRAG node for AI Tutor.
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
from backend.llm import get_llm, stream_with_token_tracking
from backend.teacher.Ai_Tutor.graph_type import GraphState
from backend.teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES


def format_student_data(student_data: Any) -> str:
    """Format student data for context."""
    if not student_data:
        return "No student data provided."
    
    if isinstance(student_data, dict):
        # Check if it's a single student or multiple students
        if "name" in student_data or "grade" in student_data or "language" in student_data:
            # Single student object
            name = student_data.get("name", "N/A")
            grade = student_data.get("grade", "N/A")
            language = student_data.get("language", "N/A")
            return f"Student: {name}, Grade: {grade}, Language: {language}"
        elif "students" in student_data:
            # Multiple students in a list
            students = student_data.get("students", [])
            formatted = []
            for i, student in enumerate(students, 1):
                name = student.get("name", "N/A") if isinstance(student, dict) else "N/A"
                grade = student.get("grade", "N/A") if isinstance(student, dict) else "N/A"
                language = student.get("language", "N/A") if isinstance(student, dict) else "N/A"
                formatted.append(f"Student {i}: {name}, Grade: {grade}, Language: {language}")
            return "\n".join(formatted)
        else:
            # Try to format as list of students
            formatted = []
            for key, value in student_data.items():
                if isinstance(value, dict):
                    name = value.get("name", key)
                    grade = value.get("grade", "N/A")
                    language = value.get("language", "N/A")
                    formatted.append(f"Student ({key}): {name}, Grade: {grade}, Language: {language}")
                else:
                    formatted.append(f"{key}: {value}")
            return "\n".join(formatted) if formatted else str(student_data)
    elif isinstance(student_data, list):
        # List of students
        formatted = []
        for i, student in enumerate(student_data, 1):
            if isinstance(student, dict):
                name = student.get("name", f"Student {i}")
                grade = student.get("grade", "N/A")
                language = student.get("language", "N/A")
                formatted.append(f"Student {i}: {name}, Grade: {grade}, Language: {language}")
            else:
                formatted.append(f"Student {i}: {student}")
        return "\n".join(formatted) if formatted else "No student data available."
    
    return str(student_data)


def format_content_type(content_type: Any) -> str:
    """Format content_type (generated content list) for context."""
    if not content_type:
        return "No generated content available."
    
    # If it's a string, return as is
    if isinstance(content_type, str):
        return f"Content Type: {content_type}"
    
    # If it's a list of content items
    if isinstance(content_type, list):
        if not content_type:
            return "No generated content available."
        
        formatted = ["Generated Content:"]
        for i, content_item in enumerate(content_type, 1):
            if isinstance(content_item, dict):
                content_type_name = content_item.get("type") or content_item.get("contentType", "Unknown")
                title = content_item.get("title", "Untitled")
                subject = content_item.get("subject", "N/A")
                grade = content_item.get("grade", "N/A")
                topic = content_item.get("topic", "N/A")
                content_preview = content_item.get("content", "")
                if content_preview and len(content_preview) > 200:
                    content_preview = content_preview[:200] + "..."
                
                formatted.append(f"""
  Content {i}:
    - Type: {content_type_name}
    - Title: {title}
    - Subject: {subject}
    - Grade: {grade}
    - Topic: {topic}
    - Content Preview: {content_preview}
""")
            else:
                formatted.append(f"  Content {i}: {content_item}")
        
        return "\n".join(formatted)
    
    # If it's a dict
    if isinstance(content_type, dict):
        formatted = ["Generated Content:"]
        content_type_name = content_type.get("type") or content_type.get("contentType", "Unknown")
        title = content_type.get("title", "Untitled")
        subject = content_type.get("subject", "N/A")
        grade = content_type.get("grade", "N/A")
        topic = content_type.get("topic", "N/A")
        content_preview = content_type.get("content", "")
        if content_preview and len(content_preview) > 200:
            content_preview = content_preview[:200] + "..."
        
        formatted.append(f"""
  - Type: {content_type_name}
  - Title: {title}
  - Subject: {subject}
  - Grade: {grade}
  - Topic: {topic}
  - Content Preview: {content_preview}
""")
        return "\n".join(formatted)
    
    return str(content_type)


def format_teacher_data(teacher_data: Any) -> str:
    """Format teacher data for context with new structure."""
    if not teacher_data:
        return "No teacher data provided."
    
    if isinstance(teacher_data, dict):
        formatted = []
        
        # Teacher basic information
        name = teacher_data.get("name", "N/A")
        grade = teacher_data.get("grade", "N/A")
        subjects = teacher_data.get("subjects", [])
        total_content = teacher_data.get("total_content", 0)
        total_assessments = teacher_data.get("total_assessments", 0)
        total_students = teacher_data.get("total_students", 0)
        
        formatted.append(f"Teacher Name: {name}")
        if grade and grade != "N/A":
            formatted.append(f"Grade: {grade}")
        if subjects:
            formatted.append(f"Subjects: {', '.join(subjects) if isinstance(subjects, list) else subjects}")
        formatted.append(f"Total Content Generated: {total_content}")
        formatted.append(f"Total Assessments: {total_assessments}")
        formatted.append(f"Total Students: {total_students}")
        
        # Students array - format with clear names for easy identification
        students = teacher_data.get("students", [])
        if students and isinstance(students, list):
            formatted.append("\n=== STUDENT LIST ===")
            # First, list all student names for quick reference
            student_names = []
            for student in students:
                if isinstance(student, dict):
                    student_name = student.get("name", "Unknown")
                    if student_name and student_name != "Unknown":
                        student_names.append(student_name)
            
            if student_names:
                formatted.append(f"Student Names: {', '.join(student_names)}")
            
            formatted.append("\nDetailed Student Information:")
            for i, student in enumerate(students, 1):
                if isinstance(student, dict):
                    student_name = student.get("name", "Unknown")
                    student_grade = student.get("grade", "N/A")
                    performance = student.get("performance", "N/A")
                    achievements = student.get("achievements", "N/A")
                    feedback = student.get("feedback", "N/A")
                    issues = student.get("issues", "N/A")
                    
                    # Use clear formatting with student name as header
                    student_info = f"\n--- STUDENT: {student_name} ---"
                    if student_grade and student_grade != "N/A":
                        student_info += f"\n  Grade: {student_grade}"
                    if performance and performance != "N/A":
                        student_info += f"\n  Performance: {performance}"
                    if achievements and achievements != "N/A":
                        student_info += f"\n  Achievements: {achievements}"
                    if feedback and feedback != "N/A":
                        student_info += f"\n  Feedback: {feedback}"
                    if issues and issues != "N/A":
                        student_info += f"\n  Issues: {issues}"
                    
                    formatted.append(student_info)
        
        return "\n".join(formatted) if formatted else "No teacher data available."
    
    return str(teacher_data)


def get_student_names_list(teacher_data: Any) -> str:
    """Extract and return a comma-separated list of student names for quick reference."""
    if not teacher_data or not isinstance(teacher_data, dict):
        return ""
    
    students = teacher_data.get("students", [])
    if not students or not isinstance(students, list):
        return ""
    
    student_names = []
    for student in students:
        if isinstance(student, dict):
            student_name = student.get("name", "")
            if student_name and student_name != "Unknown":
                student_names.append(student_name)
    
    return ", ".join(student_names) if student_names else ""


async def simple_llm_node(state: GraphState) -> GraphState:
    """
    Simple LLM + KBRAG node.
    Uses a simple LLM with knowledge base context, student data, generated content, and teacher data.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    teacher_data = state.get("teacher_data", {})
    content_type = state.get("content_type")
    language = state.get("language", "English")
    model = state.get("model")  # Get selected model from state
    chunk_callback = state.get("chunk_callback")
    
    # Format all context information
    # Students are now in teacher_data.students, but keep student_data formatting for backward compatibility
    student_context = format_student_data(student_data)
    teacher_context = format_teacher_data(teacher_data)
    content_context = format_content_type(content_type)
    
    # Get list of student names for quick reference
    student_names_list = get_student_names_list(teacher_data)
    
    # Extract grade from teacher_data or student_data
    grade = ""
    if isinstance(teacher_data, dict):
        grade = teacher_data.get("grade", "")
        # Also check students array in teacher_data
        if not grade:
            students = teacher_data.get("students", [])
            if students and isinstance(students, list) and len(students) > 0:
                if isinstance(students[0], dict):
                    grade = students[0].get("grade", "")
    
    # Fallback to student_data if grade not found in teacher_data
    if not grade and isinstance(student_data, dict):
        grade = student_data.get("grade", "")
        if not grade and "students" in student_data:
            students = student_data.get("students", [])
            if students and isinstance(students[0], dict):
                grade = students[0].get("grade", "")
    elif isinstance(student_data, list) and student_data:
        if isinstance(student_data[0], dict):
            grade = student_data[0].get("grade", "")
    
    # KB/RAG search for curriculum-related questions
    # Only perform KB search if grade, subject, and language are all available
    kb_retrieved_contexts = []
    if grade and subject and language:
        # Normalize values for collection name
        subject_normalized = subject.lower().replace(" ", "_")
        lang_code = LANGUAGES.get(language, language).lower()
        collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
        
        # Get user query for KB search
        user_query = ""
        if messages:
            # Get the last human message
            for msg in reversed(messages):
                if hasattr(msg, 'content') and msg.content:
                    msg_type = getattr(msg, 'type', None) or getattr(msg, 'role', None)
                    if msg_type and msg_type.lower() in ('human', 'user'):
                        user_query = msg.content
                        break
        
        # Fallback to resolved_query or user_query from state
        if not user_query:
            user_query = state.get("resolved_query") or state.get("user_query", "")
        
        # Perform KB search if we have a query
        if user_query:
            try:
                print(f"[SimpleLLM KB] 🔍 Searching collection '{collection_name}' for query: {user_query[:120]}...")
                # Await the async KB retrieval operation
                kb_retrieved_contexts = await retrieve_kb_context(collection_name, user_query, top_k=5)
                if kb_retrieved_contexts:
                    print(f"[SimpleLLM KB] ✅ Retrieved {len(kb_retrieved_contexts)} context chunk(s) from knowledge base")
                else:
                    print(f"[SimpleLLM KB] ⚠️ No knowledge base context found for collection '{collection_name}'")
            except asyncio.CancelledError:
                print(f"[SimpleLLM KB] ⚠️ KB search was cancelled")
                kb_retrieved_contexts = []
                raise
            except Exception as e:
                print(f"[SimpleLLM KB] ❌ Error retrieving KB context: {e}")
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
        print(f"[SimpleLLM KB] ⚠️ Skipping KB search - missing: {', '.join(missing)}")
    
    # Build comprehensive context
    # Note: Students are now primarily in teacher_data.students, but we keep student_context for backward compatibility
    
    # Format KB context if available
    formatted_kb_context = ""
    if kb_retrieved_contexts:
        formatted_kb_context = "\n\n".join(kb_retrieved_contexts[:5])
    
    # Build XML-formatted prompt
    xml_prompt = f"""
<ai_tutor_request>
    <context>
        <role>Expert AI Tutor for Teachers</role>
        <task>Help teachers with educational content, students, and curriculum-related questions</task>
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
    
    <teacher_information>
        <data>
{teacher_context}
        </data>
        <student_names>{student_names_list if student_names_list else "None listed"}</student_names>
    </teacher_information>
    
    <student_data>
        <data>
{student_context if student_context != "No student data provided." else "Students are listed in Teacher Information above."}
        </data>
    </student_data>
    
    <generated_content>
        <data>
{content_context}
        </data>
    </generated_content>
    
    <capabilities>
        <access>
            <item>Topic and subject information</item>
            <item>Complete teacher information including their students (with performance, achievements, feedback, issues)</item>
            <item>Teacher statistics (total content generated, assessments, number of students)</item>
            <item>All content generated by the teacher (lesson plans, worksheets, quizzes, presentations, etc.) with their types, subjects, grades, and content</item>
{f"            <item>Curriculum knowledge base content for Grade {grade}, Subject: {subject}, Language: {language} - Use this authoritative curriculum material to answer curriculum-related questions</item>" if kb_retrieved_contexts else ""}
        </access>
    </capabilities>
    
    <role_responsibilities>
        <responsibility>Answer questions about the generated content (lesson plans, worksheets, quizzes, presentations)</responsibility>
        <responsibility>Provide insights about students based on their performance, achievements, feedback, and issues</responsibility>
        <responsibility>Help teachers understand how to use their generated content effectively</responsibility>
        <responsibility>Suggest improvements or modifications to generated content based on student needs</responsibility>
        <responsibility>Answer questions related to the subject, topic, and grade level using curriculum knowledge base when available</responsibility>
        <responsibility>Provide educational guidance based on all available context</responsibility>
        <responsibility>Help teachers address student issues and celebrate achievements</responsibility>
{f"        <responsibility>When answering curriculum-related questions, prioritize information from the knowledge base section as it contains authoritative curriculum content</responsibility>" if kb_retrieved_contexts else ""}
    </role_responsibilities>
    
    <student_handling>
        <critical_rules>
            <rule>When the teacher asks about a specific student, identify them by NAME from the student list</rule>
            <rule>You have access to multiple students, each with their own: name, grade, performance, achievements, feedback, and issues</rule>
            <rule>When answering questions about a specific student, clearly identify which student you're referring to by their name</rule>
            <rule>If the teacher asks "What about [Student Name]?" or "Tell me about [Student Name]", provide detailed information about that specific student</rule>
            <rule>You can compare students if asked (e.g., "Compare John and Sarah's performance")</rule>
            <rule>If asked about "all students" or "my students", provide insights across all students</rule>
            <rule>Always use the student's exact name as provided in the context when referencing them</rule>
        </critical_rules>
    </student_handling>
    
    <important_guidelines>
        <guideline>When answering questions about generated content, reference specific content items by their type, title, subject, and grade</guideline>
        <guideline>Consider all student information (performance, achievements, feedback, issues) when providing recommendations</guideline>
        <guideline>Use the teacher's statistics (total content, assessments, students) to provide context-aware advice</guideline>
        <guideline>Be specific and reference the actual content when possible</guideline>
        <guideline>Pay special attention to student issues and provide actionable solutions</guideline>
        <guideline>Acknowledge student achievements and suggest ways to build on them</guideline>
        <guideline>When multiple students are present, always identify which student(s) you're discussing by name</guideline>
    </important_guidelines>
    
    <instructions>
        Provide clear, educational, and contextually relevant responses based on all available information. 
        When discussing students, always use their names to avoid confusion.
        {f"When answering curriculum-related questions, use the knowledge base reference material as the primary source of information." if kb_retrieved_contexts else ""}
        Output your responses in natural, conversational language that is helpful and professional.
    </instructions>
</ai_tutor_request>
"""
    
    # Use the selected model if provided, otherwise default to grok
    model_name = model if model else "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.6)
    
    llm_messages = [
        SystemMessage(content="You are an expert AI tutor. Process the following XML request and provide helpful, educational responses."),
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
        print(f"[SimpleLLM] ⚠️ LLM streaming was cancelled")
        raise
    except Exception as e:
        print(f"[SimpleLLM] ❌ Error during LLM streaming: {e}")
        import traceback
        traceback.print_exc()
        # Set error response in state
        state["simple_llm_response"] = f"Error: {str(e)}"
        state["response"] = f"Error: {str(e)}"
    
    return state

