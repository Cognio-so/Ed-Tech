
from __future__ import annotations

import asyncio
import inspect
import json
import os
import logging
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Path as PathParam, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from models import (
    InstructionDepth,
    LessonPlanRequest,
    ContentGenerationRequest,
    WebSearchSchemaRequest,
    AssessmentRequest,
    ComicsSchema,
    PresentationSchema,
    TeacherVoiceSchema,
    StudentAITutorRequest,
    ImageGenSchema,
    AITutorRequest,
    StudentVoiceSchema,
    AddDocumentsRequest,
)

from teacher.media_toolkit.websearch_schema import run_search_agent
from teacher.media_toolkit.image_gen import ImageGenerator
from teacher.media_toolkit.comic_generation import create_comical_story_prompt, generate_comic_image
from teacher.media_toolkit.slide_generation import AsyncSlideSpeakGenerator, SlideSpeakError, SlideSpeakAuthError, SlideSpeakTimeoutError
from teacher.media_toolkit.video_generation import CloudinaryStorage, PPTXToHeyGenVideo
from teacher.Content_generation.lesson_plan import generate_lesson_plan
from teacher.Content_generation.presentation import generate_presentation
from teacher.Content_generation.Quizz import generate_quizz
from teacher.Content_generation.worksheet import generate_worksheet
from teacher.Assessment.assessment import generate_assessment
from teacher.Ai_Tutor.graph import create_ai_tutor_graph
from teacher.Ai_Tutor.graph_type import GraphState
from langchain_core.messages import HumanMessage, AIMessage
from doument_processor import extract_text_from_pdf, extract_text_from_docx, extract_text_from_txt, extract_text_from_json
from teacher.Ai_Tutor.qdrant_utils import store_documents
from teacher.Ai_Tutor.cleanup_scheduler import start_cleanup_scheduler
import httpx
from teacher.voice_agent.voice_agent_webrtc import VoiceAgentBridge
from Student.Ai_tutor.graph import create_student_ai_tutor_graph
from Student.Ai_tutor.graph_type import StudentGraphState
from teacher.Ai_Tutor.qdrant_utils import delete_teacher_session_collection
from Student.student_voice_agent.student_voice_agent import StudyBuddyBridge

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress verbose httpx logs (Qdrant HTTP requests)
logging.getLogger("httpx").setLevel(logging.WARNING)

BASE_DIR = Path(__file__).parent

ai_tutor_graph = create_ai_tutor_graph()
student_ai_tutor_graph = create_student_ai_tutor_graph()

GENERATOR_MAP: Dict[str, Callable[..., Awaitable[str]]] = {
    "lesson_plan": generate_lesson_plan,
    "presentation": generate_presentation,
    "quizz": generate_quizz,
    "worksheet": generate_worksheet,
}





video_generation_tasks: Dict[str, Dict[str, Any]] = {}
cloudinary_storage_manager: Optional[CloudinaryStorage] = None

try:
    cloudinary_storage_manager = CloudinaryStorage()
except Exception as e:
    logger.error(f"Failed to initialize Cloudinary Storage: {e}")








def _parse_enhanced_story_panels(story_text: str) -> List[Dict[str, str]]:
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






sessions: Dict[str, Dict[str, Any]] = {}

# Stores active VoiceAgentBridge instances by session_id
voice_sessions: Dict[str, VoiceAgentBridge] = {}
student_sessions: Dict[str, Dict[str, Any]] = {}
student_voice_sessions: Dict[str, StudyBuddyBridge] = {}


import time
from contextlib import asynccontextmanager
from teacher.Ai_Tutor.qdrant_utils import delete_teacher_session_collection
class SessionManager:
    @staticmethod
    async def create_session(teacher_id: str, existing_session_id: Optional[str] = None) -> str:
        session_id = existing_session_id or str(uuid4())
        if session_id not in sessions:
            sessions[session_id] = {
                "session_id": session_id,
                "teacher_id": teacher_id,
                "created_at_ts": time.time(),
                "created_at": str(uuid4()), 
                "newly_uploaded_docs":[],
                "content_generation": [],
                "messages": [],
                "teacher_payload":[]
            }
        return session_id

    @staticmethod
    async def get_session(session_id: str) -> Dict[str, Any]:
        session = sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    @staticmethod
    async def update_session(session_id: str, updates: Dict[str, Any]) -> None:
        session = await SessionManager.get_session(session_id)
        session.update(updates)
        sessions[session_id] = session


class StudentSessionManager:
    @staticmethod
    async def create_session(student_id: str, existing_session_id: Optional[str] = None) -> str:
        session_id = existing_session_id or str(uuid4())
        if session_id not in student_sessions:
            student_sessions[session_id] = {
                "session_id": session_id,
                "student_id": student_id,
                "created_at": str(uuid4()),
                "messages": [],
            }
        return session_id

    @staticmethod
    async def get_session(session_id: str) -> Dict[str, Any]:
        session = student_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Student session not found")
        return session

    @staticmethod
    async def update_session(session_id: str, updates: Dict[str, Any]) -> None:
        session = await StudentSessionManager.get_session(session_id)
        session.update(updates)
        student_sessions[session_id] = session

app = FastAPI(
    title="Ed-Tech Content Generation API",
    version="0.1.0",
    description="Backend services for AI-powered content generation.",
)

