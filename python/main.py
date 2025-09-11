import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Union

import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv
from fastapi.concurrency import run_in_threadpool
import json
import asyncio
import aiohttp
from datetime import datetime

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
from assessment import create_question_generation_chain, generate_test_questions_async

# Teaching content generation imports
from teaching_content_generation import run_generation_pipeline_async as generate_teaching_content

# Media toolkit imports
from media_toolkit.slides_generation import SlideSpeakGenerator
from media_toolkit.image_generation_model import ImageGenerator
from media_toolkit.comics_generation import create_comical_story_prompt, generate_comic_image
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
    allow_origins=["http://localhost:3000", "https://e-learning-frontend-navy.vercel.app"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- Global Objects and Initializations ---
logger.info("Initializing global components...")

try:
    # Initialize Storage Manager
    storage_manager = CloudflareR2Storage()
    logger.info("✅ Cloudflare R2 storage manager initialized.")

    # Initialize Tutor Sessions Dictionary
    tutor_sessions: Dict[str, AsyncRAGTutor] = {}
    teacher_sessions: Dict[str, TeacherAsyncRAGTutor] = {} # New: Dictionary to store teacher sessions

    # Initialize other components
    slide_generator = SlideSpeakGenerator()
    image_generator = ImageGenerator()
    
    # Initialize assessment chain
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if google_api_key:
        assessment_chain = create_question_generation_chain(google_api_key)
        logger.info("✅ Assessment chain initialized successfully.")
    else:
        assessment_chain = None
        logger.warning("⚠️ Google API key not found. Assessment functionality will be limited.")
    
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
# 2. VOICE FUNCTIONALITY ENDPOINTS
# ==============================



@app.post("/voice_realtime_endpoint")
async def voice_realtime_endpoint():
    """
    Real-time voice interaction endpoint that uses the actual voice functionality.
    This streams audio in real-time like ChatGPT.
    """
    async def event_stream():
        import json
        import asyncio
        
        
        async def send(obj: dict):
            yield f"data: {json.dumps(obj)}\n\n"

        try:
            # This simulates the real-time voice interaction
            # In a real implementation, you'd stream audio chunks here
            async for part in send({"type": "voice_ready", "message": "Voice system ready"}):
                yield part

        except Exception as e:
            logger.error(f"Error in real-time voice stream: {e}", exc_info=True)
            async for part in send({"type": "error", "message": str(e)}):
                yield part

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")

# Update the voice chat endpoint to use real-time processing

# Replace the existing WebSocket voice endpoint with real-time voice
@app.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    """Real-time voice conversation using OpenAI's real-time API."""
    await websocket.accept()
    
    # Store student data and session info
    student_data = None
    openai_ws = None
    openai_session = None
    response_task = None
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "start_session":
                # Initialize real-time voice session with student data
                student_data = data.get("student_data", {})
                logger.info(f"Received student data keys: {list(student_data.keys())}")
                logger.info(f"Student data sample: {dict(list(student_data.items())[:5])}")
                
                # Connect to OpenAI's real-time API
                openai_api_key = os.getenv("OPENAI_API_KEY")
                
                if not openai_api_key:
                    await websocket.send_json({
                        "type": "error",
                        "message": "OpenAI API key not configured"
                    })
                    continue
                
                # Create connection to OpenAI real-time API
                # Use gpt-4o-realtime-preview-2024-10-01 for the real-time model
                openai_url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
                openai_headers = {
                    "Authorization": f"Bearer {openai_api_key}",
                    "OpenAI-Beta": "realtime=v1"
                }
                
                try:
                    # Connect to OpenAI real-time API
                    openai_session = aiohttp.ClientSession()
                    openai_ws = await openai_session.ws_connect(
                        openai_url,
                        headers=openai_headers,
                        max_msg_size=10_000_000
                    )
                    
                    # Send session configuration to OpenAI
                    # Create comprehensive personalized prompt based on student data
                    student_name = student_data.get('name', 'Student')
                    student_grade = student_data.get('grade', '8')
                    student_subjects = student_data.get('subjects', ['General Studies'])
                    
                    # Extract learning insights with better defaults
                    learning_stats = student_data.get('learningStats', {}) or {}
                    achievements = student_data.get('achievements', []) or []
                    recent_lessons = student_data.get('recentLessons', []) or student_data.get('lessons', []) or []
                    incomplete_assessments = student_data.get('incompleteAssessments', []) or []
                    study_preferences = student_data.get('studyPreferences', {}) or {}
                    performance_insights = student_data.get('performanceInsights', {}) or {}
                    
                    # Additional data extraction
                    progress = student_data.get('progress', {}) or {}
                    user_progress = student_data.get('userProgress', []) or []
                    resources = student_data.get('resources', []) or []
                    assessments = student_data.get('assessments', []) or []
                    
                    logger.info(f"Processed student data - achievements: {len(achievements)}, lessons: {len(recent_lessons)}, assessments: {len(assessments)}")
                    
                    prompt = f"""You are {student_name}'s personalized AI study buddy and tutor. You have comprehensive knowledge about their learning journey and academic progress.

STUDENT PROFILE:
- Name: {student_name}
- Grade: {student_grade}
- Subjects: {', '.join(student_subjects)}
- Learning Style: {study_preferences.get('learningStyle', 'adaptive')}
- Difficulty Preference: {study_preferences.get('difficultyPreference', 'medium')}

LEARNING PROGRESS & PERFORMANCE:
- Average Score: {performance_insights.get('averageScore', 'Building progress')}
- Total Study Time: {performance_insights.get('studyTime', 'Getting started')}
- Strong Subjects: {', '.join(performance_insights.get('strongSubjects', ['Exploring strengths']))}
- Areas for Improvement: {', '.join(performance_insights.get('needsImprovement', ['Identifying growth areas']))}
- Recent Achievements: {len(achievements)} milestones reached

CURRENT ACADEMIC STATUS:
- Active Lessons: {len(recent_lessons)} recent lessons  
- Total Resources: {len(resources)} learning resources
- Assessments: {len(assessments)} total, {len(incomplete_assessments)} incomplete
- User Progress Entries: {len(user_progress)} progress records
- Available Support Areas:
{json.dumps(student_data.get('pending_tasks', []), indent=2)}

DETAILED PROGRESS DATA:
- Overall Progress: {json.dumps(progress, indent=2) if progress else 'Starting journey'}
- Recent Lessons: {json.dumps(recent_lessons[:3], indent=2) if recent_lessons else 'No recent lessons'}
- Learning Resources: {json.dumps([r.get('title', 'Untitled') for r in resources[:5]], indent=2) if resources else 'No resources yet'}

PERSONALIZATION INSTRUCTIONS:
1. **Adaptive Communication**: Adjust explanations based on {student_name}'s grade level and learning style. Use {study_preferences.get('learningStyle', 'visual')} learning approaches when possible.

2. **Progress-Aware Support**: 
   - Acknowledge their strengths in {', '.join(performance_insights.get('strongSubjects', ['their studies']))}
   - Provide extra support for {', '.join(performance_insights.get('needsImprovement', ['areas they are working on']))}
   - Reference their past achievements to build confidence

3. **Contextual Assistance**:
   - Help with incomplete assessments and current lessons
   - Connect new concepts to their previous learning
   - Suggest practice problems at their preferred difficulty level

4. **Emotional Intelligence**:
   - **Encouraging Tone**: Default supportive and motivating approach
   - **Celebration Mode**: Enthusiastically celebrate successes and breakthroughs
   - **Patient Support**: Extra patience and breaking down complex topics when they struggle
   - **Confidence Building**: Remind them of past achievements when facing challenges

5. **Learning Enhancement**:
   - Use real-world examples relevant to their interests
   - Provide step-by-step explanations for complex topics
   - Offer multiple explanation approaches if they don't understand
   - Ask follow-up questions to ensure comprehension

6. **Tool Usage**: Use web_search to find current examples, visual aids, and supplementary materials that match their learning style and academic level.

Remember: You're not just answering questions - you're {student_name}'s dedicated learning partner helping them succeed academically while building confidence and understanding."""

                    await openai_ws.send_json({
                        "type": "session.update",
                        "session": {
                            "modalities": ["audio", "text"],
                            "instructions": prompt,
                            "voice": "cedar",
                            "turn_detection": {
                                "type": "server_vad",
                                "threshold": 0.5,
                                "prefix_padding_ms": 300,
                                "silence_duration_ms": 500,
                            },
                            "input_audio_transcription": {"model": "gpt-4o-transcribe"},
                            "input_audio_noise_reduction": {"type": "near_field"},
                            "tools": [
                                {
                                    "type": "function",
                                    "name": "web_search",
                                    "description": "Search the web for fresh information and examples.",
                                    "parameters": {
                                        "type": "object",
                                        "properties": {"query": {"type": "string", "description": "provide latest information, real-time answers, and examples."}},
                                        "required": ["query"]
                                    }
                                }
                            ],
                            "tool_choice": "auto",
                            "include": ["item.input_audio_transcription.logprobs"],
                        }
                    })
                    
                    await websocket.send_json({
                        "type": "session_started",
                        "message": "Real-time voice session started"
                    })
                    
                    # Start task to handle OpenAI responses
                    response_task = asyncio.create_task(handle_openai_responses(openai_ws, websocket))
                    
                except Exception as e:
                    logger.error(f"Failed to connect to OpenAI real-time API: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Failed to start voice session: {str(e)}"
                    })
                    
            elif data["type"] == "stop_session":
                if response_task:
                    response_task.cancel()
                if openai_ws:
                    await openai_ws.close()
                if openai_session:
                    await openai_session.close()
                break
                
            elif data["type"] == "audio_chunk" and openai_ws:
                # Forward audio chunks directly to OpenAI
                try:
                    await openai_ws.send_json({
                        "type": "input_audio_buffer.append",
                        "audio": data["audio"]
                    })
                except Exception as e:
                    logger.error(f"Error forwarding audio to OpenAI: {e}")
                    
            elif data["type"] == "function_call_output" and openai_ws:
                # Forward function call results back to OpenAI
                try:
                    await openai_ws.send_json({
                        "type": "conversation.item.create",
                        "item": {
                            "type": "function_call_output",
                            "call_id": data["call_id"],
                            "output": data["output"]
                        }
                    })
                except Exception as e:
                    logger.error(f"Error sending function output to OpenAI: {e}")
                    
    except WebSocketDisconnect:
        logger.info("Client WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        await websocket.send_json({
            "type": "error",
            "message": f"WebSocket error: {str(e)}"
        })
    finally:
        if openai_ws:
            await openai_ws.close()
        if openai_session:
            await openai_session.close()

