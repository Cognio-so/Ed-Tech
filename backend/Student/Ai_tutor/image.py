"""
Image generation node for Student AI Tutor.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
import json
import re
import os
from typing import List, Dict, Any
import replicate  

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq

try:
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
except ImportError:
    from Student.Ai_tutor.graph_type import StudentGraphState


def _get_visual_type_instructions(visual_type: str) -> str:
    """
    Get specific instructions based on the visual type for educational images.
    
    Args:
        visual_type: The type of visual (diagram, chart, image, illustration)
        
    Returns:
        String with specific XML instructions for the visual type
    """
    instructions = {
        'diagram': (
            """<Diagram_Requirements>
                    <Title>DIAGRAM REQUIREMENTS</Title>
                    <Requirement>Create a technical or scientific diagram with clear structural elements.</Requirement>
                    <Requirement>Include labeled parts, components, or processes with connecting lines/arrows.</Requirement>
                    <Requirement>Use clean, technical drawing style with precise geometric shapes.</Requirement>
                    <Requirement>Show relationships, flow, or hierarchy between different elements.</Requirement>
                    <Requirement>Include process steps, system components, or anatomical parts as needed.</Requirement>
                    <Requirement>Use consistent visual language and symbols throughout.</Requirement>
                    <Requirement>Make it suitable for educational explanation and understanding.</Requirement>
                </Diagram_Requirements>"""
        ),
        'chart': (
            """<Chart_Requirements>
                    <Title>CHART REQUIREMENTS</Title>
                    <Requirement>Create a data visualization with clear axes, labels, and data points.</Requirement>
                    <Requirement>Include proper chart elements: title, x-axis, y-axis, legend, data series.</Requirement>
                    <Requirement>Use appropriate chart type (bar, line, pie, scatter, etc.) based on the topic.</Requirement>
                    <Requirement>Ensure data is clearly represented with distinct colors and patterns.</Requirement>
                    <Requirement>Add grid lines or background elements for better readability.</Requirement>
                    <Requirement>Include numerical values and percentages where relevant.</Requirement>
                    <Requirement>Make it suitable for educational presentation and analysis.</Requirement>
                </Chart_Requirements>"""
        ),
        'image': (
            """<Image_Requirements>
                    <Title>IMAGE REQUIREMENTS</Title>
                    <Requirement>Create a general educational illustration or visual representation.</Requirement>
                    <Requirement>Focus on clear, engaging visual content that supports learning.</Requirement>
                    <Requirement>Include relevant visual elements, scenes, or concepts.</Requirement>
                    <Requirement>Use appropriate artistic style for the grade level and subject.</Requirement>
                    <Requirement>Ensure the image is informative and educational.</Requirement>
                    <Requirement>Include any necessary labels or annotations for clarity.</Requirement>
                    <Requirement>Make it visually appealing and suitable for classroom use.</Requirement>
                </Image_Requirements>"""
        ),
        'illustration': (
            """<Illustration_Requirements>
                    <Title>ILLUSTRATION REQUIREMENTS</Title>
                    <Requirement>Create an educational illustration that visually explains concepts.</Requirement>
                    <Requirement>Use clear, simple visual elements appropriate for the grade level.</Requirement>
                    <Requirement>Include relevant characters, objects, or scenes that support learning.</Requirement>
                    <Requirement>Use bright, engaging colors that are age-appropriate.</Requirement>
                    <Requirement>Ensure the illustration tells a story or explains a concept clearly.</Requirement>
                    <Requirement>Include labels or annotations if needed for educational clarity.</Requirement>
                    <Requirement>Make it visually appealing and suitable for student engagement.</Requirement>
                </Illustration_Requirements>"""
        )
    }
    
    return instructions.get(visual_type.lower(), instructions['image'])


def _detect_visual_type(query: str, subject: str = "") -> str:
    """
    Detect the visual type from the user query.
    
    Args:
        query: User's image generation query
        subject: Subject context if available
        
    Returns:
        Visual type: 'diagram', 'chart', 'image', or 'illustration'
    """
    query_lower = query.lower()
    
    # Check for explicit visual type mentions
    if any(word in query_lower for word in ['diagram', 'schematic', 'structure', 'process flow', 'system']):
        return 'diagram'
    elif any(word in query_lower for word in ['chart', 'graph', 'plot', 'data visualization', 'bar chart', 'pie chart']):
        return 'chart'
    elif any(word in query_lower for word in ['illustration', 'drawing', 'picture', 'scene']):
        return 'illustration'
    else:
        # Default based on subject
        if subject:
            subject_lower = subject.lower()
            if subject_lower in ['science', 'biology', 'chemistry', 'physics']:
                return 'diagram'
            elif subject_lower in ['mathematics', 'math', 'statistics']:
                return 'chart'
        return 'image'


async def _enhance_prompt_with_context(
    query: str,
    conversation: List[Dict[str, Any]],
    state: StudentGraphState = None,
) -> str:
    """
    Uses an LLM to generate an enhanced, detailed educational prompt for image generation
    based on the conversation history, current user query, and student context.
    Uses XML-structured prompts for educational image generation.
    """
    print("✨ Enhancing prompt with conversation context and educational focus...")

    history_str = ""
    for m in (conversation or [])[-6:]:  # Last 6 messages for context
        if hasattr(m, "content"):
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "")
        else:
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content", "")
        speaker = "User" if role in ("human", "user") else "Assistant"
        history_str += f"{speaker}: {content}\n"

    # Extract student context for age-appropriate image generation
    student_profile = state.get("student_profile") or {} if state else {}
    grade = ""
    subject = ""
    language = "English"
    
    if student_profile:
        grade = student_profile.get("grade", "")
        subject = student_profile.get("subject", "")
        language = student_profile.get("language", state.get("language", "English") if state else "English")
    
    if not language:
        language = state.get("language", "English") if state else "English"
    
    # Also check state directly for subject if not in profile
    if not subject and state:
        subject = state.get("subject", "")
    
    # Detect visual type from query
    visual_type = _detect_visual_type(query, subject)
    visual_type_instructions = _get_visual_type_instructions(visual_type)
    
    # Check if user explicitly references a previous prompt
    reference_keywords = ["above prompt", "previous prompt", "that prompt", "based on what I said", 
                         "the one before", "generate image based on", "create image from", "same as before"]
    is_reference = any(keyword in query.lower() for keyword in reference_keywords)
    
    # Build XML-structured prompt (similar to teacher's image_gen.py)
    xml_prompt = f"""
