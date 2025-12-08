"""
RAG node for AI Tutor with Intelligent Document Selection.
Retrieves documents from Qdrant with session scoping, intelligent filtering, and automatic cleanup.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
import asyncio
import time
import re
import json
from typing import List, Dict, Any, Optional

try:
    from backend.llm import get_llm, stream_with_token_tracking
except ImportError:
    from llm import get_llm, stream_with_token_tracking
try:
    from backend.teacher.Ai_Tutor.graph_type import GraphState
except ImportError:
    from teacher.Ai_Tutor.graph_type import GraphState

try:
    from backend.teacher.Ai_Tutor.qdrant_utils import retrieve_relevant_documents, get_collection_name, QDRANT_CLIENT
    from backend.teacher.Ai_Tutor.simple_llm import format_teacher_data, format_student_data
except ImportError:
    from teacher.Ai_Tutor.qdrant_utils import retrieve_relevant_documents, get_collection_name, QDRANT_CLIENT
    from teacher.Ai_Tutor.simple_llm import format_teacher_data, format_student_data

USER_DOC_TTL_SECONDS = int(24 * 60 * 60)  
def _format_last_turns(messages, k=3):
    """Format last k messages for context."""
    if not messages:
        return "(no previous conversation)"
    
    formatted = []
    for m in messages[-k:]:
        if isinstance(m, dict):
            role = (m.get("type") or m.get("role") or "").lower()
            content = m.get("content", "")
        else:
            role = (getattr(m, "type", None) or getattr(m, "role", None) or "").lower()
            content = getattr(m, "content", "") if hasattr(m, "content") else str(m)
        
        if not content:
            continue
        
        speaker = "User" if role in ("human", "user") else "Assistant"
        formatted.append(f"{speaker}: {content}")
    
    return "\n".join(formatted) if formatted else "(no previous conversation)"


async def cleanup_expired_documents(teacher_id: str, session_id: str) -> bool:
    """
    Delete document embeddings if they have expired (older than 24 hours).
    Returns True if cleanup was performed.
    """
    try:
        collection_name = get_collection_name(teacher_id, session_id)
        exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
        if not exists:
            return False
        
        scroll_result = await asyncio.to_thread(
            QDRANT_CLIENT.scroll,
            collection_name=collection_name,
            limit=10,
            with_payload=True,
            with_vectors=False
        )
        
        points, _ = scroll_result
        if not points:
            return False
        
        current_time = int(time.time())
        oldest_timestamp = min(
            point.payload.get("timestamp", current_time) 
            for point in points 
            if point.payload
        )
        
        if current_time - oldest_timestamp > USER_DOC_TTL_SECONDS:
            await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
            print(f"[RAG] 🗑️ Deleted expired collection: {collection_name} (age: {(current_time - oldest_timestamp) / 3600:.1f} hours)")
            return True
        
        return False
        
    except Exception as e:
        print(f"[RAG] Error checking document expiry: {e}")
        return False


async def get_all_session_documents(teacher_id: str, session_id: str) -> List[Dict[str, Any]]:
    """
    Get all documents in the session from Qdrant with their metadata.
    Returns list of document metadata dictionaries.
    """
    try:
        collection_name = get_collection_name(teacher_id, session_id)
        
        exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
        if not exists:
            return []
        
        scroll_result = await asyncio.to_thread(
            QDRANT_CLIENT.scroll,
            collection_name=collection_name,
            limit=1000,
            with_payload=True,
            with_vectors=False
        )
        
        points, _ = scroll_result
        
        seen_doc_ids = set()
        all_docs = []
        
        for point in points:
            payload = point.payload or {}
            doc_id = payload.get("doc_id")
            
            if doc_id and doc_id not in seen_doc_ids:
                seen_doc_ids.add(doc_id)
                all_docs.append({
                    "id": doc_id,
                    "filename": payload.get("filename", "unknown"),
                    "file_type": payload.get("file_type", "unknown"),
                    "file_url": payload.get("file_url") or payload.get("source_url") or payload.get("source", ""),
                    "timestamp": payload.get("timestamp", 0)
                })
        
        all_docs.sort(key=lambda x: x.get("timestamp", 0))
        
        return all_docs
        
    except Exception as e:
        print(f"[RAG] Error getting session documents: {e}")
        return []


async def intelligent_document_selection(
    user_query: str,
    newly_uploaded_docs_metadata: List[Dict[str, Any]],
    all_available_docs: List[Dict[str, Any]],
    conversation_history: Optional[List[Any]] = None,
    llm_model: str = "x-ai/grok-4.1-fast"
) -> Dict[str, Any]:
    """
    Use LLM to intelligently decide which documents to use based on:
    - User query
    - Newly uploaded documents
    - All available documents in session
    - Conversation history
    
    Returns:
        {
            "use_new_docs_only": bool,
            "selected_doc_ids": List[str],
            "selected_doc_indices": List[int],
            "reasoning": str
        }
    """
    new_docs = [doc for doc in newly_uploaded_docs_metadata if doc.get("file_type") != "image"]
    new_doc_ids = [doc.get("id") for doc in new_docs if doc.get("id")]
    
    is_followup = not new_docs and bool(all_available_docs)
    conversation_context = ""
    if conversation_history:
        last_turn = []
        for msg in conversation_history[-2:]:
            if isinstance(msg, dict):
                role = (msg.get("type") or msg.get("role") or "").lower()
                content = msg.get("content", "")
            else:
                role = (getattr(msg, "type", None) or getattr(msg, "role", None) or "").lower()
                content = getattr(msg, "content", "") if hasattr(msg, "content") else str(msg)
            
            if content:
                speaker = "User" if role in ("human", "user") else "Assistant"
                if len(content) > 500:
                    content = content[:500] + "..."
                last_turn.append(f"{speaker}: {content}")
        
        if last_turn:
            conversation_context = "\n".join(last_turn)
    all_docs_context = ""
    if all_available_docs:
        all_docs_context = "\n".join([
            f"- Document {i+1}: {doc.get('filename', 'unknown')} ({doc.get('file_type', 'unknown')}) (ID: {doc.get('id', 'unknown')})"
            + (" [NEWLY UPLOADED]" if doc.get("id") in new_doc_ids else "")
            for i, doc in enumerate(all_available_docs)
        ])
    new_docs_context = ""
    if new_docs:
        new_docs_context = "\n".join([
            f"- Document {i+1}: {doc.get('filename', 'unknown')} ({doc.get('file_type', 'unknown')}) (ID: {doc.get('id', 'unknown')})"
            for i, doc in enumerate(new_docs)
        ])
    
    classification_prompt = f"""You are an intelligent document selection orchestrator for an AI Tutor system.