async def perform_web_search(query: str) -> str:
    """Perform web search using Tavily client."""
    try:
        if tavily_client:
            search_results = tavily_client.search(query, max_results=3)
            formatted_results = []
            for result in search_results.get('results', []):
                formatted_results.append(f"Title: {result.get('title', '')}\nURL: {result.get('url', '')}\nContent: {result.get('content', '')}")
            return "\n\n".join(formatted_results) if formatted_results else "No results found."
        else:
            return "Web search is not available at the moment."
    except Exception as e:
        logger.error(f"Error performing web search: {e}")
        return f"Error performing search: {str(e)}"

async def handle_openai_responses(openai_ws, client_ws):
    """Handle responses from OpenAI and forward to client."""
    try:
        async for msg in openai_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                event = json.loads(msg.data)
                event_type = event.get("type")
                
                # Log important events for debugging
                if event_type in ["error", "response.error"]:
                    logger.error(f"OpenAI error event: {json.dumps(event, indent=2)}")
                elif event_type == "session.created":
                    logger.info(f"OpenAI session created successfully")
                
                # Forward all relevant events to client
                if event_type in [
                    "session.created", 
                    "response.audio.delta", 
                    "response.audio.done",
                    "conversation.item.create", 
                    "conversation.item.input_audio_transcription.completed",
                    "input_audio_buffer.speech_started",
                    "input_audio_buffer.speech_stopped",
                    "response.error", 
                    "response.completed",
                    "response.done",
                    "session.terminated",
                    "error"
                ]:
                    # For audio delta, ensure we pass the audio data properly
                    if event_type == "response.audio.delta" and "delta" in event:
                        # Forward the audio chunk with proper field name
                        await client_ws.send_json({
                            "type": "response.audio.delta",
                            "audio": event["delta"],  # OpenAI sends audio in 'delta' field
                            "response_id": event.get("response_id"),
                            "item_id": event.get("item_id"),
                            "output_index": event.get("output_index"),
                            "content_index": event.get("content_index")
                        })
                        logger.debug(f"Forwarded audio delta: {len(event['delta'])} bytes")
                    else:
                        await client_ws.send_json(event)
                    
                # Handle function calls from OpenAI
                if event_type == "response.function_call_arguments.done":
                    # Process function call results
                    logger.info(f"Function call completed: {event}")
                    
                # Handle tool calls requiring execution
                if event_type == "response.output_item.added":
                    item = event.get("item", {})
                    if item.get("type") == "function_call" and item.get("name") == "web_search":
                        # Execute web search server-side
                        try:
                            args = json.loads(item.get("arguments", "{}"))
                            search_results = await perform_web_search(args.get("query", ""))
                            
                            # Send results back to OpenAI
                            await openai_ws.send_json({
                                "type": "conversation.item.create",
                                "item": {
                                    "type": "function_call_output",
                                    "call_id": item.get("call_id"),
                                    "output": search_results
                                }
                            })
                        except Exception as e:
                            logger.error(f"Error handling web search: {e}")
                    
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                logger.warning("OpenAI WebSocket closed or errored")
                await client_ws.send_json({"type": "error", "message": "OpenAI connection lost"})
                break
    except Exception as e:
        logger.error(f"Error handling OpenAI responses: {e}", exc_info=True)
        await client_ws.send_json({"type": "error", "message": str(e)})

