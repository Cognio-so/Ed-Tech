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
MODEL = "gpt-4o-realtime-preview-2024-10-01"  # Correct model name for real-time API
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
        
    # Check if user is speaking while assistant is responding
    if assistant_speaking and np.abs(indata).max() > VAD_THRESHOLD:
        speech_detected_event.set()
        
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

async def send_audio(ws, student_details):
    """Sends audio from the queue to the OpenAI WebSocket."""
    
    # Dynamically create the prompt with student details
    prompt = f"""You are a friendly and encouraging AI study buddy for {student_details['name']}, a student in grade {student_details['grade']} studying {', '.join(student_details['subjects'])}. Your primary goal is to help them learn, feel supported, and complete their pending assignments.

Here are the student's pending tasks:
{json.dumps(student_details['pending_tasks'], indent=2)}

Your main objective is to help the student solve these pending assignments by explaining the topics clearly and patiently. Engage the student in a conversation about their tasks, ask which one they want to work on, and then help them understand the underlying concepts.

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
        * How: Celebrate their achievement with genuine enthusiasm! This helps build their confidence. Use phrases like, "Yes, that's exactly right! Great job, {student_details['name']}!", "You nailed it! Fantastic work!", or "Awesome! You've successfully figured it out!"
    - Calm Tone (During Stress Detection):
        * When: The student's message contains keywords indicating stress, anxiety, or frustration (e.g., "I can't do this," "help," "I'm so confused," "this is too hard," "panic").
        * How: Shift to a calm, patient, and steady tone. Reassure them that it's okay to feel this way and that you're there to help them through it. Use phrases like, "It's okay, let's take a deep breath," "We can work through this together, one step at a time," "I understand this can be challenging, but don't give up," or "Let's try a simpler approach.
        
        **Function calling:**
        - **Web Search (`web_search`)**: Use this to find current, real-world information or examples related to their assignments."""
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
                            "type": "server_vad",
                            "threshold": 0.5,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 500,
                        },
                        "input_audio_transcription": { "model": "gpt-4o-transcribe" },
                        "input_audio_noise_reduction": {
                            "type": "near_field"
                        },
                        "tools": [
                            {
                                "type": "function", # Note the nesting under a "function" key
                                "name": "web_search",
                                "description": "Search the web for fresh information and examples.",
                                "parameters": {
                                    "type": "object",
                                    "properties": {"query": {"type": "string", "description": "provide latest information, real-time answers, and examples."}},
                                    "required": ["query"]
                                }
                            }
                        ],
                        "tool_choice": "auto",
                        "include": [ 
                            "item.input_audio_transcription.logprobs",
                        ],
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
    
    # Get student details from command line arguments or environment
    import sys
    if len(sys.argv) > 3:
        name = sys.argv[1]
        grade = sys.argv[2]  # FIXED: Changed from class_name to grade
        subjects_input = sys.argv[3]
        subjects = [subject.strip() for subject in subjects_input.split(',')]
        
        # Get pending tasks from command line or use default
        if len(sys.argv) > 4:
            try:
                pending_tasks = json.loads(sys.argv[4])
            except json.JSONDecodeError:
                pending_tasks = [
                    {"topic": "General Studies", "status": "Not Started"}
                ]
        else:
            pending_tasks = [
                {"topic": "General Studies", "status": "Not Started"}
            ]
    else:
        # Fallback to environment variables or defaults
        name = os.getenv("STUDENT_NAME", "Student")
        grade = os.getenv("STUDENT_GRADE", "8")  # FIXED: Changed from STUDENT_CLASS to STUDENT_GRADE
        subjects_input = os.getenv("STUDENT_SUBJECTS", "Mathematics, Science")
        subjects = [subject.strip() for subject in subjects_input.split(',')]
        pending_tasks = [
            {"topic": "General Studies", "status": "Not Started"}
        ]

    student_details = {
        "name": name,
        "grade": grade,  # FIXED: Changed from class to grade
        "subjects": subjects,
        "pending_tasks": pending_tasks
    }
    
    print(f"\nStarting study session for {student_details['name']}...")
    print(f"Grade: {student_details['grade']}")  # FIXED: Changed from Class to Grade
    print(f"Subjects: {', '.join(student_details['subjects'])}")
    print(f"Pending Tasks: {len(student_details['pending_tasks'])} tasks")

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
                # Pass student details to the send_audio task
                send_task = asyncio.create_task(send_audio(ws, student_details))

                output_stream = sd.OutputStream(
                    samplerate=SAMPLE_RATE, channels=1, dtype="int16", blocksize=CHUNK
                )
                output_stream.start()

                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        event = json.loads(msg.data)
                        if event.get("type") == "session.created":
                            # Mark that assistant is now speaking
                            assistant_speaking = True
                            print("Start speaking")

                        elif event.get("type") == "response.audio.delta":
                            try:
                                pcm = base64.b64decode(event["delta"])
                                audio_data = np.frombuffer(pcm, dtype=np.int16)
                                if len(audio_data) > 0:
                                    output_stream.write(audio_data)
                            except Exception as e:
                                print(f"Error playing audio delta: {e}")
                                continue
                            
                        elif event.get("type") == "conversation.item.create":
                            if event.get("tool_calls"):
                                for tool_call in event["tool_calls"]:
                                    if tool_call.get("function", {}).get("name") == "web_search":
                                        print("Performing web search...")
                                        arguments = json.loads(tool_call["function"]["arguments"])
                                        # Use asyncio.create_task to run the web search concurrently
                                        search_results = await web_search(arguments["query"])
                                        await ws.send_json({
                                            "type": "tool_call_output",
                                            "call_id": tool_call["id"],
                                            "output": search_results
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
                            
                        else:
                            print(f"Received event: {event.get('type')}")

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
        
        # Await tasks to ensure they are cancelled
        tasks = [t for t in [mic_task, send_task, interrupt_task] if t]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        print("Cleanup complete. Exiting.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nProgram interrupted by user.")