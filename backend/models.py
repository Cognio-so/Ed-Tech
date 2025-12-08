from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, PositiveInt, validator, model_validator

import os
import logging
import tempfile
from datetime import datetime
from starlette.concurrency import run_in_threadpool
from teacher.media_toolkit.video_generation import PPTXToHeyGenVideo 

logger = logging.getLogger(__name__)

class DocumentInfo(BaseModel):
    """Model for document information."""
    id: str
    filename: str
    content: str
    file_type: str
    file_url: str
    size: int

class InstructionDepth(str, Enum):
    SIMPLE = "Simple"
    STANDARD = "Standard"
    ENRICHED = "Enriched"

class LessonPlanRequest(BaseModel):
    grade: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    language: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=1)
    learning_objective: str = Field(..., min_length=1)
    emotional_consideration: int = Field(..., ge=1, le=5, description="Scale from 1 to 5")
    adaptive_learning: bool = False
    include_assessment: bool = False
    multimedia_suggestion: bool = False
    instruction_depth: InstructionDepth = InstructionDepth.STANDARD
    number_of_sessions: Optional[PositiveInt] = Field(None, description="Optional, used in lesson plan")
    duration_of_session: Optional[str] = Field(None, description="Optional, e.g. '45 minutes'")

    @validator("language")
    def normalize_language(cls, value: str) -> str:
        return value.capitalize()

class ContentGenerationRequest(LessonPlanRequest):
    model_config = ConfigDict(populate_by_name=True)

class WebSearchSchemaRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    grade_level: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    content_type: str = Field(..., min_length=1, description="e.g., articles, videos")
    language: str = Field(..., min_length=1)
    comprehension: str = Field(..., min_length=1, description="e.g., beginner, intermediate")

class AssessmentRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    grade: str = Field(..., min_length=1)
    difficulty_level: str = Field(..., min_length=1)
    language: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=1)
    learning_objective: str = Field(..., min_length=1)
    duration: str = Field(..., min_length=1)
    confidence_level: int = Field(..., ge=1, le=5)
    custom_instruction: Optional[str] = Field("", description="Optional teacher notes")
    mcq_enabled: bool = False
    mcq_count: Optional[int] = Field(default=0, ge=0)
    true_false_enabled: bool = False
    true_false_count: Optional[int] = Field(default=0, ge=0)
    short_answer_enabled: bool = False
    short_answer_count: Optional[int] = Field(default=0, ge=0)

    @validator("language")
    def normalize_language(cls, value: str) -> str:
        return value.capitalize()

    @model_validator(mode="after")
    def validate_question_configuration(cls, values: "AssessmentRequest") -> "AssessmentRequest":
        question_flags = [
            ("mcq_enabled", "mcq_count"),
            ("true_false_enabled", "true_false_count"),
            ("short_answer_enabled", "short_answer_count"),
        ]
        any_enabled = False

        for enabled_key, count_key in question_flags:
            count_value = getattr(values, count_key) or 0
            if getattr(values, enabled_key):
                any_enabled = True
                if count_value <= 0:
                    raise ValueError(f"{count_key} must be greater than 0 when {enabled_key} is true.")
            else:
                setattr(values, count_key, 0)

        if not any_enabled:
            raise ValueError("At least one question type must be enabled.")
        return values

class ComicsSchema(BaseModel):
    instructions: str = Field(..., description="Educational story/topic, e.g., Water cycle")
    grade_level: str = Field(..., description="Grade level string, e.g., '5' or 'Grade 5'")
    num_panels: int = Field(..., description="Number of panels to generate", ge=1, le=20)
    language: str = Field("English", description="Language for comic text (e.g., English)")