# ==============================================================================
# 3. CHATBOT ENDPOINT (JSON-only, SSE text streaming)
# ==============================================================================

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
            
            Consider their grade level ({student_data.grade}) and adapt your explanations accordingly.
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
        if session_id not in teacher_tutor_sessions:
            logger.info(f"Creating new Teacher AI Tutor session for document upload: {session_id}")
            teacher_config = TeacherRAGTutorConfig.from_env()
            teacher_config.web_search_enabled = True  # Always enable web search
            teacher_tutor_sessions[session_id] = TeacherAsyncRAGTutor(storage_manager=storage_manager, config=teacher_config)

        tutor = teacher_tutor_sessions[session_id]

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
                    logger.info(f"Uploaded file {file.filename} for teacher to cloud storage with key: {storage_key}")
                else:
                    logger.error(f"Failed to upload file {file.filename} for teacher to cloud storage.")

        if storage_keys:
            # Ingest documents into the teacher's tutor's knowledge base
            success = await tutor.ingest_async(storage_keys)
            if success:
                return {
                    "success": True,
                    "message": f"Successfully uploaded and processed {len(storage_keys)} document(s) for the teacher's session",
                    "files_processed": len(storage_keys)
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
# 4. ASSESSMENT ENDPOINT
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
# 5. TEACHING CONTENT ENDPOINT
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
        pattern="(?i)^(low|standard|high|basic|advanced)$"
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

@app.post("/teaching_content_endpoint", response_model=Dict[str, Any])
async def teaching_content_endpoint(schema: TeachingContentSchema):
    """
    Generates detailed teaching content based on the provided specifications.
    This can create lesson plans, worksheets, presentations, or quizzes,
    optionally enhanced with real-time web search results.
    """
    try:
        # Use model_dump() for Pydantic v2+ to avoid deprecation warnings
        config = schema.model_dump()
        logger.info(f"Generating teaching content: {config['content_type']} on {config['lesson_topic']}")
        
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
# 6. PRESENTATION ENDPOINT
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
# 7. IMAGE GENERATION ENDPOINT
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
# 8. WEB SEARCH ENDPOINT
# ==============================
class WebSearchSchema(BaseModel):
    topic: str = Field(..., description="Search topic")
    grade_level: str = Field(..., description="Grade level (e.g., 10)")
    subject: str = Field(..., description="Subject (e.g., History)")
    content_type: str = Field(..., description="Preferred content type (e.g., articles, videos)")
    language: str = Field("English", description="Language")
    comprehension: str = Field("intermediate", description="Comprehension level")
    max_results: int = Field(5, description="Maximum number of results")

@app.post("/web_search_endpoint", response_model=Dict[str, Any])
async def web_search_endpoint(schema: WebSearchSchema):
    if not pplx_chat:
        raise HTTPException(status_code=500, detail="Perplexity client not configured. Check PPLX_API_KEY.")

    try:
        data = schema.model_dump()
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
# 9. COMICS STREAMING ENDPOINT
# ==============================
class ComicsSchema(BaseModel):
    instructions: str = Field(..., description="Educational story/topic, e.g., Water cycle")
    grade_level: str = Field(..., description="Grade level string, e.g., '5' or 'Grade 5'")
    num_panels: int = Field(..., description="Number of panels to generate", ge=1, le=20)
    language: str = Field("English", description="Language for comic text (e.g., English, Arabic)")

def _parse_panel_prompts(story_text: str):
    lines = story_text.strip().split("\n")
    panels = []
    for line in lines:
        if "Panel_Prompt:" in line:
            try:
                prompt = line.split("Panel_Prompt:")[1].strip()
                if prompt:
                    panels.append(prompt)
            except Exception:
                continue
    return panels

@app.post("/comics_stream_endpoint")
async def comics_stream_endpoint(schema: ComicsSchema):
    async def event_stream():
        import json
        async def send(obj: dict):
            # SSE event
            yield f"data: {json.dumps(obj)}\n\n"

        try:
            # 1) Generate story/panel prompts
            story_prompts = await run_in_threadpool(
                create_comical_story_prompt,
                schema.instructions,
                schema.grade_level,
                schema.num_panels,
                schema.language  # Pass language parameter
            )
            if not story_prompts:
                async for chunk in send({"type": "error", "message": "Failed to generate story prompts."}):
                    yield chunk
                return

            # Send the full story text first
            async for chunk in send({"type": "story_prompts", "content": story_prompts}):
                yield chunk

            # 2) Parse and send each panel prompt, then image URL per panel
            panel_prompts = _parse_panel_prompts(story_prompts)
            if not panel_prompts:
                async for chunk in send({"type": "error", "message": "No panel prompts parsed."}):
                    yield chunk
                return

            for i, prompt in enumerate(panel_prompts[:schema.num_panels]):
                panel_index = i + 1
                # Emit the panel prompt
                async for chunk in send({"type": "panel_prompt", "index": panel_index, "prompt": prompt}):
                    yield chunk

                # Generate panel image synchronously via threadpool to avoid blocking
                image_url = await run_in_threadpool(generate_comic_image, prompt, panel_index)
                async for chunk in send({
                    "type": "panel_image",
                    "index": panel_index,
                    "url": image_url or ""
                }):
                    yield chunk

            # Done
            async for chunk in send({"type": "done"}):
                yield chunk

        except Exception as e:
            logger.error(f"Error in comics stream: {e}", exc_info=True)
            async for chunk in send({"type": "error", "message": str(e)}):
                yield chunk

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",  # for some proxies
    }
    return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")




