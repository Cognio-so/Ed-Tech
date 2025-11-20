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
st.markdown("Test the backend API for generating educational content, performing web searches, and creating images.")

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

tool_selection = st.radio(
    "Choose Generator",
    ["Content Generator", "Assessment Generator", "Web Search", "Image Generator"],
    horizontal=True,
    help="Switch between different AI-powered tools.",
)

if tool_selection == "Content Generator":
    with st.form("content_generation_form"):
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Content Details")
            content_type = st.selectbox("Content Type", ["lesson_plan", "presentation", "quizz", "worksheet"])
            grade = st.text_input("Grade", "10th")
            subject = st.text_input("Subject", "Physics")
            topic = st.text_input("Topic", "Newton's Laws of Motion")
            language = st.text_input("Language", "English")
        with col2:
            st.subheader("Parameters")
            instruction_depth = st.selectbox("Instruction Depth", ["Simple", "Standard", "Enriched"])
            emotional_consideration = st.slider("Emotional Consideration Level", 1, 5, 3)
            st.markdown("**Features**")
            adaptive_learning = st.checkbox("Adaptive Learning", value=True)
            include_assessment = st.checkbox("Include Assessment", value=True)
            multimedia_suggestion = st.checkbox("Multimedia Suggestions", value=True)
        st.subheader("Specifics")
        learning_objective = st.text_area("Learning Objective", "Students should understand the three laws of motion and apply them to real-world scenarios.")
        if content_type == "lesson_plan":
            c1, c2 = st.columns(2)
            with c1:
                number_of_sessions = st.number_input("Number of Sessions", min_value=1, value=2)
            with c2:
                duration_of_session = st.text_input("Duration per Session", "45 minutes")
        else:
            number_of_sessions, duration_of_session = None, None
        stream_output = st.checkbox("Stream Output", value=True)
        submitted = st.form_submit_button("Generate Content")

    if submitted:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required. Please create one.")
        else:
            payload = {
                "grade": grade, "subject": subject,
                "language": language,
                "topic": topic,
                "learning_objective": learning_objective,
                "emotional_consideration": emotional_consideration,
                "adaptive_learning": adaptive_learning,
                "include_assessment": include_assessment,
                "multimedia_suggestion": multimedia_suggestion,
                "instruction_depth": instruction_depth,
                "number_of_sessions": number_of_sessions,
                "duration_of_session": duration_of_session
            }
            base_url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/content_generator/{content_type}"
            url = f"{base_url}?stream=true" if stream_output else base_url
            st.info(f"Sending request to: `{url}`")
            try:
                if stream_output:
                    placeholder = st.empty()
                    full_response = ""
                    with st.spinner("Streaming content..."):
                        response = requests.post(url, json=payload, stream=True)
                        if response.status_code != 200:
                            st.error(f"Error {response.status_code}: {response.text}")
                        else:
                            for line in response.iter_lines():
                                if line and line.startswith(b"data:"):
                                    try:
                                        event = json.loads(line[5:].strip())
                                        if event.get("type") == "content":
                                            full_response = event.get("data", {}).get("full_response", "")
                                            placeholder.markdown(full_response + "▌")
                                        elif event.get("type") == "error":
                                            st.error(event.get("data", {}).get("message"))
                                    except json.JSONDecodeError:
                                        continue
                            placeholder.markdown(full_response)
                            st.success("Streaming complete.")
                else:
                    with st.spinner("Generating content..."):
                        response = requests.post(url, json=payload)
                        if response.status_code == 200:
                            st.success("Content generated successfully!")
                            st.json(response.json())
                        else:
                            st.error(f"Error {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e:
                st.error(f"Connection error: {e}")

elif tool_selection == "Assessment Generator":
    st.subheader("Assessment Generator")
    with st.form("assessment_form"):
        col1, col2 = st.columns(2)
        with col1:
            assess_subject = st.text_input("Subject", "Mathematics", key="assess_subject")
            assess_grade = st.text_input("Grade", "8th", key="assess_grade")
            assess_topic = st.text_input("Topic", "Linear Equations", key="assess_topic")
        with col2:
            assess_language = st.text_input("Language", "English", key="assess_language")
            assess_duration = st.text_input("Duration", "40 minutes", key="assess_duration")
            assess_difficulty = st.text_input("Difficulty Level", "Standard", key="assess_difficulty")
        assess_learning_objective = st.text_area("Learning Objective", "Ensure students can solve one-variable linear equations.", key="assess_learning_objective")
        assess_custom_instruction = st.text_area("Custom Instructions", "Emphasize problem-solving.", key="assess_custom_instruction")
        assess_confidence = st.slider("Confidence Support Level (1-5)", 1, 5, 3, key="assess_confidence")
        
        st.markdown("### Question Types")
        q_col1, q_col2, q_col3 = st.columns(3)
        with q_col1:
            mcq_enabled = st.checkbox("Multiple Choice", value=True, key="assess_mcq_enabled")
            mcq_count = st.number_input("MCQ Count", 1, 50, 5, key="assess_mcq_count") if mcq_enabled else 0
        with q_col2:
            tf_enabled = st.checkbox("True / False", value=True, key="assess_tf_enabled")
            tf_count = st.number_input("T/F Count", 1, 50, 4, key="assess_tf_count") if tf_enabled else 0
        with q_col3:
            sa_enabled = st.checkbox("Short Answer", value=False, key="assess_sa_enabled")
            sa_count = st.number_input("Short Answer Count", 1, 50, 3, key="assess_sa_count") if sa_enabled else 0
        
        assessment_stream = st.checkbox("Stream Output", value=True, key="assess_stream")
        assessment_submit = st.form_submit_button("Generate Assessment")

    if assessment_submit:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required.")
        else:
            payload = {
                "subject": assess_subject, "grade": assess_grade, "difficulty_level": assess_difficulty, "language": assess_language,
                "topic": assess_topic, "learning_objective": assess_learning_objective, "duration": assess_duration,
                "confidence_level": assess_confidence, "custom_instruction": assess_custom_instruction,
                "mcq_enabled": mcq_enabled, "mcq_count": mcq_count, "true_false_enabled": tf_enabled,
                "true_false_count": tf_count, "short_answer_enabled": sa_enabled, "short_answer_count": sa_count
            }
            base_url = f"{api_base_url}/api/session/{session_id}/teacher/{teacher_id}/assessment"
            url = f"{base_url}?stream=true" if assessment_stream else base_url
            st.info(f"Sending request to: `{url}`")
            # Streaming logic similar to content generator
            try:
                if assessment_stream:
                    placeholder = st.empty()
                    full_response = ""
                    with st.spinner("Streaming assessment..."):
                        response = requests.post(url, json=payload, stream=True)
                        if response.status_code != 200:
                            st.error(f"Error {response.status_code}: {response.text}")
                        else:
                            for line in response.iter_lines():
                                if line and line.startswith(b"data:"):
                                    try:
                                        event = json.loads(line[5:].strip())
                                        if event.get("type") == "content":
                                            full_response = event.get("data", {}).get("full_response", "")
                                            placeholder.markdown(full_response + "▌")
                                    except json.JSONDecodeError: continue
                            placeholder.markdown(full_response)
                            st.success("Streaming complete.")
                else:
                    with st.spinner("Generating assessment..."):
                        response = requests.post(url, json=payload)
                        if response.status_code == 200:
                            st.success("Assessment generated!")
                            st.json(response.json())
                        else: st.error(f"Error {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e: st.error(f"Connection error: {e}")

elif tool_selection == "Web Search":
    st.subheader("Web Search Agent")
    with st.form("web_search_form"):
        col1, col2 = st.columns(2)
        with col1:
            ws_topic = st.text_input("Topic", "Photosynthesis")
            ws_grade_level = st.text_input("Grade Level", "9th")
            ws_subject = st.text_input("Subject", "Biology")
        with col2:
            ws_content_type = st.text_input("Content Type", "articles and diagrams")
            ws_language = st.text_input("Language", "English")
            ws_comprehension = st.text_input("Comprehension Level", "beginner")
        
        ws_submitted = st.form_submit_button("Search Web")

    if ws_submitted:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required.")
        else:
            payload = {
                "topic": ws_topic, "grade_level": ws_grade_level, "subject": ws_subject,
                "content_type": ws_content_type, "language": ws_language, "comprehension": ws_comprehension
            }
            url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/web_search_schema"
            st.info(f"Sending request to: `{url}`")
            try:
                placeholder = st.empty()
                full_response = ""
                with st.spinner("Searching the web..."):
                    response = requests.post(url, json=payload, stream=True)
                    if response.status_code != 200:
                        st.error(f"Error {response.status_code}: {response.text}")
                    else:
                        for line in response.iter_lines():
                            if line and line.startswith(b"data:"):
                                try:
                                    event = json.loads(line[5:].strip())
                                    if event.get("type") == "content":
                                        full_response = event.get("data", {}).get("full_response", "")
                                        placeholder.markdown(full_response + "▌")
                                except json.JSONDecodeError: continue
                        placeholder.markdown(full_response)
                        st.success("Web search complete.")
            except requests.exceptions.RequestException as e:
                st.error(f"Connection error: {e}")

elif tool_selection == "Image Generator":
    st.subheader("Educational Image Generator")
    with st.form("image_gen_form"):
        col1, col2 = st.columns(2)
        with col1:
            img_topic = st.text_input("Topic", "The Water Cycle")
            img_grade_level = st.text_input("Grade Level", "5th")
            img_subject = st.text_input("Subject", "Science")
            img_language = st.text_input("Language for Labels", "English")
        with col2:
            img_visual_type = st.selectbox("Visual Type", ["diagram", "chart", "image"])
            img_difficulty = st.checkbox("Advanced Difficulty/Detail", value=False)

        img_instructions = st.text_area(
            "Instructions",
            "Create a colorful diagram showing the main stages: evaporation, condensation, precipitation, and collection. Label each stage clearly."
        )
        img_submitted = st.form_submit_button("Generate Image")

    if img_submitted:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required.")
        else:
            payload = {
                "topic": img_topic,
                "grade_level": img_grade_level,
                "preferred_visual_type": img_visual_type,
                "subject": img_subject,
                "instructions": img_instructions,
                "difficulty_flag": "true" if img_difficulty else "false",
                "language": img_language,
            }
            url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/image_generation"
            st.info(f"Sending request to: `{url}`")
            try:
                with st.spinner("Generating image... This may take a moment."):
                    response = requests.post(url, json=payload)
                    if response.status_code == 200:
                        st.success("Image Generated Successfully!")
                        data = response.json()
                        st.image(data.get("image_url"), caption=f"Generated {img_visual_type} for '{img_topic}'")
                    else:
                        st.error(f"Error {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e:
                st.error(f"Connection error: {e}")