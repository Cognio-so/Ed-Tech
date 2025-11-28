"""
Qdrant utilities for Student AI Tutor vector storage and retrieval.
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

import uuid
import asyncio
from typing import List, Dict, Any, Optional

from qdrant_client import models
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.embedding import embed_chunks_parallel, embed_query
from rank_bm25 import BM25Okapi
import re
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from backend.qdrant_service import (
    get_qdrant_client,
    VECTOR_SIZE,
    QDRANT_UPSERT_BATCH_SIZE,
)

QDRANT_CLIENT = get_qdrant_client()


def tokenize(text: str) -> List[str]:
    """Tokenize text for BM25."""
    tokens = re.findall(r"\w+", text.lower())
    return [token for token in tokens if token not in ENGLISH_STOP_WORDS]


def get_collection_name(student_id: str, collection_type: str = "user_docs") -> str:
    """Generate collection name for student."""
    return f"student_ai_tutor_{student_id}_{collection_type}"


async def ensure_collection(collection_name: str, is_hybrid: bool = False):
    """Ensure collection exists, create if not."""
    try:
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [collection.name for collection in collections_response.collections]

        if collection_name not in collections:
            await asyncio.to_thread(
                QDRANT_CLIENT.recreate_collection,
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
            )

            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="doc_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="filename",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="file_type",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            print(f"[Student Qdrant] Created collection: {collection_name}")
        else:
            print(f"[Student Qdrant] Collection already exists: {collection_name}")
    except Exception as exc:
        print(f"[Student Qdrant] Error ensuring collection: {exc}")
        raise


async def store_documents(
    student_id: str,
    documents: List[Document],
    collection_type: str = "user_docs",
    is_hybrid: bool = False,
    clear_existing: bool = False,
    metadata: Optional[Dict[str, Any]] = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> bool:
    """
    Store documents in Qdrant with embeddings.
    """
    if not documents:
        return False

    try:
        collection_name = get_collection_name(student_id, collection_type)

        if clear_existing:
            try:
                collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
                collections = [collection.name for collection in collections_response.collections]
                if collection_name in collections:
                    await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                    print(f"[Student Qdrant] Cleared existing collection: {collection_name}")
            except Exception as exc:
                print(f"[Student Qdrant] Error clearing collection: {exc}")

        await ensure_collection(collection_name, is_hybrid)

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

        all_chunks: List[str] = []
        all_metadatas: List[Dict[str, Any]] = []

        for document in documents:
            chunks = text_splitter.split_text(document.page_content)
            base_meta = document.metadata.copy() if document.metadata else {}
            if metadata:
                base_meta.update(metadata)

            for index, chunk in enumerate(chunks):
                chunk_meta = base_meta.copy()
                chunk_meta["chunk_index"] = index
                chunk_meta["total_chunks"] = len(chunks)
                all_chunks.append(chunk)
                all_metadatas.append(chunk_meta)

        print(f"[Student Qdrant] Split {len(documents)} documents into {len(all_chunks)} chunks")
        print(f"[Student Qdrant] Generating embeddings for {len(all_chunks)} chunks...")
        embeddings = await embed_chunks_parallel(all_chunks, batch_size=200)

        points = []
        for index, (chunk, embedding, meta) in enumerate(zip(all_chunks, embeddings, all_metadatas)):
            payload = {
                "text": chunk,
                "chunk_index": index,
                **meta,
            }
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload=payload,
                )
            )

        for start in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
            batch = points[start : start + QDRANT_UPSERT_BATCH_SIZE]
            await asyncio.to_thread(
                QDRANT_CLIENT.upsert,
                collection_name=collection_name,
                points=batch,
            )

        if is_hybrid:
            tokenized_chunks = [tokenize(chunk) for chunk in all_chunks]
            await asyncio.to_thread(BM25Okapi, tokenized_chunks)
            print(f"[Student Qdrant] Created BM25 index for {collection_name}")

        print(f"[Student Qdrant] ✅ Stored {len(points)} chunks in {collection_name}")
        return True

    except Exception as exc:
        print(f"[Student Qdrant] ❌ Error storing documents: {exc}")
        import traceback

        traceback.print_exc()
        return False


async def retrieve_relevant_documents(
    student_id: str,
    query: str,
    collection_type: str = "user_docs",
    top_k: int = 5,
    score_threshold: float = 0.7,
    filter_doc_ids: Optional[List[str]] = None,
    is_hybrid: bool = False,
) -> List[Document]:
    """
    Retrieve relevant documents from Qdrant using semantic search.
    """
    try:
        collection_name = get_collection_name(student_id, collection_type)

        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [collection.name for collection in collections_response.collections]

        if collection_name not in collections:
            print(f"[Student Qdrant] Collection {collection_name} does not exist")
            return []

        query_embedding = await embed_query(query)

        query_filter = None
        if filter_doc_ids:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="doc_id",
                        match=models.MatchAny(any=filter_doc_ids),
                    )
                ]
            )

        if is_hybrid:
            results = await asyncio.to_thread(
                QDRANT_CLIENT.search,
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k * 3,
                score_threshold=score_threshold,
                query_filter=query_filter,
            )
            results = results[:top_k]
        else:
            results = await asyncio.to_thread(
                QDRANT_CLIENT.search,
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=query_filter,
            )

        documents: List[Document] = []
        for result in results:
            payload = result.payload or {}
            text = payload.get("text", "")
            metadata = {key: value for key, value in payload.items() if key != "text"}
            metadata["score"] = result.score

            documents.append(
                Document(
                    page_content=text,
                    metadata=metadata,
                )
            )

        print(f"[Student Qdrant] ✅ Retrieved {len(documents)} relevant documents")
        return documents

    except Exception as exc:
        print(f"[Student Qdrant] ❌ Error retrieving documents: {exc}")
        import traceback

        traceback.print_exc()
        return []


