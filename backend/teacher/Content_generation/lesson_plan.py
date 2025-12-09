import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
from typing import Any, Dict, Awaitable, Callable, Optional, List

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
        print(f"[LessonPlan RAG] 🔍 Searching collection '{collection_name}' for query: {query_text[:120]}...")

        # 1. Check if collection exists
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        existing = [c.name for c in collections_response.collections]
        if collection_name not in existing:
            print(f"[LessonPlan RAG] Collection '{collection_name}' not found")
            return []

        # 2. Generate the Dense Vector (Standard embedding)
        query_vector = await embed_query(query_text)
        results_response = await asyncio.to_thread(
            QDRANT_CLIENT.query_points,
            collection_name=collection_name,
            query=query_vector,  # Pass the dense vector list here
            limit=top_k,
            with_payload=True,
            # score_threshold=0.65,
        )
        
        # 4. Extract points (The response object wraps the list in .points)
        results = results_response.points
        # print(f"[LessonPlan RAG] Retrieved {results} results from Qdrant")
        contexts: List[str] = []
        for res in results:
            text = (res.payload or {}).get("text")
            if text:
                contexts.append(text.strip())

        print(f"[LessonPlan RAG] ✅ Retrieved {len(contexts)} context chunk(s) (limit {top_k})")
        return contexts
    except Exception as exc:
        print(f"[LessonPlan RAG] Retrieval failed: {exc}")
        import traceback
        traceback.print_exc()
        return []
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
    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = LANGUAGES.get(language, language).lower()
    collection_name=f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
    print(f"[LessonPlan] Target KB collection: {collection_name}")
    
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
        print(f"[LessonPlan] Running {len(tasks)} task(s) in parallel: {[t[0] for t in tasks]}")
        task_results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        for (task_name, _), result in zip(tasks, task_results):
            if isinstance(result, Exception):
                print(f"[LessonPlan] ❌ Task '{task_name}' failed: {result}")
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
        print(f"[LessonPlan] {warning_msg}")
        return warning_msg
    
    formatted_context = "\n\n".join(kb_contexts[:5])
    print(f"[LessonPlan] RAG context status: found ({len(kb_contexts)} chunk(s))")
    if multimedia_suggestion:
        print(f"[LessonPlan] Websearch status: found {len(multimedia_links)} multimedia link(s)")
    
    context_note = (
        "Use ONLY the reference material when writing the lesson plan. "
        "If the requested content is not covered, explicitly state that the knowledge base does not contain it."
    )
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
        - You MUST use only the content provided inside <reference_text>. Do not add outside facts.
        - If information is missing from <reference_text>, state explicitly: "The knowledge base does not cover ___." Do not invent details.
        - Use only the sections above; do not prepend or append explanations.
        - Keep tone professional and classroom-ready.
        - Integrate provided context (big ideas, SEL, cultural notes) inside the relevant sections instead of creating new headings.
        - Output ONLY valid Markdown.
        
        MARKDOWN FORMATTING REQUIREMENTS:
        - Output your responses in proper Markdown format, adhering to Shadcn UI typography guidelines for headings, lists, code blocks, and tables.
        - Ensure proper spacing between list items and paragraphs.
        - Use triple backticks for code blocks with language specification (e.g., ```python\nprint('Hello')\n```).
        - Use Markdown table syntax for tabular data.
        - Use `*` or `-` for unordered lists and `1.` for ordered lists.
        - Use `**bold**` and `*italic*` for emphasis.
        - Use `>` for blockquotes.
        - Ensure headings are hierarchical (e.g., `# H1`, `## H2`, `### H3`, `#### H4`).
        - Avoid excessive blank lines.
        - Do not include any introductory or concluding remarks outside the Markdown content itself.
        - When generating content, prioritize clarity and readability for educational purposes.
    </instructions>
</lesson_plan_request>
"""
    llm = get_llm("google/gemini-2.5-flash-lite", 0.6)
    
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
