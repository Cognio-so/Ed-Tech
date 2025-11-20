import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Any, Dict, Awaitable, Callable, Optional
from backend.llm import get_llm, stream_with_token_tracking
from backend.utils.websearch import get_youtube_links
from langchain_core.messages import HumanMessage, SystemMessage

async def generate_lesson_plan(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None
) -> str:
    """
    Generates a lesson plan using an LLM based on the provided data.
    """
    
    grade = data.get("grade", "Unknown Grade")
    subject = data.get("subject", "Unknown Subject")
    topic = data.get("topic", "Unknown Topic")
    language = data.get("language", "English")
    learning_objective = data.get("learning_objective", "")
    emotional_consideration = data.get("emotional_consideration", 3)
    adaptive_learning = data.get("adaptive_learning", False)
    include_assessment = data.get("include_assessment", False)
    multimedia_suggestion = data.get("multimedia_suggestion", False)
    instruction_depth = data.get("instruction_depth", "Standard")
    number_of_sessions = data.get("number_of_sessions", "Not specified")
    duration_of_session = data.get("duration_of_session", "Not specified")

    multimedia_links = []
    if multimedia_suggestion:
        multimedia_links = await get_youtube_links(topic, max_results=3)
    if multimedia_suggestion:
        if multimedia_links:
            multimedia_prompt_block = "\n".join(
                f"            - {url}" for url in multimedia_links
            )
        else:
            multimedia_prompt_block = "            - (No live links available)"
    else:
        multimedia_prompt_block = ""

    xml_prompt = f"""
<lesson_plan_request>
    <context>
        <role>Expert Teacher and Curriculum Designer</role>
        <task>Create a comprehensive lesson plan</task>
    </context>
    <parameters>
        <grade>{grade}</grade>
        <subject>{subject}</subject>
        <language>{language}</language>
        <topic>{topic}</topic>
        <learning_objective>{learning_objective}</learning_objective>
        <emotional_consideration_level>{emotional_consideration}</emotional_consideration_level>
        <instruction_depth>{instruction_depth}</instruction_depth>
        <logistics>
            <number_of_sessions>{number_of_sessions}</number_of_sessions>
            <duration_per_session>{duration_of_session}</duration_per_session>
        </logistics>
        <features>
            <adaptive_learning>{adaptive_learning}</adaptive_learning>
            <include_assessment>{include_assessment}</include_assessment>
            <multimedia_suggestions>{multimedia_suggestion}</multimedia_suggestions>
        </features>
    </parameters>
    <instructions>
        Generate the lesson plan in rich Markdown using ONLY the following section order and headings. Each narrative subsection should contain at least 3 sentences or bullet points to ensure depth. Do not add extra commentary, summaries, or sections.
        1. Title line formatted exactly as: "Lesson Plan: {topic or subject}".
        2. "## Estimated Total Duration" followed by a single line with total time (e.g., "45 minutes").
        3. "## Learning Objectives" with:
           - A "### Primary Objective" paragraph.
           - A "### Measurable Success Criteria" numbered list (3 items).
           - A "### Prerequisite Knowledge" bullet list (3 items).
           - A "### Relevant Standards/Frameworks" bullet list naming NGSS/CCSS/state items when available.
        4. "## Materials" as a bullet list (use items provided in the input when available, otherwise infer).
        5. "## Step-by-Step Procedure" with one subsection per session using "### Session X (YY minutes)" and the nested structure:
           - "#### Introduction", "#### Direct Instruction", "#### Guided Practice", "#### Independent Practice", "#### Assessment/Check for Understanding".
           - Under each subheading, include 2-4 detailed steps (sentences or numbered items) that reference timing, teacher moves, and student actions.
        6. "## Differentiation Strategies" with two subheadings:
           - "### Support" (bullet list for emerging learners).
           - "### Extension" (bullet list for advanced learners).
        {'7. "## Assessment Strategy" section containing: (a) Diagnostic Tools, (b) Formative Checks, (c) Summative Tasks, and (d) "Assessment Questions & Solutions" listing 3-5 problems aligned to the session topics with step-by-step solutions.' if include_assessment else ''}
{f'        8. "## Multimedia Suggestions" bullet list including URLs or descriptions if available; include accessibility or contingency notes. Use ONLY these verified YouTube links:\\n{multimedia_prompt_block}' if multimedia_suggestion else ''}
        9. "## References" bullet list for any cited frameworks/resources (may repeat standards if no other references).
        
        Additional constraints:
        - Use only the sections above; do not prepend or append explanations.
        - Keep tone professional and classroom-ready.
        - Integrate provided context (big ideas, SEL, cultural notes) inside the relevant sections instead of creating new headings.
        - Output ONLY valid Markdown.
    </instructions>
</lesson_plan_request>
"""
    llm = get_llm("x-ai/grok-4.1-fast", 0.6)
    
    messages = [
        SystemMessage(content="You are an expert curriculum designer. Output strictly valid XML."),
        HumanMessage(content=xml_prompt)
    ]
    
    full_response, _token_usage = await stream_with_token_tracking(
        llm,
        messages,
        chunk_callback=chunk_callback
    )
    return full_response