**User Query:** "{user_query}"

**Is Follow-up Query:** {is_followup}

**Previous Conversation:**
{conversation_context if conversation_context else "No previous conversation."}

**All Available Documents:**
{all_docs_context if all_docs_context else "No documents available."}

**Newly Uploaded Documents:**
{new_docs_context if new_docs_context else "No new documents uploaded."}

**Task:** Determine which documents should be used to answer the query.

**Decision Rules:**
1. **New Upload + Generic Query** (e.g., "summarize this", "what's in this document"):
   → Use ALL newly uploaded documents

2. **Specific Document Reference** (e.g., "the first document", "document 2", "the PDF"):
   → Use ONLY the referenced document(s)

3. **Comparison** (e.g., "compare document 1 and 2"):
   → Use the specified documents

4. **Follow-up without new uploads** (e.g., "tell me more", "explain further"):
   → Use documents from previous conversation context

5. **No documents uploaded**:
   → Return empty selection

**Output Format (JSON only):**
{{
    "use_new_docs_only": true/false,
    "selected_doc_ids": ["id1", "id2"],
    "selected_doc_indices": [1, 2],
    "reasoning": "Brief explanation"
}}
"""

    try:
        llm = get_llm("openai/gpt-oss-120b",0.5)
        response = await llm.ainvoke([HumanMessage(content=classification_prompt)])
        
        content = response.content.strip()
        if content.startswith('```json'):
            content = re.sub(r'^```json\s*', '', content)
        if content.endswith('```'):
            content = re.sub(r'\s*```$', '', content)
        
        result = json.loads(content)
        available_ids = {doc.get("id") for doc in all_available_docs if doc.get("id")}
        
        if result.get("selected_doc_ids"):
            result["selected_doc_ids"] = [
                doc_id for doc_id in result["selected_doc_ids"] 
                if doc_id in available_ids
            ]
        if not result.get("selected_doc_ids") and result.get("selected_doc_indices"):
            index_to_id = {i + 1: doc.get("id") for i, doc in enumerate(all_available_docs) if doc.get("id")}
            result["selected_doc_ids"] = [
                index_to_id[idx] for idx in result["selected_doc_indices"] 
                if idx in index_to_id
            ]
        
        print(f"[DOC-SELECTION] {result.get('reasoning', 'No reasoning')}")
        return result
        
    except Exception as e:
        print(f"[DOC-SELECTION] Error: {e}, using fallback")
        if new_doc_ids:
            return {
                "use_new_docs_only": True,
                "selected_doc_ids": new_doc_ids,
                "selected_doc_indices": list(range(1, len(new_docs) + 1)),
                "reasoning": f"Fallback: using all new documents (error: {str(e)})"
            }
        elif all_available_docs:
            return {
                "use_new_docs_only": False,
                "selected_doc_ids": [doc.get("id") for doc in all_available_docs if doc.get("id")],
                "selected_doc_indices": list(range(1, len(all_available_docs) + 1)),
                "reasoning": f"Fallback: using all documents (error: {str(e)})"
            }
        else:
            return {
                "use_new_docs_only": False,
                "selected_doc_ids": [],
                "selected_doc_indices": [],
                "reasoning": "No documents available"
            }

import html
def _escape_xml(text: str) -> str:
    """Helper to ensure text content doesn't break XML structure."""
    if not text:
        return ""
    return html.escape(str(text))

