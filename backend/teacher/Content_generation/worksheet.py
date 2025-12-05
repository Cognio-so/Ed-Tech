import sys
from pathlib import Path
import asyncio
from typing import Any, Awaitable, Callable, Dict, Optional, List
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.utils.websearch import get_youtube_links
    from backend.embedding import embed_query
    from backend.qdrant_service import get_qdrant_client
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from utils.websearch import get_youtube_links
    from embedding import embed_query
    from qdrant_service import get_qdrant_client
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
        print(f"[Worksheet RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}...")

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[Worksheet RAG] Collection '{collection_name}' not found")
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

        print(f"[Worksheet RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})")
        return contexts
    except Exception as exc:
        print(f"[Worksheet RAG] Retrieval failed: {exc}")
        import traceback
        traceback.print_exc()
        return []


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

    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[Worksheet] Target KB collection: {collection_name}")
    
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
        print(f"[Worksheet] Running {len(tasks)} task(s) in parallel: {[t[0] for t in tasks]}")
        task_results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        for (task_name, _), result in zip(tasks, task_results):
            if isinstance(result, Exception):
                print(f"[Worksheet] ❌ Task '{task_name}' failed: {result}")
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
        print(f"[Worksheet] {warning_msg}")
        return warning_msg
    
    formatted_context = "\n\n".join(kb_contexts[:5])
    print(f"[Worksheet] RAG context status: found ({len(kb_contexts)} chunk(s))")
    if multimedia_suggestion:
        print(f"[Worksheet] Websearch status: found {len(multimedia_links)} multimedia link(s)")
    
    context_note = (
        "Use the reference material as the PRIMARY BASE for all content. "
        "The knowledge base provides the core facts, concepts, and examples. "
        "You may supplement with additional pedagogical explanations, problem variations, "
        "or teaching strategies, but the factual foundation must come from the reference material."
    )
    
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
        - Use <reference_text> as the PRIMARY BASE for all factual content, concepts, definitions, and examples.
        - Core facts, terminology, and key concepts MUST come from the reference material.
        - You may supplement with additional pedagogical elements (explanations, problem variations, teaching tips, differentiation strategies) to enhance the worksheet.
        - If critical information is missing from <reference_text> for a required section, you may use general knowledge but prioritize what is available in the reference material.
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
