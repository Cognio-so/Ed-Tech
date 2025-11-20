import os
import json
from dotenv import load_dotenv
import logging
from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langchain_core.messages import HumanMessage, ToolMessage
from typing import Callable, Awaitable

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

    chat = ChatOpenAI(
        model="openai/gpt-4o-mini",
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=openrouter_api_key,
        temperature=0.9,
        default_headers={
            "HTTP-Referer": os.getenv("APP_URL", "http://localhost"),
            "X-Title": os.getenv("APP_NAME", "My LangGraph App")
        },
        model_kwargs={
            "stream_options": {"include_usage": True}
        },
    )
    logger.info("OpenRouter chat initialized successfully")

    tavily_tool = TavilySearch(max_results=5, api_key=tavily_api_key, search_depth="advanced", topic="general")
    logger.info("Tavily Search tool initialized successfully")

    chat_with_tools = chat.bind_tools([tavily_tool])
    logger.info("Tavily tool bound to the chat model")

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

    full_response = ""
    async for chunk in chat_with_tools.astream(messages):
        content = chunk.content
        if content:
            full_response += content
            if chunk_callback:
                await chunk_callback(content)
    
    logger.info("Finished streaming final response.")
    return full_response