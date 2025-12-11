"""
Web search node for Student AI Tutor.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
import os

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch

try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.Student.Ai_tutor.graph_type import StudentGraphState
    from backend.teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from Student.Ai_tutor.graph_type import StudentGraphState
    from teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES


async def _web_search(topic: str, subject: str, grade: str, language: str) -> str:
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key:
        return "Web search unavailable: TAVILY_API_KEY not configured."

    try:
        tavily_tool = TavilySearch(
            max_results=3,
            api_key=tavily_api_key,
            search_depth="advanced",
            topic="general",
        )

        query = f"{topic} {subject} grade {grade} {language}"
        results = await tavily_tool.ainvoke(query)
        if isinstance(results, list):
            formatted = []
            for result in results[:5]:
                if isinstance(result, dict):
                    formatted.append(
                        f"Title: {result.get('title', '')}\nURL: {result.get('url', '')}\nContent: {result.get('content', '')}\n"
                    )
                else:
                    formatted.append(str(result))
            return "\n".join(formatted)
        return str(results)
    except Exception as exc:
        return f"Web search error: {exc}"


async def _retrieve_kb_information(query: str, subject: str, grade: str, language: str) -> str:
    if not query or not subject or not grade:
        return ""
        
    try:
        subject_normalized = subject.lower().replace(" ", "_")
        lang_code = LANGUAGES.get(language, language).lower()
        collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
        
        print(f"[WEBSEARCH KB] 🔍 Searching collection '{collection_name}' for query: {query[:50]}...")
        kb_contexts = await retrieve_kb_context(collection_name, query, top_k=3)
        
        if kb_contexts:
            kb_contexts = kb_contexts[:3]
            print(f"[WEBSEARCH KB] ✅ Retrieved {len(kb_contexts)} context chunk(s)")
            return "\n\n".join(kb_contexts)
        else:
            print(f"[WEBSEARCH KB] ⚠️ No context found")
            return ""
            
    except Exception as e:
        print(f"[WEBSEARCH KB] ❌ Error: {str(e)}")
        return ""


async def websearch_node(state: StudentGraphState) -> StudentGraphState:
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_profile = state.get("student_profile") or {}
    grade = student_profile.get("grade", "")
    language = state.get("language", "English")
    
    if subject and subject.strip().lower() == "hindi" and language == "English":
        language = "Hindi"
    
    chunk_callback = state.get("chunk_callback")
    
    user_query = state.get("resolved_query") or state.get("user_query", "")
    
    print(f"[WEBSEARCH] 🔍 Query: {user_query}")
    print(f"[WEBSEARCH] 📚 Grade: {grade}, Subject: {subject}")
    
    search_query = user_query if user_query else f"{topic} {subject} grade {grade}"
    
    websearch_task = _web_search(search_query, subject, grade, language)
    kb_task = _retrieve_kb_information(search_query, subject, grade, language)
    
    websearch_results, kb_information = await asyncio.gather(websearch_task, kb_task)
    
    has_kb_info = bool(kb_information and kb_information.strip())
    
    if has_kb_info:
        combined_context = f"""<knowledge_base priority="primary" authority="verified_curriculum">
<description>Verified curriculum content for Grade {grade}, Subject: {subject}, Language: {language}</description>
<instruction>MUST use this information to answer the student's question</instruction>
<content>
{kb_information}
</content>
</knowledge_base>

<web_search priority="secondary" condition="only_if_kb_insufficient">
<description>Real-time web search results</description>
<instruction>Only refer to these if the Knowledge Base above does not contain the answer</instruction>
<content>
{websearch_results}
</content>
</web_search>"""
    else:
        combined_context = f"""<knowledge_base status="not_found">
<message>No relevant information found in Knowledge Base for this query</message>
</knowledge_base>

<web_search priority="primary">
<description>Real-time web search results</description>
<content>
{websearch_results}
</content>
</web_search>"""
    
    messages = state.get("messages", [])
    user_message = ""
    if messages:
        last = messages[-1]
        user_message = last.content if hasattr(last, "content") else str(last)
    else:
        user_message = user_query
    
    if has_kb_info:
        system_prompt = f"""<study_buddy_instruction>
<role>Real-time Study Buddy for Students</role>
<context>
    <grade>{grade}</grade>
    <subject>{subject}</subject>
    <language>{language}</language>
    <sources>
        <source type="primary">Knowledge Base - Verified Curriculum Content</source>
        <source type="secondary">Web Search - Current Information</source>
    </sources>
</context>

<source_priority>
    <primary_source>
        <name>Knowledge Base Information</name>
        <description>Verified curriculum content for Grade {grade}, Subject: {subject}, Language: {language}</description>
        <authority>Authoritative source for curriculum-related questions</authority>
        <usage_rule>MUST answer using ONLY Knowledge Base information if it contains the answer</usage_rule>
        <restriction>DO NOT use web search results if Knowledge Base has the answer</restriction>
    </primary_source>
    
    <secondary_source>
        <name>Web Search Results</name>
        <description>Real-time web information</description>
        <usage_conditions>
            <condition>Knowledge Base does NOT contain the answer to the specific question</condition>
            <condition>Knowledge Base information is incomplete or irrelevant to the student's query</condition>
        </usage_conditions>
        <verification>Verify relevance to Grade {grade} and Subject {subject}</verification>
    </secondary_source>
