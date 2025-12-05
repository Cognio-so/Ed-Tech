"""
Image generation node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

try:
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
except ImportError:
    from Student.Ai_tutor.graph_type import StudentGraphState
from teacher.media_toolkit.image_gen import ImageGenerator


async def image_node(state: StudentGraphState) -> StudentGraphState:
    """
    Generate supportive study visuals for the student.
    """
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    grade = student_profile.get("grade", "")
    language = state.get("language", "English")

    try:
        generator = ImageGenerator()
        schema_dict = {
            "topic": topic or subject or "Study Concept",
            "grade_level": grade or "General",
            "preferred_visual_type": "diagram",
            "subject": subject or "General Studies",
            "instructions": (
                f"Create a friendly, student-facing diagram for {topic or subject}. "
                "Keep the visual simple and focused on learning."
            ),
            "difficulty_flag": "false",
            "language": language,
        }

        image_b64 = generator.generate_image_from_schema(schema_dict)
        if image_b64:
            state["image_result"] = f"data:image/png;base64,{image_b64}"
            state["response"] = "Generated a study diagram you can review below."
        else:
            state["image_result"] = None
            state["response"] = "Unable to generate an image at the moment."
    except Exception as exc:
        state["image_result"] = None
        state["response"] = f"Image generation failed: {exc}"
        print(f"[Student Image] Error: {exc}")

    return state


