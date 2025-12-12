"""
Websearch + KB Information node for AI Tutor.
Runs web search and KB retrieval in parallel.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import asyncio
import os
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_tavily import TavilySearch
try:
    from backend.llm import get_llm, stream_with_token_tracking
    from backend.teacher.Ai_Tutor.graph_type import GraphState
    from backend.teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
    from backend.utils.dsa_utils import ContentDeduplicator
except ImportError:
    from llm import get_llm, stream_with_token_tracking
    from teacher.Ai_Tutor.graph_type import GraphState
    from teacher.Content_generation.lesson_plan import retrieve_kb_context, LANGUAGES
    try:
        from utils.dsa_utils import ContentDeduplicator
    except ImportError:
        class ContentDeduplicator:
            def __init__(self): self.seen_hashes = set()
            def is_duplicate(self, t): 
                import hashlib
                h = hashlib.sha256(t.strip().encode('utf-8')).hexdigest()
                if h in self.seen_hashes: return True
                self.seen_hashes.add(h)
                return False


async def _web_search(topic: str, subject: str, grade: str, language: str) -> str:
    """
    Perform web search using Tavily.
    """
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    if not tavily_api_key:
        return "Web search unavailable: TAVILY_API_KEY not configured."
    
    try:
        tavily_tool = TavilySearch(
            max_results=3,
            api_key=tavily_api_key,
            search_depth="advanced",
            topic="general"
        )
        
        query = f"{topic} {subject} grade {grade} {language}"
        results = await tavily_tool.ainvoke(query)
        if isinstance(results, list):
            formatted_results = []
            for result in results[:5]:
                if isinstance(result, dict):
                    title = result.get("title", "")
                    url = result.get("url", "")
                    content = result.get("content", "")
                    formatted_results.append(f"Title: {title}\nURL: {url}\nContent: {content}\n")
                else:
                    formatted_results.append(str(result))
            return "\n".join(formatted_results)
        else:
            return str(results)
    except Exception as e:
        return f"Web search error: {str(e)}"


async def _retrieve_kb_information(query: str, subject: str, grade: str, language: str) -> str:
    """
    Retrieve knowledge base information using vector search.
    """
    if not query or not subject or not grade:
        return ""
        
    try:
        subject_normalized = subject.lower().replace(" ", "_")
        lang_code = LANGUAGES.get(language, language).lower()
        collection_name = f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"
        
        print(f"[WEBSEARCH KB] 🔍 Searching collection '{collection_name}' for query: {query[:50]}...")
        kb_contexts = await retrieve_kb_context(collection_name, query, top_k=3)
        
        if kb_contexts:
            # Optimization: Content Deduplication
            deduplicator = ContentDeduplicator()
            unique_contexts = []
            for text in kb_contexts:
                if text and not deduplicator.is_duplicate(text):
                    unique_contexts.append(text)
            
            # Limit to top 3 unique chunks
            final_contexts = unique_contexts[:3]
            print(f"[WEBSEARCH KB] ✅ Retrieved {len(final_contexts)} unique context chunk(s)")
            return "\n\n".join(final_contexts)
        else:
            print(f"[WEBSEARCH KB] ⚠️ No context found")
            return ""
            
    except Exception as e:
        print(f"[WEBSEARCH KB] ❌ Error: {str(e)}")
        return ""


async def websearch_node(state: GraphState) -> GraphState:
    """
    Websearch + KB Information node.
    Runs web search and KB retrieval in parallel.
    """
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    teacher_data = state.get("teacher_data", {})
    grade = student_data.get("grade", "") if isinstance(student_data, dict) else ""
    if not grade and isinstance(teacher_data, dict):
        grades = teacher_data.get("grades", [])
        if grades and isinstance(grades, list) and len(grades) > 0:
            grade = str(grades[0])
    
    language = state.get("language", "English")
    if subject and subject.strip().lower() == "hindi" and language == "English":
        language = "Hindi"
    
    chunk_callback = state.get("chunk_callback")
    
    # Get user query from state
    user_query = state.get("resolved_query") or state.get("user_query", "")
    
    print(f"[WEBSEARCH] 🔍 Query: {user_query}")
    print(f"[WEBSEARCH] 📚 Grade: {grade}, Subject: {subject}")
    
    # Run web search and KB retrieval in parallel using asyncio.gather
    # Both tasks execute concurrently for better performance
    search_query = user_query if user_query else f"{topic} {subject} grade {grade}"
    
    # Create both async tasks (they don't execute until awaited)
    websearch_task = _web_search(search_query, subject, grade, language)
    kb_task = _retrieve_kb_information(search_query, subject, grade, language)
    
    # Execute both tasks in parallel - they run concurrently
    websearch_results, kb_information = await asyncio.gather(
        websearch_task,
        kb_task
    )
    
    # Determine if KB has relevant information
    has_kb_info = bool(kb_information and kb_information.strip())
    
    if has_kb_info:
        combined_context = f"""<knowledge_base priority="primary" authority="verified_curriculum">
