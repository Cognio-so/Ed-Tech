
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
from fastapi import FastAPI, HTTPException, status, Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PositiveInt,
    validator,
    model_validator,
)

from  teacher.media_toolkit.websearch_schema import run_search_agent
from  teacher.media_toolkit.image_gen import ImageGenerator

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
import httpx


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent

ai_tutor_graph = create_ai_tutor_graph()

GENERATOR_MAP: Dict[str, Callable[..., Awaitable[str]]] = {
    "lesson_plan": generate_lesson_plan,
    "presentation": generate_presentation,
    "quizz": generate_quizz,
    "worksheet": generate_worksheet,
}


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
    student_data: Optional[Dict[str, Any]] = Field(None, description="Student data (Name, Language, Grade, etc.) - can contain multiple students")
    teacher_data: Optional[Dict[str, Any]] = Field(None, description="Teacher data")
    topic: Optional[str] = Field(None, description="Topic for the conversation")
    content_type: Optional[str] = Field(None, description="Content type generated by teacher")
    subject: Optional[str] = Field(None, description="Subject")
    doc_url: Optional[str] = Field(None, description="Document URL if uploaded")
    language: str = Field("English", description="Language for the conversation")


sessions: Dict[str, Dict[str, Any]] = {}


class SessionManager:
    """Global in-memory session management."""

    @staticmethod
    async def create_session(teacher_id: str, existing_session_id: Optional[str] = None) -> str:
        session_id = existing_session_id or str(uuid4())
        if session_id not in sessions:
            sessions[session_id] = {
                "session_id": session_id,
                "teacher_id": teacher_id,
                "created_at": str(uuid4()), 
                "content_generation": [],
                "messages": [],
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


app = FastAPI(
    title="Ed-Tech Content Generation API",
    version="0.1.0",
    description="Backend services for AI-powered content generation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["System"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}



@app.post(
    "/api/teacher/{teacher_id}/session/{session_id}/content_generator/{type}",
    tags=["Content Generation"],
)
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

    await SessionManager.get_session(session_id)
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
                    "session_id": session_id,
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
            "X-Session-Id": session_id,
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
        "session_id": session_id,
        "teacher_id": teacher_id,
        "type": "assessment",
        "content": raw_output,
    }
@app.post(
    "/api/teacher/{teacher_id}/session/{session_id}/image_generation",
    tags=["Content Generation"],
    summary="Generates an educational image based on a detailed schema.",
)
async def image_generation_endpoint(
    teacher_id: str,
    session_id: str,
    schema: ImageGenSchema
):
    """
    Generates an image using a schema, ideal for creating educational visuals like
    diagrams, charts, or illustrations with specific labels and styles.
    """
    await SessionManager.get_session(session_id)
    
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


class AddDocumentsRequest(BaseModel):
    """Request schema for adding documents by URL."""
    documents: List[Dict[str, Any]] = Field(..., description="List of documents with file_url, filename, file_type, id, size")


@app.post("/api/session/teacher/{teacher_id}/add-documents")
async def add_documents_by_url(
    teacher_id: str,
    payload: AddDocumentsRequest,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add documents by URL for AI Tutor.
    Downloads documents, extracts text, chunks, and embeds into Qdrant.
    """
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
            
            logger.info(f"[DOC EMBEDDING] Processing document {index + 1}/{len(documents)}: {filename}")
            print(f"[DOC EMBEDDING] 📄 Starting processing: {filename} from URL: {file_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=30.0)
                response.raise_for_status()
                file_content = response.content
                logger.info(f"[DOC EMBEDDING] Downloaded {len(file_content)} bytes from {filename}")
                print(f"[DOC EMBEDDING] ✅ Downloaded {len(file_content)} bytes from {filename}")
            
            file_extension = filename.split('.')[-1].lower() if '.' in filename else ''
            
            text = ""
            print(f"[DOC EMBEDDING] 🔍 Extracting text from {filename} (type: {file_extension})")
            if file_extension == 'pdf' or 'pdf' in file_type.lower():
                text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from PDF")
            elif file_extension == 'docx' or 'wordprocessingml' in file_type.lower():
                text = await asyncio.to_thread(extract_text_from_docx, file_content)
                print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from DOCX")
            elif file_extension == 'json' or 'json' in file_type.lower():
                text = extract_text_from_json(file_content)
                print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from JSON")
            else:
                text = extract_text_from_txt(file_content)
                print(f"[DOC EMBEDDING] 📄 Extracted {len(text)} characters from TXT")
            
            if not text.strip():
                logger.warning(f"[DOC EMBEDDING] No text content extracted from {filename}")
                print(f"[DOC EMBEDDING] ⚠️ WARNING: No text content extracted from {filename}")
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
            
            print(f"[DOC EMBEDDING] 💾 Storing document in Qdrant for teacher_id: {teacher_id}, collection: user_docs")
            logger.info(f"[DOC EMBEDDING] Storing document in Qdrant for teacher_id: {teacher_id}")
            success = await store_documents(
                teacher_id=teacher_id,
                documents=[document],
                collection_type="user_docs",
                is_hybrid=False,
                clear_existing=False,
                metadata={"source_url": file_url, "file_type": file_extension, "doc_id": doc_id, "filename": filename}
            )
            
            if success:
                print(f"[DOC EMBEDDING] ✅ Successfully embedded document {filename} in Qdrant")
                processed_doc = {
                    "id": doc_id,
                    "filename": filename,
                    "file_url": file_url,
                    "file_type": file_extension or "txt",
                    "size": doc.get("size", len(file_content))
                }
                logger.info(f"Successfully processed and embedded {filename}")
                return processed_doc
            else:
                logger.error(f"[DOC EMBEDDING] Failed to store {filename} in Qdrant")
                print(f"[DOC EMBEDDING] ❌ ERROR: Failed to store {filename} in Qdrant")
                return None
                
        except Exception as e:
            logger.error(f"Error processing {doc.get('filename', 'unknown')}: {e}", exc_info=True)
            return None
    
    logger.info(f"[DOC EMBEDDING] Starting parallel processing of {len(documents)} documents...")
    print(f"[DOC EMBEDDING] 🚀 Starting parallel processing of {len(documents)} documents for teacher_id: {teacher_id}")
    doc_tasks = [process_single_document(doc, i) for i, doc in enumerate(documents)]
    results = await asyncio.gather(*doc_tasks, return_exceptions=True)
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"[DOC EMBEDDING] Document {i + 1} raised exception: {result}")
            print(f"[DOC EMBEDDING] ❌ Document {i + 1} raised exception: {result}")
        elif result is not None:
            processed_docs.append(result)
    
    if "uploaded_docs" not in session:
        session["uploaded_docs"] = []
    
    session["uploaded_docs"].extend(processed_docs)
    await SessionManager.update_session(current_session_id, session)
    
    logger.info(f"[DOC EMBEDDING] Successfully processed {len(processed_docs)}/{len(documents)} documents")
    print(f"[DOC EMBEDDING] ✅ COMPLETE: Successfully processed {len(processed_docs)}/{len(documents)} documents")
    
    return {
        "message": f"Added {len(processed_docs)} documents",
        "documents": processed_docs,
        "session_id": current_session_id
    }


@app.get("/api/session/teacher/{teacher_id}/documents")
async def get_documents(
    teacher_id: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Get all documents for a session"""
    current_session_id = await SessionManager.create_session(teacher_id, session_id)
    session = await SessionManager.get_session(current_session_id)
    
    return {
        "uploaded_docs": session.get("uploaded_docs", []),
        "session_id": current_session_id
    }


async def process_document_from_url(url: str, teacher_id: str) -> Dict[str, Any]:
    """Process document from URL: download, extract text, and store in Qdrant"""
    try:
        logger.info(f"Processing document from URL: {url}")
        
        return {
            "success": True,
            "content": "Document will be processed in orchestrator",
            "file_type": url.split('.')[-1].lower() if '.' in url else 'txt',
            "url": url
        }
        
    except Exception as e:
        logger.error(f"Error processing document: {e}", exc_info=True)
        return {"success": False, "content": ""}


@app.post(
    "/api/session/teacher/{teacher_id}/stream-chat"
)
async def ai_tutor_stream_chat(
    teacher_id: str,
    payload: AITutorRequest,
    session_id: Optional[str] = None,
    stream: bool = True,
) -> StreamingResponse:
    """
    AI Tutor streaming chat endpoint.
    Accepts teacher data, student data, topic, and user message.
    Streams the AI Tutor response using Server-Sent Events.
    """
    current_session_id = await SessionManager.create_session(teacher_id, session_id)
    session = await SessionManager.get_session(current_session_id)
    
    print(f"[CHAT ENDPOINT] 📥 Received chat request - teacher_id: {teacher_id}, session_id: {current_session_id}")
    print(f"[CHAT ENDPOINT] 📝 Message: {payload.message[:100]}...")
    print(f"[CHAT ENDPOINT] 📎 doc_url: {payload.doc_url}")
    
    # Auto-process document if doc_url is provided
    if payload.doc_url:
        print(f"[CHAT ENDPOINT] 🔗 Document URL provided: {payload.doc_url}")
        if "uploaded_docs" not in session:
            session["uploaded_docs"] = []
        
        # Check if document is already processed (has an "id" field which means it was embedded)
        doc_already_processed = any(
            (doc.get("url") == payload.doc_url or doc.get("file_url") == payload.doc_url) 
            and doc.get("id") is not None  # If it has an ID, it was processed
            for doc in session["uploaded_docs"]
        )
        
        if not doc_already_processed:
            print(f"[CHAT ENDPOINT] ⚡ Document not yet processed. Auto-processing and embedding...")
            try:
                # Extract filename from URL
                filename = payload.doc_url.split('/')[-1].split('?')[0]  # Remove query params
                file_extension = filename.split('.')[-1].lower() if '.' in filename else 'txt'
                doc_id = str(uuid4())
                
                print(f"[CHAT ENDPOINT] 📥 Downloading document: {filename}")
                async with httpx.AsyncClient() as client:
                    response = await client.get(payload.doc_url, timeout=30.0)
                    response.raise_for_status()
                    file_content = response.content
                    print(f"[CHAT ENDPOINT] ✅ Downloaded {len(file_content)} bytes")
                
                # Extract text
                print(f"[CHAT ENDPOINT] 🔍 Extracting text from {filename} (type: {file_extension})")
                text = ""
                if file_extension == 'pdf':
                    text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                elif file_extension == 'docx':
                    text = await asyncio.to_thread(extract_text_from_docx, file_content)
                elif file_extension == 'json':
                    text = extract_text_from_json(file_content)
                else:
                    text = extract_text_from_txt(file_content)
                
                if not text.strip():
                    print(f"[CHAT ENDPOINT] ⚠️ WARNING: No text extracted from {filename}")
                else:
                    print(f"[CHAT ENDPOINT] ✅ Extracted {len(text)} characters from {filename}")
                    
                    # Create document and embed
                    from langchain_core.documents import Document
                    doc_metadata = {
                        "source": payload.doc_url,
                        "file_type": file_extension,
                        "doc_id": doc_id,
                        "filename": filename,
                    }
                    document = Document(page_content=text, metadata=doc_metadata)
                    
                    print(f"[CHAT ENDPOINT] 💾 Embedding document in Qdrant...")
                    success = await store_documents(
                        teacher_id=teacher_id,
                        documents=[document],
                        collection_type="user_docs",
                        is_hybrid=False,
                        clear_existing=False,
                        metadata={"source_url": payload.doc_url, "file_type": file_extension, "doc_id": doc_id, "filename": filename}
                    )
                    
                    if success:
                        print(f"[CHAT ENDPOINT] ✅ Successfully embedded document in Qdrant")
                        # Add to session with processed flag
                        session["uploaded_docs"].append({
                            "url": payload.doc_url,
                            "file_url": payload.doc_url,
                            "file_type": file_extension,
                            "id": doc_id,
                            "filename": filename,
                            "processed": True,
                            "size": len(file_content)
                        })
                        await SessionManager.update_session(current_session_id, session)
                    else:
                        print(f"[CHAT ENDPOINT] ❌ Failed to embed document in Qdrant")
                        # Still add to session but mark as not processed
                        session["uploaded_docs"].append({
                            "url": payload.doc_url,
                            "file_type": file_extension,
                            "processed": False
                        })
                        await SessionManager.update_session(current_session_id, session)
            except Exception as e:
                logger.error(f"[CHAT ENDPOINT] Error auto-processing document: {e}", exc_info=True)
                print(f"[CHAT ENDPOINT] ❌ ERROR auto-processing document: {e}")
                # Add to session anyway but mark as not processed
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
    langchain_messages = []
    
    for msg in session_messages:
        if msg.get("role") == "user":
            langchain_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            langchain_messages.append(AIMessage(content=msg.get("content", "")))
    
    langchain_messages.append(HumanMessage(content=payload.message))
    
    session_messages.append({"role": "user", "content": payload.message})
    
    print(f"[CHAT ENDPOINT] 🎯 Creating graph state with doc_url: {payload.doc_url}")
    print(f"[CHAT ENDPOINT] 👤 Teacher ID: {teacher_id}, Topic: {payload.topic}, Subject: {payload.subject}")
    
    state: GraphState = {
        "messages": langchain_messages,
        "user_query": payload.message,
        "teacher_id": teacher_id,
        "student_data": payload.student_data,
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
    
    print(f"[CHAT ENDPOINT] ✅ Graph state created. doc_url in state: {state.get('doc_url')}")
    
    async def generate_stream():
        try:
            final_state = None
            stream_error_message = None
            
            async def run_graph():
                nonlocal final_state, stream_error_message
                try:
                    logger.info("Starting AI Tutor graph execution")
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
                    "token_usage": token_usage,
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
            if state.get("route"):
                session["last_route"] = state["route"]
            
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "false").lower() == "true",
    )
