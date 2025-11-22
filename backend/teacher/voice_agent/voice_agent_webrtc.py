import asyncio
import json
import logging
import os
import time
from fractions import Fraction
from typing import Optional, Dict, Any

import aiohttp
import av
import numpy as np
import pyaudio
from aiortc import (
    RTCPeerConnection, 
    RTCSessionDescription, 
    MediaStreamTrack, 
    RTCConfiguration, 
    RTCIceServer
)
from dotenv import load_dotenv
from aiortc.contrib.media import MediaPlayer, MediaRecorder
from aiortc.mediastreams import MediaStreamError

load_dotenv()

# --- LOGGING CONFIGURATION ---
# Filter out noisy aioice/ice connection errors (harmless binding errors on Windows)
logging.basicConfig(level=logging.INFO)
logging.getLogger("aioice").setLevel(logging.WARNING) 
logger = logging.getLogger("RealtimeOpenAI")

class AudioStreamTrack(MediaStreamTrack):
    """
    A MediaStreamTrack that reads from the system microphone via PyAudio.
    """
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.p = pyaudio.PyAudio()
        self.rate = 24000  # OpenAI Realtime preferred rate
        self.channels = 1
        self.format = pyaudio.paInt16
        self.frame_length = 0.02  # 20ms
        self.chunk = int(self.rate * self.frame_length)
        
        self.stream = self.p.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk
        )
        self.pts = 0
        self._running = True

    async def recv(self):
        """Called by aiortc to get the next audio frame."""
        if self.readyState != "live" or not self._running:
            raise MediaStreamError

        try:
            # Read raw data from microphone
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, self.stream.read, self.chunk, False)
            
            # Convert to numpy
            np_data = np.frombuffer(data, dtype=np.int16)
            np_data = np_data.reshape(1, -1)
            
            frame = av.AudioFrame.from_ndarray(np_data, format='s16', layout='mono')
            frame.sample_rate = self.rate
            frame.pts = self.pts
            frame.time_base = Fraction(1, self.rate)
            
            self.pts += self.chunk
            return frame
        except Exception:
            raise MediaStreamError

    def stop(self):
        self._running = False
        super().stop()
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.p.terminate()

