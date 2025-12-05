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
        print(f"[Presentation RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}...")

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[Presentation RAG] Collection '{collection_name}' not found")
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

        print(f"[Presentation RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})")
        return contexts
    except Exception as exc:
        print(f"[Presentation RAG] Retrieval failed: {exc}")
        import traceback
        traceback.print_exc()
        return []


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

    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[Presentation] Target KB collection: {collection_name}")
    
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
        print(f"[Presentation] Running {len(tasks)} task(s) in parallel: {[t[0] for t in tasks]}")
        task_results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        for (task_name, _), result in zip(tasks, task_results):
            if isinstance(result, Exception):
                print(f"[Presentation] ❌ Task '{task_name}' failed: {result}")
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
        print(f"[Presentation] {warning_msg}")
        return warning_msg
    
    formatted_context = "\n\n".join(kb_contexts[:5])
    print(f"[Presentation] RAG context status: found ({len(kb_contexts)} chunk(s))")
    if multimedia_suggestion:
        print(f"[Presentation] Websearch status: found {len(multimedia_links)} multimedia link(s)")
    
    context_note = (
        "Use the reference material as the PRIMARY BASE for all content. "
        "The knowledge base provides the core facts, concepts, and examples. "
        "You may supplement with additional pedagogical explanations, slide organization strategies, "
        "or teaching delivery cues, but the factual foundation must come from the reference material."
    )
    
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
        Produce ONLY valid Markdown with the structure below. Keep every slide concise and actionable.
        1. Title formatted exactly as "Presentation: {topic}".
        2. "## Overview" with 3 concise sentences describing goals, SEL considerations, and tone.
        3. "## Slide Deck" with exactly 10-12 slides in sequence (output nothing else after this section):
           - Use headings like "### Slide 1: {{slide title}}", "### Slide 2: {{slide title}}", etc. (titles derived from the topic/subtopics).
           - For each slide include ONLY:
             * **Slide Content** – 3-6 ultra-precise bullets tied to the slide topic (ensure coverage of key facts, examples, or prompts).
             * **Speaker Notes** – 2 short bullets with delivery cues.
        Additional constraints:
        - Use <reference_text> as the PRIMARY BASE for all factual content, concepts, definitions, and examples.
        - Core facts, terminology, and key concepts MUST come from the reference material.
        - You may supplement with additional pedagogical elements (explanations, slide organization, speaker notes, teaching delivery cues) to enhance the presentation.
        - If critical information is missing from <reference_text> for a required section, you may use general knowledge but prioritize what is available in the reference material.
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
