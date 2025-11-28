import os
from typing import Optional

from qdrant_client import QdrantClient

QDRANT_URL = os.getenv("QDRANT_URL", ":memory:")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_TIMEOUT = float(os.getenv("QDRANT_TIMEOUT", "60"))
VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "1536"))
QDRANT_UPSERT_BATCH_SIZE = int(os.getenv("QDRANT_UPSERT_BATCH_SIZE", "64"))

_QDRANT_CLIENT: Optional[QdrantClient] = None
_QDRANT_USING_IN_MEMORY: bool = QDRANT_URL == ":memory:"
_QDRANT_STATUS: str = "Qdrant client not initialized"


def get_qdrant_client() -> QdrantClient:
    """Return a shared Qdrant client instance."""
    global _QDRANT_CLIENT, _QDRANT_USING_IN_MEMORY, _QDRANT_STATUS

    if _QDRANT_CLIENT is not None:
        return _QDRANT_CLIENT

    try:
        if QDRANT_URL == ":memory:":
            _QDRANT_CLIENT = QdrantClient(":memory:", timeout=QDRANT_TIMEOUT)
            _QDRANT_USING_IN_MEMORY = True
            _QDRANT_STATUS = "Using in-memory Qdrant instance"
        else:
            _QDRANT_CLIENT = QdrantClient(
                url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=QDRANT_TIMEOUT
            )
            # Simple connectivity check
            _QDRANT_CLIENT.get_collections()
            _QDRANT_USING_IN_MEMORY = False
            _QDRANT_STATUS = f"Connected to Qdrant at {QDRANT_URL}"
            print(f"[Qdrant] Connected to remote Qdrant at {QDRANT_URL}")
    except Exception as exc:
        print(f"[Qdrant] ❌ Failed to connect to {QDRANT_URL}: {exc}")
        _QDRANT_CLIENT = QdrantClient(":memory:", timeout=QDRANT_TIMEOUT)
        _QDRANT_USING_IN_MEMORY = True
        _QDRANT_STATUS = (
            f"Failed to connect to {QDRANT_URL}. Falling back to in-memory Qdrant."
        )
        print("[Qdrant] ⚠️ Using in-memory Qdrant (data lost on restart)")

    return _QDRANT_CLIENT


def is_qdrant_in_memory() -> bool:
    """Return True if the shared client points to an in-memory instance."""
    if _QDRANT_CLIENT is None:
        get_qdrant_client()
    return _QDRANT_USING_IN_MEMORY


def get_qdrant_status() -> str:
    """Return the latest connection status message."""
    if _QDRANT_CLIENT is None:
        get_qdrant_client()
    return _QDRANT_STATUS

