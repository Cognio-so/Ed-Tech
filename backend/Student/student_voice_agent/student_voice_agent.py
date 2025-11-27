import asyncio
import json
import logging
import os
from typing import Optional, Dict, Any

import aiohttp
from aiortc import (
    RTCPeerConnection, 
    RTCSessionDescription, 
    RTCConfiguration, 
    RTCIceServer
)
from aiortc.contrib.media import MediaRelay

try:
    import pyaudio
    import av
    import numpy as np
    from fractions import Fraction
    from aiortc import MediaStreamTrack
    HAS_AUDIO_HARDWARE = True
except ImportError:
    HAS_AUDIO_HARDWARE = False

from .student_prompt.student_voice_prompt import get_study_buddy_prompt 

logger = logging.getLogger("StudyBuddy")
logging.basicConfig(level=logging.INFO)

class StudyBuddyBridge:
    """
    Acts as a WebRTC Bridge (B2BUA) between the Student (Browser) and OpenAI.
    Browser <==> [StudyBuddyBridge] <==> OpenAI Realtime API
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.pc_client: Optional[RTCPeerConnection] = None
        self.pc_openai: Optional[RTCPeerConnection] = None
        
        self.relay = MediaRelay()
        self.client_dc = None
        self.openai_dc = None
        
        self.context_data = {}

    async def connect(self, offer_sdp: str, context_data: Dict[str, Any], voice: str = "shimmer") -> Dict[str, str]:
        """
        1. Sets up PC for Client.
        2. Sets up PC for OpenAI.
        3. Relays tracks and Data Channels.
        4. Returns Answer SDP for Client.
        """
        self.context_data = context_data
        
        self.pc_client = RTCPeerConnection()
        
        self.pc_openai = RTCPeerConnection(RTCConfiguration(
            iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
        ))

        @self.pc_client.on("track")
        def on_client_track(track):
            logger.info(f"🎤 Received Student Track: {track.kind}")
            if track.kind == "audio":
                self.pc_openai.addTrack(self.relay.subscribe(track))

        @self.pc_openai.on("track")
        def on_openai_track(track):
            logger.info(f"🤖 Received AI Track: {track.kind}")
            if track.kind == "audio":
                self.pc_client.addTrack(self.relay.subscribe(track))

        @self.pc_client.on("datachannel")
        def on_client_datachannel(channel):
            logger.info(f"📡 Student DataChannel opened: {channel.label}")
            self.client_dc = channel
            
            @channel.on("message")
            def on_client_message(message):
                if self.openai_dc and self.openai_dc.readyState == "open":
                    self.openai_dc.send(message)

        self.openai_dc = self.pc_openai.createDataChannel("oai-events")
        
        @self.openai_dc.on("open")
        def on_openai_dc_open():
            logger.info("✅ OpenAI DataChannel Open")
            self._send_session_update(voice)

        @self.openai_dc.on("message")
        def on_openai_message(message):
            self._log_transcription(message)
            
            if self.client_dc and self.client_dc.readyState == "open":
                self.client_dc.send(message)

        client_offer = RTCSessionDescription(sdp=offer_sdp, type="offer")
        await self.pc_client.setRemoteDescription(client_offer)

        if not self.pc_client.getTransceivers():
            self.pc_openai.addTransceiver("audio", direction="sendrecv")
        
        openai_offer = await self.pc_openai.createOffer()
        await self.pc_openai.setLocalDescription(openai_offer)

        url = "https://api.openai.com/v1/realtime?model=gpt-realtime-mini-2025-10-06"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/sdp"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=self.pc_openai.localDescription.sdp, headers=headers) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    raise Exception(f"OpenAI API Error {response.status}: {text}")
                openai_answer_sdp = await response.text()

        openai_answer = RTCSessionDescription(sdp=openai_answer_sdp, type="answer")
        await self.pc_openai.setRemoteDescription(openai_answer)

        client_answer = await self.pc_client.createAnswer()
        await self.pc_client.setLocalDescription(client_answer)

        return {
            "sdp": self.pc_client.localDescription.sdp,
            "type": self.pc_client.localDescription.type
        }

    def _send_session_update(self, voice: str):
        """Constructs system instructions and sends session update to OpenAI."""
        if not self.openai_dc:
            return

        instructions = self._create_dynamic_prompt()
        
        session_config = {
            "modalities": ["text", "audio"],
            "instructions": instructions,
            "voice": voice,
            "input_audio_transcription": {
                "model": "gpt-4o-mini-transcribe"
            },
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 500
            }
        }
        
        msg = {
            "type": "session.update",
            "session": session_config
        }
        self.openai_dc.send(json.dumps(msg))
        logger.info("📡 Sent Session Update (Enabled Input Transcription)")

    def _log_transcription(self, raw_message):
        """Parses JSON events to find and log transcriptions."""
        try:
            data = json.loads(raw_message)
            event_type = data.get("type")

            if event_type == "conversation.item.input_audio_transcription.completed":
                transcript = data.get("transcript", "").strip()
                if transcript:
                    print(f"\n[STUDENT]: {transcript}")
                    logger.info(f"🗣️ [STUDENT]: {transcript}")

            elif event_type == "response.audio_transcript.done":
                transcript = data.get("transcript", "").strip()
                if transcript:
                    print(f"\n[BUDDY]: {transcript}")
                    logger.info(f"🤖 [BUDDY]: {transcript}")

        except json.JSONDecodeError:
            pass
        except Exception as e:
            logger.error(f"Error parsing transcription: {e}")

    def _create_dynamic_prompt(self) -> str:
        """Generates the system prompt using student context."""
        name = self.context_data.get("student_name", "Student")
        subject = self.context_data.get("subject", "General")
        grade = self.context_data.get("grade", "Learning")
        pending_tasks = self.context_data.get("pending_assignments", "No specific pending assignments listed")
        extra_inst = self.context_data.get("instructions", "")

        # Call the imported function
        return get_study_buddy_prompt(
            name=name,
            subject=subject,
            grade=grade,
            pending_tasks=pending_tasks,
            extra_inst=extra_inst
        )

    async def disconnect(self):
        """Closes all connections."""
        logger.info("🔌 Closing Study Buddy Bridge...")
        if self.client_dc:
            self.client_dc.close()
        if self.openai_dc:
            self.openai_dc.close()
            
        if self.pc_client:
            await self.pc_client.close()
        if self.pc_openai:
            await self.pc_openai.close()
        logger.info("🔌 Study Buddy Bridge Closed")

if HAS_AUDIO_HARDWARE:
    class AudioStreamTrack(MediaStreamTrack):
        kind = "audio"
        def __init__(self):
            super().__init__()
            self.p = pyaudio.PyAudio()
            self.rate = 24000
            self.channels = 1
            self.format = pyaudio.paInt16
            self.chunk = int(self.rate * 0.02)
            self.stream = self.p.open(
                format=self.format, channels=self.channels, rate=self.rate,
                input=True, frames_per_buffer=self.chunk
            )
            self.pts = 0
            self._running = True

        async def recv(self):
            if not self._running: raise Exception("Track stopped")
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, self.stream.read, self.chunk, False)
            np_data = np.frombuffer(data, dtype=np.int16).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
            frame.sample_rate = self.rate
            frame.pts = self.pts
            frame.time_base = Fraction(1, self.rate)
            self.pts += self.chunk
            return frame

        def stop(self):
            self._running = False
            super().stop()
            self.stream.stop_stream()
            self.stream.close()
            self.p.terminate()

    class RealtimeOpenAIService:
        """Legacy class for local testing with PyAudio."""
        def __init__(self, api_key: str):
            self.api_key = api_key
            self.pc = None
            self.mic_track = None
            self.pyaudio_instance = pyaudio.PyAudio()

        async def connect(self, voice_gender: str = 'female'):
            self.pc = RTCPeerConnection()
            self.mic_track = AudioStreamTrack()
            self.pc.addTrack(self.mic_track)
            
            @self.pc.on("track")
            def on_track(track):
                if track.kind == "audio":
                    asyncio.ensure_future(self._play_audio(track))

            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)
            
            url = "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/sdp"}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=self.pc.localDescription.sdp, headers=headers) as res:
                    ans = await res.text()
            
            await self.pc.setRemoteDescription(RTCSessionDescription(sdp=ans, type="answer"))

        async def _play_audio(self, track):
            out_stream = self.pyaudio_instance.open(format=pyaudio.paInt16, channels=1, rate=24000, output=True)
            resampler = av.AudioResampler(format='s16', layout='mono', rate=24000)
            try:
                while True:
                    frame = await track.recv()
                    for f in resampler.resample(frame):
                        out_stream.write(f.to_ndarray().tobytes())
            except Exception: pass
            finally: out_stream.stop_stream(); out_stream.close()

        async def disconnect(self):
            if self.mic_track: self.mic_track.stop()
            if self.pc: await self.pc.close()
            self.pyaudio_instance.terminate()

if __name__ == "__main__":
    async def main():
        key = os.getenv("OPENAI_API_KEY")
        if HAS_AUDIO_HARDWARE and key:
            svc = RealtimeOpenAIService(key)
            await svc.connect()
            print("Connected locally. Ctrl+C to stop.")
            await asyncio.sleep(3600)
    try:
        asyncio.run(main())
    except: pass