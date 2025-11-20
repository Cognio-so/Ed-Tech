import sys
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from backend.llm import get_llm, stream_with_token_tracking
from backend.utils.websearch import get_youtube_links
from langchain_core.messages import HumanMessage, SystemMessage


async def generate_worksheet(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """
    Generates a structured worksheet using the configured LLM.
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
        "\n".join(f"        - {url}" for url in multimedia_links)
        if multimedia_suggestion and multimedia_links
        else "        - (No enrichment links available)"
    )

    xml_prompt = f"""
<worksheet_request>
    <context>
        <role>Expert {subject} Curriculum Writer</role>
        <task>Create a detailed worksheet for students</task>
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
        Produce ONLY valid Markdown structured exactly as follows:
        1. Title formatted: "Grade {grade} {topic} Worksheet".
        2. "## Instructions for Students" with 2 paragraphs: welcome + mindset tips tailored to SEL level {emotional_consideration}.
        3. For each major concept, create sections using "## Section X: {{concept title}}" with:
           - "**Key Concepts**" list explaining 2-3 essential ideas.
           - "**Example Problems**" containing 1-2 worked examples with step-by-step solutions.
           - "**Practice Problems**" list with 3-4 questions; if include_assessment is true, add mini-answer key after each section.
        4. Include at least three sections (e.g., fundamentals, core skills, applications). Ensure problems increase in rigor.
        5. If adaptive learning is true, add "**Differentiation Tips**" bullet list at the end of each section with supports/extension ideas.
        6. If multimedia suggestions are true, add a final "## Enrichment" section listing 2-3 resources (description + URL if available). Use ONLY these vetted YouTube links:
{multimedia_links_block if multimedia_suggestion else ''}
        7. Close with "## Reflection" including 2 prompts plus an optional journaling task.
        Additional constraints:
        - Keep tone encouraging, student-friendly, and precise.
        - Ensure all math notation is clear (use LaTeX inline where necessary).
        - Output ONLY the sections described above; do not add any other commentary.
    </instructions>
</worksheet_request>
"""

    llm = get_llm("x-ai/grok-4.1-fast", 0.45)
    messages = [
        SystemMessage(
            content="You craft detailed, student-friendly worksheets. Output strictly valid Markdown."
        ),
        HumanMessage(content=xml_prompt),
    ]

    full_response, _usage = await stream_with_token_tracking(
        llm, messages, chunk_callback=chunk_callback
    )
    return full_response
