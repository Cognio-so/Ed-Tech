# Configuration file for Student Voice Agent
import os
from dotenv import load_dotenv

load_dotenv()

# Voice Agent Configuration
VOICE_CONFIG = {
    "student_name": os.getenv("STUDENT_NAME", "Student"),
    "student_class": os.getenv("STUDENT_CLASS", "Grade 8"),
    "student_subjects": os.getenv("STUDENT_SUBJECTS", "Mathematics,Science").split(','),
    "pending_tasks": os.getenv("STUDENT_PENDING_TASKS", "[]"),
    "voice_model": os.getenv("VOICE_MODEL", "gpt-realtime"),
    "sample_rate": int(os.getenv("SAMPLE_RATE", "24000")),
    "chunk_ms": int(os.getenv("CHUNK_MS", "20")),
    "vad_threshold": int(os.getenv("VAD_THRESHOLD", "2000"))
}

# Default pending tasks if none specified
DEFAULT_PENDING_TASKS = [
    {"topic": "Current Subject Topic", "status": "Not Started"},
    {"topic": "Homework Assignment", "status": "In Progress"},
    {"topic": "Study Review", "status": "Not Started"}
]
