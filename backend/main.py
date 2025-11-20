"""FastAPI entrypoint for teacher content generation services."""

from __future__ import annotations

import asyncio
import inspect
import json
import os
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, PositiveInt, validator

from teacher.Content_generation.lesson_plan import generate_lesson_plan
from teacher.Content_generation.presentation import generate_presentation
from teacher.Content_generation.Quizz import generate_quizz
from teacher.Content_generation.worksheet import generate_worksheet


load_dotenv()

BASE_DIR = Path(__file__).parent


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "false").lower() == "true",
    )
