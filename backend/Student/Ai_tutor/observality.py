import os
from typing import Any, Callable
from functools import wraps
from langsmith import traceable
from langchain_core.tracers.context import tracing_v2_enabled

os.environ["LANGCHAIN_TRACING_V2"] = "true"

import inspect

def trace_graph_invoke(graph_func: Callable) -> Callable:
    if inspect.iscoroutinefunction(graph_func):
        @wraps(graph_func)
        @traceable(
            name="graph_execution",
            run_type="chain",
            tags=["graph", "api_call"]
        )
        async def async_wrapper(state: dict[str, Any]) -> dict[str, Any]:
            import langsmith
            run = langsmith.get_current_run_tree()
            if run:
                run.extra["metadata"] = {
                    "session_id": state.get("session_id"),
                    "llm_model": state.get("llm_model"),
                    "has_doc": bool(state.get("doc")),
                    "text_preview": (state.get("text") or "")[:100],
                }
            return await graph_func(state)
        return async_wrapper
    else:
        @wraps(graph_func)
        @traceable(
            name="graph_execution",
            run_type="chain",
            tags=["graph", "api_call"]
        )
        def sync_wrapper(state: dict[str, Any]) -> dict[str, Any]:
            import langsmith
            run = langsmith.get_current_run_tree()
            if run:
                run.extra["metadata"] = {
                    "session_id": state.get("session_id"),
                    "llm_model": state.get("llm_model"),
                    "has_doc": bool(state.get("doc")),
                    "text_preview": (state.get("text") or "")[:100],
                }
            return graph_func(state)
        return sync_wrapper


import inspect
from typing import Any, Callable
from functools import wraps
from langsmith import traceable

def trace_node(node_func: Callable, node_name: str) -> Callable:
    
    if inspect.iscoroutinefunction(node_func):
        @wraps(node_func)
        async def async_wrapper(state: dict[str, Any]) -> dict[str, Any]:
            @traceable(
                name=node_name,
                run_type="chain",
                tags=[node_name, "node", "graph_execution"],
                metadata={
                    "node_name": node_name,
                    "session_id": state.get("session_id"),
                    "thread_id": state.get("session_id"),
                    "input_keys": list(state.keys()) if isinstance(state, dict) else [],
                    "timestamp": state.get("timestamp"),
                }
            )
            async def _execute_node(input_state):
                return await node_func(input_state)

            return await _execute_node(state)

        return async_wrapper
    
    else:
        @wraps(node_func)
        def sync_wrapper(state: dict[str, Any]) -> dict[str, Any]:
            @traceable(
                name=node_name,
                run_type="chain",
                tags=[node_name, "node", "graph_execution"],
                metadata={
                    "node_name": node_name,
                    "session_id": state.get("session_id"),
                    "thread_id": state.get("session_id"),
                    "input_keys": list(state.keys()) if isinstance(state, dict) else [],
                    "timestamp": state.get("timestamp"),
                }
            )
            def _execute_node(input_state):
                return node_func(input_state)

            return _execute_node(state)

        return sync_wrapper


def trace_llm_call(func: Callable) -> Callable:
    @wraps(func)
    @traceable(
        run_type="llm",
        tags=["llm_call"]
    )
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    
    return wrapper
import time
def track_llm_usage(func: Callable) -> Callable:
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        
        result = await func(*args, **kwargs)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"LLM call completed in {duration:.2f}s")
        
        return result
    
    return async_wrapper    
