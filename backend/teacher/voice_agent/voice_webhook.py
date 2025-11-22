import os
import asyncio
import json
import base64
import aiohttp
import sounddevice as sd
import numpy as np
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
MODEL = "gpt-realtime"  # Correct model name
SAMPLE_RATE = 24000
CHUNK_MS = 20
CHUNK = int(SAMPLE_RATE * CHUNK_MS / 1000)
URL = f"wss://api.openai.com/v1/realtime?model={MODEL}" # Correct URL path

audio_queue = asyncio.Queue()
speech_detected_event = asyncio.Event()
assistant_speaking = False
VAD_THRESHOLD = 2000  # Adjust as needed for your microphone sensitivity
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

def web_search(query: str):
    """Performs a web search using Tavily."""
    try:
        response = tavily_client.search(query=query, search_depth="advanced", max_results=1)
        return json.dumps(response["results"])
    except Exception as e:
        print(f"Error during web search: {e}")
        return json.dumps([{"error": str(e)}])

def audio_callback(indata, frames, time, status):
    """This function is called by the sounddevice stream for each audio chunk."""
    global assistant_speaking
    if status:
        print(status)

    # If the assistant is speaking, we discard the audio to prevent a feedback loop.
    if assistant_speaking:
        # You can still have interruption logic here if needed, but DO NOT queue the audio.
        # For example, you could still set an event for interruption.
        if np.abs(indata).max() > VAD_THRESHOLD:
            speech_detected_event.set()
        return  # Explicitly return and do nothing with the audio chunk.

    # If the assistant is NOT speaking, then we treat the incoming audio as user input.
    audio_queue.put_nowait(indata.copy())


async def microphone_stream():
    """Continuously streams audio from the microphone into the queue."""
    try:
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="int16",
            blocksize=CHUNK,
            callback=audio_callback,
        ):
            print("Microphone stream started.")
            while True:
                await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        print("Microphone stream cancelled.")
    except Exception as e:
        print(f"An error occurred in microphone stream: {e}")

async def send_audio(ws):
    """Sends audio from the queue to the OpenAI WebSocket."""
    prompt = """You are a friendly and encouraging AI study buddy for school students. Your primary goal is to help them learn and feel supported. Your responses must be tailored to their emotional state and the context of the conversation.
Core Instructions:
** give response in which student talk **
1. Adopt a Persona: Always maintain a positive, encouraging, and helpful persona. Your language should be clear, easy to understand for a student audience, and avoid being overly technical or robotic.
2. Analyze and Adapt: Before responding, analyze the student's query and the outcome of any task. Your tone must dynamically change based on the following emotional layers:
    - Friendly Tone (Default for Explanations):
        * When: The student asks a question, requests an explanation, or you are providing general information.
        * How: Be warm, approachable, and encouraging. Use phrases like, "That's a great question!", "Let's break it down," "Think of it like this," or "I'm happy to help with that!"
    - Reassuring Tone (On Failure or Error):
        * When: The student's answer is incorrect, you cannot fulfill a request, or an error occurs.
        * How: Be gentle, supportive, and focus on the learning opportunity. Never be discouraging. Use phrases like, "No worries, that's a common mistake!", "That was a good try! We're very close," "It seems I had a little trouble with that request, let's try it another way," or "Don't worry if it's not perfect yet, learning is a process."
    - Excited Tone (On Success):
        * When: The student answers a question correctly, solves a problem, or completes a task successfully.
        * How: Celebrate their achievement with genuine enthusiasm! This helps build their confidence. Use phrases like, "Yes, that's exactly right! Great job!", "You nailed it! Fantastic work!", or "Awesome! You've successfully figured it out!"
    - Calm Tone (During Stress Detection):
        * When: The student's message contains keywords indicating stress, anxiety, or frustration (e.g., "I can't do this," "help," "I'm so confused," "this is too hard," "panic").
        * How: Shift to a calm, patient, and steady tone. Reassure them that it's okay to feel this way and that you're there to help them through it. Use phrases like, "It's okay, let's take a deep breath," "We can work through this together, one step at a time," "I understand this can be challenging, but don't give up," or "Let's try a simpler approach."""
    try:
        # Start the session
        await ws.send_json(
                {
                    "type": "session.update",
                    "session": {
                        "modalities": ["audio", "text"],
                        "instructions": prompt,
                        "voice": "cedar",
                        "turn_detection": {
                            "type": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300,
                            "silence_duration_ms": 600, "create_response": True, "interrupt_response": True
                        },
                        "input_audio_transcription": { "model": "gpt-4o-transcribe" },
                        "tools": [
                            {
                                "type": "function",
                                "name": "generate_horoscope",
                                "description": "Give today's horoscope for an astrological sign.",
                                "parameters": {
                                "type": "object",
                                "properties": {
                                    "sign": {
                                    "type": "string",
                                    "description": "The sign for the horoscope.",
                                    "enum": [
                                        "Aries",
                                        "Taurus",
                                        "Gemini",
                                        "Cancer",
                                        "Leo",
                                        "Virgo",
                                        "Libra",
                                        "Scorpio",
                                        "Sagittarius",
                                        "Capricorn",
                                        "Aquarius",
                                        "Pisces"
                                    ]
                                    }
                                },
                                "required": ["sign"]
                                }
                            }
                            ],
                            "tool_choice": "auto",
                    }
                    }

        )
        print("Session started.")

        while True:
            audio_chunk = await audio_queue.get()
            await ws.send_json(
                {
                    "type": "input_audio_buffer.append",
                    "audio": base64.b64encode(audio_chunk.tobytes()).decode("ascii"),
                }
            )
            # Small sleep to prevent overwhelming the server and to allow other tasks to run.
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        print("Audio sending task cancelled.")
    except aiohttp.ClientConnectionResetError:
        print("Connection was closed by the server while trying to send audio.")
    except Exception as e:
        print(f"An error occurred in send_audio: {e}")