class PresentationSchema(BaseModel):
    plain_text: str = Field(..., description="The main topic or content of the presentation.", example="Introduction to Machine Learning")
    custom_user_instructions: str = Field("", description="Specific instructions for the AI.", example="Focus on practical applications")
    length: int = Field(..., description="The desired number of slides.", example=10, ge=1, le=50)
    language: str = Field("ENGLISH", description="The language of the presentation.", example="ENGLISH", pattern="^(ENGLISH|HINDI)$")
    fetch_images: bool = Field(True, description="Whether to include stock images in the presentation.")
    verbosity: str = Field("standard", description="The desired text verbosity.", example="standard", pattern="^(concise|standard|text-heavy)$")
    # Added tone to match the generator capabilities, defaulting to educational
    tone: str = Field("educational", description="The tone of the presentation.", example="educational", pattern="^(educational|playful|professional|persuasive|inspirational)$") 
    template: str = Field("default", description="The template style for the presentation.", example="default", pattern="^(default|aurora|lavender|monarch|serene|iris|clyde|adam|nebula|bruno)$")

class TeacherVoiceSchema(BaseModel):
    """Schema for initializing the Voice Agent with context."""
    sdp: str = Field(..., description="The WebRTC SDP Offer from the client browser")
    type: str = Field(..., description="SDP type, usually 'offer'")
    teacher_name: str = Field(..., description="Name of the teacher")
    grade: str = Field("General", description="Grade level")
    instructions: Optional[str] = Field(None, description="Specific instructions for this session")
    voice: Literal['alloy', 'echo', 'shimmer'] = Field('shimmer', description="Voice preference")

class StudentAITutorRequest(BaseModel):
    message: str = Field(..., description="Student's question or input")
    student_profile: Optional[Dict[str, Any]] = Field(None, description="Profile data such as name, grade, preferences")
    subject: Optional[str] = Field(None, description="Subject for the session")
    topic: Optional[str] = Field(None, description="Topic focus")
    doc_url: Optional[str] = Field(None, description="Optional document to analyze")
    language: str = Field("English", description="Conversation language")
    pending_assignments: Optional[List[Dict[str, Any]]] = Field(None, description="Assignments to keep in mind")
    achievements: Optional[List[str]] = Field(None, description="Recent accomplishments")
    assessment_data: Optional[Dict[str, Any]] = Field(None, description="Assessment details for personalization")

class ImageGenSchema(BaseModel):
    topic: str = Field(..., description="Topic for the image")
    grade_level: str = Field(..., description="Grade level")
    preferred_visual_type: str = Field(..., description="Visual type: 'image' for general images, 'chart' for data visualizations, 'diagram' for technical diagrams")
    subject: str = Field(..., description="Subject")
    instructions: str = Field(..., description="Detailed instructions")
    difficulty_flag: str = Field("false", description="true/false flag")
    language: str = Field("English", description="Language for labels (e.g., English, Arabic)")

class AITutorRequest(BaseModel):
    """Request schema for AI Tutor chat."""
    message: str = Field(..., description="User's message/query")
    teacher_data: Optional[Dict[str, Any]] = Field(None, description="Teacher data with name, grade, subjects, students array, etc.")
    student_data: Optional[Dict[str, Any]] = Field(None, description="Student data (currently not used, students are in teacher_data)")
    topic: Optional[str] = Field(None, description="Topic for the conversation")
    subject: Optional[str] = Field(None, description="Subject")
    doc_url: Optional[str] = Field(None, description="Document URL if uploaded")
    language: str = Field("English", description="Language for the conversation")
    model: Optional[str] = Field(None, description="Selected AI model (e.g., 'deepseek-v3.1')")

class StudentVoiceSchema(BaseModel):
    """Schema for initializing the Student Voice Agent (Study Buddy)."""
    sdp: str = Field(..., description="The WebRTC SDP Offer from the client browser")
    type: str = Field(..., description="SDP type, usually 'offer'")
    student_name: str = Field(..., description="Name of the student")
    grade: str = Field(..., description="Grade level")
    subject: str = Field(..., description="Subject being studied")
    pending_assignments: Optional[List[Dict[str, Any]]] = Field(
        default=[], 
        description="List of pending assignments (e.g., [{'title': 'Math HW', 'due': 'tomorrow'}])"
    )
    completed_assignments: Optional[List[Dict[str, Any]]] = Field(
        default=[], 
        description="List of recently completed assignments"
    )
    voice: Literal['alloy', 'echo', 'shimmer'] = Field('shimmer', description="Voice preference")