app.add_middleware(
    CORSMiddleware,
   allow_origins=["http://localhost:3000", "https://ed-tech-alpha-six.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz", tags=["System"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on application startup."""
    # Start the document cleanup scheduler (runs every hour)
    asyncio.create_task(start_cleanup_scheduler())
    logger.info("🚀 Document cleanup scheduler started (24-hour TTL)")



async def generate_video_background(
    task_id: str, 
    pptx_bytes: bytes, 
    original_filename: str, 
    voice_id: str, 
    avatar_id: str, 
    title: str, 
    language: str
):
    """
    Background task to handle the synchronous video generation process.
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
            cloudinary_storage_manager.upload_file,
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
            storage_manager=cloudinary_storage_manager,
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


@app.post("/api/teacher/{teacher_id}/session/{session_id}/video_generation/generate")
async def generate_video_presentation(
    teacher_id: str,
    session_id: str,
    pptx_file: UploadFile = File(..., description="The PowerPoint (.pptx) file"),
    voice_id: str = Form(..., description="HeyGen Voice ID"),
    talking_photo_id: str = Form(..., description="HeyGen Avatar/Talking Photo ID"),
    title: str = Form(..., description="Title for the video"),
    language: str = Form("english", description="Language for the script generation")
):
    """
    Uploads a PPTX file and starts the video generation process asynchronously.
    Returns a task_id to poll for status.
    """
    # Ensure session exists
    await SessionManager.create_session(teacher_id, session_id)

    if not cloudinary_storage_manager:
        raise HTTPException(
            status_code=500, 
            detail="Cloudinary storage is not configured on the server."
        )
    
    # Validate file type
    if not pptx_file.filename.lower().endswith(".pptx"):
        raise HTTPException(
            status_code=400, 
            detail="Invalid file format. Only .pptx files are supported."
        )

    try:
        task_id = str(uuid4())
        logger.info(f"Received video request. Task ID: {task_id}, File: {pptx_file.filename}")

        # Read file content into memory to pass to background task
        # Note: For extremely large files, stream processing might be needed, 
        # but PPTX files are usually manageable in memory.
        content = await pptx_file.read()

        # Initialize Task State
        video_generation_tasks[task_id] = {
            "session_id": session_id,
            "teacher_id": teacher_id,
            "status": "processing",
            "title": title,
            "filename": pptx_file.filename,
            "created_at": datetime.now().isoformat(),
            "error": None
        }

        # Start Background Task
        asyncio.create_task(generate_video_background(
            task_id=task_id,
            pptx_bytes=content,
            original_filename=pptx_file.filename,
            voice_id=voice_id,
            avatar_id=talking_photo_id,
            title=title,
            language=language
        ))

        return {
            "success": True,
            "task_id": task_id,
            "status": "processing",
            "message": "Video generation started successfully."
        }

    except Exception as e:
        logger.error(f"Failed to start video generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start process: {str(e)}")


@app.get("/api/teacher/{teacher_id}/session/{session_id}/video_generation/status/{task_id}")
async def check_video_generation_status(
    teacher_id: str,
    session_id: str,
    task_id: str
):
    """
    Checks the status of a video generation task.
    """
    # Verify session (optional, but good practice for security/logging)
    await SessionManager.get_session(session_id)

    if task_id not in video_generation_tasks:
        raise HTTPException(status_code=404, detail="Task ID not found.")

    task_info = video_generation_tasks[task_id]

    # simple auth check to ensure task belongs to this session/teacher
    if task_info.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this task.")

    response = {
        "task_id": task_id,
        "status": task_info["status"],
        "title": task_info["title"],
        "created_at": task_info["created_at"]
    }

    if task_info["status"] == "completed":
        response.update({
            "video_id": task_info.get("video_id"),
            "video_url": task_info.get("video_url"),
            "slides_processed": task_info.get("slides_processed"),
            "completed_at": task_info.get("completed_at")
        })
        
        # Optional: Save to session history if not already done
        session = await SessionManager.get_session(session_id)
        if "generated_videos" not in session:
            session["generated_videos"] = []
        
        # Avoid duplicates
        if not any(v.get("video_id") == task_info.get("video_id") for v in session["generated_videos"]):
            session["generated_videos"].append(response)
            await SessionManager.update_session(session_id, session)

    elif task_info["status"] == "failed":
        response.update({
            "error": task_info.get("error"),
            "failed_at": task_info.get("failed_at")
        })

    return response


@app.post("/api/teacher/{teacher_id}/session/{session_id}/voice_agent/connect")
async def connect_voice_agent(
    teacher_id: str,
    session_id: str,
    payload: TeacherVoiceSchema
) -> Dict[str, Any]:
    """
    Establishes a WebRTC connection for the Voice Agent.
    """
    await SessionManager.create_session(teacher_id, session_id)
    
    if session_id in voice_sessions:
        logger.info(f"Cleaning up existing voice session for {session_id}")
        await voice_sessions[session_id].disconnect()
        del voice_sessions[session_id]

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API Key not configured")

        bridge = VoiceAgentBridge(api_key=api_key)
        
        context_data = {
            "teacher_name": payload.teacher_name,
            "grade": payload.grade,
            "instructions": payload.instructions
        }
        
        # Connect
        answer_sdp = await bridge.connect(
            offer_sdp=payload.sdp, 
            context_data=context_data,
            voice=payload.voice
        )
        
        voice_sessions[session_id] = bridge
        
        return {
            "sdp": answer_sdp["sdp"],
            "type": answer_sdp["type"]
        }

    except Exception as e:
        logger.error(f"Voice Connection Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/teacher/{teacher_id}/session/{session_id}/voice_agent/disconnect")
async def disconnect_voice_agent(
    teacher_id: str,
    session_id: str
) -> Dict[str, str]:
    if session_id in voice_sessions:
        try:
            await voice_sessions[session_id].disconnect()
            del voice_sessions[session_id]
            return {"status": "disconnected", "message": "Voice agent disconnected."}
        except Exception as e:
            logger.error(f"Error disconnecting voice session: {e}")
            raise HTTPException(status_code=500, detail=f"Error disconnecting: {str(e)}")
    
    return {"status": "not_found", "message": "No active voice session found."}

@app.post("/api/student/{student_id}/session/{session_id}/voice_agent/connect")
async def connect_student_voice_agent(
    student_id: str,
    session_id: str,
    payload: StudentVoiceSchema
) -> Dict[str, Any]:
    """
    Establishes a WebRTC connection for the Student Voice Agent (Study Buddy).
    """
    # 1. Ensure Student Session Exists
    await StudentSessionManager.create_session(student_id, session_id)
    
    # 2. Cleanup existing voice session if strictly replacing
    if session_id in student_voice_sessions:
        logger.info(f"Cleaning up existing student voice session for {session_id}")
        await student_voice_sessions[session_id].disconnect()
        del student_voice_sessions[session_id]

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API Key not configured")

        # 3. Initialize the Bridge
        bridge = StudyBuddyBridge(api_key=api_key)
        
        # 4. Format assignments for the AI context
        # Convert list of dicts into a readable string for the System Prompt
        pending_str = "None"
        if payload.pending_assignments:
            pending_str = ", ".join(
                [f"{a.get('title', 'Unknown Task')} (Due: {a.get('due', 'Unknown')})" 
                 for a in payload.pending_assignments]
            )

        completed_str = "None"
        if payload.completed_assignments:
            completed_str = ", ".join(
                [a.get('title', 'Unknown Task') for a in payload.completed_assignments]
            )

        # 5. Prepare Context Data
        context_data = {
            "student_name": payload.student_name,
            "subject": payload.subject,
            "grade": payload.grade,
            "pending_assignments": pending_str,
            "instructions": f"The student has completed: {completed_str}. Focus on their pending work: {pending_str}."
        }
        
        # 6. Connect (WebRTC Handshake)
        answer_sdp = await bridge.connect(
            offer_sdp=payload.sdp, 
            context_data=context_data,
            voice=payload.voice
        )
        
        # 7. Store the active bridge
        student_voice_sessions[session_id] = bridge
        
        return {
            "sdp": answer_sdp["sdp"],
            "type": answer_sdp["type"]
        }

    except Exception as e:
        logger.error(f"Student Voice Connection Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/student/{student_id}/session/{session_id}/voice_agent/disconnect")
async def disconnect_student_voice_agent(
    student_id: str,
    session_id: str
) -> Dict[str, str]:
    """
    Disconnects the Student Voice Agent and cleans up resources.
    """
    if session_id in student_voice_sessions:
        try:
            await student_voice_sessions[session_id].disconnect()
            del student_voice_sessions[session_id]
            return {"status": "disconnected", "message": "Study Buddy disconnected."}
        except Exception as e:
            logger.error(f"Error disconnecting student voice session: {e}")
            raise HTTPException(status_code=500, detail=f"Error disconnecting: {str(e)}")
    
    return {"status": "not_found", "message": "No active study buddy session found."}

@app.post("/api/teacher/{teacher_id}/session/{session_id}/content_generator/{type}")
async def generate_content(
    teacher_id: str,
    type: Literal["lesson_plan", "presentation", "quizz", "worksheet"],
    payload: ContentGenerationRequest,
    session_id: Optional[str] = None,
    stream: bool = False,
) -> Dict[str, Any]:
    current_session_id = await SessionManager.create_session(teacher_id, session_id)

    generator_func = GENERATOR_MAP.get(type)
    if generator_func is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Generator for {type} is not implemented.",
        )

    request_payload = payload.model_dump(mode='json')

    generator_signature = inspect.signature(generator_func)
    accepts_chunk_callback = "chunk_callback" in generator_signature.parameters

    async def invoke_generator(chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None):
        kwargs = {"chunk_callback": chunk_callback} if chunk_callback and accepts_chunk_callback else {}
        result = generator_func(request_payload, **kwargs)
        if inspect.isawaitable(result):
            return await result
        return result

    if stream:
        if not accepts_chunk_callback:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Streaming is not supported for generator '{type}'",
            )

        queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
        full_response = ""

        async def chunk_callback(chunk: str):
            nonlocal full_response
            full_response += chunk
            await queue.put(
                {
                    "type": "content",
                    "data": {
                        "chunk": chunk,
                        "full_response": full_response,
                        "is_complete": False,
                    },
                }
            )

        async def run_and_store():
            try:
                raw_output = await invoke_generator(chunk_callback=chunk_callback)
                metadata = {
                    "session_id": current_session_id,
                    "teacher_id": teacher_id,
                    "type": type,
                    "content": raw_output,
                }
                await queue.put(
                    {
                        "type": "content",
                        "data": {
                            "chunk": "",
                            "full_response": raw_output,
                            "is_complete": True,
                        },
                    }
                )
                await queue.put(
                    {
                        "type": "metadata",
                        "data": metadata,
                    }
                )
            except Exception as exc:
                await queue.put(
                    {
                        "type": "error",
                        "data": {"message": str(exc)},
                    }
                )
            finally:
                await queue.put(None)

        asyncio.create_task(run_and_store())

        async def stream_output():
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield f"data: {json.dumps(chunk)}\n\n"

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Session-Id": current_session_id,
            "X-Teacher-Id": teacher_id,
            "X-Content-Type": type,
        }
        return StreamingResponse(
            stream_output(),
            media_type="text/event-stream",
            headers=headers,
        )

    try:
        raw_output = await invoke_generator()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return {
        "session_id": current_session_id,
        "teacher_id": teacher_id,
        "type": type,
        "content": raw_output,
    }


