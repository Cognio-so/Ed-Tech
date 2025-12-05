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

# TTL for document embeddings (24 hours)
USER_DOC_TTL_SECONDS = int(24 * 60 * 60)  # 24 hours

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
        
        # Check if collection exists
        exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
        if not exists:
            return False
        
        # Get all points to check timestamps
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
        
        # Check if any document has expired
        current_time = int(time.time())
        oldest_timestamp = min(
            point.payload.get("timestamp", current_time) 
            for point in points 
            if point.payload
        )
        
        # If oldest document is older than TTL, delete the entire collection
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
        
        # Check if collection exists
        exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
        if not exists:
            return []
        
        # Scroll through all points to get unique documents
        scroll_result = await asyncio.to_thread(
            QDRANT_CLIENT.scroll,
            collection_name=collection_name,
            limit=1000,
            with_payload=True,
            with_vectors=False
        )
        
        points, _ = scroll_result
        
        # Extract unique documents by doc_id
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
        
        # Sort by timestamp (oldest first)
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
    
    # Build conversation context
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
    
    # Build all docs context
    all_docs_context = ""
    if all_available_docs:
        all_docs_context = "\n".join([
            f"- Document {i+1}: {doc.get('filename', 'unknown')} ({doc.get('file_type', 'unknown')}) (ID: {doc.get('id', 'unknown')})"
            + (" [NEWLY UPLOADED]" if doc.get("id") in new_doc_ids else "")
            for i, doc in enumerate(all_available_docs)
        ])
    
    # Build new docs context
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
        llm = get_llm(llm_model, temperature=0.2)
        response = await llm.ainvoke([HumanMessage(content=classification_prompt)])
        
        content = response.content.strip()
        # Clean JSON markers
        if content.startswith('```json'):
            content = re.sub(r'^```json\s*', '', content)
        if content.endswith('```'):
            content = re.sub(r'\s*```$', '', content)
        
        result = json.loads(content)
        
        # Validate selected IDs exist
        available_ids = {doc.get("id") for doc in all_available_docs if doc.get("id")}
        
        if result.get("selected_doc_ids"):
            result["selected_doc_ids"] = [
                doc_id for doc_id in result["selected_doc_ids"] 
                if doc_id in available_ids
            ]
        
        # Map indices to IDs if needed
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
        # Fallback: use all new docs if available, otherwise all docs
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


