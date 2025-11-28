import sys
from pathlib import Path
import asyncio
from typing import Any, Dict, Awaitable, Callable, Optional, List
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from backend.llm import get_llm, stream_with_token_tracking
from backend.utils.websearch import get_youtube_links
from backend.embedding import embed_query
from backend.qdrant_service import get_qdrant_client
from langchain_core.messages import HumanMessage, SystemMessage
from qdrant_client import models

LANGUAGES = {
    "English": "en",
    "Hindi": "hi"
}

QDRANT_CLIENT = get_qdrant_client()


async def retrieve_kb_context(collection_name: str, query_text: str, top_k: int = 5) -> List[str]:
    """
    Fetch relevant knowledge base chunks using the modern Qdrant 'query_points' API.
    """
    try:
        print(f"[Quiz RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}...")

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[Quiz RAG] Collection '{collection_name}' not found")
            return []

        query_vector = await embed_query(query_text)
        results_response = await asyncio.to_thread(
            QDRANT_CLIENT.query_points,
            collection_name=collection_name,
            query=query_vector,
            limit=top_k,
            with_payload=True,
        )
        
        results = results_response.points
        contexts: List[str] = []
        for res in results:
            text = (res.payload or {}).get("text")
            if text:
                contexts.append(text.strip())

        print(f"[Quiz RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})")
        return contexts
    except Exception as exc:
        print(f"[Quiz RAG] Retrieval failed: {exc}")
        import traceback
        traceback.print_exc()
        return []


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

    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[Quiz] Target KB collection: {collection_name}")
    
    rag_query_parts = [topic]
    if learning_objective:
        rag_query_parts.append(learning_objective)
    rag_query = " ".join(part for part in rag_query_parts if part and part.lower() not in {"unknown topic"})
    
    tasks = []
    if rag_query.strip():
        tasks.append(("rag", retrieve_kb_context(collection_name, rag_query.strip())))
    if multimedia_suggestion:
        tasks.append(("websearch", get_youtube_links(topic, max_results=3)))
    
    results = {}
    if tasks:
        print(f"[Quiz] Running {len(tasks)} task(s) in parallel: {[t[0] for t in tasks]}")
        task_results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        for (task_name, _), result in zip(tasks, task_results):
            if isinstance(result, Exception):
                print(f"[Quiz] ❌ Task '{task_name}' failed: {result}")
                results[task_name] = [] if task_name == "websearch" else []
            else:
                results[task_name] = result
    
    kb_contexts = results.get("rag", [])
    multimedia_links = results.get("websearch", [])
    
    if not kb_contexts:
        warning_msg = (
            f"⚠️ No knowledge base context found for collection '{collection_name}'. "
            "Ensure the correct grade/subject/language book has been embedded."
        )
        print(f"[Quiz] {warning_msg}")
        return warning_msg
    
    formatted_context = "\n\n".join(kb_contexts[:5])
    print(f"[Quiz] RAG context status: found ({len(kb_contexts)} chunk(s))")
    if multimedia_suggestion:
        print(f"[Quiz] Websearch status: found {len(multimedia_links)} multimedia link(s)")
    
    context_note = (
        "Use ONLY the reference material when writing the quiz. "
        "If the requested content is not covered, explicitly state that the knowledge base does not contain it."
    )
    
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
    <knowledge_base>
        <collection>{collection_name}</collection>
        <reference_text>
{formatted_context}
        </reference_text>
        <guidance>{context_note}</guidance>
    </knowledge_base>
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
        - You MUST use only the content provided inside <reference_text>. Do not add outside facts.
        - If information is missing from <reference_text>, state explicitly: "The knowledge base does not cover ___." Do not invent details.
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

