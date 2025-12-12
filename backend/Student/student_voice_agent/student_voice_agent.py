import asyncio
import json
import logging
import os
import base64
from typing import Optional, Dict, Any
from fractions import Fraction
from .student_prompt.student_voice_prompt import get_study_buddy_prompt

import websockets
from aiortc import (
    RTCPeerConnection, 
    RTCSessionDescription, 
    RTCConfiguration, 
    RTCIceServer,
    MediaStreamTrack
)
import av
import numpy as np

# --- RAG IMPORTS ---
try:
    from backend.teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
    from backend.utils.dsa_utils import ContentDeduplicator
except ImportError:
    from teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
    try:
        from utils.dsa_utils import ContentDeduplicator
    except ImportError:
        class ContentDeduplicator:
            def __init__(self): self.seen_hashes = set()
            def is_duplicate(self, t): 
                import hashlib
                h = hashlib.sha256(t.strip().encode('utf-8')).hexdigest()
                if h in self.seen_hashes: return True
                self.seen_hashes.add(h)
                return False

# Configure Logging
logger = logging.getLogger("StudyBuddy")
logging.basicConfig(level=logging.INFO)

# Gemini Configuration
GEMINI_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Map frontend voice names to Gemini voice names
VOICE_MAPPING = {
    "alloy": "Puck",
    "echo": "Charon",
    "shimmer": "Aoede"
}

