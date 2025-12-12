import hashlib
import heapq
from typing import List, Any, Callable, Dict, Set

class ContentDeduplicator:
    """
    Uses hashing to identify and filter duplicate content chunks.
    This is an O(1) average time complexity check per chunk using a Hash Set.
    """
    def __init__(self):
        self.seen_hashes: Set[str] = set()

    def is_duplicate(self, text: str) -> bool:
        """
        Check if text has been seen before.
        Returns True if duplicate, False otherwise.
        """
        if not text or not text.strip():
            return True
            
        # Create a stable hash of the content
        content_hash = hashlib.sha256(text.strip().encode('utf-8')).hexdigest()
        
        if content_hash in self.seen_hashes:
            return True
            
        self.seen_hashes.add(content_hash)
        return False

    def clear(self):
        self.seen_hashes.clear()

def merge_sorted_results(
    results_lists: List[List[Any]], 
    key_func: Callable[[Any], float], 
    reverse: bool = True,
    limit: int = 10
) -> List[Any]:
    """
    Merges multiple sorted lists into a single sorted list using a Heap.
    Time Complexity: O(N log K) where N is total elements and K is number of lists.
    
    :param results_lists: List of lists containing result objects
    :param key_func: Function to extract the comparison key (e.g. score)
    :param reverse: True for descending order (higher score first), False for ascending
    :param limit: Maximum number of results to return
    """
    # Filter out empty lists
    iterators = [iter(r) for r in results_lists if r]
    
    if not iterators:
        return []

    # Use heapq.merge which is efficient for sorted inputs
    # Note: heapq.merge assumes inputs are already sorted!
    merged_iter = heapq.merge(*results_lists, key=key_func, reverse=reverse)
    
    # Take only the top 'limit' items
    final_results = []
    try:
        for _ in range(limit):
            final_results.append(next(merged_iter))
    except StopIteration:
        pass
        
    return final_results

from collections import OrderedDict

class LRUCache:
    """
    A simple Least Recently Used (LRU) cache implementation using OrderedDict
    (which is a Doubly Linked List + Hash Map in Python).
    """

    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: str) -> Any:
        if key not in self.cache:
            return None
        # Move to end to mark as recently used
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: str, value: Any) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