@app.post("/api/teacher/{teacher_id}/session/{session_id}/web_search_schema")
async def web_search_schema(
    teacher_id: str,
    payload: WebSearchSchemaRequest,
    session_id: Optional[str] = None,
) -> StreamingResponse:
    """
    Accepts search criteria, constructs a detailed query, and uses a web search
    agent to find relevant content, streaming the results back to the client.
    """
    current_session_id = await SessionManager.create_session(teacher_id, session_id)

    queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
    full_response = ""

    async def chunk_callback(chunk: str):
        nonlocal full_response
        full_response += chunk
        await queue.put(
            {
                "type": "content",
                "data": {"chunk": chunk, "full_response": full_response, "is_complete": False},
            }
        )

    async def run_and_store():
        try:
            raw_output = await run_search_agent(
                topic=payload.topic,
                grade_level=payload.grade_level,
                subject=payload.subject,
                content_type=payload.content_type,
                language=payload.language,
                comprehension=payload.comprehension,
                chunk_callback=chunk_callback,
            )
            metadata = {
                "session_id": current_session_id,
                "teacher_id": teacher_id,
                "type": "web_search_schema",
                "content": raw_output,
            }
            await queue.put(
                {
                    "type": "content",
                    "data": {"chunk": "", "full_response": raw_output, "is_complete": True},
                }
            )
            await queue.put({"type": "metadata", "data": metadata})
        except Exception as exc:
            await queue.put({"type": "error", "data": {"message": str(exc)}})
        finally:
            await queue.put(None)

    asyncio.create_task(run_and_store())

    async def stream_output():
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield f"data: {json.dumps(chunk)}\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Session-Id": current_session_id,
        "X-Teacher-Id": teacher_id,
        "X-Content-Type": "web_search_schema",
    }
    return StreamingResponse(
        stream_output(),
        media_type="text/event-stream",
        headers=headers,
    )


@app.post("/api/session/{session_id}/teacher/{teacher_id}/assessment")
async def create_assessment(
    session_id: str,
    teacher_id: str,
    payload: AssessmentRequest,
    stream: bool = False,
) -> Dict[str, Any]:
    """
    Generate an assessment aligned to the provided grade, subject, and learning objectives.
    Supports optional streaming using Server-Sent Events.
    """

    current_session_id = await SessionManager.create_session(teacher_id, session_id)
    request_payload = payload.model_dump(mode="json")

    async def invoke_generator(
        chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ):
        result = generate_assessment(request_payload, chunk_callback=chunk_callback)
        if inspect.isawaitable(result):
            return await result
        return result

    if stream:
        queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
        full_response = ""

        async def chunk_callback(chunk: str):
            nonlocal full_response
            full_response += chunk
            await queue.put(
                {
                    "type": "content",
                    "data": {
                        "chunk": chunk,
                        "full_response": full_response,
                        "is_complete": False,
                    },
                }
            )

        async def run_and_store():
            try:
                raw_output = await invoke_generator(chunk_callback=chunk_callback)
                metadata = {
                    "session_id": current_session_id,
                    "teacher_id": teacher_id,
                    "type": "assessment",
                    "content": raw_output,
                }
                await queue.put(
                    {
                        "type": "content",
                        "data": {
                            "chunk": "",
                            "full_response": raw_output,
                            "is_complete": True,
                        },
                    }
                )
                await queue.put({"type": "metadata", "data": metadata})
            except Exception as exc:
                await queue.put(
                    {"type": "error", "data": {"message": str(exc)}}
                )
            finally:
                await queue.put(None)

        asyncio.create_task(run_and_store())

        async def stream_output():
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield f"data: {json.dumps(chunk)}\n\n"

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Session-Id": current_session_id,
            "X-Teacher-Id": teacher_id,
            "X-Content-Type": "assessment",
        }
        return StreamingResponse(
            stream_output(),
            media_type="text/event-stream",
            headers=headers,
        )

    try:
        raw_output = await invoke_generator()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return {
        "session_id": current_session_id,
        "teacher_id": teacher_id,
        "type": "assessment",
        "content": raw_output,
    }