<InstructionPrompt>
    <Role>
        You are an expert prompt engineer for an image generation model.
    </Role>
    <Task>
        Your task is to take the following schema and create a detailed, visually rich, and optimized prompt that generates a high-quality, educational {visual_type} with readable, properly positioned text labels suitable for a school-level {subject if subject else "general"} {visual_type}. The output must use image generation model strengths in structured visual composition and label clarity.
    </Task>

    <Constraints title="Important constraints">
        <Constraint>All text labels must be in **{language}**.</Constraint>
        <Constraint>All labels should be rendered in **clean, black, sans-serif font (like Arial or Helvetica)**.</Constraint>
        <Constraint>Labels must be inside **white rectangular or circular callout boxes** connected with clear lines or arrows to the correct parts.</Constraint>
        <Constraint>Avoid any artistic distortion, cursive, handwriting, or stylized fonts.</Constraint>
        <Constraint>Labels should be **concise and accurately spelled** without any distortions.</Constraint>
        <Constraint>Do not place labels diagonally or on complex textures; use **plain background zones** for clarity.</Constraint>
        <Constraint>Image must be age-appropriate for grade {grade if grade else "elementary/middle"} level students.</Constraint>
    </Constraints>

    <VisualTypeRequirements title="VISUAL TYPE SPECIFIC REQUIREMENTS">
        {visual_type_instructions}
    </VisualTypeRequirements>

    <Schema>
        <Topic>{query}</Topic>
        <Subject>{subject if subject else "General"}</Subject>
        <GradeLevel>{grade if grade else "Not specified"}</GradeLevel>
        <VisualType>{visual_type}</VisualType>
        <Language>{language}</Language>
        <Instructions>Create an educational {visual_type} about {query} suitable for {grade if grade else "student"} grade level learning</Instructions>
    </Schema>

    <GenerationGuidelines introduction="Based on this schema, generate a prompt. The prompt must:">
        <Guideline id="1">Be highly descriptive and provide rich visual details.</Guideline>
        <Guideline id="2">Include all relevant parts and their correct visual positions.</Guideline>
        <Guideline id="3">Specify that each label must be written in a **clear, legible font** in a white box near the corresponding part.</Guideline>
        <Guideline id="4">Ensure the style is visually appealing and age-appropriate for the given grade.</Guideline>
        <Guideline id="5">Explicitly list all labels that must appear for: {query} and ensure they are in **{language}**.</Guideline>
        <Guideline id="6" criticality="CRITICAL">Follow the visual type specific requirements above to ensure the generated image is a proper {visual_type}.</Guideline>
    </GenerationGuidelines>

    <ConversationHistory>
{history_str.strip() if history_str.strip() else "No previous conversation"}
    </ConversationHistory>

    <ReferenceRequest>
        <is_reference>{str(is_reference).lower()}</is_reference>
        <note>If is_reference is true, find the exact prompt in conversation history and return it EXACTLY AS WRITTEN. Do not modify or enhance.</note>
    </ReferenceRequest>

    <FinalOutput>
        Final Output Prompt should be natural, instructional, and not include markdown formatting.
        Return ONLY the final image generation prompt text - no explanations, no XML tags, no meta-commentary.
    </FinalOutput>
