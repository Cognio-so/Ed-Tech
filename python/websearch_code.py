import os
import logging
import time
import asyncio
import re
from typing import Annotated, TypedDict, List, Dict, Any, Optional, Literal
from dotenv import load_dotenv

# LangChain imports
from langchain_core.messages import BaseMessage
from langchain_core.tools import StructuredTool
from langchain_perplexity import ChatPerplexity
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# LangGraph imports
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class WebSearchState(TypedDict):
    """State for the web search graph."""
    messages: Annotated[List[BaseMessage], add_messages]
    search_results: Optional[List[Dict[str, Any]]]

class PerplexityWebSearchTool:
    """Reusable Perplexity web search tool for LangGraph with enhanced URL extraction."""
    
    def __init__(
        self, 
        max_results: int = 5,
        api_key: Optional[str] = None,
        model: str = "sonar",
        temperature: float = 0.7,
        include_links: bool = True,
    ):
        """
        Initialize the Perplexity web search tool.
        
        Args:
            max_results: Maximum number of search results to return
            api_key: Perplexity API key (defaults to PPLX_API_KEY env variable)
            model: Model to use (sonar recommended for search functionality)
            temperature: Temperature setting for the model
            include_links: Whether to include links in the response
        """
        self.max_results = max_results
        self.api_key = api_key
        self.include_links = include_links
        self.model = model
        
        # Set API key in environment if provided
        if api_key:
            os.environ["PPLX_API_KEY"] = api_key
        elif not os.getenv("PPLX_API_KEY"):
            raise ValueError("Perplexity API key is required. Set the PPLX_API_KEY environment variable.")
        
        try:
            # Initialize the search tool with Perplexity chat model
            self.chat_model = ChatPerplexity(
                model=model,
                temperature=temperature,
                pplx_api_key=os.getenv("PPLX_API_KEY"),
                streaming=False,
            )
            
            # Convert the chat model to a structured tool for searching
            self.search_tool = StructuredTool.from_function(
                func=self._search_func,
                name="perplexity_search",
                description=(
                    "A powerful web search tool that finds educational videos and resources. "
                    "CRITICAL: You MUST extract clean, valid YouTube URLs from the results. "
                    "Use this to find current and factual information with video resources. "
                    "Pass the full, detailed query in a single search call. "
                    "Always provide URLs in the format: [Title](https://youtube.com/watch?v=VIDEO_ID)"
                ),
                args_schema=self._get_args_schema(),
            )
            
            logger.info(f"PerplexityWebSearchTool initialized with max_results={max_results}, model={model}")
        except Exception as e:
            logger.error(f"Failed to initialize PerplexityWebSearchTool: {str(e)}")
            raise
    
    def _get_args_schema(self):
        """Create a dynamic args schema for the search tool."""
        from pydantic import BaseModel, Field
        
        class SearchSchema(BaseModel):
            query: str = Field(..., description="The search query to execute")
        
        return SearchSchema
    
    def _extract_clean_urls(self, text: str) -> List[Dict[str, str]]:
        """
        Extract and clean YouTube URLs from text with multiple fallback patterns.
        
        Returns:
            List of dicts with 'url' and 'title' keys
        """
        urls = []
        
        # Pattern 1: Full YouTube URLs (most common)
        youtube_patterns = [
            r'https?://(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
            r'https?://youtu\.be/([a-zA-Z0-9_-]{11})',
            r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
            r'youtu\.be/([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in youtube_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                video_id = match.group(1) if match.groups() else match.group(0)
                # Ensure we have a valid 11-character video ID
                if len(video_id) == 11:
                    clean_url = f"https://youtube.com/watch?v={video_id}"
                    
                    # Try to extract title from surrounding text
                    title = self._extract_title_near_url(text, match.start())
                    
                    urls.append({
                        'url': clean_url,
                        'title': title or "Educational Video",
                        'video_id': video_id
                    })
        
        # Pattern 2: Markdown-style links [title](url)
        markdown_pattern = r'\[([^\]]+)\]\((https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11}))[^\)]*\)'
        markdown_matches = re.finditer(markdown_pattern, text, re.IGNORECASE)
        for match in markdown_matches:
            title = match.group(1).strip()
            video_id = match.group(3)
            clean_url = f"https://youtube.com/watch?v={video_id}"
            urls.append({
                'url': clean_url,
                'title': title,
                'video_id': video_id
            })
        
        # Remove duplicates based on video_id
        seen_ids = set()
        unique_urls = []
        for url_dict in urls:
            if url_dict['video_id'] not in seen_ids:
                seen_ids.add(url_dict['video_id'])
                unique_urls.append(url_dict)
        
        logger.info(f"Extracted {len(unique_urls)} unique clean URLs from search results")
        return unique_urls
    
    def _extract_title_near_url(self, text: str, url_position: int, context_window: int = 100) -> Optional[str]:
        """
        Extract a title from text near a URL position.
        Looks backwards from the URL for a likely title.
        """
        start = max(0, url_position - context_window)
        context = text[start:url_position]
        
        # Look for patterns like "Title:" or "Video:" before the URL
        title_patterns = [
            r'(?:title|video|watch):\s*([^\n\r]+?)(?:\s*[-–—]|\s*\||$)',
            r'"([^"]{10,100})"',  # Quoted text
            r'([A-Z][^.!?\n]{10,100}?)(?:\s*[-–—]|\n)',  # Sentence-like structure
        ]
        
        for pattern in title_patterns:
            matches = re.finditer(pattern, context, re.IGNORECASE)
            for match in matches:
                title = match.group(1).strip()
                if len(title) > 10 and len(title) < 100:  # Reasonable title length
                    return title
        
        return None
    
    def _format_search_prompt(self, query: str) -> str:
        """
        Format the search prompt to instruct Perplexity to return clean URLs.
        
        Args:
            query: The search query
            
        Returns:
            Formatted search prompt
        """
        link_instruction = """
        CRITICAL URL REQUIREMENTS:
        1. Provide ONLY valid, complete YouTube URLs
        2. Use the format: https://youtube.com/watch?v=VIDEO_ID
        3. Each URL must be on its own line or in markdown format: [Title](URL)
        4. Include the full video title before each URL
        5. Do not truncate or break URLs
        """ if self.include_links else ""
        
        prompt = (
            f"Search for educational videos and resources about: '{query}'\n\n"
            f"REQUIREMENTS:\n"
            f"- Return up to {self.max_results} high-quality results\n"
            f"- Focus on educational content suitable for learning\n"
            f"- Prioritize YouTube videos from reputable educational channels\n"
            f"{link_instruction}\n"
            f"- Provide a brief description of each video\n"
            f"- Ensure all URLs are complete and functional\n\n"
            f"Format your response clearly with video titles and URLs."
        )
        
        return prompt
    
    def _search_func(self, query: str) -> Dict[str, Any]:
        """
        Internal function to execute web search using Perplexity.
        
        Args:
            query: The search query
        
        Returns:
            Dictionary with search results including cleaned URLs
        """
        search_prompt = self._format_search_prompt(query)
        response = self.chat_model.invoke(search_prompt)
        
        # Extract clean URLs from the response
        clean_urls = self._extract_clean_urls(response.content)
        
        # Format the response with clean URLs
        formatted_content = response.content
        if clean_urls:
            formatted_content += "\n\n=== EXTRACTED VIDEO URLS ===\n"
            for i, url_info in enumerate(clean_urls, 1):
                formatted_content += f"{i}. [{url_info['title']}]({url_info['url']})\n"
        
        return {
            "query": query,
            "results": formatted_content,
            "video_urls": clean_urls,  # Separate field for easy access
            "url_count": len(clean_urls)
        }
    
    # Async search method
    async def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Execute a web search using Perplexity asynchronously.
        
        Args:
            query: The search query
            
        Returns:
            List of search result objects with cleaned URLs
        """
        try:
            logger.info(f"Executing async web search for query: {query}")
            start_time = time.time()
            
            search_prompt = self._format_search_prompt(query)
            
            # Using 'ainvoke' for non-blocking I/O
            response = await self.chat_model.ainvoke(search_prompt)
            
            # Extract clean URLs
            clean_urls = self._extract_clean_urls(response.content)
            
            # Format the response
            formatted_content = response.content
            if clean_urls:
                formatted_content += "\n\n=== EXTRACTED VIDEO URLS ===\n"
                for i, url_info in enumerate(clean_urls, 1):
                    formatted_content += f"{i}. [{url_info['title']}]({url_info['url']})\n"
            
            search_results = [{
                "content": formatted_content,
                "query": query,
                "video_urls": clean_urls,
                "url_count": len(clean_urls)
            }]
            
            elapsed = time.time() - start_time
            logger.info(f"Search completed in {elapsed:.2f}s. Found {len(clean_urls)} video URLs")
            
            return search_results
        except Exception as e:
            logger.error(f"Error executing web search: {str(e)}")
            return []
    
    def get_tool(self) -> StructuredTool:
        """
        Get the underlying LangChain StructuredTool.
        
        Returns:
            StructuredTool instance for use in chains
        """
        return self.search_tool
    
    def create_tool_node(self) -> ToolNode:
        """
        Create a LangGraph ToolNode for the search tool.
        
        Returns:
            ToolNode instance for use in LangGraph
        """
        return ToolNode(tools=[self.search_tool])
    
    def bind_to_llm(self, llm):
        """
        Bind the tool to an LLM.
        
        Args:
            llm: Language model instance
            
        Returns:
            LLM with tools binding
        """
        return llm.bind_tools([self.search_tool])

def get_llm(model_name: str = "gpt-4o-mini", temperature: float = 0.5):
    """
    Get an LLM instance. Tries to initialize OpenAI's models first
    and falls back to Google's models on any error.
    
    Args:
        model_name: Name of the LLM to use.
        temperature: Temperature setting for the LLM.
        
    Returns:
        LLM instance.
    """
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("OpenAI API key is required for the fallback LLM.")
                
        logger.info(f"Initializing OpenAI LLM: {model_name}")
        return ChatOpenAI(
            model=model_name,
            temperature=temperature,
            openai_api_key=openai_api_key
            )
    except Exception as e:
        logger.warning(f"Could not initialize OpenAI LLM ({e}). Falling back to gemini-2.5-flash-lite")
        try:
            google_api_key = os.getenv("GOOGLE_API_KEY")
            if not google_api_key:
                raise ValueError("GOOGLE_API_KEY environment variable not found.")

            logger.info(f"Initializing Google fallback LLM: gemini-2.5-flash-lite")
            return ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-lite",
                temperature=temperature,
                google_api_key=google_api_key,
            )
        except Exception as e_google:
            logger.error(f"Fatal: Could not initialize fallback Google LLM. Error: {e_google}")
            raise

def get_search_components(llm):
    """
    Get components needed for web search without creating graph nodes.
    
    Args:
        llm: Language model instance
        
    Returns:
        Dictionary with search tool and LLM with tools bound
    """
    # This now uses the Perplexity class with enhanced URL extraction
    search_tool_instance = PerplexityWebSearchTool(
        max_results=5, 
        model="sonar", 
        include_links=True
    )
    llm_with_tools = search_tool_instance.bind_to_llm(llm)
    
    return {
        "search_tool": search_tool_instance.get_tool(),
        "llm_with_tools": llm_with_tools,
        "search_instance": search_tool_instance  # Include instance for direct access
    }