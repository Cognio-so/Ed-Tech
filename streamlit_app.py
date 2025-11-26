import streamlit as st
import requests
import json
import os
import uuid
import streamlit.components.v1 as components  # Required for WebRTC/JS

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
    [
        "Content Generator", 
        "Assessment Generator",
        "Presentation Generator (SlideSpeak)", 
        "Web Search", 
        "Image Generator", 
        "Comic Generator", 
        "AI Tutor",
        "Student AI Tutor",
        "Teacher Voice Agent",
        "Student Voice Agent" 
    ],
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

# --- NEW SECTION: Presentation Generator (SlideSpeak) ---
elif tool_selection == "Presentation Generator (SlideSpeak)":
    st.subheader("📊 Professional Slide Deck Generator (via SlideSpeak)")
    
    with st.form("slidespeak_form"):
        col1, col2 = st.columns(2)
        
        with col1:
            ppt_plain_text = st.text_area(
                "Presentation Topic / Content", 
                "The History of Artificial Intelligence: From Turing to Transformers",
                height=150,
                help="The main text or topic to generate slides from."
            )
            ppt_custom_instructions = st.text_area(
                "Custom Instructions", 
                "Focus on key milestones and include dates.",
                height=100
            )

        with col2:
            ppt_length = st.number_input("Number of Slides", min_value=1, max_value=50, value=10)
            ppt_language = st.selectbox("Language", ["ENGLISH", "HINDI"])
            ppt_template = st.selectbox(
                "Template Style", 
                ["default", "aurora", "lavender", "monarch", "serene", "iris", "clyde", "adam", "nebula", "bruno"]
            )
            ppt_tone = st.selectbox(
                "Tone", 
                ["educational", "playful", "professional", "persuasive", "inspirational"]
            )
            ppt_verbosity = st.selectbox(
                "Verbosity", 
                ["standard", "concise", "text-heavy"]
            )
            ppt_fetch_images = st.checkbox("Fetch Stock Images", value=True)

        ppt_submit = st.form_submit_button("Generate Presentation", use_container_width=True)

    if ppt_submit:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required. Please create one.")
        elif not ppt_plain_text:
            st.error("Please provide a topic or content for the presentation.")
        else:
            payload = {
                "plain_text": ppt_plain_text,
                "custom_user_instructions": ppt_custom_instructions,
                "length": ppt_length,
                "language": ppt_language,
                "fetch_images": ppt_fetch_images,
                "verbosity": ppt_verbosity,
                "tone": ppt_tone,
                "template": ppt_template
            }
            
            url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/presentation_slidespeak"
            
            st.info(f"Sending request to: `{url}`")
            
            try:
                with st.spinner("Generating presentation... (This interacts with SlideSpeak and may take a minute)"):
                    # Use a longer timeout because presentation generation involves polling
                    response = requests.post(url, json=payload, timeout=360) 
                    
                    if response.status_code == 200:
                        data = response.json()
                        download_url = data.get("presentation_url")
                        
                        st.success("✅ Presentation Generated Successfully!")
                        
                        if download_url:
                            st.markdown(f"### [📥 Download PowerPoint (.pptx)]({download_url})")
                            st.info(f"URL: {download_url}")
                        else:
                            st.warning("Presentation marked as success, but no URL was returned.")
                            
                        with st.expander("View Raw API Response"):
                            st.json(data)
                    else:
                        st.error(f"Error {response.status_code}: {response.text}")
            
            except requests.exceptions.Timeout:
                st.error("The request timed out. The presentation might still be processing on the server.")
            except requests.exceptions.RequestException as e:
                st.error(f"Connection error: {e}")

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

elif tool_selection == "Comic Generator":
    st.subheader("AI Comic Book Generator")
    with st.form("comic_gen_form"):
        col1, col2 = st.columns(2)
        with col1:
            comic_topic = st.text_input("Comic Topic / Story Idea", "The Life of a Red Blood Cell")
            comic_grade = st.text_input("Target Grade Level", "3rd Grade")
        with col2:
            comic_panels = st.number_input("Number of Panels", min_value=1, max_value=10, value=3)
            comic_language = st.text_input("Language", "English")
        
        comic_submitted = st.form_submit_button("Generate Comic")

    if comic_submitted:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required.")
        else:
            payload = {
                "instructions": comic_topic,
                "grade_level": comic_grade,
                "num_panels": comic_panels,
                "language": comic_language
            }
            url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/comic_generation"
            st.info(f"Sending request to: `{url}`")
            
            try:
                # Containers for different parts of the stream
                status_container = st.empty()
                story_expander = st.expander("Read Story Script", expanded=False)
                panels_container = st.container()

                with st.spinner("Starting comic generation..."):
                    response = requests.post(url, json=payload, stream=True)
                    
                    if response.status_code != 200:
                        st.error(f"Error {response.status_code}: {response.text}")
                    else:
                        # Process the stream
                        for line in response.iter_lines():
                            if line and line.startswith(b"data:"):
                                try:
                                    event = json.loads(line[5:].strip())
                                    msg_type = event.get("type")
                                    
                                    if msg_type == "story_prompts":
                                        with story_expander:
                                            st.markdown("### Generated Story & Prompts")
                                            st.text(event.get("content"))
                                        status_container.info("Story generated! Creating panels...")
                                        
                                    elif msg_type == "panel_info":
                                        idx = event.get("index")
                                        status_container.info(f"🎨 Generatng artwork for Panel {idx}...")
                                        
                                    elif msg_type == "panel_image":
                                        idx = event.get("index")
                                        img_url = event.get("url")
                                        footer_text = event.get("footer_text", "")
                                        prompt_used = event.get("prompt_used", "")
                                        
                                        with panels_container:
                                            st.markdown(f"### Panel {idx}")
                                            st.image(img_url, use_column_width=True)
                                            if footer_text:
                                                st.caption(f"**Dialogue:** {footer_text}")
                                            with st.expander("View Visual Prompt"):
                                                st.write(prompt_used)
                                            st.divider()
                                            
                                    elif msg_type == "panel_error":
                                        idx = event.get("index")
                                        err_msg = event.get("message")
                                        st.error(f"Error in Panel {idx}: {err_msg}")
                                        
                                    elif msg_type == "done":
                                        status_container.success("✅ Comic Generation Complete!")
                                        
                                    elif msg_type == "error":
                                        st.error(f"Server Error: {event.get('message')}")
                                        
                                except json.JSONDecodeError:
                                    continue
                                    
            except requests.exceptions.RequestException as e:
                st.error(f"Connection error: {e}")