</InstructionPrompt>
"""

    system_prompt = """You are an expert prompt engineer for educational image generation models. Your task is to create detailed, optimized prompts that generate high-quality, age-appropriate educational images for student learning.

Your output must be ONLY the final image generation prompt text - no explanations, no XML, no meta-commentary. Just the prompt that will be sent directly to the image generation model."""

    human_prompt = xml_prompt

    try:
        groq_api_key = os.getenv("GROQ_API_KEY")
        llm_kwargs = {
            "model": "llama-3.1-8b-instant",
            "temperature": 0.5  # Higher temperature for creativity
        }
        if groq_api_key:
            llm_kwargs["groq_api_key"] = groq_api_key
        else:
            print("⚠️ GROQ_API_KEY not found, using default")
        llm = ChatGroq(**llm_kwargs)   
        response = await llm.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
        )
        enhanced_prompt = (response.content or "").strip()
        
        # Remove any quotes, XML tags, or markdown that might wrap the prompt
        enhanced_prompt = enhanced_prompt.strip('"\'`')
        # Remove XML tags if present
        enhanced_prompt = re.sub(r'<[^>]+>', '', enhanced_prompt)
        # Remove markdown code blocks if present
        enhanced_prompt = re.sub(r'```[a-z]*\n?', '', enhanced_prompt)
        enhanced_prompt = enhanced_prompt.strip()
        
        # If the prompt is too short or seems incomplete, enhance it with educational context
        if len(enhanced_prompt.split()) < 10 and not is_reference:
            if grade and subject:
                enhanced_prompt = f"An educational {visual_type} about {query} for {grade} grade {subject} students. {enhanced_prompt} All labels must be in {language} with clear, readable text in white callout boxes."
            else:
                enhanced_prompt = f"An educational {visual_type} about {query} suitable for student learning. {enhanced_prompt} All labels must be in {language} with clear, readable text."
        
        print(f"✨ Enhanced Educational Prompt: {enhanced_prompt[:200]}...")
        return enhanced_prompt
        
    except Exception as e:
        print(f"❌ Error in _enhance_prompt_with_context: {e}")
        print(f"✨ Fallback: Creating basic educational prompt from query")
        # Create a basic educational prompt as fallback
        if grade and subject:
            return f"An educational {visual_type} about {query} for {grade} grade {subject} students. Clear, age-appropriate visual with labels in {language}."
        else:
            return f"An educational {visual_type} about {query} suitable for student learning. Clear visual with labels in {language}."


async def _check_edit_intent(
    query: str,
    previous_images: List[str],
    conversation: List[Dict[str, Any]],
    state: StudentGraphState,
) -> bool:
    """
    Uses an LLM to decide if the user query is an edit
    request or a new image generation request.
    """
    print("🕵️ Checking for image edit intent...")
    history_str = ""
    for m in (conversation or [])[-2:]:
        if hasattr(m, "content"):
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "")
        else:
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content", "")
        speaker = "User" if role in ("human", "user") else "Assistant"
        history_str += f"{speaker}: {content}\n"

    system_prompt = """You are a simple AI router. Your only job is to decide if the user wants to EDIT a PREVIOUSLY generated image or create a NEW one.

