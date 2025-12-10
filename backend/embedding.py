
import os
from langchain_openai import OpenAIEmbeddings
from typing import List, Dict
import httpx
import asyncio

_persistent_http_client = httpx.Client(
    http2=True,
    timeout=httpx.Timeout(60.0),  
    headers={
        "Connection": "keep-alive",
        "User-Agent": "DruidX-Embedding-Service/1.0"
    },
)

_cached_embedding_models: Dict[str, OpenAIEmbeddings] = {}


def get_embedding_model(model: str = "text-embedding-3-small", dimensions: int = None) -> OpenAIEmbeddings:
    """
    Get or create cached OpenAIEmbeddings instance with shared HTTP client.
    """
    global _cached_embedding_models
    
    # Create cache key that includes dimensions to avoid conflicts
    cache_key = f"{model}_{dimensions}" if dimensions else model
    
    if cache_key not in _cached_embedding_models:
        embedding_kwargs = {
            "model": model,
            "http_client": _persistent_http_client,
            "show_progress_bar": False
        }
        # Add dimensions parameter if specified (for text-embedding-3 models)
        if dimensions:
            embedding_kwargs["dimensions"] = dimensions
        
        _cached_embedding_models[cache_key] = OpenAIEmbeddings(**embedding_kwargs)
        dim_str = f" (dimensions={dimensions})" if dimensions else " (default dimensions)"
        print(f"[Embeddings] ✅ Initialized cached embedding model: {model}{dim_str}")
    
    return _cached_embedding_models[cache_key]


async def embed_chunks_parallel(
    texts: List[str], 
    batch_size: int = 500,
    model: str = "text-embedding-3-small",
    dimensions: int = None
) -> List[List[float]]:
    """
    Process embeddings in parallel batches for maximum efficiency.
    
    Splits large text lists into batches and processes them concurrently using asyncio.gather().
    This enables:
    - Parallel processing of multiple batches
    - No blocking between different sessions
    - Optimal batch sizes for API efficiency
    - Preserved order of results
    - Support for custom dimensions (e.g., 1024 for text-embedding-3 models)
    
    Args:
        texts: List of text strings to embed
        batch_size: Number of texts per batch (default: 500, optimal for OpenAI API - supports up to 2048)
        model: Embedding model name
        dimensions: Optional dimension size (e.g., 1024). If None, uses model default.
    
    Returns:
        List of embedding vectors in the same order as input texts
    
    Example:
        >>> texts = ["text1", "text2", ..., "text1000"]
        >>> embeddings = await embed_chunks_parallel(texts, batch_size=500, dimensions=1024)
        >>> # Will create 2 batches of 500, process them in parallel with 1024 dimensions
    """
    if not texts:
        return []

    embedding_model = get_embedding_model(model, dimensions=dimensions)
    batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]
    
    # Determine fallback dimension for error cases
    fallback_dim = dimensions if dimensions else 1536  # Default for text-embedding-3-small
    
    if len(batches) == 1:
        print(f"[Embeddings] Processing single batch of {len(texts)} texts")
        embeddings = await embedding_model.aembed_documents(batches[0])
        return embeddings
    
    async def embed_batch(batch: List[str], batch_idx: int) -> List[List[float]]:
        """Embed a single batch"""
        try:
            result = await embedding_model.aembed_documents(batch)
            print(f"[Embeddings] ✅ Batch {batch_idx + 1}/{len(batches)} completed ({len(batch)} texts)")
            return result
        except Exception as e:
            print(f"[Embeddings] ❌ Batch {batch_idx + 1}/{len(batches)} failed: {e}")
            return [[0.0] * fallback_dim] * len(batch)  
        
    batch_results = await asyncio.gather(
        *[embed_batch(batch, idx) for idx, batch in enumerate(batches)],
        return_exceptions=True
    )
    
    all_embeddings = []
    for batch_result in batch_results:
        if isinstance(batch_result, Exception):
            print(f"[Embeddings] ⚠️ Batch raised exception: {batch_result}")
            continue
        all_embeddings.extend(batch_result)
    
    print(f"[Embeddings] ✅ Completed parallel embedding: {len(all_embeddings)}/{len(texts)} embeddings")
    return all_embeddings


async def embed_query(
    query: str,
    model: str = "text-embedding-3-small",
    dimensions: int = None
) -> List[float]:
    """
    Embed a single query string (optimized wrapper).
    
    Args:
        query: Query text to embed
        model: Embedding model name
        dimensions: Optional dimension size (e.g., 1024). If None, uses model default.
    
    Returns:
        Embedding vector as list of floats
    """
    embedding_model = get_embedding_model(model, dimensions=dimensions)
    return await embedding_model.aembed_query(query)