elif tool_selection == "AI Tutor":
    st.subheader("🤖 AI Tutor - Interactive Teaching Assistant")
    st.markdown("Chat with the AI Tutor to get help with teaching, lesson planning, and educational content.")
    
    # Initialize chat history
    if "ai_tutor_history" not in st.session_state:
        st.session_state.ai_tutor_history = []
    
    # Clear history button (outside form)
    if st.session_state.ai_tutor_history:
        if st.button("🗑️ Clear Chat History", use_container_width=True):
            st.session_state.ai_tutor_history = []
            st.rerun()
    
    # Display chat history
    if st.session_state.ai_tutor_history:
        st.markdown("### 💬 Conversation History")
        for msg in st.session_state.ai_tutor_history:
            if msg["role"] == "user":
                with st.chat_message("user"):
                    st.write(msg["content"])
            else:
                with st.chat_message("assistant"):
                    st.write(msg["content"])
                    if msg.get("image_result"):
                        st.image(msg["image_result"], caption="Generated Image")
    
    with st.form("ai_tutor_form"):
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("### Teacher & Student Info")
            tutor_teacher_id = st.text_input("Teacher ID", teacher_id, key="tutor_teacher_id")
            tutor_student_name = st.text_input("Student Name (optional)", "", key="tutor_student_name")
            tutor_student_grade = st.text_input("Student Grade (optional)", "", key="tutor_student_grade")
            tutor_student_learning_style = st.selectbox(
                "Student Learning Style (optional)",
                ["", "Visual", "Auditory", "Kinesthetic", "Reading/Writing"],
                key="tutor_student_learning_style"
            )
        with col2:
            st.markdown("### Content Context")
            tutor_topic = st.text_input("Topic (optional)", "", key="tutor_topic")
            tutor_subject = st.text_input("Subject (optional)", "", key="tutor_subject")
            tutor_content_type = st.selectbox(
                "Content Type (optional)",
                ["", "lesson_plan", "presentation", "worksheet", "assessment"],
                key="tutor_content_type"
            )
            tutor_language = st.text_input("Language", "English", key="tutor_language")
        
        st.markdown("### Document & Message")
        tutor_doc_url = st.text_input(
            "Document URL (optional)",
            "",
            help="URL to a document (PDF, DOCX, TXT) that the AI Tutor can reference",
            key="tutor_doc_url"
        )
        tutor_message = st.text_area(
            "Your Message",
            "Help me create a lesson plan for teaching Newton's Laws of Motion to 10th grade students.",
            height=100,
            key="tutor_message"
        )
        
        tutor_stream = st.checkbox("Stream Output", value=True, key="tutor_stream")
        tutor_submit = st.form_submit_button("Send to AI Tutor", use_container_width=True)
    
    if tutor_submit:
        session_id = st.session_state.session_id.strip()
        if not session_id:
            st.error("Session ID is required. Please create one in the sidebar.")
        elif not tutor_message.strip():
            st.error("Please enter a message to send to the AI Tutor.")
        else:
            # Build payload
            payload = {
                "message": tutor_message,
                "language": tutor_language,
            }
            
            # Add optional fields only if provided
            if tutor_topic:
                payload["topic"] = tutor_topic
            if tutor_subject:
                payload["subject"] = tutor_subject
            if tutor_content_type:
                payload["content_type"] = tutor_content_type
            if tutor_doc_url:
                payload["doc_url"] = tutor_doc_url
            
            # Build student_data if any student info provided
            student_data = {}
            if tutor_student_name:
                student_data["name"] = tutor_student_name
            if tutor_student_grade:
                student_data["grade"] = tutor_student_grade
            if tutor_student_learning_style:
                student_data["learning_style"] = tutor_student_learning_style
            
            if student_data:
                payload["student_data"] = student_data
            
            # Teacher data (can be extended)
            payload["teacher_data"] = {}
            
            # Build URL
            base_url = f"{api_base_url}/api/session/teacher/{tutor_teacher_id}/stream-chat"
            url = f"{base_url}?session_id={session_id}&stream={str(tutor_stream).lower()}"
            
            st.info(f"📡 Sending request to: `{url}`")
            
            try:
                if tutor_stream:
                    # Stream response
                    placeholder = st.empty()
                    full_response = ""
                    image_result = None
                    token_usage = {}
                    
                    with st.spinner("🤖 AI Tutor is thinking..."):
                        response = requests.post(url, json=payload, stream=True, timeout=300)
                        
                        if response.status_code != 200:
                            st.error(f"❌ Error {response.status_code}: {response.text}")
                        else:
                            for line in response.iter_lines():
                                if line and line.startswith(b"data:"):
                                    try:
                                        event = json.loads(line[5:].strip())
                                        
                                        if event.get("type") == "content":
                                            data = event.get("data", {})
                                            full_response = data.get("full_response", "")
                                            is_complete = data.get("is_complete", False)
                                            
                                            if is_complete:
                                                # Final response
                                                image_result = data.get("image_result")
                                                token_usage = data.get("token_usage", {})
                                                
                                                placeholder.empty()
                                                
                                                # Add both user and assistant messages to history
                                                st.session_state.ai_tutor_history.append({
                                                    "role": "user",
                                                    "content": tutor_message
                                                })
                                                st.session_state.ai_tutor_history.append({
                                                    "role": "assistant",
                                                    "content": full_response,
                                                    "image_result": image_result
                                                })
                                                
                                                if token_usage:
                                                    st.caption(f"📊 Token Usage: {token_usage.get('total_tokens', 0)} tokens")
                                                
                                                st.success("✅ Response complete!")
                                                st.rerun()
                                            else:
                                                # Streaming in progress
                                                placeholder.markdown(f"**AI Tutor:** {full_response}▌")
                                        
                                        elif event.get("type") == "error":
                                            error_msg = event.get("data", {}).get("error", "Unknown error")
                                            st.error(f"❌ Error: {error_msg}")
                                        
                                        elif event.get("type") == "metadata":
                                            metadata = event.get("data", {})
                                            token_usage = metadata.get("token_usage", {})
                                            if token_usage:
                                                st.caption(f"📊 Token Usage: {token_usage.get('total_tokens', 0)} tokens")
                                        
                                        elif event.get("type") == "done":
                                            st.success("✅ Conversation complete!")
                                    
                                    except json.JSONDecodeError:
                                        continue
                    
                    # Clear placeholder if still showing
                    placeholder.empty()
                
                else:
                    # Non-streaming response
                    with st.spinner("🤖 AI Tutor is thinking..."):
                        response = requests.post(url, json=payload, timeout=300)
                        
                        if response.status_code == 200:
                            data = response.json()
                            st.success("✅ Response received!")
                            
                            # Add to history
                            st.session_state.ai_tutor_history.append({
                                "role": "user",
                                "content": tutor_message
                            })
                            st.session_state.ai_tutor_history.append({
                                "role": "assistant",
                                "content": data.get("full_response", ""),
                                "image_result": data.get("image_result")
                            })
                            
                            st.rerun()
                        else:
                            st.error(f"❌ Error {response.status_code}: {response.text}")
            
            except requests.exceptions.Timeout:
                st.error("⏱️ Request timed out. Please try again.")
            except requests.exceptions.RequestException as e:
                st.error(f"❌ Connection error: {e}")