async def rag_node(state: GraphState) -> GraphState:
    """
    RAG node with Intelligent Document Selection and XML-Structured Prompting.
    """
    messages = state.get("messages", [])
    teacher_id = state.get("teacher_id", "")
    session_id = state.get("session_id")
    chunk_callback = state.get("chunk_callback")
    query = state.get("resolved_query") or state.get("user_query", "")
    if not query and messages:
        last_msg = messages[-1]
        query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
    doc_url = state.get("doc_url")
    newly_uploaded_docs = state.get("new_uploaded_docs", [])
    if teacher_id and session_id:
        await cleanup_expired_documents(teacher_id, session_id)
        all_available_docs = await get_all_session_documents(teacher_id, session_id)
    else:
        all_available_docs = []
    selected_doc_ids = None
    selection_reasoning = ""
    
    if newly_uploaded_docs or all_available_docs:
        try:
            selection_result = await intelligent_document_selection(
                user_query=query,
                newly_uploaded_docs_metadata=newly_uploaded_docs,
                all_available_docs=all_available_docs,
                conversation_history=messages,
                llm_model=state.get("model") or "x-ai/grok-4.1-fast"
            )
            selected_doc_ids = selection_result.get("selected_doc_ids", [])
            selection_reasoning = selection_result.get("reasoning", "")
        except Exception:
            pass

    user_docs = []
    if teacher_id and session_id:
        try:
            if selected_doc_ids:
                doc_map = {d["id"]: d for d in all_available_docs if d.get("id")}
                tasks = []
                for doc_id in selected_doc_ids:
                    doc_info = doc_map.get(doc_id)
                    target_url = doc_info.get("file_url") if doc_info else None
                    if target_url:
                        tasks.append(retrieve_relevant_documents(
                            teacher_id=teacher_id,
                            session_id=session_id,
                            query=query,
                            top_k=4,
                            score_threshold=0.3,
                            filter_doc_url=target_url
                        ))
                if tasks:
                    results = await asyncio.gather(*tasks)
                    for res in results:
                        user_docs.extend(res)
            elif doc_url:
                user_docs = await retrieve_relevant_documents(
                    teacher_id=teacher_id, session_id=session_id, query=query,
                    top_k=6, score_threshold=0.3, filter_doc_url=doc_url
                )
            else:
                user_docs = await retrieve_relevant_documents(
                    teacher_id=teacher_id, session_id=session_id, query=query,
                    top_k=6, score_threshold=0.35, filter_doc_url=None
                )
        except Exception as e:
            print(f"[RAG] ❌ Retrieval failed: {e}")
    xml_documents = ""
    if user_docs:
        doc_entries = []
        for i, doc in enumerate(user_docs):
            meta = doc.metadata or {}
            filename = _escape_xml(meta.get("filename", "Unknown File"))
            file_type = _escape_xml(meta.get("file_type", "unknown"))
            page_num = meta.get("page_number") or meta.get("page") or "N/A"
            content = _escape_xml(doc.page_content)
            entry = (
                f'    <search_result index="{i+1}">\n'
                f'        <metadata>\n'
                f'            <filename>{filename}</filename>\n'
                f'            <file_type>{file_type}</file_type>\n'
                f'            <page_number>{page_num}</page_number>\n'
                f'        </metadata>\n'
                f'        <excerpt>\n{content}\n</excerpt>\n'
                f'    </search_result>'
            )
            doc_entries.append(entry)
        
        xml_documents = "<retrieved_context>\n" + "\n".join(doc_entries) + "\n</retrieved_context>"
    else:
        xml_documents = "<retrieved_context>\n    <status>No relevant document segments found for this specific query.</status>\n</retrieved_context>"

    xml_history = ""
    if messages:
        hist_entries = []
        for m in messages[-5:]:
            role = "user" if isinstance(m, HumanMessage) or (getattr(m, 'type', '') == 'human') else "assistant"
            content = _escape_xml(m.content if hasattr(m, 'content') else str(m))
            hist_entries.append(f'    <turn speaker="{role}">\n        {content}\n    </turn>')
        xml_history = "<conversation_history>\n" + "\n".join(hist_entries) + "\n</conversation_history>"
    teacher_data = state.get("teacher_data", {})
    xml_teacher = ""
    if teacher_data:
        t_info = _escape_xml(format_teacher_data(teacher_data))
        xml_teacher = f"<teacher_profile>\n{t_info}\n</teacher_profile>"

    system_prompt = f"""You are an expert AI Tutor. Your goal is to answer the user's question accurately using ONLY the provided XML context.

<input_data>
{xml_teacher}

{xml_documents}

{xml_history}
</input_data>

<instructions>
1. **Analyze the Context**: Look at the <retrieved_context>. The user has uploaded documents. The relevant chunks are provided inside <search_result> tags.
2. **Prioritize Uploaded Data**: If the <search_result> contains information relevant to the user's question, you MUST base your answer on it. 
3. **Multi-Document Synthesis**: If chunks come from different filenames (check <metadata>), synthesize the information. E.g., "Document A says X, while Document B says Y."
4. **Citations**: When you use information from a document, mention the source naturally. Example: "According to the lecture notes..." or "As seen in [filename]...".
5. **No Hallucination**: If the <retrieved_context> is empty or does not contain the answer, explicitly state that the uploaded documents do not contain that specific information, then offer general knowledge if appropriate.
6. **Tone**: Be helpful, educational, and clear.
</instructions>

<current_user_query>
{query}
</current_user_query>

Answer the user's query now based on the XML data above."""
    model_name = state.get("model") 
    llm = get_llm(model_name, temperature=0.5) 
    
    llm_messages = [SystemMessage(content=system_prompt)]
    llm_messages.append(HumanMessage(content=query))
    
    full_response, _ = await stream_with_token_tracking(
        llm, llm_messages, chunk_callback=chunk_callback, state=state
    )
    
    state["response"] = full_response
    state["rag_response"] = full_response
    
    return state