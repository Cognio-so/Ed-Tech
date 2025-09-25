import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Union

import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, WebSocket, WebSocketDisconnect, Form, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv
from fastapi.concurrency import run_in_threadpool
import json
import asyncio
import aiohttp
from datetime import datetime
import base64
import numpy as np

# --- Configure Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Load Environment Variables ---
load_dotenv()

# --- Import functionalities from your scripts ---

# Chatbot imports
from Student_chatbot.Student_AI_tutor import AsyncRAGTutor, RAGTutorConfig
from AI_tutor import TeacherAsyncRAGTutor, TeacherRAGTutorConfig

# Assessment generation imports
from assessment import create_question_generation_chain, generate_test_questions_async, get_curriculum_context_async

# Teaching content generation imports
from teaching_content_generation import run_generation_pipeline_async as generate_teaching_content

# Media toolkit imports
from media_toolkit.slides_generation import SlideSpeakGenerator
from media_toolkit.image_generation_model import ImageGenerator
from media_toolkit.comics_generation import (
    create_comical_story_prompt, 
    generate_comic_image, 
    parse_story_panels,
    add_footer_text_to_image
)
from media_toolkit.video_presentation_heygen import PPTXToHeyGenVideo

# Import Tavily for web search in voice
try:
    from tavily import TavilyClient
    tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
except:
    tavily_client = None

# Import the Perplexity chat instance from your module
try:
    from media_toolkit.websearch_schema_based import chat as pplx_chat
except Exception as e:
    pplx_chat = None
    logger.warning(f"Perplexity chat not initialized: {e}")

# Import the cloud storage manager
from storage import CloudflareR2Storage
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
import qdrant_client

# --- FastAPI App Initialization ---
logger.info("Starting AI Education Platform API...")
app = FastAPI(
    title="AI Education Platform API",
    description="An AI-powered tools for tutoring, assessment creation, and teaching content generation.",
    version="1.0.0"
)

# --- Add CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://ed-tech-alpha-sable.vercel.app"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- Add request size limit middleware ---
@app.middleware("http")
async def increase_request_size_limit(request: Request, call_next):
    # Increase the maximum request size to 50MB
    request._max_content_length = 50 * 1024 * 1024  # 50MB
    response = await call_next(request)
    return response

# --- Global Objects and Initializations ---
logger.info("Initializing global components...")

try:
    # Initialize Storage Manager
    storage_manager = CloudflareR2Storage()
    logger.info("✅ Cloudflare R2 storage manager initialized.")

    # Initialize Tutor Sessions Dictionary
    tutor_sessions: Dict[str, AsyncRAGTutor] = {}
    teacher_sessions: Dict[str, TeacherAsyncRAGTutor] = {} # New: Dictionary to store teacher sessions
    # Add teacher tutor sessions
    teacher_tutor_sessions: Dict[str, Any] = {}


    # Initialize other components
    slide_generator = SlideSpeakGenerator()
    image_generator = ImageGenerator()
    
    # Initialize assessment chain
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        assessment_chain = create_question_generation_chain(openai_api_key)
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=openai_api_key)
        logger.info("✅ Assessment chain and embeddings initialized successfully.")
    else:
        assessment_chain = None
        embeddings = None
        logger.warning("⚠️ OpenAI API key not found. Assessment functionality will be limited.")

    logger.info("✅ All global components initialized successfully.")
except Exception as e:
    logger.error(f"❌ Error initializing global components: {e}", exc_info=True)
    raise

# ==============================
# 1. HEALTH CHECK ENDPOINT
# ==============================
@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {
        "status": "healthy",
        "message": "AI Education Platform API is running",
        "timestamp": "2024-01-01T00:00:00Z"
    }

# ==============================
# 2. CHATBOT ENDPOINT (JSON-only, SSE text streaming)
# ==============================

class StudentData(BaseModel):
    id: str = Field(..., description="Student's unique identifier")
    email: str = Field(..., description="Student's email address")
    name: str = Field(..., description="Student's name")
    grade: str = Field(..., description="Student's grade level")
    progress: Optional[Dict[str, Any]] = Field({}, description="Student's learning progress")
    achievements: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = Field([], description="Student's achievements")
    learning_stats: Optional[Dict[str, Any]] = Field({}, description="Student's learning statistics")
    assessments: Optional[List[Dict[str, Any]]] = Field([], description="Student's assessments")
    lessons: Optional[List[Dict[str, Any]]] = Field([], description="Student's lessons")
    resources: Optional[List[Dict[str, Any]]] = Field([], description="Student's learning resources")
    analytics: Optional[List[Dict[str, Any]]] = Field([], description="Student's learning analytics")

    @validator('achievements', pre=True)
    def validate_achievements(cls, v):
        """Convert achievements to list format if it's an object with nested data."""
        if isinstance(v, dict) and 'achievements' in v:
            return v['achievements']
        elif isinstance(v, list):
            return v
        else:
            return []

class ChatbotRequest(BaseModel):
    session_id: str = Field(..., description="A unique identifier for the chat session. This maintains the context and knowledge base for the user.")
    query: str = Field(..., description="The user's text query to the chatbot.")  # FIXED: Remove Optional, make required
    history: List[Dict[str, Any]] = Field([], description="A list of previous messages in the chat history.")
    web_search_enabled: bool = Field(True, description="Enable or disable web search functionality for the tutor.")  # Changed default to True
    student_data: Optional[StudentData] = Field(None, description="Comprehensive student data for personalized learning")
    uploaded_files: Optional[List[str]] = Field([], description="List of uploaded file names for context")