@app.post("/api/teacher/{teacher_id}/session/{session_id}/image_generation")
async def image_generation_endpoint(
    teacher_id: str,
    session_id: str,
    schema: ImageGenSchema
):
    """
    Generates an image using a schema, ideal for creating educational visuals like
    diagrams, charts, or illustrations with specific labels and styles.
    """
    await SessionManager.create_session(teacher_id, session_id)
    
    try:
        generator = ImageGenerator()
        schema_dict = schema.model_dump()
        
        logger.info(f"Generating {schema_dict['preferred_visual_type']} for topic: {schema_dict['topic']}")
        
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

@app.post("/api/teacher/{teacher_id}/session/{session_id}/presentation_slidespeak")
async def generate_slidespeak_presentation(
    teacher_id: str,
    session_id: str,
    schema: PresentationSchema
) -> Dict[str, Any]:
    """
    Generates a SlideSpeak presentation asynchronously.
    Returns the complete task result including the presentation URL.
    """
    # 1. Manage Session
    await SessionManager.create_session(teacher_id, session_id)
    
    try:
        # 2. Initialize Generator
        # Note: API Key is fetched from os.getenv("SLIDESPEAK_API_KEY") inside the class
        generator = AsyncSlideSpeakGenerator()
        
        logger.info(f"Generating SlideSpeak presentation for session {session_id}. Topic: {schema.plain_text}")

        # 3. Generate Presentation (Direct Await)
        # We map the schema fields to the generator's arguments
        result = await generator.generate_presentation(
            plain_text=schema.plain_text,
            custom_user_instructions=schema.custom_user_instructions,
            length=schema.length,
            language=schema.language,
            fetch_images=schema.fetch_images,
            verbosity=schema.verbosity,
            tone=schema.tone, 
            template=schema.template
        )

        # 4. Handle Response
        if result.get("task_status") == "SUCCESS":
            download_url = result.get("task_result", {}).get("url")
            logger.info(f"Presentation generated successfully: {download_url}")
            
            # Optional: Store in session content history
            await SessionManager.update_session(session_id, {
                "last_generated_presentation": download_url
            })
            
            return {
                "status": "success",
                "session_id": session_id,
                "teacher_id": teacher_id,
                "presentation_url": download_url,
                "full_result": result
            }
            
        elif result.get("task_status") == "FAILURE":
            error_msg = result.get("task_result", {}).get("error", "Unknown error occurred")
            logger.error(f"SlideSpeak generation failed: {error_msg}")
            raise HTTPException(status_code=422, detail=f"Generation failed: {error_msg}")
            
        else:
            raise HTTPException(status_code=500, detail=f"Unexpected status: {result.get('task_status')}")

    except SlideSpeakAuthError as e:
        logger.error(f"SlideSpeak Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid SlideSpeak API Key.")
        
    except SlideSpeakTimeoutError as e:
        logger.error(f"SlideSpeak Timeout: {e}")
        raise HTTPException(status_code=408, detail="Presentation generation timed out.")
        
    except SlideSpeakError as e:
        logger.error(f"SlideSpeak General Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    except ValueError as e:
        # Usually raised if API key is missing entirely
        logger.error(f"Configuration Error: {e}")
        raise HTTPException(status_code=500, detail="Server configuration error (API Key missing).")
        
    except Exception as e:
        logger.error(f"Unhandled error in presentation endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/api/teacher/{teacher_id}/session/{session_id}/comic_generation")
async def comics_stream_endpoint(
    teacher_id: str,
    session_id: str,
    schema: ComicsSchema, 
    request: Request
) -> StreamingResponse:
    """
    Generates a comic story and images based on instructions.
    Streams results via SSE (Server-Sent Events).
    """
    # Ensure session exists
    await SessionManager.create_session(teacher_id, session_id)
    
    async def event_stream():
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
                "panels_preview": [{"index": i+1, "has_footer": bool(p.get('footer_text'))} for i, p in enumerate(panels)]
            }):
                yield chunk

            # 3) Generate images WITHOUT footer text for each panel
            # We limit processing to the requested number of panels if parsing found more
            limit = schema.num_panels
            
            for i, panel_data in enumerate(panels[:limit]):
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info("Client disconnected, stopping comics generation")
                    break
                
                panel_index = i + 1
                footer_text = panel_data.get('footer_text', '')
                prompt_text = panel_data.get('prompt', '')
                
                logger.info(f"Processing panel {panel_index}/{len(panels)}")
                
                # Emit the panel information with separate text
                async for chunk in send({
                    "type": "panel_info",
                    "index": panel_index,
                    "prompt": prompt_text,
                    "footer_text": footer_text,
                    "has_footer": bool(footer_text)
                }):
                    yield chunk

                try:
                    # Generate panel image WITHOUT footer text (passing empty string for footer arg)
                    logger.info(f"Generating image for panel {panel_index}...")
                    image_b64 = await run_in_threadpool(
                        generate_comic_image, 
                        prompt_text, 
                        panel_index,
                        "",  # We pass empty string so the python script doesn't bake text into the image
                        schema.language
                    )
                    
                    # Check for disconnection again
                    if await request.is_disconnected():
                        logger.info("Client disconnected after image generation")
                        break
                    
                    if image_b64:
                        # Create data URL for the image
                        image_data_url = f"data:image/png;base64,{image_b64}"
                        
                        # Send the image and text separately
                        async for chunk in send({
                            "type": "panel_image",
                            "index": panel_index,
                            "url": image_data_url,
                            "footer_text": footer_text,
                            "has_footer": bool(footer_text),
                            "prompt_used": prompt_text[:100] + "..." if len(prompt_text) > 100 else prompt_text
                        }):
                            yield chunk
                            
                        logger.info(f"Panel {panel_index} completed successfully")
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
                async for chunk in send({"type": "done", "message": "Comic generation completed!", "session_id": session_id}):
                    yield chunk

        except Exception as e:
            error_msg = f"Error in enhanced comics stream: {str(e)}"
            logger.error(error_msg, exc_info=True)
            async for chunk in send({"type": "error", "message": error_msg}):
                yield chunk

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Session-Id": session_id,
        "X-Teacher-Id": teacher_id,
        "X-Content-Type": "comic_generation",
    }

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers
    )