</source_priority>

<response_guidelines>
    <answer_format>
        <from_kb>Explain clearly using curriculum content</from_kb>
        <from_web>Explain that you're using current web information</from_web>
    </answer_format>
    <tone>
        <requirement>Clear, engaging, and relatable to the student's learning level</requirement>
    </tone>
    <formatting>
        <requirement>Format ALL responses using proper Markdown syntax</requirement>
        <headers>
            <h1># for main topics</h1>
            <h2>## for subtopics</h2>
            <h3>### for sections/activities</h3>
            <h4>#### for details/subsections</h4>
        </headers>
        <lists>
            <unordered>* or - for bullet points</unordered>
            <ordered>1. 2. 3. for numbered lists</ordered>
            <spacing>Ensure proper spacing between list items</spacing>
        </lists>
        <emphasis>
            <bold>**bold text** for important concepts, key terms, or emphasis</bold>
            <italic>*italic text* for definitions or subtle emphasis</italic>
            <code>`inline code` for technical terms, formulas, or specific instructions</code>
        </emphasis>
        <code_blocks>
            <format>Triple backticks with language specification</format>
            <example>```python
result = calculation()
```</example>
        </code_blocks>
        <tables>
            <format>Proper Markdown table syntax with | separators</format>
            <requirement>Include header row with alignment indicators</requirement>
        </tables>
        <blockquotes>
            <format>> for important notes, tips, or encouragement</format>
            <example>> **Study Tip**: This is a key concept to remember!</example>
        </blockquotes>
    </formatting>
</response_guidelines>

<critical_rule>
    The Knowledge Base contains the answer to curriculum-related questions. Use it first!
</critical_rule>
</study_buddy_instruction>"""
    else:
        system_prompt = f"""<study_buddy_instruction>
<role>Real-time Study Buddy for Students</role>
<context>
    <grade>{grade}</grade>
    <subject>{subject}</subject>
    <language>{language}</language>
    <sources>
        <source type="primary">Web Search - Current Information</source>
    </sources>
</context>

<instructions>
    <task>Use Web Search Results to answer the student's question</task>
    <verification>Verify information is relevant to Grade {grade} and Subject {subject}</verification>
    <explanation>Explain clearly, cite key facts, and relate them to the student's studies</explanation>
    <formatting>Format responses using proper Markdown syntax</formatting>
</instructions>

<response_structure>
    <when_using_web_search>
        <header>## What's Happening Now: [Topic]</header>
        <introduction>Hi! I found the latest information on this topic:</introduction>
        <sections>
            <section name="Recent Updates">
                <format>* **Latest Finding 1** - From current sources</format>
                <format>* **Latest Finding 2** - From current sources</format>
                <format>* **Latest Finding 3** - Cross-referenced information</format>
            </section>
            <section name="How This Helps Your Studies">Clear connection to student's learning goals</section>
            <section name="Key Points to Remember">
                <format>1. **Important Point 1**: [Clear explanation]</format>
                <format>2. **Important Point 2**: [Clear explanation]</format>
                <format>3. **Important Point 3**: [Clear explanation]</format>
            </section>
        </sections>
        <footer>> **Study Connection**: This current information directly relates to your coursework and will help you succeed!</footer>
    </when_using_web_search>
</response_structure>

<formatting>
    <headers>
        <h1># for main topics</h1>
        <h2>## for subtopics</h2>
        <h3>### for sections/activities</h3>
        <h4>#### for details/subsections</h4>
    </headers>
    <lists>
        <unordered>* or - for bullet points</unordered>
        <ordered>1. 2. 3. for numbered lists</ordered>
        <spacing>Ensure proper spacing between list items</spacing>
    </lists>
    <emphasis>
        <bold>**bold text** for important concepts, key terms, or emphasis</bold>
        <italic>*italic text* for definitions or subtle emphasis</italic>
        <code>`inline code` for technical terms, formulas, or specific instructions</code>
    </emphasis>
    <code_blocks>
        <format>Triple backticks with language specification</format>
        <example>```python
result = calculation()
```</example>
    </code_blocks>
    <tables>
        <format>Proper Markdown table syntax with | separators</format>
        <requirement>Include header row with alignment indicators</requirement>
    </tables>
    <blockquotes>
        <format>> for important notes, tips, or encouragement</format>
        <example>> **Latest Discovery**: This recent information will help with your studies!</example>
    </blockquotes>
</formatting>
</study_buddy_instruction>"""

    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.65)
    
    if has_kb_info:
        user_message_content = f"""<query_request>
<priority_instruction>
    Answer the student's question using the Knowledge Base information below. 
    Only use Web Search if the KB doesn't contain the answer.
    Remember: Use Knowledge Base information first!
</priority_instruction>

<context>
{combined_context}
</context>

<student_question>{user_message}</student_question>
</query_request>"""
    else:
        user_message_content = f"""<query_request>
<context>
{combined_context}
</context>

<student_question>{user_message}</student_question>
</query_request>"""
    
    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message_content),
    ]

    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state,
    )

    state["websearch_results"] = full_response
    state["response"] = full_response
    state["kb_information"] = kb_information
    state["token_usage"] = token_usage

    return state
