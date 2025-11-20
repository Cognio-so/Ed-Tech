# llm.py
import os
from langchain_openai import ChatOpenAI
from typing import Dict, Any, Optional
import httpx

_persistent_http_client = httpx.Client(
    http2=True,
    timeout=httpx.Timeout(30.0),
    headers={
        "Connection": "keep-alive",
        "User-Agent": "DruidX-LLM-Agent/1.0"
    },
)
_cached_llms = {}

def _extract_usage(ai_message):
    """
    Returns a dict: {"input_tokens": int, "output_tokens": int, "total_tokens": int}
    Compatible with both non-streaming and streaming (with include_usage).
    """
    usage = getattr(ai_message, "usage_metadata", None)
    if usage:
        return {
            "input_tokens": usage.get("input_tokens") or usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("output_tokens") or usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0)
        }

    rm = getattr(ai_message, "response_metadata", {}) or {}
    tu = rm.get("token_usage", {}) or {}
    if tu:
        return {
            "input_tokens": tu.get("prompt_tokens", tu.get("input_tokens", 0)),
            "output_tokens": tu.get("completion_tokens", tu.get("output_tokens", 0)),
            "total_tokens": tu.get("total_tokens", 0),
        }

    if "usage" in rm:
        usage = rm["usage"]
        return {
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("candidates_token_count", 0),
            "total_tokens": usage.get("total_token_count", 0)
        }
    
    return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

def get_reasoning_llm(model_name: str):
    """
    Returns a ChatOpenAI instance configured to use DeepSeek via OpenRouter.
    """
    return ChatOpenAI(
        model=model_name,   
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=0.9,
        default_headers={
            "HTTP-Referer": os.getenv("APP_URL", "http://localhost"),
            "X-Title": os.getenv("APP_NAME", "My LangGraph App")
        },
        model_kwargs={
            "stream_options": {"include_usage": True}
        },
    )

def get_llm(model_name: str, temperature: float = 0.3):
    """
    Optimized ChatOpenAI constructor for OpenRouter.
    ⚙️ Features:
    - Persistent HTTP/2 keep-alive connection
    - Cached model clients (no re-authentication each call)
    - Reduced TLS handshake latency
    - Works seamlessly with LangGraph & async streaming
    - Includes stream_options to get token usage
    """
    global _cached_llms
    if model_name in _cached_llms:
        return _cached_llms[model_name]
    llm = ChatOpenAI(
        model=model_name,
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        temperature=temperature,
        http_client=_persistent_http_client,
        default_headers={
            "HTTP-Referer": os.getenv("APP_URL", "http://localhost"),
            "X-Title": os.getenv("APP_NAME", "My LangGraph App"),
            "Connection": "keep-alive"
        },
        model_kwargs={
            "stream_options": {"include_usage": True}
        },
    )

    _cached_llms[model_name] = llm
    return llm


async def stream_with_token_tracking(llm, messages, chunk_callback=None, state: Optional[Dict[str, Any]] = None):
    """
    Stream LLM response while tracking token usage.
    
    Uses the more reliable `astream_events` method to capture usage metadata 
    from the 'end' event of the stream, which is more robust across different LLM providers.
    
    Args:
        llm: LangChain LLM instance
        messages: List of messages to send to LLM
        chunk_callback: Optional callback function for streaming chunks
        state: Optional GraphState dictionary to accumulate token usage
    
    Returns:
        Tuple of (full_response: str, token_usage: Dict[str, int])
    """
    full_response = ""
    token_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    
    async for event in llm.astream_events(messages, version="v1"):
        kind = event["event"]
        
        if kind == "on_chat_model_stream":
            chunk_content = event["data"]["chunk"].content
            if chunk_content:
                full_response += chunk_content
                if chunk_callback:
                    await chunk_callback(chunk_content)
                    
        elif kind == "on_chat_model_end":
            final_run_state = event["data"]
            final_message = final_run_state.get("output")
            if final_message:
                token_usage = _extract_usage(final_message)

    if token_usage["total_tokens"] > 0:
        print(f"[TokenTracking] ✅ Captured tokens from stream: {token_usage}")
    else:
        print(f"[TokenTracking] ⚠️ No tokens found in stream (usage will be 0)")
    
    if state is not None:
        if "token_usage" not in state or state["token_usage"] is None:
            state["token_usage"] = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        
        state["token_usage"]["input_tokens"] += token_usage["input_tokens"]
        state["token_usage"]["output_tokens"] += token_usage["output_tokens"]
        state["token_usage"]["total_tokens"] += token_usage["total_tokens"]
        
        print(f"[TokenTracking] Accumulated token usage in state: {state['token_usage']}")
    
    return full_response, token_usage
