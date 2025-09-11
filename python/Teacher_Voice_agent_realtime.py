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

async def send_audio(ws, teacher_data):
    """Sends audio from the queue to the OpenAI WebSocket."""
    
    # Dynamically create the prompt with teacher and student data
    prompt = f"""You are a helpful and insightful AI teaching assistant for {teacher_data.get('teacherName', 'the teacher')}. Your primary goal is to help them analyze student performance, refine their teaching strategies, and feel supported in their role.

Here are the details for the students and their performance reports:
{json.dumps(teacher_data.get('students', []), indent=2)}

Student Performance Overview:
{json.dumps(teacher_data.get('studentPerformance', {}), indent=2)}

Student Overview:
{json.dumps(teacher_data.get('studentOverview', {}), indent=2)}

Top Performers:
{json.dumps(teacher_data.get('topPerformers', []), indent=2)}

Subject Performance:
{json.dumps(teacher_data.get('subjectPerformance', {}), indent=2)}

Here are the details of the content you have generated or have available:
{json.dumps(teacher_data.get('content', []), indent=2)}

Assessment Details:
{json.dumps(teacher_data.get('assessments', []), indent=2)}

Media Toolkit Resources:
{json.dumps(teacher_data.get('mediaToolkit', {}), indent=2)}

Learning Analytics:
{json.dumps(teacher_data.get('learningAnalytics', {}), indent=2)}

Your main objective is to act as a collaborative partner for the teacher. Engage them in a conversation about their students' progress, ask about their teaching challenges, and provide data-driven insights and pedagogical suggestions.

Core Instructions:
** give response in which teacher talk **
1.  **Adopt a Persona**: Always maintain a professional, encouraging, and analytical persona. Your language should be clear, respectful, and focused on educational best practices. Avoid being overly robotic or generic.
2.  **Analyze and Adapt**: Before responding, analyze the teacher's query and the provided data. Your tone must dynamically change based on the conversation's context:
    *   **Insightful Tone (Default for Analysis)**:
        *   When: The teacher asks for performance analysis, trends, or student comparisons.
        *   How: Be data-driven and objective. Use phrases like, "Looking at the reports, I notice a pattern...", "That's an interesting question. Let's dive into the data.", "Based on the content details, we could try..."
    *   **Supportive Tone (On Challenges/Frustration)**:
        *   When: The teacher expresses difficulty, frustration with a student's progress, or uncertainty.
        *   How: Be empathetic and encouraging. Never be dismissive. Use phrases like, "I understand that can be challenging.", "That's a common hurdle. Let's brainstorm some strategies together.", "It's okay to feel that way. We can figure out a new approach."
    *   **Collaborative Tone (For Brainstorming/Suggestions)**:
        *   When: The teacher is looking for new ideas, lesson plans, or teaching methods.
        *   How: Be creative and resourceful. Use phrases like, "What if we tried a different angle?", "Building on that idea, we could also incorporate...", "I can help you find some resources for that."
    *   **Encouraging Tone (On Success)**:
        *   When: The teacher shares a success story or a student shows significant improvement.
        *   How: Celebrate their success and reinforce positive outcomes! Use phrases like, "That's fantastic news! Your approach is clearly working.", "It's wonderful to see that kind of progress.", "Great job, {teacher_data.get('teacherName', 'teacher')}! That's a testament to your teaching."

**Function calling:**
- **Web Search (`web_search`)**: Use this to find new teaching methodologies, educational research, or real-world examples to supplement the generated content.
"""
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
                            "interrupt_response": True,
                            "create_response": True
                        },
                        "input_audio_transcription": { "model": "gpt-4o-transcribe" },
                        "input_audio_noise_reduction": {
                            "type": "near_field"
                        },
                        "tools": [
                            {
                                "type": "function", # Note the nesting under a "function" key
                                "name": "web_search",
                                "description": "Search the web for fresh information, teaching strategies, and examples.",
                                "parameters": {
                                    "type": "object",
                                    "properties": {"query": {"type": "string", "description": "Natural language search query"}},
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
    
    # --- START OF MODIFIED SECTION ---
    # Get teacher and context details from terminal input
    teacher_name = input("Enter teacher's name: ")
    # student_details_json = input("Enter student details with reports (in JSON format): ")
    # generated_content_json = input("Enter generated content details (in JSON format): ")

    # try:
    #     student_details_with_reports = json.loads(student_details_json)
    #     generated_content_details = json.loads(generated_content_json)
    # except json.JSONDecodeError as e:
    #     print(f"Invalid JSON format: {e}. Please try again.")
    #     return

    teacher_data = {
        "teacher_name": teacher_name,
        "student_details_with_reports": [
  {
    "student_name": "John Doe",
    "student_id": "JD001",
    "reports": [
      {"subject": "Math", "score": 65, "comments": "Struggles with algebra."},
      {"subject": "History", "score": 88, "comments": "Excellent essay writing."}
    ]
  },
  {
    "student_name": "Jane Smith",
    "student_id": "JS002",
    "reports": [
      {"subject": "Math", "score": 92, "comments": "Top performer in geometry."},
      {"subject": "History", "score": 75, "comments": "Needs to elaborate more in answers."}
    ]
  }
],
        "generated_content_details": [{
  "subject": "History",
  "topic": "The Roman Empire",
  "available_materials": [
    {"type": "reading", "title": "Chapter 5: The Rise of Augustus"},
    {"type": "video", "title": "Crash Course: The Roman Empire"},
    {"type": "activity", "title": "Worksheet on Roman Emperors"}
  ]
}]
    }
    
    print(f"\nStarting teaching assistant session for {teacher_data['teacher_name']}...")
    # --- END OF MODIFIED SECTION ---

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
                # Pass teacher data to the send_audio task
                send_task = asyncio.create_task(send_audio(ws, teacher_data))

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
                            pcm = base64.b64decode(event["delta"])
                            output_stream.write(np.frombuffer(pcm, dtype=np.int16))
                            
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