@app.post("/chatbot_endpoint")
async def chatbot_endpoint(request: ChatbotRequest):
    """
    Handles interactions with the AI tutor with JSON-only requests.
    Streaming text responses, no audio files.
    Enhanced with student data for personalized learning.
    """
    try:
        logger.info(f"Chatbot endpoint called with session_id: {request.session_id}")
        logger.info(f"Query: {request.query}")
        logger.info(f"Student data: {request.student_data}")
        
        session_id = request.session_id
        
        # Get or create a tutor instance for the session
        if session_id not in tutor_sessions:
            logger.info(f"Creating new AI Tutor session: {session_id}")
            tutor_config = RAGTutorConfig.from_env()
            tutor_config.web_search_enabled = True  # Always enable web search
            tutor_sessions[session_id] = AsyncRAGTutor(storage_manager=storage_manager, config=tutor_config)
        
        tutor = tutor_sessions[session_id]

        # Always enable web search for the tutor
        tutor.update_web_search_status(True)

        # --- Enhanced Query Processing with Student Data ---
        if not request.query:
            logger.error("No query provided in request")
            raise HTTPException(status_code=400, detail="A 'query' is required.")

        # Prepare enhanced context with student data
        enhanced_query = request.query
        enhanced_history = request.history.copy()
        
        if request.student_data:
            student_data = request.student_data
            
            # Create personalized context based on student data
            personalization_context = f"""
            Student Information:
            - Name: {student_data.name}
            - Grade: {student_data.grade}
            - Email: {student_data.email}
            
            Learning Progress:
            - Completed Resources: {len([r for r in student_data.resources or [] if r.get('completed')])}
            - Total Resources: {len(student_data.resources or [])}
            - Achievements: {len(student_data.achievements or [])}
            
            Current Learning Focus:
            - Active Lessons: {len([l for l in student_data.lessons or [] if l.get('status') == 'active'])}
            - Recent Assessments: {len([a for a in student_data.assessments or [] if a.get('recent')])}
            
            Learning Statistics:
            - Study Time: {student_data.learning_stats.get('totalStudyTime', 'N/A') if student_data.learning_stats else 'N/A'}
            - Completion Rate: {student_data.learning_stats.get('completionRate', 'N/A') if student_data.learning_stats else 'N/A'}
            - Performance Score: {student_data.learning_stats.get('averageScore', 'N/A') if student_data.learning_stats else 'N/A'}
            """
            
            # Add personalization context to the query
            enhanced_query = f"""
            {personalization_context}
            
            Student Query: {request.query}
            
            """
            
            logger.info(f"Enhanced query with student data for {student_data.name} (Grade {student_data.grade})")
        
        is_kb_ready = tutor.ensemble_retriever is not None
        
        # FIXED: Pass all parameters including uploaded_files to match Student_AI_tutor.py run_agent_async signature
        response_generator = tutor.run_agent_async(
            query=enhanced_query,
            history=enhanced_history,
            image_storage_key=None,  # No image upload in this flow
            is_knowledge_base_ready=is_kb_ready,
            uploaded_files=request.uploaded_files,
            student_details=request.student_data.model_dump() if request.student_data else None
        )

        async def event_stream():
            import json
            async def send(obj: dict):
                yield f"data: {json.dumps(obj)}\n\n"
            try:
                async for chunk in response_generator:
                    if not chunk:
                        continue
                    async for part in send({"type": "text_chunk", "content": chunk}):
                        yield part
                async for part in send({"type": "done"}):
                    yield part
            except Exception as e:
                logger.error(f"Error in chatbot stream: {e}", exc_info=True)
                async for part in send({"type": "error", "message": str(e)}):
                    yield part

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in chatbot endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# NEW: Document upload endpoint for chatbot
@app.post("/upload_documents_endpoint")
async def upload_documents_endpoint(session_id: str = Form(...), files: List[UploadFile] = File(...)):
    """
    Upload documents for the chatbot session to create a knowledge base.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Get or create a tutor instance for the session
        if session_id not in tutor_sessions:
            logger.info(f"Creating new AI Tutor session for document upload: {session_id}")
            tutor_config = RAGTutorConfig.from_env()
            tutor_config.web_search_enabled = True  # Always enable web search
            tutor_sessions[session_id] = AsyncRAGTutor(storage_manager=storage_manager, config=tutor_config)
        
        tutor = tutor_sessions[session_id]
        
        # Save files and get storage keys
        storage_keys = []
        for file in files:
            if file.filename:
                file_bytes = await file.read()
                safe_filename = f"{uuid.uuid4()}_{file.filename}"
                
                # Upload to cloud storage. These are for the KB, so is_user_doc=False
                success, storage_key = await storage_manager.upload_file_async(file_bytes, safe_filename, is_user_doc=False)
                
                if success:
                    storage_keys.append(storage_key)
                    logger.info(f"Uploaded file {file.filename} to cloud storage with key: {storage_key}")
                else:
                    logger.error(f"Failed to upload file {file.filename} to cloud storage.")
        
        if storage_keys:
            # Ingest documents into the tutor's knowledge base
            success = await tutor.ingest_async(storage_keys)
            if success:
                return {
                    "success": True,
                    "message": f"Successfully uploaded and processed {len(storage_keys)} document(s)",
                    "files_processed": len(storage_keys)
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to process uploaded documents")
        else:
            raise HTTPException(status_code=400, detail="No valid files were successfully uploaded")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in document upload endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Document upload endpoint for TEACHER chatbot
@app.post("/teacher_upload_document_endpoint")
async def teacher_upload_document_endpoint(session_id: str = Form(...), files: List[UploadFile] = File(...)):
    """
    Upload documents for the teacher's chatbot session to create a knowledge base.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        # Get or create a TEACHER tutor instance for the session
        # FIXED: Use the correct session dictionary for teachers
        if session_id not in teacher_tutor_sessions:
            logger.info(f"Creating new Teacher AI Tutor session for document upload: {session_id}")
            teacher_config = TeacherRAGTutorConfig.from_env()
            teacher_config.web_search_enabled = True  # Always enable web search
            teacher_tutor_sessions[session_id] = TeacherAsyncRAGTutor(storage_manager=storage_manager, config=teacher_config)

        tutor = teacher_tutor_sessions[session_id]

        # Save files and get storage keys
        storage_keys = []
        original_filenames = []
        for file in files:
            if file.filename:
                original_filenames.append(file.filename)
                file_bytes = await file.read()
                safe_filename = f"{uuid.uuid4()}_{file.filename}"

                # Upload to cloud storage. These are for the KB, so is_user_doc=False
                success, storage_key = await storage_manager.upload_file_async(file_bytes, safe_filename, is_user_doc=False)

                if success:
                    storage_keys.append(storage_key)
                    logger.info(f"Uploaded file {file.filename} for teacher to cloud storage with key: {storage_key}")
                else:
                    logger.error(f"Failed to upload file {file.filename} for teacher to cloud storage.")

        if storage_keys:
            # Ingest documents into the teacher's tutor's knowledge base
            success = await tutor.ingest_async(storage_keys)
            if success:
                # FIXED: Return the original filenames for context
                return {
                    "success": True,
                    "message": f"Successfully uploaded and processed {len(storage_keys)} document(s) for the teacher's session",
                    "files_processed": len(storage_keys),
                    "filenames": original_filenames
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to process uploaded documents for the teacher's session")
        else:
            raise HTTPException(status_code=400, detail="No valid files were successfully uploaded")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in teacher document upload endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 3. ASSESSMENT ENDPOINT
# ==============================

class AssessmentSchema(BaseModel):
    test_title: str = Field(..., description="The title of the test.", example="The American Revolution")
    grade_level: str = Field(..., description="The target grade or class for the test.", example="8th Grade")
    subject: str = Field(..., description="The subject of the test.", example="History")
    topic: str = Field(..., description="The specific topic the test will cover.", example="Key Battles of the Revolutionary War")
    assessment_type: str = Field(..., description="The type of questions to generate or 'Mixed' for multiple types.", example="MCQ")
    question_types: Optional[List[str]] = Field(None, description="List of question types when using mixed assessments.", example=["mcq", "true_false"])
    question_distribution: Optional[Dict[str, int]] = Field(None, description="Distribution of questions by type.", example={"mcq": 6, "true_false": 2, "short_answer": 2})
    test_duration: str = Field(..., description="The estimated duration for completing the test.", example="30 minutes")
    number_of_questions: int = Field(..., description="The exact number of questions to generate.", example=10)
    difficulty_level: str = Field(..., description="The difficulty level of the questions.", example="Medium", pattern="^(Easy|Medium|Hard)$")
    learning_objectives: Optional[str] = Field("", description="Learning objectives for the assessment.")
    anxiety_triggers: Optional[str] = Field("", description="Anxiety considerations to account for.")
    user_prompt: Optional[str] = Field("None.", description="Optional specific instructions for the AI.", example="Focus on the strategic importance of each battle.")
    language: Optional[str] = Field("English", description="The language to generate the assessment in (e.g., English, Arabic)")

@app.post("/assessment_endpoint", response_model=Dict[str, Any])
async def assessment_endpoint(schema: AssessmentSchema):
    """
    Generates a set of test questions based on the provided schema.
    The response will contain the formatted questions and a separate answer key.
    Supports both single question type and mixed question type assessments.
    """
    try:
        # Convert the schema to dict for processing
        schema_dict = schema.model_dump()

        # MODIFICATION: Add instructions for Arabic generation if selected.
        if schema_dict.get('language', 'English').lower().strip() == 'arabic':
            arabic_instruction = "الرجاء إنشاء هذا التقييم بالكامل باللغة العربية."
            current_prompt = schema_dict.get('user_prompt', '') or "None."
            schema_dict['user_prompt'] = f"{arabic_instruction}\n\n{current_prompt}"
            
            # Translate key terms to guide the LLM more effectively
            schema_dict['test_title'] = f"عنوان الاختبار: {schema_dict['test_title']}"
            schema_dict['topic'] = f"الموضوع: {schema_dict['topic']}"
            schema_dict['subject'] = f"المادة: {schema_dict['subject']}"

        if embeddings:
            logger.info("Fetching curriculum context for the assessment...")
            curriculum_context = await get_curriculum_context_async(schema_dict, embeddings)
            schema_dict['curriculum_context'] = curriculum_context
            logger.info("Curriculum context fetched and added to the schema.")
        else:
            logger.warning("Embeddings not initialized, skipping curriculum context search.")
            schema_dict['curriculum_context'] = "Curriculum context search was skipped because the required API key is not configured."
        
        # Validate and process mixed question types
        if schema.assessment_type == "Mixed" and schema.question_types and schema.question_distribution:
            # Validate that the distribution sums to the total number of questions
            total_distributed = sum(schema.question_distribution.values())
            if total_distributed != schema.number_of_questions:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Question distribution ({total_distributed}) does not match total questions ({schema.number_of_questions})"
                )
            
            logger.info(f"Generating mixed assessment for topic: {schema.topic}")
            logger.info(f"Question distribution: {schema.question_distribution}")
        else:
            logger.info(f"Generating {schema.assessment_type} assessment for topic: {schema.topic}")
        
        generated_content = await generate_test_questions_async(assessment_chain, schema_dict)
        return {"assessment": generated_content}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error in assessment generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 4. TEACHING CONTENT ENDPOINT
