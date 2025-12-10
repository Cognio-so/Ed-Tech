"""
Qdrant utilities for AI Tutor.
Adapted to support Session-Scoped collections and robust filtering.
"""
import sys
from pathlib import Path
import uuid
import asyncio
import os
import time
import httpx
from typing import List, Dict, Any, Optional
import re
import json

# Safely import Pydantic
try:
    from pydantic.v1 import BaseModel as PydanticBaseModel
except ImportError:
    from pydantic import BaseModel as PydanticBaseModel

from qdrant_client import models, QdrantClient
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# Adjust these imports to match your project structure
try:
    from backend.embedding import embed_chunks_parallel, embed_query
    from backend.qdrant_service import (
        get_qdrant_client,
        VECTOR_SIZE,
        QDRANT_UPSERT_BATCH_SIZE,
    )
except ImportError:
    from embedding import embed_chunks_parallel, embed_query
    from qdrant_service import (
        get_qdrant_client,
        VECTOR_SIZE,
        QDRANT_UPSERT_BATCH_SIZE,
    )

QDRANT_CLIENT = get_qdrant_client()

def tokenize(text: str):
    """Tokenize text for BM25 (Hybrid Search prep)."""
    if not text:
        return []
    tokens = re.findall(r"\w+", text.lower())
    return [t for t in tokens if t not in ENGLISH_STOP_WORDS]

def get_collection_name(student_id: str, session_id: str) -> str:
    """
    Generate collection name strictly scoped to Student AND Session.
    Format: student_{student_id}_{session_id}
    """
    safe_student = re.sub(r'[^a-zA-Z0-9_-]', '_', str(student_id))
    safe_session = re.sub(r'[^a-zA-Z0-9_-]', '_', str(session_id))
    return f"student_{safe_student}_{safe_session}"