class GeminiAudioTrack(MediaStreamTrack):
    """
    A WebRTC Audio Track that buffers Gemini audio to ensure smooth playback.
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.q = asyncio.Queue()
        self.rate = 24000  # Gemini Native Rate
        self.pts = 0
        self.frame_size_bytes = 960 
        self.buffer = bytearray()

    def add_audio_chunk(self, pcm_data: bytes):
        self.q.put_nowait(pcm_data)

    async def recv(self):
        while len(self.buffer) < self.frame_size_bytes:
            try:
                new_data = await self.q.get()
                self.buffer.extend(new_data)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                break

        frame_data = self.buffer[:self.frame_size_bytes]
        del self.buffer[:self.frame_size_bytes]

        if len(frame_data) < self.frame_size_bytes:
            padding = self.frame_size_bytes - len(frame_data)
            frame_data.extend(b'\x00' * padding)

        np_data = np.frombuffer(frame_data, dtype=np.int16).reshape(1, -1)
        frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
        frame.sample_rate = self.rate
        frame.pts = self.pts
        frame.time_base = Fraction(1, self.rate)
        self.pts += len(frame_data) // 2
        return frame

class StudyBuddyBridge:
    """
    Acts as a Bridge between WebRTC (Browser) and WebSocket (Gemini 2.5 Flash).
    """
    def __init__(self, api_key: str = None):
        self.api_key = GEMINI_API_KEY or api_key
        self.pc_client: Optional[RTCPeerConnection] = None
        self.gemini_ws = None
        self.gemini_track = GeminiAudioTrack()
        self.processing_task = None
        self.context_data = {}
        self.client_dc = None
        self.session_active = False
        self.current_transcript = ""

    async def connect(self, offer_sdp: str, context_data: Dict[str, Any], voice: str = "Puck") -> Dict[str, str]:
        self.context_data = context_data
        self.context_data["voice"] = voice
        
        self.pc_client = RTCPeerConnection(RTCConfiguration(
            iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
        ))

        self.pc_client.addTrack(self.gemini_track)

        @self.pc_client.on("track")
        def on_track(track):
            if track.kind == "audio":
                logger.info("🎤 Received Student Audio Track")
                asyncio.create_task(self._process_incoming_audio(track))

        @self.pc_client.on("datachannel")
        def on_datachannel(channel):
            logger.info("📡 Student DataChannel opened")
            self.client_dc = channel
            channel.send(json.dumps({"type": "status", "message": "Connecting to Gemini 2.5..."}))

        try:
            url = f"{GEMINI_URL}?key={self.api_key}"
            self.gemini_ws = await websockets.connect(url, ping_interval=None)
            logger.info("✅ Connected to Gemini WebSocket")
            
            self.processing_task = asyncio.create_task(self._receive_from_gemini())
            await self._send_initial_setup()
            
        except Exception as e:
            logger.error(f"Gemini Connection Failed: {e}")
            raise

        await self.pc_client.setRemoteDescription(RTCSessionDescription(sdp=offer_sdp, type="offer"))
        answer = await self.pc_client.createAnswer()
        await self.pc_client.setLocalDescription(answer)

        return {
            "sdp": self.pc_client.localDescription.sdp,
            "type": self.pc_client.localDescription.type
        }

    # --- RAG SEARCH IMPLEMENTATION ---
    async def _perform_rag_search(self, query: str, user_language: str = "English") -> str:
        """
        Executes RAG search using knowledge base. Only works if subject is selected.
        Returns context or error message.
        """
        try:
            grade = str(self.context_data.get("grade", "")).strip()
            subject = str(self.context_data.get("subject", "")).strip()
            
            logger.info(f"🔎 Voice RAG Search: '{query}' | Grade: {grade} | Subject: {subject}")

            # Check if subject is selected
            if not subject or subject.lower() in ["", "general", "all", "none"]:
                if user_language.lower() == "hindi":
                    return "विषय चयनित नहीं है। कृपया पहले एक विषय चुनें।"
                return "No subject selected. Please select a subject first to search the knowledge base."

            if not grade:
                if user_language.lower() == "hindi":
                    return "ग्रेड जानकारी उपलब्ध नहीं है।"
                return "Grade information not available."

            # Determine language for collection (default to English unless subject is Hindi)
            language = "English"
            if subject and subject.lower() == "hindi":
                language = "Hindi"

            # Construct Collection Name (matching simple_llm.py logic)
            subject_normalized = subject.lower().replace(" ", "_")
            lang_code = LANGUAGES.get(language, language).lower()
            collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
            
            logger.info(f"📚 Searching Collection: {collection_name}")

            # Perform Search - Retrieve only 3 chunks
            kb_retrieved_contexts = await retrieve_kb_context(collection_name, query, top_k=3)
            
            # Deduplicate
            if kb_retrieved_contexts:
                deduplicator = ContentDeduplicator()
                unique_contexts = []
                for text in kb_retrieved_contexts:
                    if text and not deduplicator.is_duplicate(text):
                        unique_contexts.append(text)
                kb_retrieved_contexts = unique_contexts
                
                result_text = "\n\n".join(kb_retrieved_contexts)
                logger.info(f"✅ RAG Found {len(kb_retrieved_contexts)} results")
                return f"CONTEXT FOUND IN KNOWLEDGE BASE:\n{result_text}"
            else:
                logger.warning(f"⚠️ No results found in {collection_name}")
                if user_language.lower() == "hindi":
                    return "ज्ञान आधार में कोई प्रासंगिक जानकारी नहीं मिली।"
                return "No relevant information found in the knowledge base."

        except Exception as e:
            logger.error(f"❌ RAG Error: {e}")
            if user_language.lower() == "hindi":
                return f"ज्ञान आधार खोज में त्रुटि: {str(e)}"
            return f"Error searching knowledge base: {str(e)}"

    async def _send_initial_setup(self):
        """Configures Gemini with model, tools, and transcription."""
        
        name = self.context_data.get("student_name", "Student")
        subject = self.context_data.get("subject", "General")
        grade = self.context_data.get("grade", "Learning")
        pending_tasks = self.context_data.get("pending_assignments", "No specific pending assignments listed")
        extra_inst = self.context_data.get("instructions", "")
        frontend_voice = self.context_data.get("voice", "alloy")
        
        voice = VOICE_MAPPING.get(frontend_voice, "Puck")

        sys_prompt = get_study_buddy_prompt(
            name=name,
            subject=subject,
            grade=grade,
            pending_tasks=pending_tasks,
            extra_inst=extra_inst
        )
        
        # --- DEFINE RAG TOOL (only if subject is selected) ---
        tools = []
        subject = str(self.context_data.get("subject", "")).strip()
        
        # Only enable RAG tool if subject is selected and not "General" or "all"
        if subject and subject.lower() not in ["", "general", "all", "none"]:
            tools = [
                {
                    "functionDeclarations": [
                        {
                            "name": "search_knowledge_base",
                            "description": f"MANDATORY: Search the {grade} {subject} textbook/curriculum for ANY factual question, definition, explanation, or concept. E.g., 'What is a metal?', 'Explain Newton's laws'. You must use this tool to get accurate textbook definitions before answering.",
                            "parameters": {
                                "type": "OBJECT",
                                "properties": {
                                    "query": {
                                        "type": "STRING",
                                        "description": f"The specific {subject} concept, term, or question to search for."
                                    }
                                },
                                "required": ["query"]
                            }
                        }
                    ]
                }
            ]
            logger.info(f"✅ RAG Tool enabled for subject: {subject}")
        else:
            logger.info(f"⚠️ RAG Tool disabled - no subject selected (subject: '{subject}')")

        setup_msg = {
            "setup": {
                "model": "models/gemini-2.5-flash-native-audio-preview-09-2025",
                "tools": tools,  # <--- Attach Tools
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": voice
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [{"text": sys_prompt}]
                },
                "outputAudioTranscription": {}, 
                "inputAudioTranscription": {}   
            }
        }
        
        logger.info(f"📤 Sending Setup with RAG Tool...")
        try:
            await self.gemini_ws.send(json.dumps(setup_msg))
        except Exception as e:
            logger.error(f"Failed to send setup message: {e}")
            raise

    async def _send_initial_greeting(self):
        """Triggers the model to say hello in English (default)."""
        logger.info("👋 Sending initial greeting trigger...")
        msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": "Say hello in English. Keep it brief and wait for me to speak so you can match my language."}]
                }],
                "turnComplete": True
            }
        }
        try:
            await self.gemini_ws.send(json.dumps(msg))
        except Exception as e:
            logger.error(f"Failed to send greeting trigger: {e}")

    async def _process_incoming_audio(self, track):
        """Reads WebRTC audio, resamples to 16k, sends to Gemini."""
        resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
        try:
            while True:
                frame = await track.recv()
                if not self.session_active:
                    continue

                frame_bytes = b""
                for resampled_frame in resampler.resample(frame):
                    frame_bytes += resampled_frame.to_ndarray().tobytes()
                
                if frame_bytes:
                    msg = {
                        "realtimeInput": {
                            "mediaChunks": [{
                                "mimeType": "audio/pcm",
                                "data": base64.b64encode(frame_bytes).decode('utf-8')
                            }]
                        }
                    }
                    await self.gemini_ws.send(json.dumps(msg))
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Audio Input Error: {error_msg}")
            # Don't crash the session on transient audio errors, but log them
            if "AudioResampler" in error_msg: 
                # This might be a critical ffmpeg/av error
                pass

    async def _receive_from_gemini(self):
        """Receives Audio, Text, and Tool Requests from Gemini."""
        try:
            async for raw_msg in self.gemini_ws:
                try:
                    response = json.loads(raw_msg)
                except json.JSONDecodeError:
                    continue
                
                if "error" in response:
                    logger.error(f"❌ Gemini API Error: {response['error']}")
                    continue
                
                if "setupComplete" in response:
                    logger.info("✅ Gemini Setup Complete")
                    self.session_active = True
                    if self.client_dc:
                        self.client_dc.send(json.dumps({"type": "status", "message": "Connected!"}))
                    
                    asyncio.create_task(self._send_initial_greeting())
                    continue

                # --- 1. HANDLE TOOL USE (RAG) --- 
                tool_use = response.get("toolUse")
                if tool_use:
                    function_calls = tool_use.get("functionCalls", [])
                    for call in function_calls:
                        fn_name = call.get("name")
                        fn_args = call.get("args", {})
                        call_id = call.get("id")

                        if fn_name == "search_knowledge_base":
                            query = fn_args.get("query")
                            logger.info(f"🛠️ RAG Tool Requested: {fn_name} | Query: {query}")
                            
                            # Detect user language from recent transcription for status message
                            user_language = "English"  # Default
                            # Try to detect from context or recent input
                            
                            # Send status message to frontend (in user's language if possible)
                            status_msg = "Searching knowledge base..."
                            if self.client_dc:
                                self.client_dc.send(json.dumps({
                                    "type": "rag_status",
                                    "status": "searching",
                                    "message": status_msg,
                                    "query": query
                                }))

                            # Execute RAG Search
                            search_result = await self._perform_rag_search(query, user_language)
                            
                            # Send completion status
                            if self.client_dc:
                                if "CONTEXT FOUND" in search_result:
                                    self.client_dc.send(json.dumps({
                                        "type": "rag_status",
                                        "status": "found",
                                        "message": "Found relevant information. Preparing answer..."
                                    }))
                                else:
                                    self.client_dc.send(json.dumps({
                                        "type": "rag_status",
                                        "status": "not_found",
                                        "message": "No specific information found. Answering from general knowledge..."
                                    }))

                            # Send Result back to Gemini
                            tool_response_msg = {
                                "toolResponse": {
                                    "functionResponses": [
                                        {
                                            "name": fn_name,
                                            "id": call_id,
                                            "response": {
                                                "result": search_result
                                            }
                                        }
                                    ]
                                }
                            }
                            await self.gemini_ws.send(json.dumps(tool_response_msg))
                    continue # Skip processing rest of message if it was a tool request

                # --- 2. STANDARD RESPONSE HANDLING (Audio & Text) ---
                server_content = response.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    
                    # Audio
                    if model_turn:
                        for part in model_turn.get("parts", []):
                            inline_data = part.get("inlineData")
                            if inline_data and inline_data.get("mimeType").startswith("audio"):
                                pcm_data = base64.b64decode(inline_data.get("data"))
                                self.gemini_track.add_audio_chunk(pcm_data)

                    # Text Transcription (Assistant)
                    output_transcript = server_content.get("outputTranscription")
                    transcript_text = None

                    if output_transcript:
                        if isinstance(output_transcript, str):
                            transcript_text = output_transcript
                        elif isinstance(output_transcript, dict):
                            transcript_text = output_transcript.get("text")
                    
                    if transcript_text:
                        self.current_transcript += transcript_text
                        if self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.chunk",
                                "transcript": self.current_transcript 
                            }))

                    # User Input Transcription
                    input_transcript = server_content.get("inputTranscription")
                    if input_transcript:
                        user_text = None
                        if isinstance(input_transcript, str):
                            user_text = input_transcript
                        elif isinstance(input_transcript, dict):
                            user_text = input_transcript.get("text") or input_transcript.get("transcript")
                        
                        if user_text and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "input.audio_transcript.done",
                                "transcript": user_text
                            }))

                    if server_content.get("turnComplete"):
                        if self.current_transcript.strip() and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.done",
                                "transcript": self.current_transcript.strip()
                            }))
                            self.current_transcript = ""

        except Exception as e:
            logger.error(f"Receive Error: {e}")
            self.session_active = False

    async def disconnect(self):
        self.session_active = False
        if self.processing_task:
            self.processing_task.cancel()
        if self.gemini_ws:
            await self.gemini_ws.close()
        if self.pc_client:
            await self.pc_client.close()
        logger.info("🔌 Study Buddy Bridge Closed")