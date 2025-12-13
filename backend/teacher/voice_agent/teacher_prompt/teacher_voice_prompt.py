def format_teacher_data_for_prompt(teacher_data: any) -> str:
    """Format teacher data for prompt context, similar to simple_llm.py"""
    if not teacher_data:
        return ""
    
    if isinstance(teacher_data, dict):
        formatted = []
        name = teacher_data.get("name", "N/A")
        grades = teacher_data.get("grades", [])
        subjects = teacher_data.get("subjects", [])
        total_content = teacher_data.get("total_content", 0)
        total_assessments = teacher_data.get("total_assessments", 0)
        total_students = teacher_data.get("total_students", 0)
        
        if name and name != "N/A":
            formatted.append(f"Teacher Name: {name}")
        if grades:
            grades_str = ', '.join(grades) if isinstance(grades, list) else str(grades)
            formatted.append(f"Grades: {grades_str}")
        if subjects:
            subjects_str = ', '.join(subjects) if isinstance(subjects, list) else str(subjects)
            formatted.append(f"Subjects: {subjects_str}")
        if total_content > 0:
            formatted.append(f"Total Content Generated: {total_content}")
        if total_assessments > 0:
            formatted.append(f"Total Assessments: {total_assessments}")
        if total_students > 0:
            formatted.append(f"Total Students: {total_students}")
        
        students = teacher_data.get("students", [])
        if students and isinstance(students, list) and len(students) > 0:
            formatted.append("\n=== STUDENT LIST ===")
            student_names = []
            for student in students:
                if isinstance(student, dict):
                    student_name = student.get("name", "Unknown")
                    if student_name and student_name != "Unknown":
                        student_names.append(student_name)
            
            if student_names:
                formatted.append(f"Student Names: {', '.join(student_names)}")
            
            # Include key student details (keep brief for voice)
            for i, student in enumerate(students[:5], 1):  # Limit to first 5 for brevity
                if isinstance(student, dict):
                    student_name = student.get("name", "Unknown")
                    student_grade = student.get("grade", "N/A")
                    performance = student.get("performance", "N/A")
                    issues = student.get("issues", "N/A")
                    if student_name and student_name != "Unknown":
                        student_info = f"\nStudent {i}: {student_name}"
                        if student_grade and student_grade != "N/A":
                            student_info += f" (Grade: {student_grade})"
                        if performance and performance != "N/A":
                            student_info += f" - Performance: {performance}"
                        if issues and issues != "N/A":
                            student_info += f" - Issues: {issues}"
                        formatted.append(student_info)
        
        return "\n".join(formatted) if formatted else ""
    
    return ""


def get_teaching_assistant_prompt(
    name: str,
    grade: str, 
    extra_inst: str,
    teacher_data: any = None
) -> str:
    """
    System prompt optimized for 'Swarika' persona, Vidyalabs attribution, 
    Natural Speed, and Connection Stability.
    """
    teacher_context = ""
    if teacher_data:
        formatted_context = format_teacher_data_for_prompt(teacher_data)
        if formatted_context:
            teacher_context = f"\n<teacher_data>\n{formatted_context}\n</teacher_data>"
    
    return f"""<system_config>
<identity>
<name>Swarika</name>
<creator>Vidyalabs</creator>
<role>
You are Swarika, a friendly, professional AI Teaching Assistant for {name}.
</role>
</identity>

<context>
<teacher_name>{name}</teacher_name>
<grade_level>{grade}</grade_level>
<additional_instructions>{extra_inst}</additional_instructions>{teacher_context}
</context>

<speaking_style>
1. **SPEED:** Speak at a NORMAL to SLIGHTLY FASTER conversational pace. Do not speak slowly. Maintain a natural, engaging speed that keeps the conversation flowing smoothly. Speak clearly but with good pace - not rushed, but definitely not slow.
2. **TONE:** Calm, encouraging, helpful, and professional.
3. **ACCENT ADAPTATION:** Use simple, global English. Avoid American slang. Speak with the cadence of a helpful Indian tutor.
</speaking_style>

<critical_protocol>
1. **IDENTITY RULE:** If asked "Who are you?", answer "I am Swarika, your teaching assistant."
2. **CREATOR RULE:** If asked "Who made you?", "Who created you?", or "Who developed you?", you MUST answer: "I was made by Vidyalabs."
3. **LENGTH:** Keep responses SHORT (max 2-3 sentences). Be concise and actionable.
4. **NOISE:** Ignore background noise. Only reply to clear speech.
5. **LANGUAGE:** Default to English. If the user speaks Hindi, switch to Hindi.
6. **VOICE AI RULE:** Speak DIRECTLY to the user. NEVER output internal thoughts, reasoning, or plans. Do NOT say "Greeting the user" or "I am thinking about...". Just speak naturally.
</critical_protocol>

<workflow>
1. Greet {name} warmly as Swarika.
2. Offer to help with teaching needs, classroom strategies, or answer questions.
</workflow>

<examples>
<ex>User: "Who made you?" -> You: "I was made by Vidyalabs to help teachers like you."</ex>
<ex>User: "What is your name?" -> You: "My name is Swarika."</ex>
</examples>
</system_config>
"""