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
    FIXED: Handles burst audio delivery from Gemini without timeouts.
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.q = asyncio.Queue()
        self.rate = 24000  # Gemini Native Rate
        self.pts = 0
        
        # Audio Configuration
        self.samples_per_frame = 480  # 20ms at 24kHz
        self.frame_size_bytes = 960   # 480 samples * 2 bytes
        self.buffer = bytearray()
        
        # Tracking
        self.chunks_received = 0
        self.bytes_received = 0
        self.frames_sent = 0
        
        # Control flags
        self.is_speaking = False  # True when AI is actively speaking
        self.end_of_response = asyncio.Event()  # Signals response complete

    def add_audio_chunk(self, pcm_data: bytes):
        """Called when raw PCM bytes arrive from Gemini."""
        if not pcm_data:
            return
            
        try:
            # Mark that we're receiving audio
            self.is_speaking = True
            
            asyncio.create_task(self.q.put(pcm_data))
            self.chunks_received += 1
            self.bytes_received += len(pcm_data)
            logger.info(f"📦 Queued chunk #{self.chunks_received}: {len(pcm_data)} bytes")
        except Exception as e:
            logger.error(f"❌ Failed to queue audio: {e}")

    def mark_response_complete(self):
        """Called when turnComplete is received from Gemini."""
        logger.info("✅ Response complete signal received")
        self.end_of_response.set()

    async def recv(self):
        """Called by aiortc to get the next audio frame."""
        
        # Build up buffer to have at least one frame
        while len(self.buffer) < self.frame_size_bytes:
            # Check if we have data in queue
            if not self.q.empty():
                # Drain all available data from queue immediately
                while not self.q.empty():
                    try:
                        new_data = self.q.get_nowait()
                        self.buffer.extend(new_data)
                    except asyncio.QueueEmpty:
                        break
            else:
                # Queue is empty - wait for more data
                try:
                    # CRITICAL: No timeout - wait indefinitely for next chunk
                    # This prevents dropping audio during Gemini's processing delays
                    new_data = await self.q.get()
                    self.buffer.extend(new_data)
                    
                    # After getting data, drain any other chunks that arrived
                    while not self.q.empty():
                        try:
                            additional = self.q.get_nowait()
                            self.buffer.extend(additional)
                        except asyncio.QueueEmpty:
                            break
                            
                except asyncio.CancelledError:
                    # If cancelled and we have partial data, pad and return it
                    if len(self.buffer) > 0:
                        break
                    raise
                except Exception as e:
                    logger.error(f"❌ Error receiving audio: {e}")
                    break

        # Extract one frame
        if len(self.buffer) >= self.frame_size_bytes:
            frame_data = bytes(self.buffer[:self.frame_size_bytes])
            del self.buffer[:self.frame_size_bytes]
        else:
            # Use whatever we have and pad
            frame_data = bytes(self.buffer)
            self.buffer.clear()

        # Pad if needed
        if len(frame_data) < self.frame_size_bytes:
            padding = self.frame_size_bytes - len(frame_data)
            frame_data += b'\x00' * padding
            logger.debug(f"🔇 Padded {padding} bytes")

        # Convert to AudioFrame
        try:
            np_data = np.frombuffer(frame_data, dtype=np.int16).reshape(1, -1)
        except ValueError as e:
            logger.error(f"❌ Frame conversion error: {e}")
            np_data = np.zeros((1, self.samples_per_frame), dtype=np.int16)

        frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
        frame.sample_rate = self.rate
        frame.pts = self.pts
        frame.time_base = Fraction(1, self.rate)
        
        self.pts += self.samples_per_frame
        self.frames_sent += 1
        
        if self.frames_sent % 50 == 0:
            logger.info(f"🎵 Frame #{self.frames_sent}, PTS: {self.pts}, buffer: {len(self.buffer)}b, queue: {self.q.qsize()}")
        
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
        self.is_connecting_gemini = False
        self.current_transcript = "" 

    async def connect(self, offer_sdp: str, context_data: Dict[str, Any], voice: str = "Puck") -> Dict[str, str]:
        self.context_data = context_data
        self.context_data["voice"] = voice
        
        # Configure TURN Servers
        ice_servers = [RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
        
        turn_url = os.getenv("TURN_SERVER_URL")
        turn_user = os.getenv("TURN_SERVER_USERNAME")
        turn_pass = os.getenv("TURN_SERVER_PASSWORD")
        
        if turn_url and turn_user and turn_pass:
            ice_servers.append(RTCIceServer(
                urls=[turn_url],
                username=turn_user,
                credential=turn_pass
            ))
            logger.info("✅ TURN server configured")

        self.pc_client = RTCPeerConnection(RTCConfiguration(iceServers=ice_servers))
        self.pc_client.addTrack(self.gemini_track)

        @self.pc_client.on("track")
        def on_track(track):
            if track.kind == "audio":
                logger.info("🎤 Received Teacher Audio Track")
                asyncio.create_task(self._process_incoming_audio(track))

        @self.pc_client.on("datachannel")
        def on_datachannel(channel):
            logger.info("📡 DataChannel opened")
            self.client_dc = channel
            channel.send(json.dumps({"type": "status", "message": "Connecting to AI..."}))

        @self.pc_client.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"🕸️ WebRTC State: {self.pc_client.connectionState}")
            if self.pc_client.connectionState == "failed":
                await self.disconnect()

        # WebRTC Handshake
        await self.pc_client.setRemoteDescription(RTCSessionDescription(sdp=offer_sdp, type="offer"))
        answer = await self.pc_client.createAnswer()
        await self.pc_client.setLocalDescription(answer)

        # Connect to Gemini in background
        asyncio.create_task(self._connect_to_gemini_async())

        return {
            "sdp": self.pc_client.localDescription.sdp,
            "type": self.pc_client.localDescription.type
        }

    async def _connect_to_gemini_async(self):
        """Connects to Gemini independently of WebRTC."""
        try:
            self.is_connecting_gemini = True
            url = f"{GEMINI_URL}?key={self.api_key}"
            self.gemini_ws = await websockets.connect(url, ping_interval=10, ping_timeout=10)
            logger.info("✅ Connected to Gemini WebSocket")
            
            self.processing_task = asyncio.create_task(self._receive_from_gemini())
            await self._send_initial_setup()
            
        except Exception as e:
            logger.error(f"❌ Gemini connection failed: {e}")
            if self.client_dc:
                self.client_dc.send(json.dumps({"type": "error", "message": "AI unavailable"}))
            await self.disconnect()
        finally:
            self.is_connecting_gemini = False

    async def _send_initial_setup(self):
        """Configures Gemini with model and transcription enabled."""
        
        name = self.context_data.get("teacher_name", "Teacher")
        grade = self.context_data.get("grade", "General")
        extra_inst = self.context_data.get("instructions", "")
        teacher_data = self.context_data.get("teacher_data")
        frontend_voice = self.context_data.get("voice", "alloy")
        
        voice = VOICE_MAPPING.get(frontend_voice, "Puck")

        sys_prompt = get_teaching_assistant_prompt(
            name=name,
            grade=grade,
            extra_inst=extra_inst,
            teacher_data=teacher_data
        )

        setup_msg = {
            "setup": {
                "model": "models/gemini-2.5-flash-native-audio-preview-09-2025",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": { "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": voice } } }
                },
                "systemInstruction": { "parts": [{"text": sys_prompt}] },
                "inputAudioTranscription": {},
                "outputAudioTranscription": {} 
            }
        }
        await self.gemini_ws.send(json.dumps(setup_msg))

    async def _send_initial_greeting(self):
        msg = {
            "clientContent": {
                "turns": [{ "role": "user", "parts": [{"text": "Say a brief, friendly hello at a natural pace."}] }],
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
            logger.debug(f"Audio input ended: {e}")

    async def _receive_from_gemini(self):
        """Receives Audio AND Text from Gemini."""
        try:
            async for raw_msg in self.gemini_ws:
                try:
                    response = json.loads(raw_msg)
                except json.JSONDecodeError:
                    continue
                
                if "error" in response:
                    logger.error(f"❌ Gemini error: {response['error']}")
                    continue
                
                if "setupComplete" in response:
                    logger.info("✅ Gemini setup complete")
                    self.session_active = True
                    if self.client_dc:
                        self.client_dc.send(json.dumps({"type": "status", "message": "Connected!"}))
                    asyncio.create_task(self._send_initial_greeting())
                    continue

                server_content = response.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    
                    # Process audio chunks IN ORDER
                    if model_turn:
                        parts = model_turn.get("parts", [])
                        
                        for idx, part in enumerate(parts):
                            inline_data = part.get("inlineData")
                            if inline_data:
                                mime_type = inline_data.get("mimeType", "")
                                if mime_type.startswith("audio"):
                                    try:
                                        pcm_data = base64.b64decode(inline_data.get("data"))
                                        if pcm_data:
                                            self.gemini_track.add_audio_chunk(pcm_data)
                                            logger.info(f"📦 Part {idx+1}/{len(parts)}: {len(pcm_data)}b")
                                    except Exception as e:
                                        logger.error(f"❌ Decode error part {idx}: {e}")

                    # Text transcription
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

                    # User input transcription
                    input_transcript = server_content.get("inputTranscription")
                    if input_transcript:
                        text = input_transcript.get("text") if isinstance(input_transcript, dict) else input_transcript
                        if text and self.client_dc:
                            logger.info(f"👤 User: {text}")
                            self.client_dc.send(json.dumps({
                                "type": "input.audio_transcript.done",
                                "transcript": text
                            }))

                    # Turn complete - ALL audio has been sent
                    if server_content.get("turnComplete"):
                        logger.info("✅ Turn complete - all audio queued")
                        self.gemini_track.mark_response_complete()
                        
                        if self.current_transcript.strip() and self.client_dc:
                            self.client_dc.send(json.dumps({
                                "type": "response.audio_transcript.done",
                                "transcript": self.current_transcript.strip()
                            }))
                            self.current_transcript = ""

        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"❌ WebSocket closed: {e}")
            self.session_active = False
            await self.disconnect()
        except Exception as e:
            logger.error(f"❌ Receive error: {e}")
            self.session_active = False

    async def disconnect(self):
        if not self.session_active and not self.is_connecting_gemini: 
            return
        self.session_active = False
        logger.info("🔌 Disconnecting...")
        if self.processing_task: 
            self.processing_task.cancel()
        if self.gemini_ws: 
            await self.gemini_ws.close()
        if self.pc_client: 
            await self.pc_client.close()