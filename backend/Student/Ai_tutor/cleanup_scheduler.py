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

USER_DOC_TTL_SECONDS = int(24 * 60 * 60)

CLEANUP_INTERVAL_SECONDS = int(60 * 60)


async def cleanup_all_expired_collections():
    try:
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [c.name for c in collections_response.collections]
        
        student_collections = [c for c in collections if c.startswith("student_")]
        
        if not student_collections:
            print(f"[CLEANUP] No student collections found")
            return
        
        print(f"[CLEANUP] 🔍 Checking {len(student_collections)} student collections for expiry...")
        
        deleted_count = 0
        current_time = int(time.time())
        
        for collection_name in student_collections:
            try:
                scroll_result = await asyncio.to_thread(
                    QDRANT_CLIENT.scroll,
                    collection_name=collection_name,
                    limit=10,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, _ = scroll_result
                
                if not points:
                    await asyncio.to_thread(QDRANT_CLIENT.delete_collection, collection_name=collection_name)
                    print(f"[CLEANUP] 🗑️ Deleted empty collection: {collection_name}")
                    deleted_count += 1
                    continue
                
                oldest_timestamp = min(
                    point.payload.get("timestamp", current_time) 
                    for point in points 
                    if point.payload
                )
                
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
    print(f"[CLEANUP] 🚀 Starting student document cleanup scheduler (interval: {CLEANUP_INTERVAL_SECONDS / 3600} hours)")
    
    while True:
        try:
            await cleanup_all_expired_collections()
        except Exception as e:
            print(f"[CLEANUP] ❌ Scheduler error: {e}")
        
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


async def manual_cleanup():
    print(f"[CLEANUP] 🔧 Manual cleanup triggered")
    await cleanup_all_expired_collections()