@app.post("/api/teacher/{teacher_id}/sessions", tags=["Session"])
async def create_teacher_session(
    teacher_id: str,
    existing_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a session for a teacher or reuse an existing one if provided.
    """
    session_id = await SessionManager.create_session(teacher_id, existing_session_id)
    session = await SessionManager.get_session(session_id)
    return {
        "session_id": session_id,
        "teacher_id": teacher_id,
        "created_at": session.get("created_at"),
        "content_generation": session.get("content_generation", []),
    }


@app.get("/api/sessions/{session_id}", tags=["Session"])
async def get_session_details(session_id: str) -> Dict[str, Any]:
    return await SessionManager.get_session(session_id)





@app.post("/api/teacher/{teacher_id}/session/{session_id}/add-documents")
async def add_documents_by_url(
    teacher_id: str,
    session_id: str,
    payload: AddDocumentsRequest,
) -> Dict[str, Any]:
    """
    Add documents by URL for AI Tutor.
    Downloads documents, extracts text, chunks, and embeds into Qdrant.
    """
    # ========================== DEBUGGING LOGS START ==========================
    print(f"\n{'='*20} INCOMING FRONTEND DATA {'='*20}")
    print(f"DEBUG: Teacher ID: {teacher_id}")
    print(f"DEBUG: Session ID: {session_id}")
    
    # 1. Check how many docs came in
    print(f"DEBUG: Number of documents received: {len(payload.documents)}")
    
    # 2. Iterate and print specific metadata for every document
    for i, doc in enumerate(payload.documents):
        print(f"--- Document #{i+1} ---")
        print(f"DEBUG: Full Dictionary: {doc}")
        print(f"DEBUG: Keys present: {list(doc.keys())}")
        
        # Check specific fields usually expected
        print(f"   -> file_url: {doc.get('file_url')}")
        print(f"   -> filename: {doc.get('filename')}")
        print(f"   -> file_type: {doc.get('file_type')}")
        print(f"   -> id: {doc.get('id')}")
        print(f"   -> size: {doc.get('size')}")
        
    print(f"{'='*60}\n")
    # ========================== DEBUGGING LOGS END ============================

    current_session_id = await SessionManager.create_session(teacher_id, session_id)
    session = await SessionManager.get_session(current_session_id)
    
    documents = payload.documents
    processed_docs = []
    
    async def process_single_document(doc: dict, index: int) -> Optional[dict]:
        """Process a single document: download, extract text, chunk, and embed."""
        try:
            file_url = doc.get("file_url")
            filename = doc.get("filename", "")
            file_type = doc.get("file_type", "")
            doc_id = doc.get("id", str(uuid4()))
            
            if not file_url:
                logger.warning(f"Document {index + 1} missing file_url, skipping")
                return None
            
            # logger.info(f"[DOC EMBEDDING] Processing document {index + 1}/{len(documents)}: {filename}")
            # print(f"[DOC EMBEDDING] 📄 Starting processing: {filename} from URL: {file_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=30.0)
                response.raise_for_status()
                file_content = response.content
                # logger.info(f"[DOC EMBEDDING] Downloaded {len(file_content)} bytes from {filename}")
                # print(f"[DOC EMBEDDING] ✅ Downloaded {len(file_content)} bytes from {filename}")
            
            file_extension = filename.split('.')[-1].lower() if '.' in filename else ''
            
            text = ""
            # print(f"[DOC EMBEDDING] 🔍 Extracting text from {filename} (type: {file_extension})")
            if file_extension == 'pdf' or 'pdf' in file_type.lower():
                text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                # print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from PDF")
            elif file_extension == 'docx' or 'wordprocessingml' in file_type.lower():
                text = await asyncio.to_thread(extract_text_from_docx, file_content)
                # print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from DOCX")
            elif file_extension == 'json' or 'json' in file_type.lower():
                text = extract_text_from_json(file_content)
                # print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from JSON")
            else:
                text = extract_text_from_txt(file_content)
                # print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from TXT")
            
            if not text.strip():
                logger.warning(f"[DOC EMBEDDING] No text content extracted from {filename}")
                # print(f"[DOC EMBEDDING] ⚠️ WARNING: No text content extracted from {filename}")
                return None
            
            from langchain_core.documents import Document
            
            doc_metadata = {
                "source": file_url,
                "file_type": file_extension or "txt",
                "doc_id": doc_id,
                "filename": filename,
            }
            
            document = Document(
                page_content=text,
                metadata=doc_metadata
            )
            
            # print(f"[DOC EMBEDDING] 💾 Storing document in Qdrant for teacher_id: {teacher_id}, collection: user_docs")
            # logger.info(f"[DOC EMBEDDING] Storing document in Qdrant for teacher_id: {teacher_id}")
            
            # --- Ensure you updated qdrant_utils.py as per previous instructions to handle these arguments ---
            success = await store_documents(
                teacher_id=teacher_id,
                session_id=current_session_id,
                documents=[document],
               
                metadata={"source_url": file_url, "file_type": file_extension, "doc_id": doc_id, "filename": filename}
            )
            
            if success:
                # print(f"[DOC EMBEDDING] ✅ Successfully embedded document {filename} in Qdrant")
                processed_doc = {
                    "id": doc_id,
                    "filename": filename,
                    "file_url": file_url,
                    "file_type": file_extension or "txt",
                    "size": doc.get("size", len(file_content))
                }
                # logger.info(f"Successfully processed and embedded {filename}")
                return processed_doc
            else:
                # logger.error(f"[DOC EMBEDDING] Failed to store {filename} in Qdrant")
                # print(f"[DOC EMBEDDING] ❌ ERROR: Failed to store {filename} in Qdrant")
                return None
                
        except Exception as e:
            logger.error(f"Error processing {doc.get('filename', 'unknown')}: {e}", exc_info=True)
            return None
    
    # logger.info(f"[DOC EMBEDDING] Starting parallel processing of {len(documents)} documents...")
    # print(f"[DOC EMBEDDING] 🚀 Starting parallel processing of {len(documents)} documents for teacher_id: {teacher_id}")
    doc_tasks = [process_single_document(doc, i) for i, doc in enumerate(documents)]
    results = await asyncio.gather(*doc_tasks, return_exceptions=True)
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            # logger.error(f"[DOC EMBEDDING] Document {i + 1} raised exception: {result}")
            # print(f"[DOC EMBEDDING] ❌ Document {i + 1} raised exception: {result}")
            pass
        elif result is not None:
            processed_docs.append(result)
    
    if "uploaded_docs" not in session:
        session["uploaded_docs"] = []
    
    session["uploaded_docs"].extend(processed_docs)
    
    # ✅ NEW: Accumulate newly uploaded docs (like old project)
    # These will be cleared after user sends first query
    uploaded_files = []
    for doc in processed_docs:
        clean_doc = {
            "filename": doc.get("filename"),
            "file_url": doc.get("file_url"),
            "file_type": doc.get("file_type", "unknown"),
            "id": doc.get("id"),
            "size": doc.get("size")
        }
        uploaded_files.append(clean_doc)
    
    # Append to newly_uploaded_docs (accumulates until query is sent)
    session.setdefault("newly_uploaded_docs", []).extend(uploaded_files)
    # print(f"[DOC EMBEDDING] 📂 Accumulated {len(session['newly_uploaded_docs'])} docs in newly_uploaded_docs")
    
    await SessionManager.update_session(current_session_id, session)
    
    # logger.info(f"[DOC EMBEDDING] Successfully processed {len(processed_docs)}/{len(documents)} documents")
    # print(f"[DOC EMBEDDING] ✅ COMPLETE: Successfully processed {len(processed_docs)}/{len(documents)} documents")
    
    return {
        "message": f"Added {len(processed_docs)} documents",
        "documents": processed_docs,
        "session_id": current_session_id
    }


@app.get("/api/teacher/{teacher_id}/session/{session_id}/documents")
async def get_documents(
    teacher_id: str,
    session_id: str,
) -> Dict[str, Any]:
    """Get all documents for a session"""
    session = await SessionManager.get_session(session_id)
    
    return {
        "uploaded_docs": session.get("uploaded_docs", []),
        "session_id": session_id
    }


@app.delete("/api/teacher/{teacher_id}/session/{session_id}/documents")
async def delete_teacher_session_documents(teacher_id: str, session_id: str) -> Dict[str, Any]:
    """Clear all embeddings and metadata for a teacher session."""
    await clear_session_documents(teacher_id, session_id)
    try:
        session = await SessionManager.get_session(session_id)
        session["uploaded_docs"] = []
        await SessionManager.update_session(session_id, session)
    except HTTPException:
        pass
    return {"message": "Session documents cleared", "session_id": session_id}


async def process_document_from_url(
    url: str, teacher_id: str, session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process a single teacher document from a URL:
    - downloads the file
    - extracts text
    - embeds & stores in Qdrant (user_docs collection)

    Returns a dict with embedding status and metadata (url, filename, file_type, doc_id, size, content).
    """
    try:
        # logger.info(f"[DOC EMBEDDING] Processing single document from URL: {url}")

        # Basic file info
        filename = url.split("/")[-1].split("?")[0] or "document"
        file_extension = filename.split(".")[-1].lower() if "." in filename else "txt"
        doc_id = str(uuid4())

        # Download file
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            file_content = response.content

        # logger.info(f"[DOC EMBEDDING] Downloaded {len(file_content)} bytes from {filename}")

        # Extract text based on extension
        text = ""
        if file_extension == "pdf":
            text = await asyncio.to_thread(extract_text_from_pdf, file_content)
        elif file_extension == "docx":
            text = await asyncio.to_thread(extract_text_from_docx, file_content)
        elif file_extension == "json":
            text = extract_text_from_json(file_content)
        else:
            text = extract_text_from_txt(file_content)

        if not text.strip():
            logger.warning(f"[DOC EMBEDDING] No text extracted from {filename}")
            return {
                "success": False,
                "url": url,
                "filename": filename,
                "file_type": file_extension,
                "doc_id": doc_id,
                "size": len(file_content),
                "content": "",
            }

        from langchain_core.documents import Document

        base_metadata = {
            "source": url,
            "file_type": file_extension,
            "doc_id": doc_id,
            "filename": filename,
        }

        document = Document(page_content=text, metadata=base_metadata)

        # logger.info(f"[DOC EMBEDDING] Storing single document in Qdrant for teacher_id={teacher_id}")
        success = await store_documents(
            teacher_id=teacher_id,
            session_id=session_id,
            documents=[document],
            clear_existing=False,
            metadata={
                "source_url": url,
                "file_type": file_extension,
                "doc_id": doc_id,
                "filename": filename,
            },
        )

        return {
            "success": bool(success),
            "url": url,
            "filename": filename,
            "file_type": file_extension,
            "doc_id": doc_id,
            "size": len(file_content),
            "content": text,
        }

    except Exception as e:
        logger.error(f"[DOC EMBEDDING] Error processing document from URL {url}: {e}", exc_info=True)
        return {
            "success": False,
            "url": url,
            "content": "",
        }


@app.post(
    "/api/teacher/{teacher_id}/session/{session_id}/stream-chat"
)
async def ai_tutor_stream_chat(
    teacher_id: str,
    session_id: str,
    payload: AITutorRequest,
    stream: bool = True,
) -> StreamingResponse:
    """
    AI Tutor streaming chat endpoint.
    Accepts teacher data, student data, topic, and user message.
    Streams the AI Tutor response using Server-Sent Events.
    """
    current_session_id = await SessionManager.create_session(teacher_id, session_id)
    session = await SessionManager.get_session(current_session_id)
    session["teacher_payload"] = payload
    print("teacher_payload:-----------------------", session["teacher_payload"])
    print(f"hiii", payload)
    if payload.doc_url:
        print(f"[CHAT ENDPOINT] 🔗 Document URL provided: {payload.doc_url}")
        if "uploaded_docs" not in session:
            session["uploaded_docs"] = []
        
        doc_already_processed = any(
            (doc.get("url") == payload.doc_url or doc.get("file_url") == payload.doc_url) 
            and doc.get("id") is not None
            for doc in session["uploaded_docs"]
        )
        
        if not doc_already_processed:
            print(f"[CHAT ENDPOINT] ⚡ Document not yet processed. Auto-processing and embedding...")
            try:
                result = await process_document_from_url(
                    payload.doc_url, teacher_id, current_session_id
                )

                if result.get("success"):
                    print(f"[CHAT ENDPOINT] ✅ Successfully embedded document in Qdrant")
                    session["uploaded_docs"].append(
                        {
                            "url": result.get("url"),
                            "file_url": result.get("url"),
                            "file_type": result.get("file_type"),
                            "id": result.get("doc_id"),
                            "filename": result.get("filename"),
                            "processed": True,
                            "size": result.get("size"),
                        }
                    )
                else:
                    print(f"[CHAT ENDPOINT] ❌ Failed to embed document in Qdrant")
                    session["uploaded_docs"].append(
                        {
                            "url": payload.doc_url,
                            "file_url": payload.doc_url,
                            "file_type": (payload.doc_url.split(".")[-1].lower() if "." in payload.doc_url else "txt"),
                            "id": result.get("doc_id"),
                            "filename": result.get("filename") or payload.doc_url.split("/")[-1].split("?")[0],
                            "processed": False,
                        }
                    )

                await SessionManager.update_session(current_session_id, session)
            except Exception as e:
                logger.error(f"[CHAT ENDPOINT] Error auto-processing document: {e}", exc_info=True)
                print(f"[CHAT ENDPOINT] ❌ ERROR auto-processing document: {e}")
                session["uploaded_docs"].append({
                    "url": payload.doc_url,
                    "file_type": payload.doc_url.split('.')[-1].lower() if '.' in payload.doc_url else 'txt',
                    "processed": False
                })
                await SessionManager.update_session(current_session_id, session)
        else:
            print(f"[CHAT ENDPOINT] ✅ Document already processed and embedded")
    else:
        print(f"[CHAT ENDPOINT] ℹ️ No document URL provided in request")
    
    queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
    full_response = ""
    
    async def chunk_callback(chunk: str):
        nonlocal full_response
        full_response += chunk
        await queue.put(
            {
                "type": "content",
                "data": {
                    "chunk": chunk,
                    "full_response": full_response,
                    "is_complete": False,
                },
            }
        )
    
    session_messages = session.get("messages", [])
    
    print(f"[CHAT ENDPOINT] 📜 Loading conversation history: {len(session_messages)} previous messages")
    session_messages.append({"role": "user", "content": payload.message})
    recent_messages = session_messages[-3:]
    langchain_messages = []
    
    print(f"[CHAT ENDPOINT] ✂️ Limiting context to last {len(recent_messages)} messages")
    
    for msg in recent_messages:
        if msg.get("role") == "user":
            langchain_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            langchain_messages.append(AIMessage(content=msg.get("content", "")))
    
    print(f"[CHAT ENDPOINT] ✅ Total messages sent to graph: {len(langchain_messages)}")
    newly_uploaded_docs = session.get("newly_uploaded_docs", [])
    uploaded_doc_flag = bool(newly_uploaded_docs)
    
    if newly_uploaded_docs:
        print(f"[CHAT ENDPOINT] 📂 Found {len(newly_uploaded_docs)} newly uploaded docs")
        print(f"[CHAT ENDPOINT] 📋 Doc types: {[doc.get('file_type') for doc in newly_uploaded_docs]}")
    else:
        print(f"[CHAT ENDPOINT] ℹ️ No newly uploaded docs")
    state: GraphState = {
        "messages": langchain_messages,
        "user_query": payload.message,
        "teacher_id": teacher_id,
        "session_id": current_session_id,
        "student_data": payload.student_data,
        "teacher_data": payload.teacher_data,
        "topic": payload.topic,
        "subject": payload.subject,
        "content_type": None,  # Not provided in new structure, but kept for compatibility
        "doc_url": payload.doc_url,
        "language": payload.language,
        "model": payload.model,
        "context": {
            "session": {
                "summary": session.get("summary", ""),
                "last_route": session.get("last_route"),
            }
        },
        "should_continue": True,  
        "chunk_callback": chunk_callback,
        "token_usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
        
        # ✅ NEW: Enhanced orchestrator fields
        "uploaded_doc": uploaded_doc_flag,
        "new_uploaded_docs": newly_uploaded_docs,  # Note: orchestrator expects "new_uploaded_docs"
        "active_docs": session.get("uploaded_docs", []),
        "is_image": False,
        "edit_img_urls": [],
        "img_urls": session.get("img_urls", []),
    }
    
    print(f"[CHAT ENDPOINT] ✅ Graph state created. doc_url in state: {state.get('doc_url')}")
    
    async def generate_stream():
        try:
            final_state = None
            stream_error_message = None
            
            async def run_graph():
                nonlocal final_state, stream_error_message
                try:
                    # logger.info("Starting AI Tutor graph execution")
                    async for node_result in ai_tutor_graph.astream(state):
                        logger.debug(f"Node result: {list(node_result.keys())}")
                        final_state = node_result
                        for node_name, node_state in node_result.items():
                            if isinstance(node_state, dict):
                                state.update(node_state)
                except Exception as e:
                    logger.error(f"Error in graph execution: {e}", exc_info=True)
                    if isinstance(e, asyncio.CancelledError):
                        stream_error_message = "Response stream was interrupted."
                    else:
                        stream_error_message = str(e) or "Unexpected error"
                    await queue.put({
                        "type": "error",
                        "data": {"error": stream_error_message}
                    })
                finally:
                    await queue.put(None)
            
            async def consume_and_yield():
                nonlocal stream_error_message
                while True:
                    item = await queue.get()
                    if item is None:
                        break
                    if item.get("type") == "error":
                        stream_error_message = item["data"].get("error")
                        continue
                    if stream_error_message:
                        continue
                    yield item
            
            graph_task = asyncio.create_task(run_graph())
            async for chunk in consume_and_yield():
                chunk_data = json.dumps(chunk)
                yield f"data: {chunk_data}\n\n"
            
            await graph_task
            
            response = ""
            if final_state:
                for node_name, node_state in final_state.items():
                    if isinstance(node_state, dict):
                        if node_state.get("final_answer"):
                            response = node_state.get("final_answer", "")
                        elif node_state.get("websearch_results"):
                            response = node_state.get("websearch_results", "")
                        elif node_state.get("rag_response"):
                            response = node_state.get("rag_response", "")
                        elif node_state.get("simple_llm_response"):
                            response = node_state.get("simple_llm_response", "")
                        elif node_state.get("response"):
                            response = node_state.get("response", "")
                        break
            
            if not response:
                response = full_response
            
            token_usage = state.get("token_usage", {})
            
            final_chunk = {
                "type": "content",
                "data": {
                    "content": "",
                    "is_complete": True,
                    "full_response": response or full_response,
                    "image_result": state.get("image_result"),
                    "img_urls": state.get("img_urls", []),  # ✅ NEW
                    "token_usage": token_usage,
                    "route_taken": state.get("tasks", []),  # ✅ NEW
                    "error_message": stream_error_message
                }
            }
            yield f"data: {json.dumps(final_chunk)}\n\n"
            
            if response or full_response:
                if "messages" not in session:
                    session["messages"] = []
                session["messages"].append({"role": "assistant", "content": response or full_response})
            if state.get("context", {}).get("session", {}).get("summary"):
                session["summary"] = state["context"]["session"]["summary"]
            if state.get("context", {}).get("session", {}).get("last_route"):
                session["last_route"] = state["context"]["session"]["last_route"]
            
            # ✅ FIX: Update last_route from executed tasks, ignoring "end"
            tasks = state.get("tasks", [])
            if tasks:
                session["last_route"] = tasks[-1]
            elif state.get("route") and state.get("route") != "end":
                session["last_route"] = state["route"]
            if state.get("image_result"):
                session["last_image_result"] = state.get("image_result")
            if session.get("newly_uploaded_docs"):
                session["newly_uploaded_docs"] = []
            
            await SessionManager.update_session(current_session_id, session)
            
            yield f"data: {json.dumps({'type': 'done', 'data': {'session_id': current_session_id}})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in stream generation: {e}", exc_info=True)
            error_chunk = json.dumps({
                "type": "error",
                "data": {"error": str(e)}
            })
            yield f"data: {error_chunk}\n\n"
    
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Session-Id": current_session_id,
        "X-Teacher-Id": teacher_id,
        "X-Content-Type": "ai_tutor",
    }
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers=headers,
    )