<description>Verified curriculum content for Grade {grade}, Subject: {subject}, Language: {language}</description>
<instruction>MUST use this information to answer the user's question</instruction>
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
    
    # Get the latest user message
    messages = state.get("messages", [])
    user_message = ""
    if messages:
        user_message = messages[-1].content if hasattr(messages[-1], 'content') else str(messages[-1])
    
    if has_kb_info:
        system_prompt = f"""<ai_tutor_instruction>
<role>Expert AI Tutor</role>
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
        <usage_rule>MUST use ONLY Knowledge Base information if it contains the answer</usage_rule>
        <restriction>DO NOT use web search results if Knowledge Base has the answer</restriction>
    </primary_source>
    
    <secondary_source>
        <name>Web Search Results</name>
        <description>Real-time web information</description>
        <usage_conditions>
            <condition>Knowledge Base does NOT contain the answer to the specific question</condition>
            <condition>Knowledge Base information is incomplete or irrelevant to the query</condition>
        </usage_conditions>
        <verification>Verify relevance to Grade {grade} and Subject {subject}</verification>
    </secondary_source>
</source_priority>

<response_guidelines>
    <answer_format>
        <from_kb>State clearly that you're using curriculum content</from_kb>
        <from_web>State that you're using current web information</from_web>
    </answer_format>
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
def example():
    return "formatted code"
```</example>
        </code_blocks>
        <tables>
            <format>Proper Markdown table syntax with | separators</format>
            <requirement>Include header row with alignment indicators</requirement>
        </tables>
        <blockquotes>
            <format>> for important notes, tips, or quotes</format>
            <example>> **Important**: This is a key concept to remember.</example>
        </blockquotes>
    </formatting>
</response_guidelines>

<critical_rule>
    The Knowledge Base contains the answer to curriculum-related questions. Use it first!
</critical_rule>
</ai_tutor_instruction>"""
    else:
        system_prompt = f"""<ai_tutor_instruction>
<role>Expert AI Tutor</role>
<context>
    <grade>{grade}</grade>
    <subject>{subject}</subject>
    <language>{language}</language>
    <sources>
        <source type="primary">Web Search - Current Information</source>
    </sources>
</context>

<instructions>
    <task>Use Web Search Results to answer the user's question</task>
    <verification>Verify information is relevant to Grade {grade} and Subject {subject}</verification>
    <formatting>Format responses using proper Markdown syntax</formatting>
</instructions>

<response_structure>
    <when_using_web_search>
        <header>## Current Information: [Topic]</header>
        <introduction>Based on the latest web search results:</introduction>
        <sections>
            <section name="Recent Developments">
                <format>* **Update 1** - From [source]</format>
                <format>* **Update 2** - From [source]</format>
                <format>* **Update 3** - Cross-referenced information</format>
            </section>
            <section name="Key Facts">Comprehensive analysis with proper formatting</section>
            <section name="Educational Context">How this relates to curriculum and teaching</section>
        </sections>
        <footer>> **Sources**: Information compiled from recent web searches</footer>
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
def example():
    return "formatted code"
```</example>
    </code_blocks>
    <tables>
        <format>Proper Markdown table syntax with | separators</format>
        <requirement>Include header row with alignment indicators</requirement>
    </tables>
    <blockquotes>
        <format>> for important notes, tips, or quotes</format>
        <example>> **Latest Update**: This information is current as of today.</example>
    </blockquotes>
</formatting>
</ai_tutor_instruction>"""
    
    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.7)
    
    if has_kb_info:
        user_message_content = f"""<query_request>
<priority_instruction>
    Answer the user's question using the Knowledge Base information below. 
    Only use Web Search if the KB doesn't contain the answer.
    Remember: Use Knowledge Base information first!
</priority_instruction>

<context>
{combined_context}
</context>

<user_question>{user_query}</user_question>
</query_request>"""
    else:
        user_message_content = f"""<query_request>
<context>
{combined_context}
</context>

<user_question>{user_query}</user_question>
</query_request>"""
    
    llm_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message_content)
    ]
    
    # Stream response
    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state
    )
    
    # Update state - store both raw results and the LLM response
    state["websearch_results"] = full_response  # Store the LLM's synthesized response
    state["response"] = full_response  # Store in response for orchestrator
    state["kb_information"] = kb_information
    
    return state
