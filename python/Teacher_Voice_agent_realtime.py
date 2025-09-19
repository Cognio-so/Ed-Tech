import os
import asyncio
import json
import aiohttp
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")

async def teacher_voice_agent(frontend_websocket, teacher_data):
    """WebRTC-based teacher voice agent using OpenAI Realtime API"""
    try:
        print("Setting up WebRTC connection for teacher voice")
        
        # Simple prompt
        prompt = f"You are a helpful AI voice coach for teachers. You're speaking with {teacher_data.get('teacherName', 'teacher')}."
        
        # Send session configuration to frontend
        session_config = {
            "type": "session_config",
            "config": {
                "apiKey": API_KEY,
                        "instructions": prompt,
                "modalities": ["text", "audio"],
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.5,
                            "prefix_padding_ms": 300,
                    "silence_duration_ms": 500
                }
            }
        }
        
        try:
            await frontend_websocket.send_json(session_config)
            print("Sent WebRTC session config to frontend")
        except Exception as e:
            print(f"Error sending session config: {e}")
            return
        
        # Handle messages from frontend (mostly status updates)
        async def handle_frontend():
            try:
        while True:
                    try:
                        if frontend_websocket.client_state.name != "CONNECTED":
                            print("Frontend WebSocket disconnected")
                            break
                            
                        data = await frontend_websocket.receive_text()
                        message = json.loads(data)
                        
                        if message.get("type") == "webrtc_connected":
                            print("WebRTC connection established")
                            await frontend_websocket.send_json({"type": "session_ready"})
                            
                        elif message.get("type") == "webrtc_error":
                            print(f"WebRTC error: {message.get('error')}")
                            await frontend_websocket.send_json({
                                "type": "error",
                                "message": message.get('error')
                            })
                            
                        elif message.get("type") == "transcript":
                            print(f"Transcript: {message.get('text')}")
                            
                    except Exception as msg_error:
                        print(f"Error processing frontend message: {msg_error}")
                        if "1005" in str(msg_error) or "NO_STATUS_RCVD" in str(msg_error):
                            print("Frontend WebSocket closed, stopping handler")
                            break
                        continue
                        
            except Exception as e:
                print(f"Frontend handler error: {e}")
                return
        
        # Run the handler
        try:
            await handle_frontend()
        except Exception as e:
            print(f"Handler error: {e}")

    except Exception as e:
        print(f"Voice agent error: {e}")
        try:
        await frontend_websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        except:
            pass

if __name__ == "__main__":
    pass