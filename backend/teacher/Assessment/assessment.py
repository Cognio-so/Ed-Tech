import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Any, Awaitable, Callable, Dict, Optional

from backend.llm import get_llm, stream_with_token_tracking
from langchain_core.messages import HumanMessage, SystemMessage


async def generate_assessment(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """
    Use the configured LLM to generate an assessment blueprint that mixes
    multiple question types and follows the XML prompt contract.
    """

    subject = data.get("subject", "General Studies")
    grade = data.get("grade", "Grade")
    difficulty_level = data.get("difficulty_level", "Standard")
    language = data.get("language", "English")
    topic = data.get("topic", "General Topic")
    learning_objective = data.get("learning_objective", "")
    duration = data.get("duration", "45 minutes")
    confidence_level = data.get("confidence_level", 3)
    custom_instruction = data.get("custom_instruction", "")

    question_blueprints = []
    if data.get("mcq_enabled"):
        question_blueprints.append(
            f"""
            <question_set>
                <type>Multiple Choice</type>
                <count>{data.get("mcq_count", 0)}</count>
                <requirements>
                    <options>Exactly 4 labeled options (A-D)</options>
                    <rationale>Include one-line rationale for the correct answer.</rationale>
                </requirements>
            </question_set>
            """.strip()
        )
    if data.get("true_false_enabled"):
        question_blueprints.append(
            f"""
            <question_set>
                <type>True or False</type>
                <count>{data.get("true_false_count", 0)}</count>
                <requirements>
                    <follow_up>Provide a short explanation justifying the truth value.</follow_up>
                </requirements>
            </question_set>
            """.strip()
        )
    if data.get("short_answer_enabled"):
        question_blueprints.append(
            f"""
            <question_set>
                <type>Short Answer</type>
                <count>{data.get("short_answer_count", 0)}</count>
                <requirements>
                    <length>2-3 sentence responses expected.</length>
                    <rubric>Include a scoring rubric with key points.</rubric>
                </requirements>
            </question_set>
            """.strip()
        )

    question_block = "\n".join(question_blueprints)

    xml_prompt = f"""
<assessment_generation_request>
    <context>
        <role>Expert Assessment Designer</role>
        <mission>Create a classroom-ready assessment packet.</mission>
    </context>
    <parameters>
        <subject>{subject}</subject>
        <grade>{grade}</grade>
        <language>{language}</language>
        <topic>{topic}</topic>
        <difficulty_level>{difficulty_level}</difficulty_level>
        <learning_objective>{learning_objective}</learning_objective>
        <duration>{duration}</duration>
        <confidence_support_level>{confidence_level}</confidence_support_level>
        <question_blueprint>
{question_block}
        </question_blueprint>
        <custom_instruction>{custom_instruction}</custom_instruction>
    </parameters>
    <instructions>
        Produce the final assessment in valid Markdown using this structure:
        1. "# Assessment Overview" summarizing subject, grade, topic, duration, and difficulty.
        2. "## Learning Objectives" with bullet points directly tied to the provided learning objective.
        3. "## Teacher Notes" including guidance on administering the assessment, confidence scaffolds, and differentiation ideas.
        4. "## Questions" containing one sequentially numbered block per question (Question 1, Question 2, ...). Do **not** label blocks with the question type. Within each block:
           - Start with `Question X:` followed by the prompt.
           - If it is a multiple-choice item, list options A–D on their own lines and include `Correct Answer: <letter>` plus a short rationale sentence.
           - If it is a true/false item, show the statement, the words "True / False" on a separate line, and add `Correct Answer: True` (or False) with a justification sentence.
           - If it is a short-answer item, provide a response placeholder (e.g., "Enter your answer here...") and add `Correct Answer:` with the ideal response plus scoring notes.
        Avoid adding standalone sections titled "Answer Key" or "Scoring & Feedback"; all answers must appear inline within the corresponding question block.
        Ensure numbering is continuous regardless of type and only reference the type in the instructions as described above.
        If any custom instructions are provided, integrate them naturally into the relevant sections without creating new headings.
        Avoid extra commentary outside the sections above and ensure the tone is supportive and actionable for teachers.
    </instructions>
</assessment_generation_request>
""".strip()

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.55)
    messages = [
        SystemMessage(content="You are an expert assessment designer who outputs only Markdown."),
        HumanMessage(content=xml_prompt),
    ]

    full_response, _ = await stream_with_token_tracking(
        llm, messages, chunk_callback=chunk_callback
    )
    return full_response