Rules:
1. If "Previous images exist" is false, it's always a NEW image ("is_edit": false).
2. If the user query is an edit request (e.g., "make it...", "change...", "add...", "more realistic", "different color", "remove..."), it's an EDIT ("is_edit": true).
3. If the user query is a clear NEW request (e.g., "now create a...", "I also want a picture of...", "show me something else"), it's NEW ("is_edit": false).

Return ONLY valid JSON:
{"is_edit": true/false}"""

    human_prompt = f"""Previous images exist: {bool(previous_images)}
Last image URL: {previous_images[-1] if previous_images else 'None'}

Conversation History:
{history_str.strip()}

NEW User Query: "{query}"

Return ONLY the JSON.
"""

    try:
        groq_api_key = os.getenv("GROQ_API_KEY")
        llm_kwargs = {
            "model": "llama-3.1-8b-instant",
            "temperature": 0.4
        }
        if groq_api_key:
            llm_kwargs["groq_api_key"] = groq_api_key
        else:
            print("⚠️ GROQ_API_KEY not found, using default")
        llm = ChatGroq(**llm_kwargs)
        response = await llm.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
        )
        content = (response.content or "").strip()
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            result = json.loads(json_match.group(0))
            is_edit = bool(result.get("is_edit", False))
            print(f"🕵️ Edit Intent Result: {is_edit}")
            return is_edit
    except Exception as e:
        print(f"❌ Error in _check_edit_intent: {e}")
        if bool(previous_images) and len(query.split()) < 10:
            print("🕵️ Edit Intent Fallback: Assuming EDIT")
            return True

    print("🕵️ Edit Intent Fallback: Assuming NEW")
    return False


async def image_node(state: StudentGraphState) -> StudentGraphState:
    print("🖼️ Image Node Executing...")

    query =state.get("user_query", "")
    model = "black-forest-labs/flux-schnell"
    previous_images = state.get("img_urls", []) or state.get("edit_img_urls", [])
    print(f"🖼️ User Query: {query}")
    print(f"🖼️ Using Image Model: {model}")
    print(f"🖼️ Previous Images: {previous_images}")
    conversation = state.get("messages", [])
    is_edit_intent = await _check_edit_intent(
        query, previous_images, conversation, state
    )
    
    try:
        if is_edit_intent:
            print(f"📸 Detected EDIT intent. Modifying image...")
            image_to_edit = previous_images[-1] 
            
            output = await replicate.async_run(
                model,
                input={
                    "image_input": [image_to_edit],
                    "prompt": query,
                }
            )
        else:
            print(f"✨ Detected NEW image generation intent.")
        
            enhanced_prompt = await _enhance_prompt_with_context(query, conversation, state)
            
            print(f"   Using Model: {model}")
            print(f"   Original Query: {query}")
            print(f"   Enhanced Prompt: {enhanced_prompt}")
            
            output = await replicate.async_run(
                model,
                input={"prompt": enhanced_prompt}
            )

       
        if isinstance(output, list):
            first = output[0]
            if hasattr(first, "url"):
                image_url = first.url
            else:
                image_url = str(first)
        elif hasattr(output, "url"):
            image_url = output.url
        else:
            image_url = str(output)

        print("✅ Generated image URL:", image_url)
        
        # Store image URL in separate state
        img_urls = state.get("img_urls", [])
        if not img_urls:
            img_urls = []
        img_urls.append(image_url)
        state["img_urls"] = img_urls
        
        # Store in image_result for consistency with other nodes
        state["image_result"] = image_url
        
        # Also store in response for backward compatibility
        state["response"] = f"Image generated successfully! URL: {image_url}"
        
        # Add message to conversation history (using BaseMessage format if needed)
        from langchain_core.messages import AIMessage
        messages = state.get("messages", [])
        messages.append(AIMessage(content=f"Generated image: {image_url}"))
        state["messages"] = messages

    except Exception as e:
        print(f"❌ Error in image node: {e}")
        import traceback
        traceback.print_exc()
        state["response"] = f"Sorry, I couldn't process the image. Error: {e}"

    return state