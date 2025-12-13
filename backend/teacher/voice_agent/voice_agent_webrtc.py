import asyncio
import json
import logging
import os
import base64
from typing import Optional, Dict, Any
from fractions import Fraction
from .teacher_prompt.teacher_voice_prompt import get_teaching_assistant_prompt

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

# Configure Logging
logger = logging.getLogger("VoiceAgent")
logging.basicConfig(level=logging.INFO)

# Gemini Configuration
GEMINI_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Map frontend voice names to Gemini voice names
VOICE_MAPPING = {
    "alloy": "Puck",      # Default neutral voice
    "echo": "Charon",     # Male voice
    "shimmer": "Aoede"    # Female voice
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
        
        # Audio Configuration
        # 24000 Hz * 0.02s (20ms) = 480 samples
        # 480 samples * 2 bytes/sample = 960 bytes per frame
        self.frame_size_bytes = 960 
        self.buffer = bytearray()

    def add_audio_chunk(self, pcm_data: bytes):
        """Called when raw PCM bytes arrive from Gemini."""
        self.q.put_nowait(pcm_data)

    async def recv(self):
        """Called by aiortc to get the next audio frame."""
        
        # 1. Fill buffer
        while len(self.buffer) < self.frame_size_bytes:
            try:
                new_data = await self.q.get()
                self.buffer.extend(new_data)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Error buffering audio: {e}")
                break

        # 2. Slice one frame
        frame_data = self.buffer[:self.frame_size_bytes]
        del self.buffer[:self.frame_size_bytes]

        # 3. Pad if needed
        if len(frame_data) < self.frame_size_bytes:
            padding = self.frame_size_bytes - len(frame_data)
            frame_data.extend(b'\x00' * padding)

        # 4. Create AudioFrame
        np_data = np.frombuffer(frame_data, dtype=np.int16).reshape(1, -1)
        
        frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
        frame.sample_rate = self.rate
        frame.pts = self.pts
        frame.time_base = Fraction(1, self.rate)
        
        self.pts += len(frame_data) // 2
        return frame

class VoiceAgentBridge:
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
        
        # 1. Initialize WebRTC
        self.pc_client = RTCPeerConnection(RTCConfiguration(
            iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
        ))

        # 2. Add Audio Track (Output)
        self.pc_client.addTrack(self.gemini_track)

        # 3. Handle Audio IN
        @self.pc_client.on("track")
        def on_track(track):
            if track.kind == "audio":
                logger.info("🎤 Received Client Audio Track")
                asyncio.create_task(self._process_incoming_audio(track))

        # 4. Handle Data Channel
        @self.pc_client.on("datachannel")
        def on_datachannel(channel):
            logger.info("📡 Client DataChannel opened")
            self.client_dc = channel
            channel.send(json.dumps({"type": "status", "message": "Connecting to Gemini 2.5..."}))

        # 5. Connect to Gemini
        try:
            url = f"{GEMINI_URL}?key={self.api_key}"
            self.gemini_ws = await websockets.connect(url, ping_interval=None)
            logger.info("✅ Connected to Gemini WebSocket")
            
            # Start Receiving Loop
            self.processing_task = asyncio.create_task(self._receive_from_gemini())
            
            # Send Setup
            await self._send_initial_setup()
            
        except Exception as e:
            logger.error(f"Gemini Connection Failed: {e}")
            raise

        # 6. Complete Handshake
        await self.pc_client.setRemoteDescription(RTCSessionDescription(sdp=offer_sdp, type="offer"))
        answer = await self.pc_client.createAnswer()
        await self.pc_client.setLocalDescription(answer)

        return {
            "sdp": self.pc_client.localDescription.sdp,
            "type": self.pc_client.localDescription.type
        }

    async def _send_initial_setup(self):
        """Configures Gemini with model and transcription enabled."""
        
        name = self.context_data.get("teacher_name", "Teacher")
        grade = self.context_data.get("grade", "General")
        extra_inst = self.context_data.get("instructions", "")
        frontend_voice = self.context_data.get("voice", "alloy")
        
        voice = VOICE_MAPPING.get(frontend_voice, "Puck")

        sys_prompt = get_teaching_assistant_prompt(
            name=name,
            grade=grade,
            extra_inst=extra_inst
        )
        
        logger.info(f"System Prompt Length: {len(sys_prompt) if sys_prompt else 0}")

        setup_msg = {
            "setup": {
                "model": "models/gemini-2.5-flash-native-audio-preview-09-2025", 
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
                "outputAudioTranscription": {}, # Model text (Assistant)
                "inputAudioTranscription": {}   # User text (Auto-detected language)
            }
        }
        
        logger.info(f"📤 Sending Setup with voice: {voice}...")
        try:
            await self.gemini_ws.send(json.dumps(setup_msg))
        except Exception as e:
            logger.error(f"Failed to send setup message: {e}")
            raise

    async def _send_initial_greeting(self):
        """Triggers the model to say hello."""
        logger.info("👋 Sending initial greeting trigger...")
        msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": "Say hello to me efficiently without any internal monologue."}]
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
            logger.error(f"Audio Input Error: {e}")

    async def _receive_from_gemini(self):
        """Receives Audio AND Text from Gemini."""
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
                    
                    # Trigger initial greeting
                    asyncio.create_task(self._send_initial_greeting())
                    continue

                server_content = response.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    if model_turn:
                        parts = model_turn.get("parts", [])
                        for part in parts:
                            # --- AUDIO ---
                            inline_data = part.get("inlineData")
                            if inline_data and inline_data.get("mimeType").startswith("audio"):
                                pcm_data = base64.b64decode(inline_data.get("data"))
                                self.gemini_track.add_audio_chunk(pcm_data)

                    # --- TEXT (Transcription) ---
                    # Logic to capture text from outputTranscription OR modelTurn
                    output_transcript = server_content.get("outputTranscription")
                    transcript_text = None

                    # Check outputTranscription (most common for Live API)
                    if output_transcript:
                        if isinstance(output_transcript, str):
                            transcript_text = output_transcript
                        elif isinstance(output_transcript, dict):
                            transcript_text = output_transcript.get("text")
                    
                    # Fallback: Check modelTurn text parts
                    if not transcript_text and model_turn:
                         for part in model_turn.get("parts", []):
                            if part.get("text"):
                                transcript_text = part.get("text")
                                break
                    
                    if transcript_text:
                        # Filter out internal thoughts/headers if they leak
                        forbidden_phrases = [
                            "Probing Language Preference", 
                            "Thinking Process", 
                            "Greeting the user",
                            "I've been working on",
                            "My goal is to strike"
                        ]
                        
                        if any(phrase in transcript_text for phrase in forbidden_phrases):
                            logger.info(f"🚫 Filtered internal thought: {transcript_text}")
                            continue

                        # Append to current full transcript
                        self.current_transcript += transcript_text
                        
                        # CHANGE: Send self.current_transcript (Accumulated) instead of transcript_text (Delta)
                        if self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.chunk",
                                "transcript": self.current_transcript 
                            }))

                    # --- USER INPUT TRANSCRIPTION (NEW) ---
                    # Gemini auto-detects language and sends what it heard the User say
                    input_transcript = server_content.get("inputTranscription")
                    if input_transcript:
                        user_text = input_transcript.get("text")
                        if user_text and self.client_dc:
                            logger.info(f"👤 User (Gemini Detected): {user_text}")
                            self.client_dc.send(json.dumps({
                                "type": "input.audio_transcript.done", # Special event for user text
                                "transcript": user_text
                            }))

                    # Turn Complete Event
                    if server_content.get("turnComplete"):
                        if self.current_transcript.strip() and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.done",
                                "transcript": self.current_transcript.strip()
                            }))
                            self.current_transcript = ""  # Reset for next turn

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