elif tool_selection == "Student AI Tutor":
    st.subheader("🎓 Student AI Tutor - Study Buddy")
    st.markdown("Chat with your AI Study Buddy to get help with homework, assignments, and learning concepts.")
    
    # Initialize chat history
    if "student_ai_tutor_history" not in st.session_state:
        st.session_state.student_ai_tutor_history = []
    
    # Clear history button (outside form)
    if st.session_state.student_ai_tutor_history:
        if st.button("🗑️ Clear Chat History", use_container_width=True, key="clear_student_history"):
            st.session_state.student_ai_tutor_history = []
            st.rerun()
    
    # Display chat history
    if st.session_state.student_ai_tutor_history:
        st.markdown("### 💬 Conversation History")
        for msg in st.session_state.student_ai_tutor_history:
            if msg["role"] == "user":
                with st.chat_message("user"):
                    st.write(msg["content"])
            else:
                with st.chat_message("assistant"):
                    st.write(msg["content"])
                    if msg.get("image_result"):
                        st.image(msg["image_result"], caption="Generated Image")
    
    with st.form("student_ai_tutor_form"):
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("### Student Profile")
            student_id = st.text_input("Student ID", "student_123", key="student_tutor_id")
            student_name = st.text_input("Student Name", "", key="student_name")
            student_grade = st.text_input("Grade Level", "", key="student_grade")
            student_learning_style = st.selectbox(
                "Learning Style",
                ["", "Visual", "Auditory", "Kinesthetic", "Reading/Writing"],
                key="student_learning_style"
            )
        with col2:
            st.markdown("### Study Context")
            student_topic = st.text_input("Topic (optional)", "", key="student_topic")
            student_subject = st.text_input("Subject (optional)", "", key="student_subject")
            student_language = st.text_input("Language", "English", key="student_language")
        
        st.markdown("### Assignments & Achievements")
        col3, col4 = st.columns(2)
        with col3:
            pending_assignments_text = st.text_area(
                "Pending Assignments (one per line)",
                "",
                help="List assignments you're working on, e.g., 'Math homework - Chapter 5', 'Science project - Water cycle'",
                key="student_assignments",
                height=100
            )
        with col4:
            achievements_text = st.text_area(
                "Recent Achievements (one per line)",
                "",
                help="List recent accomplishments, e.g., 'Completed Algebra quiz', 'Submitted essay'",
                key="student_achievements",
                height=100
            )
        
        st.markdown("### Document & Message")
        student_doc_url = st.text_input(
            "Document URL (optional)",
            "",
            help="URL to a document (PDF, DOCX, TXT) that the Study Buddy can reference",
            key="student_doc_url"
        )
        student_message = st.text_area(
            "Your Question or Message",
            "Help me understand photosynthesis. I'm confused about how plants make food.",
            height=100,
            key="student_message"
        )
        
        student_stream = st.checkbox("Stream Output", value=True, key="student_stream")
        student_submit = st.form_submit_button("Send to Study Buddy", use_container_width=True)
    
    if student_submit:
        # Session will be created automatically by the endpoint if not provided
        student_session_id = st.session_state.get("student_session_id", "")
        
        if not student_session_id:
            # Generate a session ID (will be created by backend if needed)
            student_session_id = str(uuid.uuid4())
            st.session_state.student_session_id = student_session_id
        
        if student_submit:
            if not student_message.strip():
                st.error("Please enter a message to send to the Study Buddy.")
            else:
                # Build payload
                payload = {
                    "message": student_message,
                    "language": student_language,
                }
                
                # Add optional fields
                if student_topic:
                    payload["topic"] = student_topic
                if student_subject:
                    payload["subject"] = student_subject
                if student_doc_url:
                    payload["doc_url"] = student_doc_url
                
                # Build student_profile
                student_profile = {}
                if student_name:
                    student_profile["name"] = student_name
                if student_grade:
                    student_profile["grade"] = student_grade
                if student_learning_style:
                    student_profile["learning_style"] = student_learning_style
                
                if student_profile:
                    payload["student_profile"] = student_profile
                
                # Parse pending assignments
                if pending_assignments_text.strip():
                    assignments = [{"title": line.strip(), "status": "pending"} 
                                 for line in pending_assignments_text.strip().split("\n") 
                                 if line.strip()]
                    if assignments:
                        payload["pending_assignments"] = assignments
                
                # Parse achievements
                if achievements_text.strip():
                    achievements = [line.strip() 
                                  for line in achievements_text.strip().split("\n") 
                                  if line.strip()]
                    if achievements:
                        payload["achievements"] = achievements
                
                # Build URL
                base_url = f"{api_base_url}/api/session/student/{student_id}/stream-chat"
                url = f"{base_url}?session_id={student_session_id}&stream={str(student_stream).lower()}"
                
                st.info(f"📡 Sending request to: `{url}`")
                
                try:
                    if student_stream:
                        # Stream response
                        placeholder = st.empty()
                        full_response = ""
                        image_result = None
                        token_usage = {}
                        
                        with st.spinner("🎓 Study Buddy is thinking..."):
                            response = requests.post(url, json=payload, stream=True, timeout=300)
                            
                            if response.status_code != 200:
                                st.error(f"❌ Error {response.status_code}: {response.text}")
                            else:
                                for line in response.iter_lines():
                                    if line and line.startswith(b"data:"):
                                        try:
                                            event = json.loads(line[5:].strip())
                                            
                                            if event.get("type") == "status":
                                                # Handle status updates
                                                status_data = event.get("data", {})
                                                status_msg = status_data.get("message", "Processing...")
                                                placeholder.markdown(f"**{status_msg}**")
                                            
                                            elif event.get("type") == "content":
                                                data = event.get("data", {})
                                                full_response = data.get("full_response", "")
                                                is_complete = data.get("is_complete", False)
                                                
                                                if is_complete:
                                                    # Final response
                                                    image_result = data.get("image_result")
                                                    token_usage = data.get("token_usage", {})
                                                    
                                                    placeholder.empty()
                                                    
                                                    # Add both user and assistant messages to history
                                                    st.session_state.student_ai_tutor_history.append({
                                                        "role": "user",
                                                        "content": student_message
                                                    })
                                                    st.session_state.student_ai_tutor_history.append({
                                                        "role": "assistant",
                                                        "content": full_response,
                                                        "image_result": image_result
                                                    })
                                                    
                                                    if token_usage:
                                                        st.caption(f"📊 Token Usage: {token_usage.get('total_tokens', 0)} tokens")
                                                    
                                                    st.success("✅ Response complete!")
                                                    st.rerun()
                                                else:
                                                    # Streaming in progress
                                                    placeholder.markdown(f"**Study Buddy:** {full_response}▌")

                                            elif event.get("type") == "error":
                                                error_msg = event.get("data", {}).get("error", "Unknown error")
                                                st.error(f"❌ Error: {error_msg}")
                                            
                                            elif event.get("type") == "metadata":
                                                metadata = event.get("data", {})
                                                token_usage = metadata.get("token_usage", {})
                                                if token_usage:
                                                    st.caption(f"📊 Token Usage: {token_usage.get('total_tokens', 0)} tokens")
                                            
                                            elif event.get("type") == "done":
                                                st.success("✅ Conversation complete!")
                                        
                                        except json.JSONDecodeError:
                                            continue
                        
                        # Clear placeholder if still showing
                        placeholder.empty()
                    
                    else:
                        # Non-streaming response
                        with st.spinner("🎓 Study Buddy is thinking..."):
                            response = requests.post(url, json=payload, timeout=300)
                            
                            if response.status_code == 200:
                                data = response.json()
                                st.success("✅ Response received!")
                                
                                # Add to history
                                st.session_state.student_ai_tutor_history.append({
                                    "role": "user",
                                    "content": student_message
                                })
                                st.session_state.student_ai_tutor_history.append({
                                    "role": "assistant",
                                    "content": data.get("full_response", ""),
                                    "image_result": data.get("image_result")
                                })
                                
                                st.rerun()
                            else:
                                st.error(f"❌ Error {response.status_code}: {response.text}")
                
                except requests.exceptions.Timeout:
                    st.error("⏱️ Request timed out. Please try again.")
                except requests.exceptions.RequestException as e:
                    st.error(f"❌ Connection error: {e}")

elif tool_selection == "Teacher Voice Agent":
    st.subheader("🎙️ Realtime Teacher Voice Agent")
    st.markdown("""
    Speak with the AI Teaching Assistant in real-time. 
    **Note:** This uses your browser microphone. Ensure you have granted permission.
    """)

    # Inputs for the voice agent context
    col1, col2 = st.columns(2)
    with col1:
        v_teacher_name = st.text_input("Teacher Name", "Mr. Anderson")
        v_subject = st.text_input("Subject Context", "Physics")
    with col2:
        v_grade = st.text_input("Grade Level", "10th Grade")
        v_voice = st.selectbox("AI Voice", ["shimmer", "alloy", "echo"])

    v_instructions = st.text_area("Specific Instructions for this Session", 
                                "I need help brainstorming ideas for explaining relativity.")

    # Check session
    session_id = st.session_state.session_id.strip()
    if not session_id:
        st.error("⚠️ Session ID is missing. Please create one in the sidebar first.")
    else:
        # APIs for JS
        connect_url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/voice_agent/connect"
        disconnect_url = f"{api_base_url}/api/teacher/{teacher_id}/session/{session_id}/voice_agent/disconnect"
        
        # Prepare initial payload data for the JS to send
        context_data = {
            "teacher_name": v_teacher_name,
            "subject": v_subject,
            "grade": v_grade,
            "instructions": v_instructions,
            "voice": v_voice,
            "type": "offer"
        }
        context_json = json.dumps(context_data)

        # HTML/JS Component with Transcription Logic
        components.html(
            f"""
            <html>
            <head>
                <style>
                    body {{ font-family: sans-serif; color: #333; padding: 10px; background: transparent; }}
                    .controls {{ display: flex; gap: 10px; margin-bottom: 10px; }}
                    button {{
                        padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;
                        transition: background 0.2s;
                    }}
                    #startBtn {{ background-color: #28a745; color: white; }}
                    #startBtn:disabled {{ background-color: #94d3a2; cursor: not-allowed; }}
                    #stopBtn {{ background-color: #dc3545; color: white; }}
                    #stopBtn:disabled {{ background-color: #e4babc; cursor: not-allowed; }}
                    
                    #status {{ margin-top: 10px; font-size: 0.9em; padding: 5px; border-radius: 4px; margin-bottom: 10px; }}
                    .status-ready {{ background-color: #e2e3e5; color: #383d41; }}
                    .status-connecting {{ background-color: #fff3cd; color: #856404; }}
                    .status-active {{ background-color: #d4edda; color: #155724; }}
                    .status-error {{ background-color: #f8d7da; color: #721c24; }}
                    
                    .visualizer {{ height: 4px; background: #ddd; width: 100%; margin-top: 10px; border-radius: 2px; overflow: hidden; }}
                    .bar {{ height: 100%; width: 0%; background: #007bff; transition: width 0.1s; }}
                    
                    /* Chat/Transcription Area */
                    #transcriptBox {{
                        margin-top: 20px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 10px;
                        height: 300px;
                        overflow-y: auto;
                        background-color: #f9f9f9;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }}
                    .msg {{ padding: 8px 12px; border-radius: 12px; max-width: 80%; font-size: 0.95em; line-height: 1.4; }}
                    .msg-teacher {{ align-self: flex-end; background-color: #dcf8c6; color: #000; border-bottom-right-radius: 2px; }}
                    .msg-ai {{ align-self: flex-start; background-color: #fff; border: 1px solid #eee; color: #333; border-bottom-left-radius: 2px; }}
                    .sender {{ font-size: 0.75em; color: #666; margin-bottom: 2px; display: block; }}
                </style>
            </head>
            <body>
                <div class="controls">
                    <button id="startBtn" onclick="startCall()">📞 Start Call</button>
                    <button id="stopBtn" onclick="stopCall()" disabled>⏹️ End Call</button>
                </div>
                <div id="status" class="status-ready">Ready to connect...</div>
                
                <div class="visualizer"><div id="audioBar" class="bar"></div></div>
                
                <!-- Transcription Display -->
                <div id="transcriptBox">
                    <div style="text-align:center; color:#999; font-size:0.9em; margin-top:100px;" id="emptyMsg">
                        <i>Transcriptions will appear here...</i>
                    </div>
                </div>

                <!-- Hidden audio element -->
                <audio id="remoteAudio" autoplay></audio>

                <script>
                    let pc = null;
                    let localStream = null;
                    let dc = null; // Data Channel
                    
                    const CONNECT_URL = "{connect_url}";
                    const DISCONNECT_URL = "{disconnect_url}";
                    const CONTEXT_DATA = {context_json};

                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const statusDiv = document.getElementById('status');
                    const audioBar = document.getElementById('audioBar');
                    const transcriptBox = document.getElementById('transcriptBox');
                    const emptyMsg = document.getElementById('emptyMsg');

                    function updateStatus(msg, type) {{
                        statusDiv.textContent = msg;
                        statusDiv.className = 'status-' + type;
                    }}

                    function addTranscript(role, text) {{
                        if (emptyMsg) emptyMsg.style.display = 'none';
                        
                        const div = document.createElement('div');
                        div.className = 'msg ' + (role === 'You' ? 'msg-teacher' : 'msg-ai');
                        
                        const sender = document.createElement('span');
                        sender.className = 'sender';
                        sender.innerText = role;
                        
                        const content = document.createElement('span');
                        content.innerText = text;
                        
                        div.appendChild(sender);
                        div.appendChild(content);
                        transcriptBox.appendChild(div);
                        
                        // Scroll to bottom
                        transcriptBox.scrollTop = transcriptBox.scrollHeight;
                    }}

                    async function startCall() {{
                        startBtn.disabled = true;
                        updateStatus("Requesting Microphone...", "connecting");

                        try {{
                            // 1. Get User Media
                            localStream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
                            setupVisualizer(localStream);

                            // 2. Create Peer Connection
                            pc = new RTCPeerConnection();

                            // 3. Add Audio Tracks
                            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

                            // 4. Handle Incoming Audio
                            pc.ontrack = (event) => {{
                                const remoteAudio = document.getElementById('remoteAudio');
                                remoteAudio.srcObject = event.streams[0];
                                updateStatus("Voice Agent Connected", "active");
                                stopBtn.disabled = false;
                            }};

                            // 5. Create Data Channel (for Events/Transcription)
                            // We create it here, so the server can accept it and relay OAI events back
                            dc = pc.createDataChannel("oai-events");
                            
                            dc.onopen = () => console.log("Data Channel Opened");
                            
                            dc.onmessage = (event) => {{
                                try {{
                                    const data = JSON.parse(event.data);
                                    
                                    // 1. Teacher Transcription Event
                                    if (data.type === 'conversation.item.input_audio_transcription.completed') {{
                                        const text = data.transcript;
                                        if (text) addTranscript("You", text);
                                    }}
                                    
                                    // 2. AI Transcription Event
                                    else if (data.type === 'response.audio_transcript.done') {{
                                        const text = data.transcript;
                                        if (text) addTranscript("AI Tutor", text);
                                    }}
                                }} catch (e) {{
                                    console.error("Error parsing DC message", e);
                                }}
                            }};

                            // 6. Create Offer
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);

                            updateStatus("Connecting to AI Server...", "connecting");

                            // 7. Send to Backend
                            const payload = {{
                                ...CONTEXT_DATA,
                                sdp: offer.sdp
                            }};

                            const response = await fetch(CONNECT_URL, {{
                                method: "POST",
                                headers: {{ "Content-Type": "application/json" }},
                                body: JSON.stringify(payload)
                            }});

                            if (!response.ok) throw new Error("Server Error: " + response.statusText);

                            const data = await response.json();

                            // 8. Set Remote Description
                            const answer = new RTCSessionDescription({{
                                type: data.type,
                                sdp: data.sdp
                            }});
                            await pc.setRemoteDescription(answer);

                        }} catch (err) {{
                            console.error(err);
                            updateStatus("Error: " + err.message, "error");
                            stopCall();
                        }}
                    }}

                    async function stopCall() {{
                        updateStatus("Disconnecting...", "ready");
                        if (dc) {{ dc.close(); dc = null; }}
                        if (pc) {{ pc.close(); pc = null; }}
                        if (localStream) {{
                            localStream.getTracks().forEach(track => track.stop());
                            localStream = null;
                        }}
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                        audioBar.style.width = '0%';
                        
                        try {{
                            await fetch(DISCONNECT_URL, {{ method: "POST" }});
                            updateStatus("Call Ended", "ready");
                        }} catch (e) {{ console.log("Disconnect signal failed", e); }}
                    }}

                    function setupVisualizer(stream) {{
                        const audioContext = new AudioContext();
                        const src = audioContext.createMediaStreamSource(stream);
                        const analyser = audioContext.createAnalyser();
                        src.connect(analyser);
                        analyser.fftSize = 32;
                        const bufferLength = analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);

                        function renderFrame() {{
                            if (!localStream) return;
                            requestAnimationFrame(renderFrame);
                            analyser.getByteFrequencyData(dataArray);
                            const avg = dataArray.reduce((a,b) => a+b, 0) / bufferLength;
                            audioBar.style.width = Math.min(100, avg * 2) + '%';
                        }}
                        renderFrame();
                    }}
                </script>
            </body>
            </html>
            """,
            height=500, # Increased height for chat box
        )

