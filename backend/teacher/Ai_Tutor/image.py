"""
Image generation node for AI Tutor.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Dict, Any
try:
    from backend.teacher.Ai_Tutor.graph_type import GraphState
except ImportError:
    from teacher.Ai_Tutor.graph_type import GraphState
from teacher.media_toolkit.image_gen import ImageGenerator


async def image_node(state: GraphState) -> GraphState:
    """
    Image generation node.
    Generates educational images based on the topic.
    """
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    grade = student_data.get("grade", "") if isinstance(student_data, dict) else ""
    language = state.get("language", "English")
    
    try:
        generator = ImageGenerator()
        
        # Create schema for image generation
        schema_dict = {
            "topic": topic,
            "grade_level": grade,
            "preferred_visual_type": "diagram",  # Can be 'image', 'chart', or 'diagram'
            "subject": subject,
            "instructions": f"Create an educational {topic} diagram for grade {grade} {subject} class",
            "difficulty_flag": "false",
            "language": language
        }
        
        image_b64 = generator.generate_image_from_schema(schema_dict)
        
        if image_b64:
            data_url = f"data:image/png;base64,{image_b64}"
            state["image_result"] = data_url
        else:
            state["image_result"] = None
            
    except Exception as e:
        state["image_result"] = None
        print(f"Image generation error: {e}")
    
    # Store response for orchestrator
    if state.get("image_result"):
        state["response"] = f"Image generated successfully: {state['image_result'][:50]}..."
    else:
        state["response"] = "Image generation completed."
    
    return state