async def main():
    mic_task = None
    send_task = None
    interrupt_task = None
    output_stream = None
    global assistant_speaking

    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "OpenAI-Beta": "realtime=v1",
                },
                max_msg_size=10_000_000,
            ) as ws:
                print("Connected to OpenAI. Speak...")

                mic_task = asyncio.create_task(microphone_stream())
                send_task = asyncio.create_task(send_audio(ws))

                output_stream = sd.OutputStream(
                    samplerate=SAMPLE_RATE, channels=1, dtype="int16", blocksize=CHUNK
                )
                output_stream.start()

                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        event = json.loads(msg.data)
                        if event.get("type") == "response.started":
                            # Mark that assistant is now speaking
                            assistant_speaking = True
                            print("Assistant started speaking")
                            
                        elif event.get("type") == "response.audio.delta":
                            pcm = base64.b64decode(event["delta"])
                            output_stream.write(np.frombuffer(pcm, dtype=np.int16))
                            
                        elif event.get("type") == "tool_calls.run.create":
                            for tool_call in event["tool_calls"]:
                                if tool_call["function"]["name"] == "web_search":
                                    print("Performing web search...")
                                    arguments = json.loads(tool_call["function"]["arguments"])
                                    search_results = await web_search(arguments["query"])  # Your existing function call
                                    await ws.send_json({
                                        "type": "tool_calls.run.update",
                                        "run_id": event["run_id"],
                                        "tool_call_id": tool_call["id"],
                                        "output": search_results,
                                    })

                        elif event.get("type") == "response.error":
                            print(f"Received an error from the server: {event}")
                            
                        elif event.get("type") == "error":
                            print(f"An unexpected error occurred: {event}")
                            break
                            
                        elif event.get("type") == "response.completed":
                            print("Received completion event. Starting new turn.")
                            assistant_speaking = False
                            
                        elif event.get("type") == "session.terminated":
                            print("Session terminated.")
                            break
                            
                        elif event.get("type") == "conversation.item.input_audio_transcription.completed":
                            transcript = event.get('transcript')
                            if transcript:
                                print(f"\nYOU: {transcript}")
                        
                        elif event.get("type") == "response.output_item.done":
                            item = event.get('item', {})
                            if item.get('type') == 'message' and item.get('role') == 'assistant':
                                content_list = item.get('content', [])
                                if content_list:
                                    transcript = content_list[0].get('transcript')
                                    if transcript:
                                        print(f"AI: {transcript}", end="", flush=True)

                    elif msg.type in (
                        aiohttp.WSMsgType.CLOSED,
                        aiohttp.WSMsgType.ERROR,
                    ):
                        print("WebSocket closed or errored.")
                        break

    except Exception as e:
        print(f"An error occurred in main: {e}")

    finally:
        if output_stream:
            output_stream.stop()
            output_stream.close()
        if mic_task:
            mic_task.cancel()
        if send_task:
            send_task.cancel()
        if interrupt_task:
            interrupt_task.cancel()
        if mic_task and send_task and interrupt_task:
            await asyncio.gather(mic_task, send_task, interrupt_task, return_exceptions=True)
        print("Cleanup complete. Exiting.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nProgram interrupted by user.")