elif tool_selection == "Student Voice Agent":
    st.subheader("🎧 Student Study Buddy (Voice)")
    st.markdown("""
    **Real-time Voice Interaction for Students.**  
    Discuss homework, ask questions, and review pending assignments with your AI Study Buddy.
    *Requires Microphone Access.*
    """)

    col1, col2 = st.columns(2)
    with col1:
        sv_student_id = st.text_input("Student ID", "student_456", key="sv_id")
        sv_name = st.text_input("Student Name", "Jamie", key="sv_name")
        sv_grade = st.text_input("Grade Level", "8th Grade", key="sv_grade")
    with col2:
        sv_subject = st.text_input("Subject Focus", "General Science", key="sv_subject")
        sv_voice = st.selectbox("Buddy Voice", ["alloy", "echo", "shimmer"], index=0, key="sv_voice")
        
    sv_assignments_raw = st.text_area(
        "Pending Assignments (one per line)", 
        "Lab Report on Photosynthesis\nMath Worksheet Ch.4",
        help="These will be passed to the AI so it knows what you need to work on."
    )

    # Parse assignments for the API schema
    sv_pending_assignments = []
    if sv_assignments_raw.strip():
        lines = sv_assignments_raw.strip().split('\n')
        for line in lines:
            if line.strip():
                # Schema expects list of dicts
                sv_pending_assignments.append({"title": line.strip(), "due": "Upcoming"})

    # Initialize Student Session ID independent of Teacher/Global session
    if "student_session_id" not in st.session_state or not st.session_state.student_session_id:
        st.session_state.student_session_id = str(uuid.uuid4())
    
    st.markdown("### Session Configuration")
    student_session_id = st.text_input("Student Session ID", st.session_state.student_session_id, key="voice_student_sess_id")
    st.session_state.student_session_id = student_session_id

    # Build URLs using student_session_id
    # Endpoint: /api/session/student/{student_id}/voice_agent/connect
    connect_url = f"{api_base_url}/api/session/student/{sv_student_id}/voice_agent/connect?session_id={student_session_id}"
    disconnect_url = f"{api_base_url}/api/session/student/{sv_student_id}/voice_agent/disconnect?session_id={student_session_id}"
    
    # Prepare Context Data matching StudentVoiceSchema
    context_data = {
        "student_name": sv_name,
        "grade": sv_grade,
        "subject": sv_subject,
        "pending_assignments": sv_pending_assignments,
        "completed_assignments": [], # Optional, leaving empty for now
        "voice": sv_voice,
        "type": "offer"
    }
    context_json = json.dumps(context_data)

    # Reuse the HTML/JS Component (Logic is identical, just endpoints and context differ)
    components.html(
        f"""
        <html>
        <head>
            <style>
                body {{ font-family: sans-serif; color: #333; padding: 10px; background: transparent; }}
                .controls {{ display: flex; gap: 10px; margin-bottom: 10px; }}
                button {{
                    padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;
                    transition: background 0.2s;
                }}
                #startBtn {{ background-color: #007bff; color: white; }}
                #startBtn:disabled {{ background-color: #8bbaf0; cursor: not-allowed; }}
                #stopBtn {{ background-color: #dc3545; color: white; }}
                #stopBtn:disabled {{ background-color: #e4babc; cursor: not-allowed; }}
                
                #status {{ margin-top: 10px; font-size: 0.9em; padding: 5px; border-radius: 4px; margin-bottom: 10px; }}
                .status-ready {{ background-color: #e2e3e5; color: #383d41; }}
                .status-connecting {{ background-color: #fff3cd; color: #856404; }}
                .status-active {{ background-color: #d4edda; color: #155724; }}
                .status-error {{ background-color: #f8d7da; color: #721c24; }}
                
                .visualizer {{ height: 4px; background: #ddd; width: 100%; margin-top: 10px; border-radius: 2px; overflow: hidden; }}
                .bar {{ height: 100%; width: 0%; background: #28a745; transition: width 0.1s; }}
                
                /* Chat/Transcription Area */
                #transcriptBox {{
                    margin-top: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 10px;
                    height: 300px;
                    overflow-y: auto;
                    background-color: #f9f9f9;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }}
                .msg {{ padding: 8px 12px; border-radius: 12px; max-width: 80%; font-size: 0.95em; line-height: 1.4; }}
                .msg-student {{ align-self: flex-end; background-color: #cce5ff; color: #004085; border-bottom-right-radius: 2px; }}
                .msg-ai {{ align-self: flex-start; background-color: #fff; border: 1px solid #eee; color: #333; border-bottom-left-radius: 2px; }}
                .sender {{ font-size: 0.75em; color: #666; margin-bottom: 2px; display: block; }}
            </style>
        </head>
        <body>
            <div class="controls">
                <button id="startBtn" onclick="startCall()">🎧 Start Session</button>
                <button id="stopBtn" onclick="stopCall()" disabled>⏹️ End Session</button>
            </div>
            <div id="status" class="status-ready">Ready to study...</div>
            
            <div class="visualizer"><div id="audioBar" class="bar"></div></div>
            
            <div id="transcriptBox">
                <div style="text-align:center; color:#999; font-size:0.9em; margin-top:100px;" id="emptyMsg">
                    <i>Conversation transcript...</i>
                </div>
            </div>

            <audio id="remoteAudio" autoplay></audio>

            <script>
                let pc = null;
                let localStream = null;
                let dc = null;
                
                const CONNECT_URL = "{connect_url}";
                const DISCONNECT_URL = "{disconnect_url}";
                const CONTEXT_DATA = {context_json};

                const startBtn = document.getElementById('startBtn');
                const stopBtn = document.getElementById('stopBtn');
                const statusDiv = document.getElementById('status');
                const audioBar = document.getElementById('audioBar');
                const transcriptBox = document.getElementById('transcriptBox');
                const emptyMsg = document.getElementById('emptyMsg');

                function updateStatus(msg, type) {{
                    statusDiv.textContent = msg;
                    statusDiv.className = 'status-' + type;
                }}

                function addTranscript(role, text) {{
                    if (emptyMsg) emptyMsg.style.display = 'none';
                    const div = document.createElement('div');
                    div.className = 'msg ' + (role === 'You' ? 'msg-student' : 'msg-ai');
                    
                    const sender = document.createElement('span');
                    sender.className = 'sender';
                    sender.innerText = role;
                    
                    const content = document.createElement('span');
                    content.innerText = text;
                    
                    div.appendChild(sender);
                    div.appendChild(content);
                    transcriptBox.appendChild(div);
                    transcriptBox.scrollTop = transcriptBox.scrollHeight;
                }}

                async function startCall() {{
                    startBtn.disabled = true;
                    updateStatus("Requesting Microphone...", "connecting");

                    try {{
                        localStream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
                        setupVisualizer(localStream);

                        pc = new RTCPeerConnection();
                        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

                        pc.ontrack = (event) => {{
                            const remoteAudio = document.getElementById('remoteAudio');
                            remoteAudio.srcObject = event.streams[0];
                            updateStatus("Study Buddy Connected", "active");
                            stopBtn.disabled = false;
                        }};

                        dc = pc.createDataChannel("oai-events");
                        dc.onopen = () => console.log("Data Channel Opened");
                        
                        dc.onmessage = (event) => {{
                            try {{
                                const data = JSON.parse(event.data);
                                if (data.type === 'conversation.item.input_audio_transcription.completed') {{
                                    const text = data.transcript;
                                    if (text) addTranscript("You", text);
                                }}
                                else if (data.type === 'response.audio_transcript.done') {{
                                    const text = data.transcript;
                                    if (text) addTranscript("Buddy", text);
                                }}
                            }} catch (e) {{ console.error(e); }}
                        }};

                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);

                        updateStatus("Connecting to AI Server...", "connecting");

                        // Payload matches StudentVoiceSchema
                        const payload = {{
                            ...CONTEXT_DATA,
                            sdp: offer.sdp
                        }};

                        const response = await fetch(CONNECT_URL, {{
                            method: "POST",
                            headers: {{ "Content-Type": "application/json" }},
                            body: JSON.stringify(payload)
                        }});

                        if (!response.ok) throw new Error("Server Error: " + response.statusText);

                        const data = await response.json();
                        const answer = new RTCSessionDescription({{
                            type: data.type,
                            sdp: data.sdp
                        }});
                        await pc.setRemoteDescription(answer);

                    }} catch (err) {{
                        console.error(err);
                        updateStatus("Error: " + err.message, "error");
                        stopCall();
                    }}
                }}

                async function stopCall() {{
                    updateStatus("Disconnecting...", "ready");
                    if (dc) {{ dc.close(); dc = null; }}
                    if (pc) {{ pc.close(); pc = null; }}
                    if (localStream) {{
                        localStream.getTracks().forEach(track => track.stop());
                        localStream = null;
                    }}
                    startBtn.disabled = false;
                    stopBtn.disabled = true;
                    audioBar.style.width = '0%';
                    
                    try {{
                        await fetch(DISCONNECT_URL, {{ method: "POST" }});
                        updateStatus("Session Ended", "ready");
                    }} catch (e) {{ console.log("Disconnect signal failed", e); }}
                }}

                function setupVisualizer(stream) {{
                    const audioContext = new AudioContext();
                    const src = audioContext.createMediaStreamSource(stream);
                    const analyser = audioContext.createAnalyser();
                    src.connect(analyser);
                    analyser.fftSize = 32;
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    function renderFrame() {{
                        if (!localStream) return;
                        requestAnimationFrame(renderFrame);
                        analyser.getByteFrequencyData(dataArray);
                        const avg = dataArray.reduce((a,b) => a+b, 0) / bufferLength;
                        audioBar.style.width = Math.min(100, avg * 2) + '%';
                    }}
                    renderFrame();
                }}
            </script>
        </body>
        </html>
        """,
        height=500,
    )