class AddDocumentsRequest(BaseModel):
    """Request schema for adding documents by URL."""
    documents: List[Dict[str, Any]] = Field(..., description="List of documents with file_url, filename, file_type, id, size")

def parse_enhanced_story_panels(story_text: str) -> List[Dict[str, str]]:
    """
    Helper to parse the story text into structured panels.
    Adapts logic from comic_generation.py to match the endpoint's expected keys.
    """
    panels = []
    current_panel = {}
    
    lines = story_text.strip().split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Detect new panel start (usually numbered list)
        if line.split('.')[0].isdigit() and 'Panel_Prompt:' in line:
            if current_panel and 'prompt' in current_panel:
                # Ensure footer exists even if empty
                if 'footer_text' not in current_panel:
                    current_panel['footer_text'] = ""
                panels.append(current_panel)
            current_panel = {}

        if 'Panel_Prompt:' in line:
            parts = line.split('Panel_Prompt:', 1)
            if len(parts) > 1:
                current_panel['prompt'] = parts[1].strip()
        elif 'Footer_Text:' in line:
            parts = line.split('Footer_Text:', 1)
            if len(parts) > 1:
                current_panel['footer_text'] = parts[1].strip()

    # Add the last panel
    if current_panel and 'prompt' in current_panel:
        if 'footer_text' not in current_panel:
            current_panel['footer_text'] = ""
        panels.append(current_panel)
        
    return panels


async def generate_video_background(
    task_id: str, 
    pptx_bytes: bytes, 
    original_filename: str, 
    voice_id: str, 
    avatar_id: str, 
    title: str, 
    language: str,
    video_generation_tasks: Dict[str, Dict[str, Any]],
    storage_manager: Any
):
    """
    Background task to handle the synchronous video generation process.
    Requires dependency injection of state dictionaries and storage managers.
    """
    temp_file_path = None
    try:
        logger.info(f"Starting background video generation for task: {task_id}")
        video_generation_tasks[task_id]["status"] = "uploading"

        # 1. Write bytes to a temporary local file 
        # (CloudinaryStorage.upload_file expects a file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pptx") as temp_file:
            temp_file.write(pptx_bytes)
            temp_file_path = temp_file.name

        # 2. Upload to Cloudinary
        # We use a unique public_id to prevent collisions
        public_id = f"video_presentations/{task_id}_{original_filename}"
        
        # Run sync upload in threadpool
        success, result_id_or_error = await run_in_threadpool(
            storage_manager.upload_file,
            file_path=temp_file_path,
            public_id=public_id
        )

        if not success:
            raise Exception(f"Cloudinary upload failed: {result_id_or_error}")

        pptx_public_id = result_id_or_error
        logger.info(f"Uploaded to Cloudinary: {pptx_public_id}")
        
        video_generation_tasks[task_id]["status"] = "generating"

        # 3. Initialize Converter
        converter = PPTXToHeyGenVideo(
            storage_manager=storage_manager,
            pptx_avatar_id=avatar_id,
            pptx_voice_id=voice_id,
            language=language
        )

        # 4. Run Conversion (Heavy processing: Aspose -> OpenAI -> HeyGen)
        result = await run_in_threadpool(
            converter.convert,
            pptx_public_id=pptx_public_id,
            title=title
        )

        # 5. Update Status
        video_generation_tasks[task_id].update({
            "status": "completed",
            "video_id": result.get("video_id"),
            "video_url": result.get("video_url"),
            "slides_processed": result.get("slides_processed"),
            "completed_at": datetime.now().isoformat()
        })
        logger.info(f"Video generation task {task_id} completed successfully.")

    except Exception as e:
        logger.error(f"Error in video background task {task_id}: {e}", exc_info=True)
        video_generation_tasks[task_id].update({
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now().isoformat()
        })
    finally:
        # Cleanup local temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass
