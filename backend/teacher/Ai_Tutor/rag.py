"""
RAG node for AI Tutor.
Uses RAG with User documents + Knowledge Base + Generative AI.
Retrieves documents from Qdrant vector store.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from typing import Dict, Any, List, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from backend.llm import get_llm, stream_with_token_tracking
from backend.teacher.Ai_Tutor.graph_type import GraphState
from backend.teacher.Ai_Tutor.qdrant_utils import retrieve_relevant_documents, get_collection_name
from backend.teacher.Ai_Tutor.qdrant_utils import QDRANT_CLIENT
import asyncio


async def _retrieve_kb_context(topic: str, subject: str, grade: str, teacher_id: str) -> str:
    """
    Retrieve knowledge base context from Qdrant.
    """
    try:
        query = f"{topic} {subject} grade {grade}"
        kb_docs = await retrieve_relevant_documents(
            teacher_id=teacher_id,
            query=query,
            collection_type="kb",
            top_k=3,
            score_threshold=0.6,
            is_hybrid=False
        )
        
        if kb_docs:
            kb_texts = [doc.page_content for doc in kb_docs]
            return "\n\n".join(kb_texts)
        else:
            return f"Knowledge base context for {topic} in {subject} for grade {grade}"
    except Exception as e:
        print(f"[RAG] Error retrieving KB context: {e}")
        return f"Knowledge base context for {topic} in {subject} for grade {grade}"


async def rag_node(state: GraphState) -> GraphState:
    """
    RAG node with User documents + KB + Gen AI.
    Retrieves documents from Qdrant and generates response.
    """
    messages = state.get("messages", [])
    topic = state.get("topic", "")
    subject = state.get("subject", "")
    student_data = state.get("student_data", {})
    grade = student_data.get("grade", "") if isinstance(student_data, dict) else ""
    language = state.get("language", "English")
    teacher_id = state.get("teacher_id", "")
    chunk_callback = state.get("chunk_callback")
    
    query = state.get("resolved_query") or state.get("user_query", "")
    if not query and messages:
        last_msg = messages[-1]
        query = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
    
    doc_url = state.get("doc_url")
    print(f"[RAG] 🔍 Starting RAG retrieval - teacher_id: {teacher_id}, query: {query[:100]}...")
    print(f"[RAG] 📎 doc_url in state: {doc_url}")
    print(f"[RAG] 📚 Topic: {topic}, Subject: {subject}, Grade: {grade}")
    
    user_docs = []
    if teacher_id:
        try:
            print(f"[RAG] 🔎 Searching Qdrant for user documents (collection: user_docs, top_k: 5)")
            user_docs = await retrieve_relevant_documents(
                teacher_id=teacher_id,
                query=query,
                collection_type="user_docs",
                top_k=5,
                score_threshold=0.7,
                is_hybrid=False
            )
            print(f"[RAG] ✅ Retrieved {len(user_docs)} relevant documents from Qdrant")
            if len(user_docs) == 0:
                print(f"[RAG] ⚠️ WARNING: No documents found in Qdrant for teacher_id: {teacher_id}")
                print(f"[RAG] 💡 This might mean:")
                print(f"[RAG]    1. Documents were not embedded via /add-documents endpoint")
                print(f"[RAG]    2. Query doesn't match any embedded documents")
                print(f"[RAG]    3. Score threshold (0.7) is too high")
            else:
                for i, doc in enumerate(user_docs):
                    print(f"[RAG] 📄 Document {i+1}: {len(doc.page_content)} chars, metadata: {doc.metadata}")
        except Exception as e:
            print(f"[RAG] ❌ ERROR retrieving user documents: {e}")
            import traceback
            traceback.print_exc()
    
    kb_context = ""
    if teacher_id:
        print(f"[RAG] 🔎 Retrieving KB context for topic: {topic}, subject: {subject}, grade: {grade}")
        kb_context = await _retrieve_kb_context(topic, subject, grade, teacher_id)
        if kb_context:
            print(f"[RAG] ✅ KB context retrieved: {len(kb_context)} characters")
        else:
            print(f"[RAG] ℹ️ No KB context available")
    
    context_parts = []
    
    if user_docs:
        doc_texts = [f"[Document {i+1}]\n{doc.page_content}" for i, doc in enumerate(user_docs)]
        context_parts.append("=== User Documents ===\n" + "\n\n".join(doc_texts))
        print(f"[RAG] ✅ Added {len(user_docs)} user documents to context")
    else:
        print(f"[RAG] ⚠️ No user documents to add to context")
    
    if kb_context:
        context_parts.append(f"=== Knowledge Base ===\n{kb_context}")
        print(f"[RAG] ✅ Added KB context to context")
    
    combined_context = "\n\n".join(context_parts) if context_parts else "No additional context available."
    print(f"[RAG] 📝 Combined context length: {len(combined_context)} characters")
    
    system_prompt = f"""You are an expert AI tutor with access to:
    1. User-uploaded documents (retrieved via semantic search)
    2. Knowledge base information
    3. Advanced generative AI capabilities
    
    Use the following context to provide comprehensive, accurate responses. If the context doesn't contain relevant information, use your general knowledge but indicate when you're doing so.
    
    Context:
    {combined_context}
    
    Provide detailed, educational responses that synthesize information from both user documents and the knowledge base.
    Language: {language}
    Grade Level: {grade}
    Subject: {subject}
    Topic: {topic}
    """
    
    llm = get_llm("x-ai/grok-4.1-fast", temperature=0.7)
    
    llm_messages = [SystemMessage(content=system_prompt)]
    
    if messages:
        print(f"[RAG] 📜 Using full conversation history ({len(messages)} messages)")
        for msg in messages:
            if hasattr(msg, 'content') and msg.content:
                if hasattr(msg, 'type') or hasattr(msg, 'role'):
                    msg_type = getattr(msg, 'type', None) or getattr(msg, 'role', None)
                    if msg_type and msg_type.lower() in ('human', 'user'):
                        llm_messages.append(HumanMessage(content=msg.content))
                    elif msg_type and msg_type.lower() in ('ai', 'assistant'):
                        llm_messages.append(AIMessage(content=msg.content))
                else:
                    llm_messages.append(HumanMessage(content=msg.content))
    else:
        if query:
            llm_messages.append(HumanMessage(content=query))
    
    full_response, token_usage = await stream_with_token_tracking(
        llm,
        llm_messages,
        chunk_callback=chunk_callback,
        state=state
    )
    
    state["rag_response"] = full_response
    state["response"] = full_response
    state["should_continue"] = True
    
    return state
