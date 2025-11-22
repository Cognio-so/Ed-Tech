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

# UPDATED: Added "Comic Generator" to the list
tool_selection = st.radio(
    "Choose Generator",
    ["Content Generator", "Assessment Generator", "Web Search", "Image Generator", "Comic Generator", "AI Tutor"],
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