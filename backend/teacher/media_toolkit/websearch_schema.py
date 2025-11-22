import os
import json
from dotenv import load_dotenv
import logging
from langchain_tavily import TavilySearch
from langchain_core.messages import HumanMessage, ToolMessage
from typing import Callable, Awaitable
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[3]
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))
# Import functions from llm.py
from backend.llm import get_llm, stream_with_token_tracking

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
tavily_api_key = os.getenv("TAVILY_API_KEY")

chat = None
tavily_tool = None
chat_with_tools = None

try:
    if not openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY not found in environment variables. Please check your .env file.")
    if not tavily_api_key:
        raise ValueError("TAVILY_API_KEY not found in environment variables. Please check your .env file.")

    # Use get_llm from llm.py to initialize the chat model
    chat = get_llm("x-ai/grok-4.1-fast", 0.6)

    tavily_tool = TavilySearch(max_results=5, api_key=tavily_api_key, search_depth="advanced", topic="general")
    
    chat_with_tools = chat.bind_tools([tavily_tool])

except ImportError as e:
    logger.warning(f"Could not import a required library: {e}")
except Exception as e:
    logger.warning(f"Failed to initialize models or tools: {e}")


async def run_search_agent(
    topic: str,
    grade_level: str,
    subject: str,
    content_type: str,
    language: str,
    comprehension: str,
    chunk_callback: Callable[[str], Awaitable[None]],
) -> str:
    """
    Constructs a query, runs the web search agent, and streams the output via a callback.
    """
    if not chat_with_tools:
        raise RuntimeError("Chat model with tools is not initialized. Check API keys and dependencies.")

    # Query construction is now handled inside this module
    query = (
        f"Find detailed {content_type} about '{topic}' suitable for a grade {grade_level} "
        f"{subject} class. The content must be in {language} at a {comprehension} "
        "comprehension level. Provide links to the sources and a comprehensive summary of the content "
        "based on a web search."
    )
    logger.info(f"Constructed web search query: {query}")

    messages = [HumanMessage(content=query)]
    
    ai_msg = await chat_with_tools.ainvoke(messages)
    messages.append(ai_msg)

    if ai_msg.tool_calls:
        logger.info(f"Model decided to use tools: {ai_msg.tool_calls}")
        for tool_call in ai_msg.tool_calls:
            search_results = await tavily_tool.ainvoke(tool_call["args"])
            messages.append(
                ToolMessage(content=json.dumps(search_results), tool_call_id=tool_call["id"])
            )

    # Use stream_with_token_tracking to get the final response
    full_response, token_usage = await stream_with_token_tracking(
        llm=chat_with_tools,
        messages=messages,
        chunk_callback=chunk_callback
    )
    
    logger.info(f"Finished streaming final response. Token usage: {token_usage}")
    return full_response