@app.post("/api/student/{student_id}/session/{session_id}/stream-chat")
async def student_ai_tutor_stream_chat(
    student_id: str,
    session_id: str,
    payload: StudentAITutorRequest,
    stream: bool = True,
) -> StreamingResponse:
    """
    Student AI Tutor streaming chat endpoint.
    """
    current_session_id = await StudentSessionManager.create_session(student_id, session_id)
    session = await StudentSessionManager.get_session(current_session_id)

    print(f"[STUDENT CHAT] 📥 Request received - student_id: {student_id}, session_id: {current_session_id}")
    print(f"[STUDENT CHAT] 📝 Message: {payload.message[:100]}...")
    print(f"[STUDENT CHAT] 📎 doc_url: {payload.doc_url}")

    if payload.doc_url:
        session.setdefault("uploaded_docs", [])
        doc_already_processed = any(
            (doc.get("url") == payload.doc_url or doc.get("file_url") == payload.doc_url)
            and doc.get("id") is not None
            for doc in session["uploaded_docs"]
        )

        if not doc_already_processed:
            print(f"[STUDENT CHAT] ⚡ Processing provided document for embedding...")
            try:
                filename = payload.doc_url.split("/")[-1].split("?")[0]
                file_extension = filename.split(".")[-1].lower() if "." in filename else "txt"
                doc_id = str(uuid4())

                async with httpx.AsyncClient() as client:
                    response = await client.get(payload.doc_url, timeout=30.0)
                    response.raise_for_status()
                    file_content = response.content

                if file_extension == "pdf":
                    text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                elif file_extension == "docx":
                    text = await asyncio.to_thread(extract_text_from_docx, file_content)
                elif file_extension == "json":
                    text = extract_text_from_json(file_content)
                else:
                    text = extract_text_from_txt(file_content)

                if text.strip():
                    from langchain_core.documents import Document

                    document = Document(
                        page_content=text,
                        metadata={
                            "source": payload.doc_url,
                            "file_type": file_extension,
                            "doc_id": doc_id,
                            "filename": filename,
                        },
                    )

                    success = await store_student_documents(
                        student_id=student_id,
                        session_id=current_session_id,
                        documents=[document],
                        collection_type="user_docs",
                        is_hybrid=False,
                        clear_existing=False,
                        metadata={
                            "source_url": payload.doc_url,
                            "file_type": file_extension,
                            "doc_id": doc_id,
                            "filename": filename,
                        },
                    )

                    session["uploaded_docs"].append(
                        {
                            "url": payload.doc_url,
                            "file_url": payload.doc_url,
                            "file_type": file_extension,
                            "id": doc_id if success else None,
                            "filename": filename,
                            "processed": success,
                            "size": len(file_content),
                        }
                    )
                    await StudentSessionManager.update_session(current_session_id, session)
                else:
                    print(f"[STUDENT CHAT] ⚠️ No text extracted from {filename}")
            except Exception as exc:
                logger.error(f"[STUDENT CHAT] Error auto-processing document: {exc}", exc_info=True)
                session["uploaded_docs"].append(
                    {
                        "url": payload.doc_url,
                        "file_type": payload.doc_url.split(".")[-1].lower() if "." in payload.doc_url else "txt",
                        "processed": False,
                    }
                )
                await StudentSessionManager.update_session(current_session_id, session)
        else:
            print(f"[STUDENT CHAT] ✅ Document already processed.")
    else:
        print(f"[STUDENT CHAT] ℹ️ No document URL provided.")

    queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
    full_response = ""

    async def chunk_callback(chunk: str):
        nonlocal full_response
        full_response += chunk
        await queue.put(
            {
                "type": "content",
                "data": {
                    "chunk": chunk,
                    "full_response": full_response,
                    "is_complete": False,
                },
            }
        )

    session_messages = session.setdefault("messages", [])
    session_messages.append({"role": "user", "content": payload.message})
    recent_messages = session_messages[-3:]

    langchain_messages = []
    for msg in recent_messages:
        if msg.get("role") == "user":
            langchain_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            langchain_messages.append(AIMessage(content=msg.get("content", "")))

    state: StudentGraphState = {
        "messages": langchain_messages,
        "user_query": payload.message,
        "student_id": student_id,
        "session_id": current_session_id,
        "student_profile": payload.student_profile,
        "pending_assignments": payload.pending_assignments,
        "assessment_data": payload.assessment_data,
        "achievements": payload.achievements,
        "topic": payload.topic,
        "subject": payload.subject,
        "doc_url": payload.doc_url,
        "language": payload.language,
        "context": {
            "session": {
                "summary": session.get("summary", ""),
                "last_route": session.get("last_route"),
            }
        },
        "should_continue": True,
        "chunk_callback": chunk_callback,
        "token_usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
    }

    async def generate_stream():
        try:
            # Send initial status message immediately
            initial_status = {
                "type": "status",
                "data": {
                    "status": "processing",
                    "message": "Study Buddy is thinking..."
                }
            }
            yield f"data: {json.dumps(initial_status)}\n\n"
            
            final_state = None
            stream_error_message = None

            async def run_graph():
                nonlocal final_state, stream_error_message
                try:
                    # logger.info("Starting Student AI Tutor graph execution")
                    async for node_result in student_ai_tutor_graph.astream(state):
                        final_state = node_result
                        for node_name, node_state in node_result.items():
                            if isinstance(node_state, dict):
                                state.update(node_state)
                except Exception as exc:
                    logger.error(f"Student graph execution error: {exc}", exc_info=True)
                    stream_error_message = str(exc) or "Unexpected error"
                    await queue.put({"type": "error", "data": {"error": stream_error_message}})
                finally:
                    await queue.put(None)

            async def consume_and_yield():
                nonlocal stream_error_message
                while True:
                    try:
                        # Add timeout to prevent indefinite blocking
                        item = await asyncio.wait_for(queue.get(), timeout=300.0)
                        if item is None:
                            break
                        if item.get("type") == "error":
                            stream_error_message = item["data"].get("error")
                            continue
                        if stream_error_message:
                            continue
                        yield item
                    except asyncio.TimeoutError:
                        logger.error("Timeout waiting for queue item")
                        yield {
                            "type": "error",
                            "data": {"error": "Request timeout - no response from AI tutor"}
                        }
                        break

            graph_task = asyncio.create_task(run_graph())
            async for chunk in consume_and_yield():
                yield f"data: {json.dumps(chunk)}\n\n"
            await graph_task

            response = ""
            if final_state:
                for _, node_state in final_state.items():
                    if isinstance(node_state, dict):
                        response = (
                            node_state.get("final_answer")
                            or node_state.get("rag_response")
                            or node_state.get("simple_llm_response")
                            or node_state.get("websearch_results")
                            or node_state.get("response")
                            or response
                        )
                        if response:
                            break

            if not response:
                response = full_response

            token_usage = state.get("token_usage", {})
            final_chunk = {
                "type": "content",
                "data": {
                    "content": "",
                    "is_complete": True,
                    "full_response": response or full_response,
                    "image_result": state.get("image_result"),
                    "token_usage": token_usage,
                    "error_message": stream_error_message,
                },
            }
            yield f"data: {json.dumps(final_chunk)}\n\n"

            if response or full_response:
                session_messages.append({"role": "assistant", "content": response or full_response})
            if state.get("context", {}).get("session", {}).get("summary"):
                session["summary"] = state["context"]["session"]["summary"]
            if state.get("context", {}).get("session", {}).get("last_route"):
                session["last_route"] = state["context"]["session"]["last_route"]
            if state.get("route"):
                session["last_route"] = state["route"]

            await StudentSessionManager.update_session(current_session_id, session)

            yield f"data: {json.dumps({'type': 'done', 'data': {'session_id': current_session_id}})}\n\n"
        except Exception as exc:
            logger.error(f"Error in student stream generation: {exc}", exc_info=True)
            error_chunk = json.dumps({"type": "error", "data": {"error": str(exc)}})
            yield f"data: {error_chunk}\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Session-Id": current_session_id,
        "X-Student-Id": student_id,
        "X-Content-Type": "student_ai_tutor",
    }

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers=headers,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "false").lower() == "true",
    )
