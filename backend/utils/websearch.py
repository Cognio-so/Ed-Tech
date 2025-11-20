import asyncio
import os
from typing import List, Optional

from tavily import TavilyClient

_tavily_client: Optional[TavilyClient] = None


async def _get_tavily_client() -> Optional[TavilyClient]:
    global _tavily_client
    if _tavily_client is not None:
        return _tavily_client

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        print("[Multimedia] TAVILY_API_KEY is not set; skipping multimedia search.")
        return None

    try:
        _tavily_client = TavilyClient(api_key=api_key)
    except Exception as exc:
        print(f"[Multimedia] Failed to initialize Tavily client: {exc}")
        _tavily_client = None
    return _tavily_client


async def get_youtube_links(topic: str, max_results: int = 3) -> List[str]:
    """
    Fetch YouTube links related to the topic using Tavily search.
    """
    client = await _get_tavily_client()
    if client is None:
        return []
    print(f"[Multimedia] Searching for YouTube links for topic: {topic}")   
    query = f"educational YouTube video about {topic}"
    try:
        response = await asyncio.to_thread(
            client.search,
            query=query,
            max_results=max_results * 2,
            search_depth="advanced",
            include_domains=["youtube.com", "youtu.be"],
        )
    except Exception as exc:
        print(f"[Multimedia] Tavily search failed: {exc}")
        return []

    urls: List[str] = []
    for result in response.get("results", []):
        url = result.get("url")
        if not url:
            continue
        if "youtube.com" in url or "youtu.be" in url:
            if url not in urls:
                urls.append(url)
        if len(urls) >= max_results:
            break
    return urls