# NEW: TEACHER BULK DATA ENDPOINT

class TeacherBulkDataSchema(BaseModel):
    teacher_name: str = Field(..., description="Teacher's name")
    student_details_with_reports: List[Dict[str, Any]] = Field(..., description="Bulk student data with reports")
    generated_content_details: List[Dict[str, Any]] = Field(..., description="Generated content details")
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

# NEW: TEACHER VOICE CHAT ENDPOINT

class TeacherVoiceChatSchema(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    teacher_data: TeacherBulkDataSchema


# NEW: TEACHER VOICE WEBSOCKET ENDPOINT

@app.websocket("/ws/teacher-voice")
async def websocket_teacher_voice_endpoint(websocket: WebSocket):
    """Real-time voice conversation for teachers using OpenAI's real-time API."""
    await websocket.accept()
    
    # Store teacher data and session info
    teacher_data = None
    openai_ws = None
    openai_session = None
    response_task = None
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "start_session":
                # Initialize real-time voice session with teacher data
                teacher_data = data.get("teacher_data", {})
                logger.info(f"Received teacher data keys: {list(teacher_data.keys())}")
                logger.info(f"Teacher data sample: {dict(list(teacher_data.items())[:5])}")
                
                # Connect to OpenAI's real-time API
                openai_api_key = os.getenv("OPENAI_API_KEY")
                
                if not openai_api_key:
                    await websocket.send_json({
                        "type": "error",
                        "message": "OpenAI API key not configured"
                    })
                    continue
                
                # Create connection to OpenAI real-time API
                openai_url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
                openai_headers = {
                    "Authorization": f"Bearer {openai_api_key}",
                    "OpenAI-Beta": "realtime=v1"
                }
                
                try:
                    # Connect to OpenAI real-time API
                    openai_session = aiohttp.ClientSession()
                    openai_ws = await openai_session.ws_connect(
                        openai_url,
                        headers=openai_headers,
                        max_msg_size=10_000_000
                    )
                    
                    # Send session configuration to OpenAI
                    teacher_name = teacher_data.get('teacher_name', 'Teacher')
                    student_reports = teacher_data.get('student_details_with_reports', [])
                    generated_content = teacher_data.get('generated_content_details', [])
                    
                    # Create comprehensive teacher prompt
                    prompt = f"""You are a helpful and insightful AI teaching assistant for {teacher_data.get('teacherName', 'the teacher')}. Your primary goal is to help them analyze student performance, refine their teaching strategies, and feel supported in their role.

Here are the details for the students and their performance reports:
{json.dumps(teacher_data.get('students', []), indent=2)}

Student Performance Overview:
{json.dumps(teacher_data.get('studentPerformance', {}), indent=2)}

Student Overview:
{json.dumps(teacher_data.get('studentOverview', {}), indent=2)}

Top Performers:
{json.dumps(teacher_data.get('topPerformers', []), indent=2)}

Subject Performance:
{json.dumps(teacher_data.get('subjectPerformance', {}), indent=2)}

Here are the details of the content you have generated or have available:
{json.dumps(teacher_data.get('content', []), indent=2)}

Assessment Details:
{json.dumps(teacher_data.get('assessments', []), indent=2)}

Media Toolkit Resources:
{json.dumps(teacher_data.get('mediaToolkit', {}), indent=2)}

Learning Analytics:
{json.dumps(teacher_data.get('learningAnalytics', {}), indent=2)}

Your main objective is to act as a collaborative partner for the teacher. Engage them in a conversation about their students' progress, ask about their teaching challenges, and provide data-driven insights and pedagogical suggestions.

Core Instructions:
** give response in which teacher talk **
1.  **Adopt a Persona**: Always maintain a professional, encouraging, and analytical persona. Your language should be clear, respectful, and focused on educational best practices. Avoid being overly robotic or generic.
2.  **Analyze and Adapt**: Before responding, analyze the teacher's query and the provided data. Your tone must dynamically change based on the conversation's context:
    *   **Insightful Tone (Default for Analysis)**:
        *   When: The teacher asks for performance analysis, trends, or student comparisons.
        *   How: Be data-driven and objective. Use phrases like, "Looking at the reports, I notice a pattern...", "That's an interesting question. Let's dive into the data.", "Based on the content details, we could try..."
    *   **Supportive Tone (On Challenges/Frustration)**:
        *   When: The teacher expresses difficulty, frustration with a student's progress, or uncertainty.
        *   How: Be empathetic and encouraging. Never be dismissive. Use phrases like, "I understand that can be challenging.", "That's a common hurdle. Let's brainstorm some strategies together.", "It's okay to feel that way. We can figure out a new approach."
    *   **Collaborative Tone (For Brainstorming/Suggestions)**:
        *   When: The teacher is looking for new ideas, lesson plans, or teaching methods.
        *   How: Be creative and resourceful. Use phrases like, "What if we tried a different angle?", "Building on that idea, we could also incorporate...", "I can help you find some resources for that."
    *   **Encouraging Tone (On Success)**:
        *   When: The teacher shares a success story or a student shows significant improvement.
        *   How: Celebrate their success and reinforce positive outcomes! Use phrases like, "That's fantastic news! Your approach is clearly working.", "It's wonderful to see that kind of progress.", "Great job, {teacher_data.get('teacherName', 'teacher')}! That's a testament to your teaching."

**Function calling:**
- **Web Search (`web_search`)**: Use this to find new teaching methodologies, educational research, or real-world examples to supplement the generated content.
"""

                    await openai_ws.send_json({
                        "type": "session.update",
                        "session": {
                            "modalities": ["audio", "text"],
                            "instructions": prompt,
                            "voice": "cedar",
                            "turn_detection": {
                                "type": "server_vad",
                                "threshold": 0.5,
                                "prefix_padding_ms": 300,
                                "silence_duration_ms": 500,
                            },
                            "input_audio_transcription": {"model": "gpt-4o-transcribe"},
                            "input_audio_noise_reduction": {"type": "near_field"},
                            "tools": [
                                {
                                    "type": "function",
                                    "name": "web_search",
                                    "description": "Search for educational research and teaching strategies.",
                                    "parameters": {
                                        "type": "object",
                                        "properties": {"query": {"type": "string", "description": "Educational search query for teaching resources"}},
                                        "required": ["query"]
                                    }
                                }
                            ],
                            "tool_choice": "auto",
                            "include": ["item.input_audio_transcription.logprobs"],
                        }
                    })
                    
                    await websocket.send_json({
                        "type": "session_started",
                        "message": "Real-time teacher voice session started"
                    })
                    
                    # Start task to handle OpenAI responses
                    response_task = asyncio.create_task(handle_teacher_openai_responses(openai_ws, websocket))
                    
                except Exception as e:
                    logger.error(f"Failed to connect to OpenAI real-time API: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Failed to start voice session: {str(e)}"
                    })
                    
            elif data["type"] == "stop_session":
                if response_task:
                    response_task.cancel()
                if openai_ws:
                    await openai_ws.close()
                if openai_session:
                    await openai_session.close()
                break
                
            elif data["type"] == "audio_chunk" and openai_ws:
                # Forward audio chunks directly to OpenAI
                try:
                    await openai_ws.send_json({
                        "type": "input_audio_buffer.append",
                        "audio": data["audio"]
                    })
                except Exception as e:
                    logger.error(f"Error forwarding teacher audio to OpenAI: {e}")
                    
            elif data["type"] == "function_call_output" and openai_ws:
                # Forward function call results back to OpenAI
                try:
                    await openai_ws.send_json({
                        "type": "conversation.item.create",
                        "item": {
                            "type": "function_call_output",
                            "call_id": data["call_id"],
                            "output": data["output"]
                        }
                    })
                except Exception as e:
                    logger.error(f"Error sending teacher function output to OpenAI: {e}")
                    
    except WebSocketDisconnect:
        logger.info("Teacher WebSocket disconnected")
    except Exception as e:
        logger.error(f"Teacher WebSocket error: {e}", exc_info=True)
        await websocket.send_json({
            "type": "error",
            "message": f"WebSocket error: {str(e)}"
        })
    finally:
        if openai_ws:
            await openai_ws.close()
        if openai_session:
            await openai_session.close()

