"""
Background task scheduler for automatic document cleanup for Students.
Runs cleanup tasks periodically to remove expired documents (24 hour TTL).
"""
import asyncio
import time
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

try:
    from backend.Student.Ai_tutor.qdrant_utils import QDRANT_CLIENT
except ImportError:
    from Student.Ai_tutor.qdrant_utils import QDRANT_CLIENT

# TTL for documents (24 hours)
USER_DOC_TTL_SECONDS = int(24 * 60 * 60)

# Cleanup interval (1 hour)
CLEANUP_INTERVAL_SECONDS = int(60 * 60)


async def cleanup_all_expired_collections():
    """
    Scan all collections and delete those with expired documents.
    Collections follow naming pattern: student_{student_id}_{session_id}
    """
    try:
        # Get all collections
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [c.name for c in collections_response.collections]
        
        # Filter for student session collections
        student_collections = [c for c in collections if c.startswith("student_")]
        
        if not student_collections:
            print(f"[CLEANUP] No student collections found")
            return
        
        print(f"[CLEANUP] 🔍 Checking {len(student_collections)} student collections for expiry...")
        
        deleted_count = 0
        current_time = int(time.time())
        
        for collection_name in student_collections:
            try:
                # Use a default if timestamp is missing to avoid crashing
                # Try to find at least one point that is older than TTL
                scroll_result = await asyncio.to_thread(
                    QDRANT_CLIENT.scroll,
                    collection_name=collection_name,
                    limit=10,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, _ = scroll_result
                
                if not points:
                    # Empty collection, delete it
                    await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                    print(f"[CLEANUP] 🗑️ Deleted empty collection: {collection_name}")
                    deleted_count += 1
                    continue
                
                # Check oldest timestamp in the sample
                oldest_timestamp = min(
                    point.payload.get("timestamp", current_time) 
                    for point in points 
                    if point.payload
                )
                
                # Delete if older than TTL
                if current_time - oldest_timestamp > USER_DOC_TTL_SECONDS:
                    await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                    print(f"[CLEANUP] 🗑️ Deleted expired collection: {collection_name} (age: {(current_time - oldest_timestamp) / 3600:.1f} hours)")
                    deleted_count += 1
               
                
            except Exception as e:
                print(f"[CLEANUP] ⚠️ Error processing collection {collection_name}: {e}")
                continue
        
        if deleted_count > 0:
            print(f"[CLEANUP] ✅ Cleanup complete: deleted {deleted_count} expired collections")
        else:
            print(f"[CLEANUP] ✅ Cleanup complete: no expired collections found")
        
    except Exception as e:
        print(f"[CLEANUP] ❌ Error during cleanup: {e}")


async def start_cleanup_scheduler():
    """
    Start background task that runs cleanup every hour.
    This should be called when the application starts.
    """
    print(f"[CLEANUP] 🚀 Starting student document cleanup scheduler (interval: {CLEANUP_INTERVAL_SECONDS / 3600} hours)")
    
    while True:
        try:
            await cleanup_all_expired_collections()
        except Exception as e:
            print(f"[CLEANUP] ❌ Scheduler error: {e}")
        
        # Wait for next cleanup cycle
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


# For manual cleanup (can be called from API endpoint)
async def manual_cleanup():
    """
    Manually trigger cleanup of expired documents.
    Can be called from an API endpoint for testing or admin purposes.
    """
    print(f"[CLEANUP] 🔧 Manual cleanup triggered")
    await cleanup_all_expired_collections()