# ==============================

class TeachingContentSchema(BaseModel):
    content_type: str = Field(
        ...,
        description="The type of teaching material to create.",
        example="lesson plan",
        pattern="^(lesson plan|worksheet|presentation|quiz)$"
    )
    subject: str = Field(..., description="The subject of the content.", example="Biology")
    lesson_topic: str = Field(..., description="The specific topic for the lesson.", example="Cellular Respiration")
    grade: str = Field(..., description="The target grade level for the content.", example="10th Grade")
    learning_objective: Optional[str] = Field(
        "Not specified",
        description="The specific learning objective for this content."
    )
    emotional_consideration: Optional[str] = Field(
        "None",
        description="Emotional factors to consider for students (e.g., anxiety)."
    )
    # Accept both old (low/high) and new (basic/advanced) forms, case-insensitive
    instructional_depth: str = Field(
        "standard",
        description="The level of detail and complexity.",
        pattern="(?i)^(low|standard|high|basic|enriched)$"
    )
    # Accept both old (low/high) and new (simplified/enriched), case-insensitive
    content_version: str = Field(
        "standard",
        description="The version of the content.",
        pattern="(?i)^(low|standard|high|simplified|enriched)$"
    )
    web_search_enabled: bool = Field(False, description="Enable web search to fetch up-to-date information.")
    # New: Forward additional AI options used by the generator module
    additional_ai_options: Optional[List[str]] = Field(
        default=None,
        description="List of AI options: 'adaptive difficulty', 'include assessment', 'multimedia suggestion', 'generate slides'"
    )
    # Add language parameter
    language: str = Field(
        "English",
        description="The language for the content (e.g., English, Arabic)."
    )
    # Add session fields for lesson plans
    number_of_sessions: Optional[str] = Field(
        "1",
        description="Number of sessions for lesson plans."
    )
    session_duration: Optional[str] = Field(
        "45 minutes",
        description="Duration of each session for lesson plans."
    )

