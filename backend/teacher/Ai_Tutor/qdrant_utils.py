"""
Qdrant utilities for AI Tutor vector storage and retrieval.
"""
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import os
import uuid
import asyncio
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient, models
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.embedding import embed_chunks_parallel, embed_query
from rank_bm25 import BM25Okapi
import re
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
import dill

QDRANT_URL = os.getenv("QDRANT_URL", ":memory:")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_TIMEOUT = float(os.getenv("QDRANT_TIMEOUT", "60"))
VECTOR_SIZE = 1536
QDRANT_UPSERT_BATCH_SIZE = int(os.getenv("QDRANT_UPSERT_BATCH_SIZE", "64"))

try:
    if QDRANT_URL == ":memory:":
        QDRANT_CLIENT = QdrantClient(":memory:", timeout=QDRANT_TIMEOUT)
    else:
        QDRANT_CLIENT = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=QDRANT_TIMEOUT)
        QDRANT_CLIENT.get_collections()
        print(f"[Qdrant] Connected to remote Qdrant at {QDRANT_URL}")
except Exception as e:
    print(f"[Qdrant] Remote Qdrant failed, falling back to in-memory: {e}")
    QDRANT_CLIENT = QdrantClient(":memory:")


def tokenize(text: str):
    """Tokenize text for BM25."""
    tokens = re.findall(r"\w+", text.lower())
    return [t for t in tokens if t not in ENGLISH_STOP_WORDS]


def get_collection_name(teacher_id: str, collection_type: str = "user_docs") -> str:
    """Generate collection name for teacher."""
    return f"ai_tutor_{teacher_id}_{collection_type}"


async def ensure_collection(collection_name: str, is_hybrid: bool = False):
    """Ensure collection exists, create if not."""
    try:
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [c.name for c in collections_response.collections]
        
        if collection_name not in collections:
            await asyncio.to_thread(
                QDRANT_CLIENT.recreate_collection,
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
            )
            
            # Create payload indexes
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="doc_id",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="filename",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="file_type",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            print(f"[Qdrant] Created collection: {collection_name}")
        else:
            print(f"[Qdrant] Collection already exists: {collection_name}")
    except Exception as e:
        print(f"[Qdrant] Error ensuring collection: {e}")
        raise


async def store_documents(
    teacher_id: str,
    documents: List[Document],
    collection_type: str = "user_docs",
    is_hybrid: bool = False,
    clear_existing: bool = False,
    metadata: Optional[Dict[str, Any]] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> bool:
    """
    Store documents in Qdrant with embeddings.
    Handles text splitting, embedding, and storage.
    """
    if not documents:
        return False
    
    try:
        collection_name = get_collection_name(teacher_id, collection_type)
        
        if clear_existing:
            try:
                collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
                collections = [c.name for c in collections_response.collections]
                if collection_name in collections:
                    await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                    print(f"[Qdrant] Cleared existing collection: {collection_name}")
            except Exception as e:
                print(f"[Qdrant] Error clearing collection: {e}")
        
        await ensure_collection(collection_name, is_hybrid)
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        
        all_chunks = []
        all_metadatas = []
        
        for doc in documents:
            chunks = text_splitter.split_text(doc.page_content)
            base_meta = doc.metadata.copy() if doc.metadata else {}
            if metadata:
                base_meta.update(metadata)
            
            for i, chunk in enumerate(chunks):
                chunk_meta = base_meta.copy()
                chunk_meta["chunk_index"] = i
                chunk_meta["total_chunks"] = len(chunks)
                all_chunks.append(chunk)
                all_metadatas.append(chunk_meta)
        
        print(f"[Qdrant] Split {len(documents)} documents into {len(all_chunks)} chunks")
        print(f"[Qdrant] Generating embeddings for {len(all_chunks)} chunks...")
        embeddings = await embed_chunks_parallel(all_chunks, batch_size=200)
        
        points = []
        for i, (chunk, embedding, meta) in enumerate(zip(all_chunks, embeddings, all_metadatas)):
            payload = {
                "text": chunk,
                "chunk_index": i,
                **meta
            }
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload=payload
                )
            )
        
        for i in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
            batch = points[i:i + QDRANT_UPSERT_BATCH_SIZE]
            await asyncio.to_thread(
                QDRANT_CLIENT.upsert,
                collection_name=collection_name,
                points=batch
            )
        
        if is_hybrid:
            tokenized_chunks = [tokenize(chunk) for chunk in all_chunks]
            bm25 = await asyncio.to_thread(BM25Okapi, tokenized_chunks)
            print(f"[Qdrant] Created BM25 index for {collection_name}")
        
        print(f"[Qdrant] ✅ Stored {len(points)} chunks in {collection_name}")
        return True
        
    except Exception as e:
        print(f"[Qdrant] ❌ Error storing documents: {e}")
        import traceback
        traceback.print_exc()
        return False


async def retrieve_relevant_documents(
    teacher_id: str,
    query: str,
    collection_type: str = "user_docs",
    top_k: int = 5,
    score_threshold: float = 0.7,
    filter_doc_ids: Optional[List[str]] = None,
    is_hybrid: bool = False
) -> List[Document]:
    """
    Retrieve relevant documents from Qdrant using semantic search.
    """
    try:
        collection_name = get_collection_name(teacher_id, collection_type)
        
        # Check if collection exists
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [c.name for c in collections_response.collections]
        
        if collection_name not in collections:
            print(f"[Qdrant] Collection {collection_name} does not exist")
            return []
        
        # Embed query
        query_embedding = await embed_query(query)
        
        # Build filter if doc IDs provided
        query_filter = None
        if filter_doc_ids:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="doc_id",
                        match=models.MatchAny(any=filter_doc_ids)
                    )
                ]
            )
        
        # Search
        if is_hybrid:
            # Hybrid search: get more candidates, then use BM25
            vector_results = await asyncio.to_thread(
                QDRANT_CLIENT.search,
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k * 3,
                score_threshold=score_threshold,
                query_filter=query_filter
            )
            # For now, return vector results (BM25 can be added later)
            results = vector_results[:top_k]
        else:
            results = await asyncio.to_thread(
                QDRANT_CLIENT.search,
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=query_filter
            )
        
        # Convert to Documents
        documents = []
        for result in results:
            payload = result.payload
            text = payload.get("text", "")
            metadata = {k: v for k, v in payload.items() if k != "text"}
            metadata["score"] = result.score
            
            documents.append(
                Document(
                    page_content=text,
                    metadata=metadata
                )
            )
        
        print(f"[Qdrant] ✅ Retrieved {len(documents)} relevant documents")
        return documents
        
    except Exception as e:
        print(f"[Qdrant] ❌ Error retrieving documents: {e}")
        import traceback
        traceback.print_exc()
        return []

