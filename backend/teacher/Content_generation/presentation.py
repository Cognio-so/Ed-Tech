import sys
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from backend.llm import get_llm, stream_with_token_tracking
from backend.utils.websearch import get_youtube_links
from langchain_core.messages import HumanMessage, SystemMessage


async def generate_presentation(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """
    Generates a slide-by-slide presentation outline using LLM.
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

    multimedia_links = []
    if multimedia_suggestion:
        multimedia_links = await get_youtube_links(topic, max_results=3)
    multimedia_links_block = (
        "\n".join(f"          - {url}" for url in multimedia_links)
        if multimedia_suggestion and multimedia_links
        else "          - (No verified links available)"
    )

    xml_prompt = f"""
<presentation_request>
    <context>
        <role>Expert Instructional Designer</role>
        <task>Create a classroom-ready slide deck outline</task>
    </context>
    <parameters>
        <grade>{grade}</grade>
        <subject>{subject}</subject>
        <topic>{topic}</topic>
        <language>{language}</language>
        <learning_objective>{learning_objective}</learning_objective>
        <instruction_depth>{instruction_depth}</instruction_depth>
        <emotional_consideration_level>{emotional_consideration}</emotional_consideration_level>
        <features>
            <adaptive_learning>{adaptive_learning}</adaptive_learning>
            <include_assessment>{include_assessment}</include_assessment>
            <multimedia_suggestions>{multimedia_suggestion}</multimedia_suggestions>
        </features>
    </parameters>
    <instructions>
        Produce ONLY valid Markdown with the structure below. Keep every slide concise and actionable.
        1. Title formatted exactly as "Presentation: {topic}".
        2. "## Overview" with 3 concise sentences describing goals, SEL considerations, and tone.
        3. "## Slide Deck" with exactly 10-12 slides in sequence (output nothing else after this section):
           - Use headings like "### Slide 1: {{slide title}}", "### Slide 2: {{slide title}}", etc. (titles derived from the topic/subtopics).
           - For each slide include ONLY:
             * **Slide Content** – 3-6 ultra-precise bullets tied to the slide topic (ensure coverage of key facts, examples, or prompts).
             * **Speaker Notes** – 2 short bullets with delivery cues.
        Additional constraints:
        - Always include at least one dedicated assessment slide when assessments are requested (use the slide content bullets for question prompts and speaker notes for answer guidance).
        - Always include a dedicated multimedia/resources slide when multimedia is requested. Use ONLY these verified YouTube links when listing resources:
{multimedia_links_block if multimedia_suggestion else '          - (No multimedia links requested)'}
        - Always end with a wrap-up slide covering reflection, home connection, and next steps (in the slide content bullets with matching speaker notes).
        - Keep tone professional, energetic, and student-centered.
        - Ensure all content is in {language}.
        - Output ONLY the title, overview, and slide deck sections; do not add any other headings or commentary.
    </instructions>
</presentation_request>
"""

    llm = get_llm("x-ai/grok-4.1-fast", 0.55)
    messages = [
        SystemMessage(
            content="You design detailed instructional slide decks. Output strictly valid Markdown."
        ),
        HumanMessage(content=xml_prompt),
    ]

    full_response, _usage = await stream_with_token_tracking(
        llm, messages, chunk_callback=chunk_callback
    )
    return full_response