@app.post("/teaching_content_endpoint", response_model=Dict[str, Any])
async def teaching_content_endpoint(schema: TeachingContentSchema):
    """
    Generates detailed teaching content based on the provided specifications.
    This can create lesson plans, worksheets, presentations, or quizzes,
    optionally enhanced with real-time web search results.
    """
    try:
        config = schema.model_dump()
        logger.info(f"Generating teaching content: {config['content_type']} on {config['lesson_topic']}")
        
        # MODIFICATION: Add instructions for Arabic generation if selected.
        if config.get('language', 'English').lower().strip() == 'arabic':
            current_objective = config.get('learning_objective', 'Not specified')
            config['learning_objective'] = f"\n{current_objective}"
            
            # Provide other key details in Arabic
            config['lesson_topic'] = f"موضوع الدرس: {config['lesson_topic']}"
            config['subject'] = f"المادة: {config['subject']}"
        
        generated_content = await generate_teaching_content(config)
        
        # Add a check to ensure the generated content is valid before returning
        if not generated_content or not isinstance(generated_content, str):
            logger.error(f"Content generation returned an empty or invalid result. Got: {generated_content}")
            raise HTTPException(status_code=500, detail="AI content generation returned an empty or invalid result.")
        
        logger.info(f"Successfully generated content of length {len(generated_content)}.")
        return {"generated_content": generated_content}

    except Exception as e:
        logger.error(f"Error in teaching content endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")

# ==============================
# 5. PRESENTATION ENDPOINT
# ==============================

class PresentationSchema(BaseModel):
    plain_text: str = Field(..., description="The main topic or content of the presentation.", example="Introduction to Machine Learning")
    custom_user_instructions: str = Field("", description="Specific instructions for the AI.", example="Focus on practical applications")
    length: int = Field(..., description="The desired number of slides.", example=10, ge=1, le=50)
    language: str = Field("ENGLISH", description="The language of the presentation.", example="ENGLISH", pattern="^(ENGLISH|ARABIC)$")
    fetch_images: bool = Field(True, description="Whether to include stock images in the presentation.")
    verbosity: str = Field("standard", description="The desired text verbosity.", example="standard", pattern="^(concise|standard|text-heavy)$")
    template: str = Field("default", description="The template style for the presentation.", example="default", pattern="^(default|aurora|lavender|monarch|serene|iris|clyde|adam|nebula|bruno)$")

@app.post("/presentation_endpoint", response_model=Dict[str, Any])
async def presentation_endpoint(schema: PresentationSchema):
    """
    Generates a SlideSpeak presentation based on the provided specifications.
    Returns the complete task result including the presentation URL.
    """
    try:
        # Instantiate the generator. It will automatically use the API key from the environment.
        try:
            generator = SlideSpeakGenerator()
        except ValueError as e:
            logger.error(f"Failed to initialize SlideSpeakGenerator: {e}")
            raise HTTPException(status_code=500, detail=str(e))

        logger.info(f"Generating presentation for topic: {schema.plain_text} with template: {schema.template}")
        
        # The generate_presentation method in SlideSpeakGenerator is synchronous (uses requests and time.sleep).
        # To avoid blocking the server's event loop, we run it in a separate thread pool.
        result = await run_in_threadpool(
            generator.generate_presentation,
            plain_text=schema.plain_text,
            custom_user_instructions=schema.custom_user_instructions,
            length=schema.length,
            language=schema.language,
            fetch_images=schema.fetch_images,
            verbosity=schema.verbosity,
            template=schema.template  # Add template parameter
        )
        
        # Check if the result contains an error key from the generator class
        if "error" in result:
            logger.error(f"SlideSpeak API error: {result['error']}")
            raise HTTPException(status_code=500, detail=f"Presentation generation failed: {result['error']}")
        
        # Check if the task was successful
        if result.get("task_status") == "SUCCESS":
            logger.info(f"Presentation generated successfully. URL: {result.get('task_result', {}).get('url')}")
            return {"presentation": result}
        elif result.get("task_status") == "FAILURE":
            error_msg = result.get("task_result", {}).get("error", "Unknown error occurred")
            logger.error(f"Presentation generation failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Presentation generation failed: {error_msg}")
        else:
            logger.error(f"Unexpected task status: {result.get('task_status')}")
            raise HTTPException(status_code=500, detail="Presentation generation returned unexpected status")
        
    except HTTPException:
        # Re-raise HTTP exceptions to be handled by FastAPI
        raise
    except Exception as e:
        logger.error(f"Error in presentation endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")