async def handle_teacher_openai_responses(openai_ws, client_ws):
    """Handle responses from OpenAI for teacher and forward to client."""
    try:
        async for msg in openai_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                event = json.loads(msg.data)
                event_type = event.get("type")
                
                # Log important events for debugging
                if event_type in ["error", "response.error"]:
                    logger.error(f"OpenAI teacher error event: {json.dumps(event, indent=2)}")
                elif event_type == "session.created":
                    logger.info(f"OpenAI teacher session created successfully")
                
                # Forward all relevant events to client
                if event_type in [
                    "session.created", 
                    "response.audio.delta", 
                    "response.audio.done",
                    "conversation.item.create", 
                    "conversation.item.input_audio_transcription.completed",
                    "input_audio_buffer.speech_started",
                    "input_audio_buffer.speech_stopped",
                    "response.error", 
                    "response.completed",
                    "response.done",
                    "session.terminated",
                    "error"
                ]:
                    # For audio delta, ensure we pass the audio data properly
                    if event_type == "response.audio.delta" and "delta" in event:
                        # Forward the audio chunk with proper field name
                        await client_ws.send_json({
                            "type": "response.audio.delta",
                            "audio": event["delta"],  # OpenAI sends audio in 'delta' field
                            "response_id": event.get("response_id"),
                            "item_id": event.get("item_id"),
                            "output_index": event.get("output_index"),
                            "content_index": event.get("content_index")
                        })
                        logger.debug(f"Forwarded teacher audio delta: {len(event['delta'])} bytes")
                    else:
                        await client_ws.send_json(event)
                    
                # Handle function calls from OpenAI
                if event_type == "response.function_call_arguments.done":
                    # Process function call results
                    logger.info(f"Teacher function call completed: {event}")
                    
                # Handle tool calls requiring execution
                if event_type == "response.output_item.added":
                    item = event.get("item", {})
                    if item.get("type") == "function_call" and item.get("name") == "web_search":
                        # Execute web search server-side for teacher
                        try:
                            args = json.loads(item.get("arguments", "{}"))
                            search_results = await perform_web_search(args.get("query", ""))
                            
                            # Send results back to OpenAI
                            await openai_ws.send_json({
                                "type": "conversation.item.create",
                                "item": {
                                    "type": "function_call_output",
                                    "call_id": item.get("call_id"),
                                    "output": search_results
                                }
                            })
                        except Exception as e:
                            logger.error(f"Error handling teacher web search: {e}")
                    
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                logger.warning("Teacher OpenAI WebSocket closed or errored")
                await client_ws.send_json({"type": "error", "message": "OpenAI connection lost"})
                break
    except Exception as e:
        logger.error(f"Error handling teacher OpenAI responses: {e}", exc_info=True)
        await client_ws.send_json({"type": "error", "message": str(e)})

