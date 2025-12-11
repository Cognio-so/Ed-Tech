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
            f"[Exam Assessment RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}..."
        )

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[Exam Assessment RAG] Collection '{collection_name}' not found")
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
            f"[Exam Assessment RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})"
        )
        return contexts
    except Exception as exc:
        print(f"[Exam Assessment RAG] Retrieval failed: {exc}")
        import traceback

        traceback.print_exc()
        return []


async def generate_exam_assessment(
    data: Dict[str, Any],
    chunk_callback: Optional[Callable[[str], Awaitable[None]]] = None,
) -> str:
    """
    Generate exam questions only (no overview, learning objectives, or teacher notes).
    Supports multiple topics with different question types per topic.
    Uses XML prompt format.
    """

    organisation_name = data.get("organisation_name", "")
    exam_name = data.get("exam_name", "Exam")
    duration = data.get("duration", "45 minutes")
    topics = data.get("topics", [])
    grade = data.get("grade", "Grade")
    language = data.get("language", "English")
    subject = data.get("subject", "General Studies")
    difficulty_level = data.get("difficulty_level", "Standard")
    custom_prompt = data.get("custom_prompt", "")

    if not topics:
        return "⚠️ No topics provided. Please provide at least one topic with question configurations."

    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[Exam Assessment] Target KB collection: {collection_name}")

    # Parallel KB searches for each topic
    async def search_topic_context(topic: Dict[str, Any], topic_idx: int) -> Dict[str, Any]:
        """Search KB context for a single topic and return with metadata."""
        topic_name = topic.get("topic_name", f"Topic {topic_idx}")
        print(f"[Exam Assessment] 🔍 Searching KB for topic {topic_idx}: {topic_name}")
        
        contexts = await retrieve_kb_context(collection_name, topic_name)
        
        return {
            "topic_index": topic_idx,
            "topic_name": topic_name,
            "contexts": contexts
        }

    # Perform parallel KB searches for all topics
    print(f"[Exam Assessment] 🚀 Starting parallel KB searches for {len(topics)} topics...")
    topic_context_tasks = [
        search_topic_context(topic, idx + 1) 
        for idx, topic in enumerate(topics)
    ]
    topic_contexts_results = await asyncio.gather(*topic_context_tasks)
    
    # Check if any topic has context
    all_contexts_empty = all(not result.get("contexts") for result in topic_contexts_results)
    if all_contexts_empty:
        warning_msg = (
            f"⚠️ No knowledge base context found for collection '{collection_name}'. "
            "Ensure the correct grade/subject/language materials are embedded."
        )
        print(f"[Exam Assessment] {warning_msg}")
        return warning_msg

    # Format contexts with topic metadata
    context_blocks = []
    for result in topic_contexts_results:
        topic_idx = result["topic_index"]
        topic_name = result["topic_name"]
        contexts = result["contexts"]
        
        if contexts:
            topic_context_text = "\n\n".join(contexts[:5])  # Limit to 5 chunks per topic
            context_blocks.append(
                f"""
        <topic_context>
            <topic_number>{topic_idx}</topic_number>
            <topic_name>{topic_name}</topic_name>
            <reference_text>
{topic_context_text}
            </reference_text>
        </topic_context>
                """.strip()
            )
    
    formatted_contexts = "\n".join(context_blocks)
    context_note = (
        "The knowledge base context represents curriculum knowledge and learning materials for each topic. "
        "Use this as your reference to understand the concepts, facts, and curriculum scope. "
        "DO NOT copy exact questions from textbooks or source materials. Instead, DESIGN original questions "
        "based on the curriculum knowledge provided. Each topic has its own context section. "
        "If the needed information is missing, explicitly say 'The knowledge base does not cover ___.'"
    )

    # Aggregate question counts by type across all topics
    total_long_answer = sum(topic.get("long_answer_count", 0) for topic in topics)
    total_short_answer = sum(topic.get("short_answer_count", 0) for topic in topics)
    total_mcq = sum(topic.get("mcq_count", 0) for topic in topics)
    total_true_false = sum(topic.get("true_false_count", 0) for topic in topics)

    # Build topic metadata for question generation
    topic_metadata_blocks = []
    for idx, topic in enumerate(topics, 1):
        topic_name = topic.get("topic_name", f"Topic {idx}")
        long_answer_count = topic.get("long_answer_count", 0)
        short_answer_count = topic.get("short_answer_count", 0)
        mcq_count = topic.get("mcq_count", 0)
        true_false_count = topic.get("true_false_count", 0)
        
        topic_metadata_blocks.append(
            f"""
            <topic>
                <topic_number>{idx}</topic_number>
                <topic_name>{topic_name}</topic_name>
                <question_requirements>
                    <long_answer_count>{long_answer_count}</long_answer_count>
                    <short_answer_count>{short_answer_count}</short_answer_count>
                    <mcq_count>{mcq_count}</mcq_count>
                    <true_false_count>{true_false_count}</true_false_count>
                </question_requirements>
            </topic>
            """.strip()
        )
    
    topics_metadata_xml = "\n".join(topic_metadata_blocks)

    # Build question type requirements
    question_type_blocks = []
    
    if total_short_answer > 0:
        question_type_blocks.append(
            f"""
            <question_type>
                <type>Short Form Written Answer</type>
                <total_count>{total_short_answer}</total_count>
                <requirements>
                    <length>2-3 sentence responses expected.</length>
                    <rubric>Include a scoring rubric with key points.</rubric>
                    <distribution>Distribute questions across all topics based on their short_answer_count requirements.</distribution>
                </requirements>
            </question_type>
            """.strip()
        )
    
    if total_true_false > 0:
        question_type_blocks.append(
            f"""
            <question_type>
                <type>True or False</type>
                <total_count>{total_true_false}</total_count>
                <requirements>
                    <follow_up>Provide a short explanation justifying the truth value.</follow_up>
                    <distribution>Distribute questions across all topics based on their true_false_count requirements.</distribution>
                </requirements>
            </question_type>
            """.strip()
        )
    
    if total_mcq > 0:
        question_type_blocks.append(
            f"""
            <question_type>
                <type>Multiple Choice</type>
                <total_count>{total_mcq}</total_count>
                <requirements>
                    <options>Exactly 4 labeled options (A-D)</options>
                    <rationale>Include one-line rationale for the correct answer.</rationale>
                    <distribution>Distribute questions across all topics based on their mcq_count requirements.</distribution>
                </requirements>
            </question_type>
            """.strip()
        )
    
    if total_long_answer > 0:
        question_type_blocks.append(
            f"""
            <question_type>
                <type>Long Form Written Answer</type>
                <total_count>{total_long_answer}</total_count>
                <requirements>
                    <length>Detailed, comprehensive answers expected (3-5 paragraphs or more).</length>
                    <rubric>Include a detailed scoring rubric with key points and expected content.</rubric>
                    <distribution>Distribute questions across all topics based on their long_answer_count requirements.</distribution>
                </requirements>
            </question_type>
            """.strip()
        )

    question_types_xml = "\n".join(question_type_blocks)

    xml_prompt = f"""
<exam_assessment_generation_request>
    <context>
        <role>Expert Exam Question Designer</role>
        <mission>Create exam questions only (no overview, learning objectives, or teacher notes). Organize questions by type, not by topic.</mission>
    </context>
    <exam_metadata>
        <organisation_name>{organisation_name}</organisation_name>
        <exam_name>{exam_name}</exam_name>
        <duration>{duration}</duration>
        <subject>{subject}</subject>
        <grade>{grade}</grade>
        <language>{language}</language>
        <difficulty_level>{difficulty_level}</difficulty_level>
        <custom_instruction>{custom_prompt}</custom_instruction>
    </exam_metadata>
    <knowledge_base>
        <collection>{collection_name}</collection>
        <topic_contexts>
{formatted_contexts}
        </topic_contexts>
        <guidance>{context_note}</guidance>
    </knowledge_base>
    <topics_metadata>
{topics_metadata_xml}
    </topics_metadata>
    <question_types>
{question_types_xml}
    </question_types>
    <instructions>
        CRITICAL: The knowledge base context represents CURRICULUM KNOWLEDGE and learning materials, NOT exact textbook questions. 
        Your task is to DESIGN original, well-crafted exam questions based on the curriculum concepts, facts, and learning objectives 
        found in the reference material. DO NOT copy or paraphrase exact questions from textbooks or source materials.
        
        Use the topic-specific <reference_text> from the knowledge base to:
        - Understand the curriculum scope, concepts, and learning objectives for each topic
        - Ensure questions align with the grade level, subject, and difficulty specified
        - Base your question design on the knowledge and concepts presented
        - Create original questions that test understanding, application, and critical thinking
        
        Each topic has its own context section. Use the appropriate topic context when generating questions for that topic. 
        Do not invent facts outside the provided context. If needed details are absent, clearly state what the knowledge base does not cover before moving on.
        
        IMPORTANT: Generate ONLY questions. Do NOT include:
        - Assessment Overview
        - Learning Objectives
        - Teacher Notes
        - Any introductory or summary sections
        
        CRITICAL OUTPUT FORMAT: Organize questions by TYPE, not by topic. Group all questions of the same type together.
        
        Output format requirements:
        1. Start directly with questions, organized by QUESTION TYPE (not by topic).
        2. Use section headings for each question type in this order:
           - "## Short Form Written Answer Questions" (if any)
           - "## True or False Questions" (if any)
           - "## Multiple Choice Questions" (if any)
           - "## Long Form Written Answer Questions" (if any)
        3. Within each question type section, generate questions from ALL topics that require that type.
           - For each question, indicate which topic it belongs to using: `(Topic X: [Topic Name])` after the question number.
           - Example: "Question 1: Short Form Written Answer (Topic 1: Photosynthesis)"
        4. Number questions continuously across all types (Question 1, Question 2, Question 3, etc.).
        5. For each question, use this format:
           - Start with `Question X: [Type] (Topic Y: [Topic Name])` followed by the prompt.
           - If it is a multiple-choice item, list options A–D on their own lines and include `Correct Answer: <letter>` plus a short rationale sentence.
           - If it is a true/false item, show the statement, the words "True / False" on a separate line, and add `Correct Answer: True` (or False) with a justification sentence.
           - If it is a short-answer item, provide a response placeholder (e.g., "Enter your answer here...") and add `Correct Answer:` with the ideal response plus scoring notes.
           - If it is a long-answer item, provide a response placeholder and add `Correct Answer:` with a comprehensive ideal response plus detailed scoring rubric.
        6. Distribute questions across topics based on the counts specified in <topics_metadata>. For example, if Topic 1 requires 2 short answers and Topic 2 requires 3 short answers, generate 2 short answer questions from Topic 1 and 3 short answer questions from Topic 2, all grouped under "## Short Form Written Answer Questions".
        7. All answers must appear inline within the corresponding question block.
        8. Ensure the tone is appropriate for the specified difficulty level and grade.
        9. If custom instructions are provided, integrate them naturally into question generation.
        
        MARKDOWN FORMATTING REQUIREMENTS:
        - Output your responses in proper Markdown format, adhering to Shadcn UI typography guidelines for headings, lists, code blocks, and tables.
        - Ensure proper spacing between list items and paragraphs.
        - Use triple backticks for code blocks with language specification (e.g., ```python\\nprint('Hello')\\n```).
        - Use Markdown table syntax for tabular data.
        - Use `*` or `-` for unordered lists and `1.` for ordered lists.
        - Use `**bold**` and `*italic*` for emphasis.
        - Use `>` for blockquotes.
        - Ensure headings are hierarchical (e.g., `## H2`, `### H3`).
        - Avoid excessive blank lines.
        - Do not include any introductory or concluding remarks outside the question content itself.
        - When generating content, prioritize clarity and readability for educational purposes.
    </instructions>
</exam_assessment_generation_request>
""".strip()

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.55)
    messages = [
        SystemMessage(content="You are an expert exam question designer who creates original questions based on curriculum knowledge. You design questions that test understanding and application, not copy from textbooks. Output only questions in Markdown format."),
        HumanMessage(content=xml_prompt),
    ]

    full_response, _ = await stream_with_token_tracking(
        llm, messages, chunk_callback=chunk_callback
    )
    return full_response