# ==============================
# 6. IMAGE GENERATION ENDPOINT
# ==============================
class ImageGenSchema(BaseModel):
    topic: str = Field(..., description="Topic for the image")
    grade_level: str = Field(..., description="Grade level")
    preferred_visual_type: str = Field(..., description="Visual type, e.g., image/chart/diagram")
    subject: str = Field(..., description="Subject")
    instructions: str = Field(..., description="Detailed instructions")
    difficulty_flag: str = Field("false", description="true/false flag")
    language: str = Field("English", description="Language for labels (e.g., English, Arabic)")

@app.post("/image_generation_endpoint", response_model=Dict[str, Any])
async def image_generation_endpoint(schema: ImageGenSchema):
    try:
        generator = ImageGenerator()
        schema_dict = schema.model_dump()
        image_b64 = generator.generate_image_from_schema(schema_dict)
        if not image_b64:
            raise HTTPException(status_code=500, detail="Image generation failed.")
        data_url = f"data:image/png;base64,{image_b64}"
        return {"image_url": data_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 7. WEB SEARCH ENDPOINT
# ==============================
class WebSearchSchema(BaseModel):
    topic: str = Field(..., description="Search topic")
    grade_level: str = Field(..., description="Grade level (e.g., 10)")
    subject: str = Field(..., description="Subject (e.g., History)")
    content_type: str = Field(..., description="Preferred content type (e.g., articles, videos)")
    language: str = Field(..., description="Language")
    comprehension: str = Field("intermediate", description="Comprehension level")
    max_results: int = Field(5, description="Maximum number of results")

@app.post("/web_search_endpoint", response_model=Dict[str, Any])
async def web_search_endpoint(schema: WebSearchSchema):
    if not pplx_chat:
        raise HTTPException(status_code=500, detail="Perplexity client not configured. Check PPLX_API_KEY.")

    try:
        data = schema.model_dump()
        
        # MODIFICATION: Dynamically build the query based on the selected language.
        query = ""
        if data['language'].lower().strip() == 'arabic':
            query = (
                f"اعرض لي ما يصل إلى {data['max_results']} {data['content_type']} حول '{data['topic']}' "
                f"لصف {data['grade_level']} في مادة {data['subject']}. "
                f"يجب أن يكون المحتوى باللغة العربية مع مستوى فهم {data['comprehension']}. "
                f"قم بتضمين روابط في الاستجابة مع محتوى مفصل ومطول. "
                f"قم بتضمين مصدر المحتوى في الاستجابة."
            )
        else:
            # Default to English
            query = (
                f"Show me up to {data['max_results']} {data['content_type']} about '{data['topic']}' "
                f"for a grade {data['grade_level']} {data['subject']} class. "
                f"The content should be in {data['language']} with a {data['comprehension']} comprehension level. "
                "Include links in the response with detailed lengthy response content. "
                "Include the source of the content in the response."
            )

        full_response = ""
        for chunk in pplx_chat.stream(query):
            full_response += chunk.content or ""

        if not full_response.strip():
            raise HTTPException(status_code=500, detail="Web search returned empty response.")

        return {
            "query": query,
            "content": full_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in web search endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================
# 8. COMICS STREAMING ENDPOINT
# ==============================
class ComicsSchema(BaseModel):
    instructions: str = Field(..., description="Educational story/topic, e.g., Water cycle")
    grade_level: str = Field(..., description="Grade level string, e.g., '5' or 'Grade 5'")
    num_panels: int = Field(..., description="Number of panels to generate", ge=1, le=20)
    language: str = Field("English", description="Language for comic text (e.g., English, Arabic)")

def _parse_enhanced_story_panels(story_text: str):
    """
    Enhanced parsing function that matches the comics_generation.py parse_story_panels function.
    """
    print("Parsing story panels for FastAPI...")
    panels = []
    
    if not story_text:
        print("No story text to parse")
        return panels
    
    lines = [line.strip() for line in story_text.strip().split('\n') if line.strip()]
    print(f"Processing {len(lines)} lines...")
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if "Panel_Prompt:" in line:
            # Extract panel prompt
            panel_prompt = line.split("Panel_Prompt:", 1)[1].strip()
            footer_text = ""
            
            # Look for the corresponding Footer_Text on next line or nearby lines
            j = i + 1
            while j < len(lines) and j < i + 5:  # Look within next 5 lines
                if "Footer_Text:" in lines[j]:
                    footer_text = lines[j].split("Footer_Text:", 1)[1].strip()
                    break
                j += 1
            
            if panel_prompt:
                panel_data = {
                    'prompt': panel_prompt,
                    'footer_text': footer_text
                }
                panels.append(panel_data)
                print(f"Panel {len(panels)} parsed - Prompt: {panel_prompt[:50]}...")
                if footer_text:
                    print(f"  Footer: {footer_text[:50]}...")
                else:
                    print("  No footer text found")
        
        i += 1
    
    print(f"Successfully parsed {len(panels)} panels")
    return panels

# Enhanced Comics Streaming Endpoint
@app.post("/comics_stream_endpoint")
async def comics_stream_endpoint(schema: ComicsSchema, request: Request):
    async def event_stream():
        import json
        async def send(obj: dict):
            yield f"data: {json.dumps(obj)}\n\n"

        try:
            logger.info(f"Starting enhanced comics generation - Topic: {schema.instructions}")
            logger.info(f"Grade: {schema.grade_level}, Panels: {schema.num_panels}, Language: {schema.language}")
            
            # 1) Generate enhanced story/panel prompts
            story_prompts = await run_in_threadpool(
                create_comical_story_prompt,
                schema.instructions,
                schema.grade_level,
                schema.num_panels,
                schema.language
            )
            
            if not story_prompts:
                error_msg = "Failed to generate story prompts"
                logger.error(error_msg)
                async for chunk in send({"type": "error", "message": error_msg}):
                    yield chunk
                return

            logger.info("Story prompts generated successfully")
            
            # Send the full story text first
            async for chunk in send({"type": "story_prompts", "content": story_prompts}):
                yield chunk

            # 2) Parse enhanced story prompts to get panel/footer pairs
            panels = _parse_enhanced_story_panels(story_prompts)
            if not panels:
                error_msg = "No panel prompts could be parsed from the generated story"
                logger.error(error_msg)
                logger.error(f"Story content was: {story_prompts[:500]}...")
                async for chunk in send({"type": "error", "message": error_msg}):
                    yield chunk
                return

            logger.info(f"Parsed {len(panels)} panels successfully")
            
            # Send panel count info
            async for chunk in send({
                "type": "panels_info", 
                "total_panels": len(panels),
                "panels_preview": [{"index": i+1, "has_footer": bool(p['footer_text'])} for i, p in enumerate(panels)]
            }):
                yield chunk

            # 3) Generate images with footer text for each panel
            for i, panel_data in enumerate(panels[:schema.num_panels]):
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info("Client disconnected, stopping comics generation")
                    break
                
                panel_index = i + 1
                logger.info(f"Processing panel {panel_index}/{len(panels)}")
                
                # Emit the panel information
                async for chunk in send({
                    "type": "panel_info",
                    "index": panel_index,
                    "prompt": panel_data['prompt'],
                    "footer_text": panel_data['footer_text'],
                    "has_footer": bool(panel_data['footer_text'])
                }):
                    yield chunk

                try:
                    # Generate panel image with footer text using enhanced function
                    logger.info(f"Generating image for panel {panel_index}...")
                    enhanced_image_b64 = await run_in_threadpool(
                        generate_comic_image, 
                        panel_data['prompt'], 
                        panel_index,
                        panel_data['footer_text'],  # Include footer text
                        schema.language  # Include language parameter
                    )
                    
                    # Check for disconnection again
                    if await request.is_disconnected():
                        logger.info("Client disconnected after image generation")
                        break
                    
                    if enhanced_image_b64:
                        # Create data URL for the image
                        image_data_url = f"data:image/png;base64,{enhanced_image_b64}"
                        
                        # Send the enhanced image with footer text
                        async for chunk in send({
                            "type": "panel_image",
                            "index": panel_index,
                            "url": image_data_url,
                            "has_footer": bool(panel_data['footer_text']),
                            "footer_text": panel_data['footer_text'],
                            "prompt_used": panel_data['prompt'][:100] + "..." if len(panel_data['prompt']) > 100 else panel_data['prompt']
                        }):
                            yield chunk
                            
                        logger.info(f"Panel {panel_index} completed successfully with footer text")
                    else:
                        error_msg = f"Failed to generate image for panel {panel_index}"
                        logger.error(error_msg)
                        async for chunk in send({
                            "type": "panel_error",
                            "index": panel_index,
                            "message": error_msg
                        }):
                            yield chunk
                            
                except Exception as panel_error:
                    error_msg = f"Error generating panel {panel_index}: {str(panel_error)}"
                    logger.error(error_msg, exc_info=True)
                    async for chunk in send({
                        "type": "panel_error",
                        "index": panel_index,
                        "message": error_msg
                    }):
                        yield chunk

            # Send completion signal (only if not disconnected)
            if not await request.is_disconnected():
                logger.info("Comics generation completed successfully")
                async for chunk in send({"type": "done", "message": "Comic generation completed!"}):
                    yield chunk

        except Exception as e:
            error_msg = f"Error in enhanced comics stream: {str(e)}"
            logger.error(error_msg, exc_info=True)
            async for chunk in send({"type": "error", "message": error_msg}):
                yield chunk

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")
# ==============================
# 9. TEACHER BULK DATA ENDPOINT
# ==============================

class TeacherBulkDataSchema(BaseModel):
    teacher_name: str = Field(..., description="Teacher's name")
    teacher_id: Optional[str] = Field(None, description="Teacher's ID")
    email: Optional[str] = Field(None, description="Teacher's email")
    grades: Optional[List[str]] = Field([], description="Teacher's grades")
    subjects: Optional[List[str]] = Field([], description="Teacher's subjects")
    
    # Student data
    student_details_with_reports: List[Dict[str, Any]] = Field([], description="Bulk student data with reports")
    student_performance: Optional[Dict[str, Any]] = Field({}, description="Student performance summary")
    student_overview: Optional[Dict[str, Any]] = Field({}, description="Student overview data")
    top_performers: Optional[List[Dict[str, Any]]] = Field([], description="Top performing students")
    subject_performance: Optional[Dict[str, Any]] = Field({}, description="Subject performance data")
    behavior_analysis: Optional[Dict[str, Any]] = Field({}, description="Behavior analysis data")
    attendance_data: Optional[Dict[str, Any]] = Field({}, description="Attendance data")
    
    # Content data
    generated_content_details: List[Dict[str, Any]] = Field([], description="Generated content details")
    assessment_details: Optional[List[Dict[str, Any]]] = Field([], description="Assessment details")
    
    # Media and toolkit
    media_toolkit: Optional[Dict[str, Any]] = Field({}, description="Media toolkit data")
    media_counts: Optional[Dict[str, Any]] = Field({}, description="Media counts")
    
    # Progress and analytics
    progress_data: Optional[Dict[str, Any]] = Field({}, description="Progress data")
    feedback_data: List[Dict[str, Any]] = Field([], description="Student feedback data")
    learning_analytics: Optional[Dict[str, Any]] = Field({}, description="Learning analytics data")

class TeacherChatbotRequest(BaseModel):
    session_id: str = Field(..., description="A unique identifier for the chat session. This maintains the context and knowledge base for the user.")
    query: str = Field(..., description="The user's text query to the chatbot.")  # FIXED: Remove Optional, make required
    history: List[Dict[str, Any]] = Field([], description="A list of previous messages in the chat history.")
    teacher_data: TeacherBulkDataSchema
    web_search_enabled: bool = Field(True, description="Enable or disable web search functionality for the tutor.")  # Changed default to True
    uploaded_files: Optional[List[str]] = Field([], description="List of uploaded file names for context")

@app.post("/teacher_bulk_data_endpoint")
async def teacher_bulk_data_endpoint(schema: TeacherBulkDataSchema):
    """
    Endpoint for teachers to submit bulk student data, feedback, and content details.
    This data is used to personalize the AI teacher assistant.
    """
    try:
        logger.info(f"Received bulk data from teacher: {schema.teacher_name}")
        logger.info(f"Student count: {len(schema.student_details_with_reports)}")
        logger.info(f"Content count: {len(schema.generated_content_details)}")
        logger.info(f"Feedback count: {len(schema.feedback_data)}")
        
        # Store the teacher data in memory for the voice session
        # In production, you'd want to use Redis or a database
        teacher_sessions[schema.teacher_name] = {
            "student_details_with_reports": schema.student_details_with_reports,
            "generated_content_details": schema.generated_content_details,
            "feedback_data": schema.feedback_data,
            "learning_analytics": schema.learning_analytics,
            "timestamp": datetime.now().isoformat()
        }
        
        return {
            "success": True,
            "message": f"Successfully received data for {len(schema.student_details_with_reports)} students",
            "teacher_name": schema.teacher_name,
            "data_summary": {
                "students": len(schema.student_details_with_reports),
                "content": len(schema.generated_content_details),
                "feedback": len(schema.feedback_data)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in teacher bulk data endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



# ==============================
# 10. VIDEO PRESENTATION ENDPOINT
# ==============================

@app.post("/video_presentation_endpoint", response_model=Dict[str, Any])
async def video_presentation_endpoint(
    pptx_file: UploadFile = File(...),
    voice_id: str = Form(...),
    talking_photo_id: str = Form(...),
    title: str = Form(...)
):
    """
    Generates a video presentation from PowerPoint using HeyGen API.
    """
    try:
        logger.info(f"Video presentation request received: {title}")
        logger.info(f"Voice ID: {voice_id}, Talking Photo ID: {talking_photo_id}")
        
        # Save uploaded file temporarily
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as temp_file:
            content = await pptx_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Initialize the HeyGen video converter
            converter = PPTXToHeyGenVideo(
                pptx_avatar_id=talking_photo_id,
                pptx_voice_id=voice_id
            )
            
            # Convert the presentation to video
            result = converter.convert(
                pptx_path=temp_file_path,
                title=title
            )
            
            logger.info(f"Video generation completed: {result}")
            
            return {
                "success": True,
                "video_id": result.get("video_id"),
                "video_url": result.get("video_url"),
                "slides_count": result.get("slides_count"),
                "title": title
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"Error in video presentation endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

# ==============================
# 11. TEACHER CHAT ENDPOINT (Missing - should use AI_tutor.py)
# ==============================

@app.post("/teacher_chat_endpoint")
async def teacher_chat_endpoint(request: TeacherChatbotRequest):
    """
    Handles interactions with the AI tutor for teachers with JSON-only requests.
    Streaming text responses, no audio files.
    Enhanced with teacher data for personalized teaching support.
    """
    try:
        # Get comprehensive teacher data from the schema - use actual data only
        teacher_data = request.teacher_data.model_dump()
        teacher_name = teacher_data.get('teacher_name', 'Teacher')
        teacher_id = teacher_data.get('teacher_id', 'Unknown')
            
        # Extract all the data with proper structure - only actual data from frontend
        student_reports = teacher_data.get('student_details_with_reports', [])
        student_performance = teacher_data.get('student_performance', {})
        student_overview = teacher_data.get('student_overview', {})
        top_performers = teacher_data.get('top_performers', [])
        subject_performance = teacher_data.get('subject_performance', {})  # FIXED: Changed from [] to {}
        behavior_analysis = teacher_data.get('behavior_analysis', {})
        attendance_data = teacher_data.get('attendance_data', {})
            
        generated_content = teacher_data.get('generated_content_details', [])
        assessment_details = teacher_data.get('assessment_details', [])
            
        media_toolkit = teacher_data.get('media_toolkit', {})
        media_counts = teacher_data.get('media_counts', {})
            
        progress_data = teacher_data.get('progress_data', {})
        feedback_data = teacher_data.get('feedback_data', [])
        learning_analytics = teacher_data.get('learning_analytics', {})

        logger.info(f"Teacher chat endpoint called with session_id: {request.session_id}")
        logger.info(f"Query: {request.query}")
        logger.info(f"Teacher: {teacher_name} (ID: {teacher_id})")
        logger.info(f"Students: {len(student_reports)}, Content: {len(generated_content)}, Feedback: {len(feedback_data)}")
        
        # FIXED: Add detailed logging to see what data we're receiving
        logger.info(f"Student Performance: {student_performance}")
        logger.info(f"Student Overview: {student_overview}")
        logger.info(f"Top Performers: {len(top_performers)} items")
        logger.info(f"Subject Performance: {subject_performance}")
        logger.info(f"Media Toolkit: {media_toolkit}")
        logger.info(f"Learning Analytics: {learning_analytics}")

        session_id = request.session_id
        
        # Get or create a teacher tutor instance for the session
        if session_id not in teacher_tutor_sessions:
            logger.info(f"Creating new Teacher AI Tutor session: {session_id}")
            teacher_config = TeacherRAGTutorConfig.from_env()
            teacher_config.web_search_enabled = True  # Always enable web search
            teacher_tutor_sessions[session_id] = TeacherAsyncRAGTutor(storage_manager=storage_manager, config=teacher_config)

        tutor = teacher_tutor_sessions[session_id]

        # Always enable web search for the tutor
        tutor.update_web_search_status(True)

        # --- Enhanced Query Processing with Teacher Data ---
        if not request.query:
            logger.error("No query provided in request")
            raise HTTPException(status_code=400, detail="A 'query' is required.")

        # Prepare enhanced context with teacher data - only actual data
        enhanced_query = request.query
        enhanced_history = request.history.copy()
        
        # Create personalized context based on teacher data - only actual data
        teacher_personalization_context = f"""
        TEACHER PROFILE:
        - Name: {teacher_name}
        - ID: {teacher_id}

        STUDENT DATA:
        - Total Students: {len(student_reports)} students
        - Performance Overview: {json.dumps(student_overview, indent=2) if student_overview else 'No overview data'}
        - Top Performers: {json.dumps(top_performers, indent=2) if top_performers else 'No top performers data'}
        - Subject Performance: {json.dumps(subject_performance, indent=2) if subject_performance else 'No subject data'}
        - Behavior Analysis: {json.dumps(behavior_analysis, indent=2) if behavior_analysis else 'No behavior data'}
        - Attendance: {json.dumps(attendance_data, indent=2) if attendance_data else 'No attendance data'}

        TEACHING CONTENT:
        - Generated Content: {len(generated_content)} items
        - Assessments: {len(assessment_details)} assessments
        - Content Details: {json.dumps([c.get('title', 'Untitled') for c in generated_content[:5]], indent=2) if generated_content else 'No content'}

        MEDIA TOOLKIT:
        - Comics: {media_counts.get('comics', 0)} items
        - Images: {media_counts.get('images', 0)} items  
        - Slides: {media_counts.get('slides', 0)} items
        - Videos: {media_counts.get('video', 0)} items
        - Web Search: {media_counts.get('webSearch', 0)} items

        PROGRESS & FEEDBACK:
        - Progress Data: {json.dumps(progress_data, indent=2) if progress_data else 'No progress data'}
        - Feedback Entries: {len(feedback_data)} feedback items
        - Learning Analytics: {json.dumps(learning_analytics, indent=2) if learning_analytics else 'No analytics'}
            """
            
        # Add personalization context to the query
        enhanced_query = f"""
        {teacher_personalization_context}
        You are {teacher_name}'s personalized AI teaching assistant.
        Teacher Query: {request.query}

        """
            
        logger.info(f"Enhanced query with teacher data for {teacher_name}")
        
        is_kb_ready = tutor.ensemble_retriever is not None
        
        # Pass all parameters including uploaded_files to match AI_tutor.py run_agent_async signature
        response_generator = tutor.run_agent_async(
            query=enhanced_query,
            history=enhanced_history,
            image_storage_key=None,  # No image upload in this flow
            is_knowledge_base_ready=is_kb_ready,
            uploaded_files=request.uploaded_files,
            teaching_data=request.teacher_data.model_dump() if request.teacher_data else None
        )

        async def event_stream():
            import json
            async def send(obj: dict):
                yield f"data: {json.dumps(obj)}\n\n"
            try:
                async for chunk in response_generator:
                    if not chunk:
                        continue
                    async for part in send({"type": "text_chunk", "content": chunk}):
                        yield part
                async for part in send({"type": "done"}):
                    yield part
            except Exception as e:
                logger.error(f"Error in teacher chatbot stream: {e}", exc_info=True)
                async for part in send({"type": "error", "message": str(e)}):
                    yield part

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in teacher chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================
# 12. STUDENT VOICE ENDPOINT (Missing - should use Student_Voice_agent_realtime.py)
# ==============================

@app.post("/student_voice_endpoint")
async def student_voice_endpoint():
    """
    Endpoint to start student voice interaction using Student_Voice_agent_realtime.py
    This should redirect to or integrate with the dedicated voice module.
    """
    try:
        # Import and use the student voice agent
        from Student_chatbot.Student_Voice_agent_realtime import main as student_voice_main
        
        # This endpoint should trigger the student voice agent
        # The actual voice interaction will be handled by the dedicated module
        return {
            "success": True,
            "message": "Student voice agent initialized. Use the dedicated voice module for interaction.",
            "module": "Student_Voice_agent_realtime.py"
        }
        
    except Exception as e:
        logger.error(f"Error in student voice endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Student voice initialization failed: {str(e)}")

# Add WebSocket endpoint for student voice
@app.websocket("/ws/student-voice")
async def student_voice_websocket(websocket: WebSocket):
    """WebSocket endpoint for student voice communication."""
    # Check origin for CORS
    origin = websocket.headers.get("origin")
    allowed_origins = ["http://localhost:3000", "https://ed-tech-alpha-sable.vercel.app"]
    
    if origin not in allowed_origins:
        await websocket.close(code=1008, reason="Origin not allowed")
        return
    
    await websocket.accept()
    
    try:
        # Receive student data from frontend
        student_data = await websocket.receive_json()
        print(f"Received student data: {student_data}")
        
        # Use the Student_Voice_agent_realtime.py WebSocket function
        from Student_chatbot.Student_Voice_agent_realtime import run_student_voice_websocket
        await run_student_voice_websocket(websocket, student_data)
        
    except WebSocketDisconnect:
        print("Student voice WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in student voice WebSocket: {e}")
        await websocket.close()

# ==============================
# 13. TEACHER VOICE ENDPOINT (Missing - should use Teacher_Voice_agent_realtime.py)
# ==============================

@app.websocket("/ws/teacher-voice")
async def teacher_voice_websocket(websocket: WebSocket):
    """WebSocket endpoint for teacher voice communication."""
    # Check origin for CORS
    origin = websocket.headers.get("origin")
    allowed_origins = ["http://localhost:3000", "https://ed-tech-alpha-sable.vercel.app"]
    
    if origin not in allowed_origins:
        await websocket.close(code=1008, reason="Origin not allowed")
        return
    
    await websocket.accept()
    
    try:
        # Receive teacher data from frontend
        teacher_data = await websocket.receive_json()
        print(f"Received teacher data: {teacher_data}")
        
        # Use the Render-compatible teacher voice agent
        from Teacher_Voice_agent_realtime import teacher_voice_agent
        await teacher_voice_agent(websocket, teacher_data)
        
    except WebSocketDisconnect:
        print("Teacher voice WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in teacher voice WebSocket: {e}")
        await websocket.close()

# --- Uvicorn Server Runner ---
if __name__ == "__main__":
    logger.info("Starting Uvicorn server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)