class RealtimeOpenAIService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.pc: Optional[RTCPeerConnection] = None
        self.dc = None
        self.is_connected = False
        
        # Audio Hardware
        self.mic_track: Optional[AudioStreamTrack] = None
        self.pyaudio_instance = pyaudio.PyAudio()
        self.audio_task = None # To track the playing task
        
        # State
        self.selected_voice = 'alloy'
        self.current_emotion = 'neutral'
        self.emotion_detection_enabled = True
        
        # Callbacks
        self.on_transcript = None
        self.on_user_transcript = None
        self.on_response_start = None
        self.on_response_complete = None

    async def connect(self, voice_gender: str = 'female'):
        try:
            self.selected_voice = self._get_voice_for_gender(voice_gender)
            
            # STUN server
            config = RTCConfiguration(
                iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
            )
            self.pc = RTCPeerConnection(configuration=config)
            
            await self._setup_audio()
            self._setup_data_channel()
            await self._establish_connection()
            
            self.is_connected = True
            logger.info(f"✅ Connected to OpenAI with voice: {self.selected_voice}")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to OpenAI: {e}")
            await self.disconnect()
            raise e

    async def _setup_audio(self):
        # 1. Input: Add Microphone Track
        self.mic_track = AudioStreamTrack()
        self.pc.addTrack(self.mic_track)
        
        # 2. Output: Handle incoming audio
        @self.pc.on("track")
        def on_track(track):
            if track.kind == "audio":
                # Store task to cancel it later
                self.audio_task = asyncio.ensure_future(self._play_remote_audio(track))

    async def _play_remote_audio(self, track):
        """
        Consumes the remote audio track, resamples it to 24kHz, and plays it.
        """
        OUTPUT_RATE = 24000
        
        output_stream = self.pyaudio_instance.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=OUTPUT_RATE,
            output=True
        )
        
        resampler = av.AudioResampler(
            format='s16',
            layout='mono',
            rate=OUTPUT_RATE
        )

        loop = asyncio.get_event_loop()

        try:
            while True:
                frame = await track.recv()
                frame_resampled_iterator = resampler.resample(frame)
                
                for resampled_frame in frame_resampled_iterator:
                    p_bytes = resampled_frame.to_ndarray().tobytes()
                    await loop.run_in_executor(None, output_stream.write, p_bytes)
                
        except (MediaStreamError, asyncio.CancelledError):
            # Normal shutdown
            pass
        except Exception as e:
            logger.error(f"Error playing audio: {e}")
        finally:
            if output_stream.is_active():
                output_stream.stop_stream()
            output_stream.close()

    def _setup_data_channel(self):
        self.dc = self.pc.createDataChannel("oai-events")
        
        @self.dc.on("open")
        def on_open():
            logger.info("📡 Data Channel Open")
            # Initial session setup (MUST include voice)
            self._send_session_update(include_voice=True)
            
        @self.dc.on("message")
        def on_message(msg):
            try:
                message = json.loads(msg)
                self._handle_message(message)
            except Exception as e:
                logger.error(f"Error handling message: {e}")

    async def _establish_connection(self):
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        
        url = "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/sdp"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=self.pc.localDescription.sdp, headers=headers) as response:
                if response.status not in [200, 201]:
                    text = await response.text()
                    raise Exception(f"OpenAI API Error {response.status}: {text}")
                
                answer_sdp = await response.text()
        
        answer = RTCSessionDescription(sdp=answer_sdp, type="answer")
        await self.pc.setRemoteDescription(answer)

    def _send_session_update(self, include_voice: bool = False):
        """
        Sends session update. 
        IMPORTANT: Only include 'voice' if it's the initial setup or a deliberate voice change.
        Updating 'voice' while audio is active causes an OpenAI error.
        """
        if self.dc and self.dc.readyState == "open":
            prompt = self._create_system_prompt()
            prompt = self._add_emotion_instructions(prompt, self.current_emotion)
            
            session_config = {
                "modalities": ["text", "audio"],
                "instructions": prompt,
                # "input_audio_format": "pcm16",
                # "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "gpt-4o-transcribe"},
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 400,
                    "silence_duration_ms": 500
                }
            }

            # FIX: Only send voice if explicitly requested (Initial connection or manual switch)
            if include_voice:
                session_config["voice"] = self.selected_voice

            message = {
                "type": "session.update",
                "session": session_config
            }
            
            # Log what we are doing
            log_msg = f"📡 Sending session update. Emotion: {self.current_emotion}"
            if include_voice:
                log_msg += f", Voice set to: {self.selected_voice}"
            logger.info(log_msg)
            
            self.dc.send(json.dumps(message))

    def _handle_message(self, message: Dict[str, Any]):
        msg_type = message.get("type")
        
        if msg_type == "response.audio_transcript.delta":
            if self.on_transcript:
                self.on_transcript(message.get("delta"))
                
        elif msg_type == "response.audio_transcript.done":
            if self.on_response_complete:
                self.on_response_complete()
                
        elif msg_type == "conversation.item.input_audio_transcription.completed":
            transcript = message.get("transcript", "")
            if self.on_user_transcript:
                self.on_user_transcript(transcript)
            
            if self.emotion_detection_enabled:
                self._detect_and_update_emotion(transcript)
                
        elif msg_type == "response.created":
            if self.on_response_start:
                self.on_response_start()
                
        elif msg_type == "output_audio_buffer.started":
            pass # Suppressed log to reduce noise
            
        elif msg_type == "error":
            logger.error(f"❌ OpenAI Error: {message.get('error')}")

    def update_voice(self, gender: str):
        new_voice = self._get_voice_for_gender(gender)
        if new_voice != self.selected_voice:
            self.selected_voice = new_voice
            logger.info(f"🎤 Switching voice to {new_voice}")
            # We explicitly want to change voice here, so include_voice=True
            self._send_session_update(include_voice=True)

    def update_emotion(self, emotion: str):
        if self.current_emotion != emotion:
            self.current_emotion = emotion
            logger.info(f"🎭 Manual emotion update: {emotion}")
            # Just updating instructions, do not resend voice to avoid lock error
            self._send_session_update(include_voice=False)

    def _detect_and_update_emotion(self, user_input: str):
        detected = self._detect_emotion_from_text(user_input)
        if detected != "neutral" and detected != self.current_emotion:
            logger.info(f"🎭 Auto-detected emotion: {detected}")
            self.update_emotion(detected)

    def _detect_emotion_from_text(self, text: str) -> str:
        text = text.lower()
        if any(x in text for x in ['help', 'confused', 'hard', 'stress', 'panic', 'مساعدة', 'صعب']):
            return 'calm'
        if any(x in text for x in ['great', 'understand', 'yes', 'perfect', 'correct', 'ممتاز', 'فهمت']):
            return 'excited'
        if any(x in text for x in ['wrong', 'mistake', 'error', 'fail', 'خطأ']):
            return 'reassuring'
        if any(x in text for x in ['how', 'what', 'why', 'explain', 'كيف', 'لماذا']):
            return 'friendly'
        return 'neutral'

    def _get_voice_for_gender(self, gender: str) -> str:
        return 'shimmer' if gender == 'female' else 'echo'

    async def disconnect(self):
        self.is_connected = False
        logger.info("🔌 Disconnecting...")
        
        # 1. Stop Mic
        if self.mic_track:
            self.mic_track.stop()
            
        # 2. Cancel Audio Player Task
        if self.audio_task:
            self.audio_task.cancel()
            try:
                await self.audio_task
            except asyncio.CancelledError:
                pass

        # 3. Close Data Channel
        if self.dc:
            self.dc.close()
            
        # 4. Close Peer Connection (Crucial for aioice cleanup)
        if self.pc:
            await self.pc.close()
        
        # 5. Terminate PyAudio
        if self.pyaudio_instance:
            self.pyaudio_instance.terminate()
            
        # Give asyncio a moment to clean up pending transport tasks
        await asyncio.sleep(0.1)
        logger.info("🔌 Disconnected")

    def _create_system_prompt(self) -> str:
        """
        Returns the system prompt for the AI Teaching Assistant.
        """
        return """
You are an expert AI Teaching Assistant.

**CORE RESPONSIBILITIES:**
1. **Analyze Performance:** Help teachers identify student needs based on descriptions or data.
2. **Actionable Steps:** Provide 3-5 numbered, concrete steps to address teaching challenges.
3. **Resource Generation:** Create examples, quiz questions, or explanation strategies when asked.

**CRITICAL INSTRUCTIONS:**
- Respond in the SAME language as the user's query.
- For Arabic, ensure right-to-left (RTL) alignment and use Arabic numerals.
- Mathematical expressions MUST use LaTeX format (e.g., $x^2$).
"""

    def _add_emotion_instructions(self, base_prompt: str, emotion: str) -> str:
        emotions = {
            'friendly': "\n**TONE: FRIENDLY**\nBe warm, approachable, and encouraging.",
            'excited': "\n**TONE: EXCITED**\nCelebrate achievements with high energy.",
            'calm': "\n**TONE: CALM**\nSpeak slowly, patiently, and reassuringly.",
            'reassuring': "\n**TONE: REASSURING**\nFocus on learning opportunities.",
            'neutral': "\n**TONE: NEUTRAL**\nBe professional and clear."
        }
        return base_prompt + emotions.get(emotion, emotions['neutral'])

async def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Please set OPENAI_API_KEY environment variable")
        return

    service = RealtimeOpenAIService(api_key)
    
    # Simpler print callbacks
    service.on_user_transcript = lambda text: print(f"\nTeacher: {text}")
    service.on_transcript = lambda delta: print(f"{delta}", end="", flush=True)
    
    try:
        print("Connecting as Teaching Assistant...")
        await service.connect(voice_gender='female')
        print("Conversation started. Press Ctrl+C to exit.")
        
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        # Ensure clean disconnect even on errors
        await service.disconnect()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        # Catch any final event loop errors
        print(f"Application exited with: {e}")