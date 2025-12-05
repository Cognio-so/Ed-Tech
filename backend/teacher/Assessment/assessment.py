import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    from backend.embedding import embed_query
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.qdrant_service import get_qdrant_client
except ImportError:
    from embedding import embed_query
    from llm import get_llm, stream_with_token_tracking
    from qdrant_service import get_qdrant_client
from langchain_core.messages import HumanMessage, SystemMessage

LANGUAGES = {
    "English": "en",
    "Hindi": "hi",
}

QDRANT_CLIENT = get_qdrant_client()


async def retrieve_kb_context(
    collection_name: str, query_text: str, top_k: int = 5
) -> List[str]:
    """
    Fetch relevant knowledge base chunks using Qdrant's query_points API.
    """
    try:
        print(
            f"[Assessment RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}..."
        )

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[Assessment RAG] Collection '{collection_name}' not found")
            return []

        query_vector = await embed_query(query_text)
        results_response = await asyncio.to_thread(
            QDRANT_CLIENT.query_points,
            collection_name=collection_name,
            query=query_vector,
            limit=top_k,
            with_payload=True,
        )

        contexts: List[str] = []
        for res in results_response.points:
            text = (res.payload or {}).get("text")
            if text:
                contexts.append(text.strip())

        print(
            f"[Assessment RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})"
        )
        return contexts
    except Exception as exc:
        print(f"[Assessment RAG] Retrieval failed: {exc}")
        import traceback

        traceback.print_exc()
        return []


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

    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[Assessment] Target KB collection: {collection_name}")

    rag_query_parts = [topic]
    if learning_objective:
        rag_query_parts.append(learning_objective)
    rag_query = " ".join(
        part for part in rag_query_parts if part and part.lower() not in {"general topic"}
    )

    kb_contexts: List[str] = []
    if rag_query.strip():
        kb_contexts = await retrieve_kb_context(collection_name, rag_query.strip())

    if not kb_contexts:
        warning_msg = (
            f"⚠️ No knowledge base context found for collection '{collection_name}'. "
            "Ensure the correct grade/subject/language materials are embedded."
        )
        print(f"[Assessment] {warning_msg}")
        return warning_msg

    formatted_context = "\n\n".join(kb_contexts[:5])
    context_note = (
        "Use ONLY the reference material when drafting questions. If the needed information "
        "is missing, explicitly say 'The knowledge base does not cover ___.'"
    )

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
    <knowledge_base>
        <collection>{collection_name}</collection>
        <reference_text>
{formatted_context}
        </reference_text>
        <guidance>{context_note}</guidance>
    </knowledge_base>
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
        Ground every question and explanation strictly in the supplied <reference_text>; do not invent facts outside it. If needed details are absent, clearly state what the knowledge base does not cover before moving on.
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

