import asyncio
import json
import logging
import os
import base64
from typing import Optional, Dict, Any
from fractions import Fraction
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

# Import the prompt generator
from .student_prompt.student_voice_prompt import get_study_buddy_prompt

# Configure Logging
logger = logging.getLogger("StudyBuddy")
logging.basicConfig(level=logging.INFO)

GEMINI_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Mapping frontend voice names to Gemini models
# 'Aoede' (Shimmer) is generally the calmest/clearest for students.
VOICE_MAPPING = {
    "alloy": "Puck",
    "echo": "Charon",
    "shimmer": "Aoede" 
}

class GeminiAudioTrack(MediaStreamTrack):
    """
    Robust Audio Track with 'Silence Injection' to prevent cutoffs.
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.q = asyncio.Queue()
        self.rate = 24000
        self.pts = 0
        self.frame_size_bytes = 960  # 20ms at 24kHz
        self.buffer = bytearray()
        self.silence_frame = b'\x00' * self.frame_size_bytes

    def add_audio_chunk(self, pcm_data: bytes):
        self.q.put_nowait(pcm_data)

    async def recv(self):
        # OPTIMIZED: Better buffering logic to prevent mid-sentence cutoffs
        try:
            # If buffer is low, try to fetch more data
            if len(self.buffer) < self.frame_size_bytes:
                if self.q.empty():
                    try:
                        # Wait a tiny bit (0.1s) for network packets to arrive
                        # This prevents "choppy" audio if packets are slightly delayed
                        new_data = await asyncio.wait_for(self.q.get(), timeout=0.1)
                        self.buffer.extend(new_data)
                    except asyncio.TimeoutError:
                        # Truly no data? Send silence to keep connection alive
                        self.buffer.extend(self.silence_frame)
                else:
                    # Drain queue to fill buffer
                    while len(self.buffer) < self.frame_size_bytes and not self.q.empty():
                        new_data = await self.q.get()
                        self.buffer.extend(new_data)
        except Exception as e:
            # If audio fails, log but don't crash
            logger.error(f"Audio Track Error: {e}")
            pass

        # Extract one frame
        frame_data = self.buffer[:self.frame_size_bytes]
        del self.buffer[:self.frame_size_bytes]

        # Handle edge case: Buffer underrun (fill with silence)
        if len(frame_data) < self.frame_size_bytes:
            padding = self.frame_size_bytes - len(frame_data)
            frame_data.extend(b'\x00' * padding)

        # Convert to AudioFrame
        np_data = np.frombuffer(frame_data, dtype=np.int16).reshape(1, -1)
        frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
        frame.sample_rate = self.rate
        frame.pts = self.pts
        frame.time_base = Fraction(1, self.rate)
        self.pts += len(frame_data) // 2
        return frame

class StudyBuddyBridge:
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
            channel.send(json.dumps({"type": "status", "message": "Connecting to Gemini..."}))

        @self.pc_client.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"🕸️ WebRTC State: {self.pc_client.connectionState}")
            if self.pc_client.connectionState == "failed":
                await self.disconnect()

        try:
            url = f"{GEMINI_URL}?key={self.api_key}"
            # Keep-Alive: Ping every 10s to stop Google from closing the socket
            self.gemini_ws = await websockets.connect(url, ping_interval=10, ping_timeout=10)
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

    async def _send_initial_setup(self):
        name = self.context_data.get("student_name", "Student")
        subject = self.context_data.get("subject", "General")
        grade = self.context_data.get("grade", "Learning")
        pending_tasks = self.context_data.get("pending_assignments", "None")
        extra_inst = self.context_data.get("instructions", "")
        frontend_voice = self.context_data.get("voice", "shimmer")
        
        # Default to 'Aoede' (Shimmer) if unknown, as it's the calmest
        voice = VOICE_MAPPING.get(frontend_voice, "Aoede")

        sys_prompt = get_study_buddy_prompt(
            name=name,
            subject=subject,
            grade=grade,
            pending_tasks=pending_tasks,
            extra_inst=extra_inst
        )

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
                # Request text transcripts so the UI updates
                "inputAudioTranscription": {},
                "outputAudioTranscription": {} 
            }
        }
        
        await self.gemini_ws.send(json.dumps(setup_msg))

    async def _send_initial_greeting(self):
        msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": "Say a brief, calm hello."}]
                }],
                "turnComplete": True
            }
        }
        await self.gemini_ws.send(json.dumps(msg))

    async def _process_incoming_audio(self, track):
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
            logger.debug(f"Audio Input Ended: {e}")

    async def _receive_from_gemini(self):
        try:
            async for raw_msg in self.gemini_ws:
                try:
                    response = json.loads(raw_msg)
                except: 
                    continue
                
                # Setup Complete?
                if "setupComplete" in response:
                    logger.info("✅ Gemini Setup Complete")
                    self.session_active = True
                    if self.client_dc:
                        self.client_dc.send(json.dumps({"type": "status", "message": "Connected!"}))
                    asyncio.create_task(self._send_initial_greeting())
                    continue

                server_content = response.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    
                    # 1. Audio Data
                    if model_turn:
                        for part in model_turn.get("parts", []):
                            inline_data = part.get("inlineData")
                            if inline_data:
                                pcm_data = base64.b64decode(inline_data.get("data"))
                                self.gemini_track.add_audio_chunk(pcm_data)

                    # 2. Assistant Text
                    output_transcript = server_content.get("outputTranscription")
                    if output_transcript:
                        text = output_transcript.get("text") if isinstance(output_transcript, dict) else output_transcript
                        if text:
                            self.current_transcript += text
                            if self.client_dc:
                                self.client_dc.send(json.dumps({
                                    "type": "response.audio_transcript.chunk",
                                    "transcript": self.current_transcript 
                                }))

                    # 3. User Text (Corrected)
                    input_transcript = server_content.get("inputTranscription")
                    if input_transcript:
                        text = input_transcript.get("text") if isinstance(input_transcript, dict) else input_transcript
                        if text and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "input.audio_transcript.done",
                                "transcript": text
                            }))

                    # 4. End of Turn
                    if server_content.get("turnComplete"):
                        if self.current_transcript.strip() and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.done",
                                "transcript": self.current_transcript.strip()
                            }))
                            self.current_transcript = ""

        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"WebSocket Closed: {e}")
            self.session_active = False
            await self.disconnect()
        except Exception as e:
            # CRITICAL FIX: Do NOT disconnect on minor errors (like weird JSON)
            # Just log it and keep listening.
            logger.error(f"Receive Error (Non-Fatal): {e}")

    async def disconnect(self):
        if not self.session_active: return
        self.session_active = False
        logger.info("🔌 Disconnecting Study Buddy...")
        if self.processing_task: self.processing_task.cancel()
        if self.gemini_ws: await self.gemini_ws.close()
        if self.pc_client: await self.pc_client.close()