async def ensure_collection(collection_name: str):
    """
    Ensure collection exists and creates ALL required indexes.
    Crucial for avoiding 400 Bad Request errors during filtering.
    """
    try:
        exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
        
        if not exists:
            await asyncio.to_thread(
                QDRANT_CLIENT.create_collection,
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
            )
            
            # Create indices for fast filtering
            fields = [
                "doc_id", 
                "filename", 
                "file_type", 
                "source_url", # Used by LangChain loaders
                "file_url",   # Used by your custom logic
                "url",        # Generic URL
                "source",     # Generic source
                "timestamp"
            ]
            
            for field in fields:
                await asyncio.to_thread(
                    QDRANT_CLIENT.create_payload_index,
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
            print(f"[Qdrant] ✅ Created collection with indexes: {collection_name}")
    except Exception as e:
        print(f"[Qdrant] ⚠️ Error ensuring collection (might already exist): {e}")

async def store_student_documents(
    student_id: str,
    session_id: str,
    documents: List[Document],
    # Restored arguments to match main.py calls:
    collection_type: str = "user_docs", 
    is_hybrid: bool = False,
    clear_existing: bool = False,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Store documents in the session-specific collection for students.
    Accepts legacy arguments (collection_type, is_hybrid, clear_existing) for compatibility.
    """
    if not documents or not session_id:
        return False
    
    try:
        collection_name = get_collection_name(student_id, session_id)
        
        if clear_existing:
             # Optional: Clear existing collection if requested
             try:
                 await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                 print(f"[Qdrant] Cleared existing collection: {collection_name}")
             except Exception:
                 pass

        await ensure_collection(collection_name)
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        
        all_chunks = []
        all_metadatas = []
        current_time = int(time.time())

        for doc in documents:
            if not doc.page_content:
                continue
                
            chunks = text_splitter.split_text(doc.page_content)
            base_meta = doc.metadata.copy() if doc.metadata else {}
            if metadata:
                base_meta.update(metadata)
            
            base_meta["timestamp"] = current_time
            
            # Normalize URL fields to ensure filtering works regardless of key name
            if "file_url" in base_meta:
                base_meta["source_url"] = base_meta["file_url"]
                base_meta["url"] = base_meta["file_url"]
                base_meta["source"] = base_meta["file_url"]

            for i, chunk in enumerate(chunks):
                chunk_meta = base_meta.copy()
                chunk_meta["text"] = chunk 
                chunk_meta["chunk_index"] = i
                all_chunks.append(chunk)
                all_metadatas.append(chunk_meta)
        
        if not all_chunks:
            return False

        print(f"[Qdrant] Embedding {len(all_chunks)} chunks for {collection_name}...")
        
        embeddings = await embed_chunks_parallel(
            all_chunks,
            batch_size=500,
            dimensions=VECTOR_SIZE,
        )
        
        points = []
        for i, (embedding, meta) in enumerate(zip(embeddings, all_metadatas)):
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload=meta
                )
            )
        
        # Parallel Batch Upsert for faster storage
        upsert_batches = [points[i:i + QDRANT_UPSERT_BATCH_SIZE] for i in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE)]
        upsert_tasks = [
            asyncio.to_thread(
                QDRANT_CLIENT.upsert,
                collection_name=collection_name,
                points=batch
            )
            for batch in upsert_batches
        ]
        await asyncio.gather(*upsert_tasks)
        
        print(f"[Qdrant] ✅ Stored {len(points)} chunks in {collection_name}")
        return True
        
    except Exception as e:
        print(f"[Qdrant] ❌ Error storing documents: {e}")
        import traceback
        traceback.print_exc()
        return False

# Alias for backward compatibility
async def store_documents(
    student_id: str,
    session_id: str,
    documents: List[Document],
    collection_type: str = "user_docs", 
    is_hybrid: bool = False,
    clear_existing: bool = False,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """Alias for store_student_documents for backward compatibility."""
    return await store_student_documents(
        student_id=student_id,
        session_id=session_id,
        documents=documents,
        collection_type=collection_type,
        is_hybrid=is_hybrid,
        clear_existing=clear_existing,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        metadata=metadata
    )

async def retrieve_relevant_documents(
    student_id: str,
    session_id: str,
    query: str,
    # Restored arguments for compatibility:
    collection_type: str = "user_docs", 
    is_hybrid: bool = False,
    top_k: int = 5,
    score_threshold: float = 0.45,
    filter_doc_url: Optional[str] = None
) -> List[Document]:
    """
    Retrieve documents with robust filtering for specific URLs.
    Includes fallback for HTTP if client version is old.
    """
    try:
        collection_name = get_collection_name(student_id, session_id)
        
        # 1. Check existence
        try:
            exists = await asyncio.to_thread(QDRANT_CLIENT.collection_exists, collection_name=collection_name)
            if not exists:
                print(f"[Qdrant] Collection {collection_name} not found.")
                return []
        except Exception:
            pass # Proceed to attempt search, might be network glitch handled by fallback
        
        query_embedding = await embed_query(query, dimensions=VECTOR_SIZE)
        
        # 2. Build Filter
        query_filter = None
        if filter_doc_url:
            filter_doc_url = filter_doc_url.strip()
            print(f"[Qdrant] 🔍 Filtering search for doc_url: {filter_doc_url}")
            # Match against multiple possible metadata keys to be safe
            query_filter = models.Filter(
                should=[
                    models.FieldCondition(key="source_url", match=models.MatchValue(value=filter_doc_url)),
                    models.FieldCondition(key="source", match=models.MatchValue(value=filter_doc_url)),
                    models.FieldCondition(key="file_url", match=models.MatchValue(value=filter_doc_url)),
                    models.FieldCondition(key="url", match=models.MatchValue(value=filter_doc_url)),
                ]
            )

        # 3. Search (Modern Client or HTTP Fallback)
        search_result = []
        try:
            if hasattr(QDRANT_CLIENT, 'search'):
                search_result = await asyncio.to_thread(
                    QDRANT_CLIENT.search,
                    collection_name=collection_name,
                    query_vector=query_embedding,
                    query_filter=query_filter,
                    limit=top_k,
                    score_threshold=score_threshold,
                    with_payload=True
                )
            else:
                raise AttributeError("Old Client")
        except (AttributeError, Exception):
            # HTTP Fallback
            search_result = await _http_search_fallback(
                collection_name, query_embedding, query_filter, top_k, score_threshold
            )

        # 4. Robust Fallback Logic
        # 4a. If no results, retry with score_threshold=0.0 (Relaxed Score)
        if not search_result:
            print(f"[Qdrant] ⚠️ Search returned 0 results with threshold {score_threshold}. Retrying with threshold 0.0...")
            try:
                if hasattr(QDRANT_CLIENT, 'search'):
                    search_result = await asyncio.to_thread(
                        QDRANT_CLIENT.search,
                        collection_name=collection_name,
                        query_vector=query_embedding,
                        query_filter=query_filter,
                        limit=top_k,
                        score_threshold=0.0, # Relaxed
                        with_payload=True
                    )
                else:
                    raise AttributeError("Old Client")
            except (AttributeError, Exception):
                search_result = await _http_search_fallback(
                    collection_name, query_embedding, query_filter, top_k, 0.0
                )
            
            if search_result:
                 print(f"[Qdrant] ✅ Found {len(search_result)} results with relaxed threshold (0.0).")

        # 4b. If STILL no results and we had a filter, try removing the filter (Metadata Mismatch Fallback)
        if not search_result and filter_doc_url:
            print(f"[Qdrant] ⚠️ Filtered search returned 0 results. Checking if ANY docs exist in {collection_name}...")
            # Perform a quick unfiltered check to distinguish "no data" vs "bad filter"
            unfiltered_result = await _http_search_fallback(
                collection_name, query_embedding, None, 1, 0.0
            )
            if unfiltered_result:
                print(f"[Qdrant] 💡 Data DOES exist in collection! The filter '{filter_doc_url}' likely mismatched metadata.")
                if unfiltered_result[0].payload:
                    print(f"[Qdrant] 🐛 Sample Payload from DB: {json.dumps(unfiltered_result[0].payload, default=str)}")
                
                # FALLBACK: Return unfiltered results since filter is failing
                # CRITICAL: Use score_threshold=0.0 to ensure we get results
                print(f"[Qdrant] 🔄 Using unfiltered results as fallback (filter not working properly)")
                search_result = await _http_search_fallback(
                    collection_name, query_embedding, None, top_k, 0.0
                )
            else:
                print(f"[Qdrant] ℹ️ Collection is effectively empty.")

        # 5. Process Results
        documents = []
        for hit in search_result:
            payload = hit.payload or {}
            content = payload.get("text", "")
            meta = {k: v for k, v in payload.items() if k != "text"}
            meta["score"] = hit.score
            documents.append(Document(page_content=content, metadata=meta))
            
        return documents

    except Exception as e:
        print(f"[Qdrant] ❌ Error retrieving: {e}")
        return []

async def _http_search_fallback(collection_name, vector, query_filter, limit, score_threshold):
    """Helper for raw HTTP search if client fails."""
    print("[Qdrant] ⚠️ Using HTTP fallback for retrieval")
    qdrant_url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if not qdrant_url or qdrant_url == ":memory:":
        return []

    base_url = qdrant_url.rstrip("/")
    url = f"{base_url}/collections/{collection_name}/points/search"
    headers = {"Content-Type": "application/json"}
    if api_key: headers["api-key"] = api_key
    
    payload = {
        "vector": vector,
        "limit": limit,
        "with_payload": True,
        "score_threshold": score_threshold
    }
    
    if query_filter:
        # Pydantic serialization for filter
        if hasattr(query_filter, 'dict'):
             payload["filter"] = query_filter.dict(exclude_none=True)
        elif hasattr(query_filter, 'model_dump'):
             payload["filter"] = query_filter.model_dump(exclude_none=True)
        else:
             import json
             payload["filter"] = json.loads(query_filter.json())

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            print(f"[Qdrant] HTTP Error: {resp.text}")
            return []
        
        result_json = resp.json()
        return [
            models.ScoredPoint(
                id=r['id'], 
                version=r.get('version', 0), 
                score=r['score'], 
                payload=r.get('payload'), 
                vector=None
            ) for r in result_json.get('result', [])
        ]

async def delete_student_session_collection(student_id: str, session_id: str):
    """Deletes the entire collection for a specific student session."""
    try:
        collection_name = get_collection_name(student_id, session_id)
        await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
        print(f"[Qdrant] 🗑️ Deleted expired collection: {collection_name}")
    except Exception as e:
        print(f"[Qdrant] Error deleting collection: {e}")

async def clear_session_documents(student_id: str, session_id: str):
    """Alias for consistency"""
    await delete_student_session_collection(student_id, session_id)