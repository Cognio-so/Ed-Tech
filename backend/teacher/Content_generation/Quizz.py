import sys
from pathlib import Path
from typing import Any, Dict, Awaitable, Callable, Optional
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from backend.llm import get_llm, stream_with_token_tracking
from backend.utils.websearch import get_youtube_links
from langchain_core.messages import HumanMessage, SystemMessage


async def generate_quizz(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """
    Generates a quiz (with answers) using the configured LLM.
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
        else "        - (Unable to fetch live links)"
    )

    xml_prompt = f"""
<quiz_request>
    <context>
        <role>Expert Assessment Designer</role>
        <task>Create a rigorous, student-friendly quiz</task>
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
        Produce ONLY valid Markdown using the structure below. Do not add any extra sections.
        1. Title in the format "Quiz: {topic}".
        2. "## Overview" with 2-3 sentences describing the quiz purpose and alignment.
        3. "## Quiz Items" containing 5-8 numbered questions that mix formats (multiple-choice, short answer, scenario-based, calculation as appropriate for the subject).
           - Each question must include: a difficulty tag (Easy/Medium/Hard), clear instructions, and any needed data tables/diagrams described in text.
           - Multiple-choice questions must show options A-D.
           - Scenario/calculation questions should scaffold steps or guiding hints.
           - If adaptive learning is true, add a follow-up tip per question for support/extension.
{f'        4. "## Multimedia Prompts" list relevant simulations, videos, or visuals for select questions, plus accessibility notes. Use ONLY these verified YouTube links:\\n{multimedia_links_block}' if multimedia_suggestion else ''}
        5. "## Answer Key" with numbered solutions matching the quiz items.
           - Provide step-by-step reasoning or worked solutions, not just final answers.
           - For multiple-choice, restate the correct option letter and explanation.
        Requirements:
        - Keep tone encouraging but academically rigorous.
        - Ensure all content is in {language}.
        - Avoid duplicating the instructions or adding commentary before/after the quiz.
    </instructions>
</quiz_request>
"""

    llm = get_llm("x-ai/grok-4.1-fast", 0.6)

    messages = [
        SystemMessage(
            content="You design detailed academic quizzes. Output strictly valid Markdown."
        ),
        HumanMessage(content=xml_prompt),
    ]

    full_response, _usage = await stream_with_token_tracking(
        llm, messages, chunk_callback=chunk_callback
    )
    return full_response