async def rag_node(state: GraphState) -> GraphState:
    """
    RAG node with intelligent document selection and automatic cleanup.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    teacher_id = state.get("teacher_id", "")
    session_id = state.get("session_id")
    chunk_callback = state.get("chunk_callback")
    
    # Get query
    query = state.get("resolved_query") or state.get("user_query", "")
    if not query and messages:
        last_msg = messages[-1]
        query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
    
    # Get document URL filter (from frontend)
    doc_url = state.get("doc_url")
    print(f"[RAG] 🔍 Doc URL: {doc_url}")
    # Get newly uploaded docs metadata
    newly_uploaded_docs = state.get("new_uploaded_docs", [])
    
    print(f"[RAG] 🔍 Session: {session_id} | New docs: {len(newly_uploaded_docs)} | Doc filter: {doc_url or 'None'}")
    
    # Step 1: Cleanup expired documents (24 hour TTL)
    if teacher_id and session_id:
        try:
            was_cleaned = await cleanup_expired_documents(teacher_id, session_id)
            if was_cleaned:
                print(f"[RAG] 🗑️ Cleaned up expired documents for session {session_id}")
        except Exception as e:
            print(f"[RAG] ⚠️ Cleanup error: {e}")
    
    # Step 2: Get all available documents in session
    all_available_docs = []
    if teacher_id and session_id:
        try:
            all_available_docs = await get_all_session_documents(teacher_id, session_id)
            print(f"[RAG] 📚 Found {(all_available_docs)} total documents in session")
        except Exception as e:
            print(f"[RAG] ⚠️ Error getting session documents: {e}")
    
    # Step 3: Intelligent document selection (if no specific doc_url filter)
    selected_doc_ids = None
    if not doc_url and (newly_uploaded_docs or all_available_docs):
        try:
            selection_result = await intelligent_document_selection(
                user_query=query,
                newly_uploaded_docs_metadata=newly_uploaded_docs,
                all_available_docs=all_available_docs,
                conversation_history=messages,
                llm_model=state.get("model") or "x-ai/grok-4.1-fast"
            )
            
            selected_doc_ids = selection_result.get("selected_doc_ids", [])
            print(f"[RAG] 🎯 Intelligent selection: {len(selected_doc_ids)} documents")
            print(f"[RAG] 💡 Reasoning: {selection_result.get('reasoning', 'N/A')}")
            
        except Exception as e:
            print(f"[RAG] ⚠️ Selection error: {e}, using all documents")
    
    # Step 4: Retrieve documents with filtering
    user_docs = []
    if teacher_id and session_id:
        try:
            # Build filter based on selection
            filter_doc_url = doc_url  # Use frontend filter if provided
            
            # If intelligent selection provided IDs, convert to URL filter
            # (Note: Qdrant filtering works best with URLs, so we'll use custom logic)
            if selected_doc_ids and not filter_doc_url:
                # We'll filter results after retrieval since Qdrant filter is URL-based
                pass
            
            user_docs = await retrieve_relevant_documents(
                teacher_id=teacher_id,
                session_id=session_id,
                query=query,
                top_k=10,  # Get more initially, we'll filter after
                score_threshold=0.45,
                filter_doc_url=filter_doc_url
            )
            
            # Post-retrieval filtering by doc_id if intelligent selection was used
            if selected_doc_ids and not filter_doc_url:
                user_docs = [
                    doc for doc in user_docs 
                    if doc.metadata.get("doc_id") in selected_doc_ids
                ]
                print(f"[RAG] 🔍 Filtered to {len(user_docs)} chunks from selected documents")
            
            print(f"[RAG] ✅ Retrieved {len(user_docs)} relevant chunks")
            
        except Exception as e:
            print(f"[RAG] ❌ Retrieval failed: {e}")
    
    # Step 5: Build context
    context_parts = []
    
    if user_docs:
        doc_texts = [f"[Chunk {i+1}]: {d.page_content}" for i, d in enumerate(user_docs)]
        context_parts.append("=== UPLOADED DOCUMENT CONTEXT ===\n" + "\n\n".join(doc_texts))
    elif doc_url or selected_doc_ids:
        context_parts.append(f"=== DOCUMENT CONTEXT ===\nNo specific text matched the query in the selected document(s). Use general knowledge.")
    
    # Add teacher/student data
    teacher_data = state.get("teacher_data", {})
    if teacher_data:
        context_parts.append("=== TEACHER INFO ===\n" + format_teacher_data(teacher_data))
    
    combined_context = "\n\n".join(context_parts)
    
    # Step 6: System prompt
    system_prompt = f"""You are an expert AI Tutor Assistant.
    
CONTEXT:
{combined_context}

CONVERSATION HISTORY:
{_format_last_turns(messages, k=3)}
    
INSTRUCTIONS:
- If the user asks about uploaded documents, prioritize the 'UPLOADED DOCUMENT CONTEXT'.
- Use 'CONVERSATION HISTORY' to understand follow-up questions.
- If the answer is not in the context, politely say so.
- Be concise, clear, and helpful.
- Adapt your explanation to the student's grade level if provided.
"""
    
    # Step 7: Call LLM
    model_name = state.get("model") or "x-ai/grok-4.1-fast"
    llm = get_llm(model_name, temperature=0.7)
    
    llm_messages = [SystemMessage(content=system_prompt)]
    if messages:
        # Append last 5 messages for context
        for m in messages[-5:]:
            if hasattr(m, 'content'):
                if isinstance(m, HumanMessage) or (hasattr(m, 'type') and m.type=='human'):
                    llm_messages.append(HumanMessage(content=m.content))
                else:
                    llm_messages.append(AIMessage(content=m.content))
    else:
        llm_messages.append(HumanMessage(content=query))
    
    full_response, _ = await stream_with_token_tracking(
        llm, llm_messages, chunk_callback=chunk_callback, state=state
    )
    
    state["response"] = full_response
    state["rag_response"] = full_response
    
    print(f"[RAG] ✅ Response generated ({len(full_response)} chars)")
    
    return state