# Add teacher tutor sessions
teacher_tutor_sessions: Dict[str, Any] = {}

# Add teacher voice agent endpoint
@app.post("/teacher_voice_chat_endpoint")  
async def teacher_voice_chat_endpoint(request: TeacherChatbotRequest):
    """
    Handles interactions with the AI tutor for teachers with JSON-only requests.
    Streaming text responses, no audio files.
    Enhanced with teacher data for personalized teaching support.
    """
    try:
        # Get comprehensive teacher data from the schema
        teacher_data = request.teacher_data.model_dump()
        teacher_name = teacher_data.get('teacherName', 'Teacher') or teacher_data.get('teacher_name', 'Teacher')
        teacher_id = teacher_data.get('teacherId', 'Unknown') or teacher_data.get('teacher_id', 'Unknown')
            
        # Extract all the data with proper structure
        student_reports = teacher_data.get('students', []) or teacher_data.get('student_details_with_reports', [])
        student_performance = teacher_data.get('studentPerformance', {}) or teacher_data.get('student_performance', {})
        student_overview = teacher_data.get('student_overview', {})
        top_performers = teacher_data.get('top_performers', [])
        subject_performance = teacher_data.get('subject_performance', [])
        behavior_analysis = teacher_data.get('behavior_analysis', {})
        attendance_data = teacher_data.get('attendance_data', {})
            
        generated_content = teacher_data.get('generated_content_details', [])
        assessment_details = teacher_data.get('assessment_details', [])
            
        media_toolkit = teacher_data.get('media_toolkit', {})
        media_counts = teacher_data.get('media_counts', {})
            
        progress_data = teacher_data.get('progress_data', {})
        feedback_data = teacher_data.get('feedback_data', [])
        learning_analytics = teacher_data.get('learning_analytics', {})

        logger.info(f"Chatbot endpoint called with session_id: {request.session_id}")
        logger.info(f"Query: {request.query}")
        logger.info(f"Teacher data: {request.teacher_data}")

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

        # --- Enhanced Query Processing with Student Data ---
        if not request.query:
            logger.error("No query provided in request")
            raise HTTPException(status_code=400, detail="A 'query' is required.")

        # Prepare enhanced context with student data
        enhanced_query = request.query
        enhanced_history = request.history.copy()
        
        # if request.teacher_data:
        #     teacher_data = request.teacher_data

            # Create personalized context based on teacher data
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
        
        # FIXED: Pass all parameters including uploaded_files to match Student_AI_tutor.py run_agent_async signature
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

# --- Uvicorn Server Runner ---
if __name__ == "__main__":
    logger.info("Starting Uvicorn server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)