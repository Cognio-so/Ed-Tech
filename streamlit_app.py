import streamlit as st
import requests
import json
import os

# Set page configuration
st.set_page_config(
    page_title="Ed-Tech Content Generator Tester",
    page_icon="🎓",
    layout="wide"
)

st.title("🎓 Ed-Tech Content Generator Tester")
st.markdown("Test the backend API for generating lesson plans and other content.")

# Sidebar for configuration
if "session_id" not in st.session_state:
    st.session_state.session_id = ""

with st.sidebar:
    st.header("Configuration")
    api_base_url = st.text_input("API Base URL", "http://localhost:8000")
    teacher_id = st.text_input("Teacher ID", "teacher_123")
    session_input = st.text_input("Existing Session ID (optional)", st.session_state.session_id)

    def create_session(show_feedback: bool = True):
        endpoint = f"{api_base_url}/api/teacher/{teacher_id}/sessions"
        try:
            response = requests.post(endpoint)
            response.raise_for_status()
            data = response.json()
            st.session_state.session_id = data.get("session_id", "")
            if show_feedback:
                st.success(f"New session created: {st.session_state.session_id}")
            st.session_state.auto_session_attempted = True
        except requests.exceptions.RequestException as exc:
            if show_feedback:
                st.error(f"Failed to create session: {exc}")
            st.session_state.auto_session_attempted = True

    if st.button("Create Session", use_container_width=True):
        create_session(show_feedback=True)

    if session_input and session_input != st.session_state.session_id:
        st.session_state.session_id = session_input

    st.caption(f"Active Session ID: `{st.session_state.session_id or 'None'}`")

# Automatically create a session on first load if none exists
if "auto_session_attempted" not in st.session_state:
    st.session_state.auto_session_attempted = False

if not st.session_state.session_id and not st.session_state.auto_session_attempted:
    create_session(show_feedback=False)

# Main form
with st.form("content_generation_form"):
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Content Details")
        content_type = st.selectbox(
            "Content Type",
            ["lesson_plan", "presentation", "quizz", "worksheet"]
        )
        grade = st.text_input("Grade", "10th")
        subject = st.text_input("Subject", "Physics")
        topic = st.text_input("Topic", "Newton's Laws of Motion")
        language = st.text_input("Language", "English")
    
    with col2:
        st.subheader("Parameters")
        instruction_depth = st.selectbox(
            "Instruction Depth",
            ["Simple", "Standard", "Enriched"]
        )
        emotional_consideration = st.slider(
            "Emotional Consideration Level",
            min_value=1,
            max_value=5,
            value=3,
            help="1: Low, 5: High"
        )
        
        st.markdown("**Features**")
        adaptive_learning = st.checkbox("Adaptive Learning", value=True)
        include_assessment = st.checkbox("Include Assessment", value=True)
        multimedia_suggestion = st.checkbox("Multimedia Suggestions", value=True)

    st.subheader("Specifics")
    learning_objective = st.text_area(
        "Learning Objective",
        "Students should understand the three laws of motion and apply them to real-world scenarios."
    )

    if content_type == "lesson_plan":
        c1, c2 = st.columns(2)
        with c1:
            number_of_sessions = st.number_input(
                "Number of Sessions", min_value=1, value=2, help="Used only for lesson plans."
            )
        with c2:
            duration_of_session = st.text_input(
                "Duration per Session", "45 minutes", help="Used only for lesson plans."
            )
    else:
        number_of_sessions = None
        duration_of_session = None

    stream_output = st.checkbox("Stream Output", value=False, help="Stream responses as they are generated (only supported on lesson plans for now).")
    submitted = st.form_submit_button("Generate Content")

if submitted:
    # Construct payload
    payload = {
        "grade": grade,
        "subject": subject,
        "language": language,
        "topic": topic,
        "learning_objective": learning_objective,
        "emotional_consideration": emotional_consideration,
        "adaptive_learning": adaptive_learning,
        "include_assessment": include_assessment,
        "multimedia_suggestion": multimedia_suggestion,
        "instruction_depth": instruction_depth,
        "number_of_sessions": number_of_sessions,
        "duration_of_session": duration_of_session,
        "type": content_type # This is used for validation in the Pydantic model if needed, but mainly for the URL
    }

    # Require session ID for session-scoped endpoint
    session_id = st.session_state.session_id.strip()
    if not session_id:
        st.error("Session ID is required. Create or paste one in the sidebar before generating content.")
        st.stop()

    # Construct URL targeting the session-specific endpoint
    base_url = (
        f"{api_base_url}/api/teacher/{teacher_id}/session/"
        f"{session_id}/content_generator/{content_type}"
    )
    if stream_output:
        url = f"{base_url}?stream=true"
    else:
        url = base_url

    st.info(f"Sending request to: `{url}`")
    
    try:
        if stream_output:
            placeholder = st.empty()
            transcript_placeholder = st.empty()
            metadata_placeholder = st.empty()
            full_response = ""
            with st.spinner("Streaming content..."):
                response = requests.post(url, json=payload, stream=True)
                if response.status_code != 200:
                    st.error(f"Error {response.status_code}: {response.text}")
                else:
                    st.success("Streaming connection established")
                    for line in response.iter_lines():
                        if not line:
                            continue
                        if not line.startswith(b"data:"):
                            continue
                        payload_line = line[5:].strip()
                        try:
                            event = json.loads(payload_line.decode("utf-8"))
                        except json.JSONDecodeError:
                            continue
                        event_type = event.get("type")
                        data = event.get("data", {})
                        if event_type == "content":
                            chunk = data.get("chunk", "")
                            if chunk:
                                full_response += chunk
                            elif data.get("full_response"):
                                full_response = data["full_response"]
                            placeholder.markdown(full_response or "_Waiting for content..._")
                            if data.get("is_complete"):
                                st.success("Streaming complete")
                        elif event_type == "metadata":
                            metadata_placeholder.json(data)
                        elif event_type == "error":
                            st.error(data.get("message", "Unknown streaming error"))
                        transcript_placeholder.markdown(full_response)
            if full_response:
                st.subheader("Final Content")
                st.markdown(full_response)
        else:
            with st.spinner("Generating content..."):
                response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                st.success("Content Generated Successfully!")
                
                # Display Session Info
                st.json({
                    "session_id": data.get("session_id"),
                    "teacher_id": data.get("teacher_id"),
                    "type": data.get("type")
                })
                
                # Display Content
                st.subheader("Generated Content")
                content = data.get("content")
                
                if isinstance(content, str):
                    # Try to parse XML if it looks like XML
                    if content.strip().startswith("<") and content.strip().endswith(">"):
                        st.code(content, language="xml")
                    else:
                        st.markdown(content)
                else:
                    st.json(content)
            else:
                st.error(f"Error {response.status_code}: {response.text}")
            
    except requests.exceptions.ConnectionError:
        st.error(f"Could not connect to backend at {api_base_url}. Is it running?")
    except Exception as e:
        st.error(f"An error occurred: {str(e)}")
