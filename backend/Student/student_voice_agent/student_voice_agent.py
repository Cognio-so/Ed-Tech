import asyncio
import json
import logging
import os
import base64
import re
import io
import wave
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
VOICE_MAPPING = {
    "alloy": "Puck",
    "echo": "Charon",
    "shimmer": "Aoede" 
}

def _parse_rate(mime_type: str, default: int = 24000) -> int:
    """Parse sample rate from mime type string."""
    if not mime_type:
        return default
    m = re.search(r'rate\s*=\s*(\d+)', mime_type)
    return int(m.group(1)) if m else default

def _decode_wav_to_pcm16(raw_bytes: bytes) -> bytes:
    """Minimal WAV parsing to extract PCM16 mono data."""
    with wave.open(io.BytesIO(raw_bytes), 'rb') as wf:
        assert wf.getsampwidth() == 2, "Only 16-bit PCM WAV supported"
        n_channels = wf.getnchannels()
        assert n_channels == 1, "Only mono WAV supported"
        frames = wf.readframes(wf.getnframes())
        return frames

import time  # <--- CRITICAL IMPORT

class GeminiAudioTrack(MediaStreamTrack):
    """
    A WebRTC Audio Track that buffers Gemini audio and plays it at REAL-TIME speed.
    FIXED: Added pacing logic to prevent 'fast-forward' audio (chipmunk effect).
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        # Infinite buffer: Stores ALL audio Gemini generates (no dropping)
        self.q = asyncio.Queue() 
        
        # WebRTC standard: 48kHz, mono, 20ms ptime
        self.rate = 48000
        self.samples_per_frame = 960  # 20ms at 48k
        self.frame_size_bytes = self.samples_per_frame * 2  # 16-bit = 2 bytes
        
        self.pts = 0
        self.buffer = bytearray()
        
        # Resample Gemini (24k) -> WebRTC (48k)
        self.gemini_input_rate = 24000 
        self.resampler = av.AudioResampler(format='s16', layout='mono', rate=self.rate)
        
        # Timing Control
        self.start_time = None
        self.frames_sent = 0

    def add_audio_chunk(self, pcm_data: bytes, src_rate: int = None):
        """Add PCM chunk from Gemini, resample to 48k and enqueue bytes."""
        if not pcm_data:
            return
            
        try:
            rate = src_rate or self.gemini_input_rate
            
            # 1. Wrap raw bytes into an AV Frame
            np_in = np.frombuffer(pcm_data, dtype=np.int16).reshape(1, -1)
            frame_in = av.AudioFrame.from_ndarray(np_in, format='s16', layout='mono')
            frame_in.sample_rate = rate
            
            # 2. Resample to 48k
            resampled_bytes = bytearray()
            for out_frame in self.resampler.resample(frame_in):
                out_bytes = out_frame.to_ndarray().tobytes()
                resampled_bytes.extend(out_bytes)
            
            # 3. Add to infinite queue
            if resampled_bytes:
                self.q.put_nowait(bytes(resampled_bytes))
            
        except Exception as e:
            logger.error(f"❌ Failed to queue audio: {e}")

    def mark_response_complete(self):
        pass 

    async def recv(self):
        """
        Called by WebRTC. Must return frames at exactly 1x speed (real-time).
        """
        # --- PACING LOGIC (CRITICAL FIX) ---
        # Initialize the clock on the first frame
        if self.start_time is None:
            self.start_time = time.time()
            self.initial_pts = self.pts

        # Calculate where we SHOULD be in time
        # (Current Frame Count * 0.02 seconds)
        samples_played = self.pts - self.initial_pts
        expected_time_elapsed = samples_played / self.rate
        
        target_time = self.start_time + expected_time_elapsed
        wait_time = target_time - time.time()

        # If we are ahead of schedule, SLEEP to match real-time
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        # -----------------------------------

        try:
            # 1. Fill internal buffer
            while len(self.buffer) < self.frame_size_bytes:
                try:
                    new_data = self.q.get_nowait()
                    self.buffer.extend(new_data)
                except asyncio.QueueEmpty:
                    break

            # 2. Output Audio or Silence
            if len(self.buffer) >= self.frame_size_bytes:
                frame_data = bytes(self.buffer[:self.frame_size_bytes])
                del self.buffer[:self.frame_size_bytes]
            else:
                # Silence (Buffer Underflow)
                frame_data = b'\x00' * self.frame_size_bytes

            # 3. Create AudioFrame
            np_data = np.frombuffer(frame_data, dtype=np.int16).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
            frame.sample_rate = self.rate
            frame.pts = self.pts
            frame.time_base = Fraction(1, self.rate)

            self.pts += self.samples_per_frame
            self.frames_sent += 1

            return frame

        except Exception as e:
            logger.error(f"❌ CRITICAL RECV ERROR: {e}")
            # Fallback silence to prevent connection drop
            silent_np = np.zeros((1, self.samples_per_frame), dtype=np.int16)
            frame = av.AudioFrame.from_ndarray(silent_np, format='s16', layout='mono')
            frame.sample_rate = self.rate
            frame.pts = self.pts
            frame.time_base = Fraction(1, self.rate)
            self.pts += self.samples_per_frame
            return frame

class StudyBuddyBridge:
    def __init__(self, api_key: str = None):
        self.api_key = GEMINI_API_KEY or api_key
        self.pc_client: Optional[RTCPeerConnection] = None
        self.gemini_ws = None
        # self.gemini_track = GeminiAudioTrack()
        self.gemini_track = None
        self.processing_task = None
        self.context_data = {}
        self.client_dc = None
        self.session_active = False
        self.is_connecting_gemini = False
        self.current_transcript = ""

    async def connect(self, offer_sdp: str, context_data: Dict[str, Any], voice: str = "Puck") -> Dict[str, str]:
        self.gemini_track = GeminiAudioTrack()
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
                logger.info("🎤 Received Student Audio Track")
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
        name = self.context_data.get("student_name", "Student")
        subject = self.context_data.get("subject", "General")
        grade = self.context_data.get("grade", "Learning")
        pending_tasks = self.context_data.get("pending_assignments", "None")
        extra_inst = self.context_data.get("instructions", "")
        frontend_voice = self.context_data.get("voice", "shimmer")
        voice = VOICE_MAPPING.get(frontend_voice, "Aoede")

        sys_prompt = get_study_buddy_prompt(
            name=name, subject=subject, grade=grade, 
            pending_tasks=pending_tasks, extra_inst=extra_inst
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
                                        raw = base64.b64decode(inline_data.get("data"))
                                        if not raw:
                                            continue

                                        # Handle different audio containers
                                        if "wav" in mime_type.lower():
                                            pcm_data = _decode_wav_to_pcm16(raw)
                                            src_rate = _parse_rate(mime_type, 24000)
                                        elif "pcm" in mime_type.lower() or not mime_type:
                                            # Default to PCM if mimeType is empty or contains pcm
                                            pcm_data = raw
                                            src_rate = _parse_rate(mime_type, 24000)
                                        else:
                                            # Try to treat as raw PCM if it's audio but unknown format
                                            logger.info(f"⚠️ Unknown audio format: {mime_type}, treating as PCM")
                                            pcm_data = raw
                                            src_rate = _parse_rate(mime_type, 24000)

                                        # Feed into the 48k track with correct source rate
                                        self.gemini_track.add_audio_chunk(pcm_data, src_rate=src_rate)
                                        logger.info(f"📦 Part {idx+1}/{len(parts)}: {len(pcm_data)}b @ {src_rate}Hz, mimeType={mime_type}")

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