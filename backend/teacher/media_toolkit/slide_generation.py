import os
import asyncio
import logging
import aiohttp
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

class SlideSpeakError(Exception):
    """Base exception for SlideSpeak errors."""
    pass

class SlideSpeakAuthError(SlideSpeakError):
    """Raised when API key is invalid."""
    pass

class SlideSpeakTimeoutError(SlideSpeakError):
    """Raised when generation takes too long."""
    pass

class AsyncSlideSpeakGenerator:
    """
    An asynchronous production-ready class to generate SlideSpeak presentations.
    Designed to handle high concurrency using asyncio.
    """
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.slidespeak.co/api/v1"):
        self.api_key = api_key or os.getenv("SLIDESPEAK_API_KEY")
        if not self.api_key:
            raise ValueError("SLIDESPEAK_API_KEY not provided or set as an environment variable.")
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }

    async def _post_request(self, session: aiohttp.ClientSession, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Internal helper for POST requests with error handling."""
        url = f"{self.base_url}{endpoint}"
        try:
            async with session.post(url, json=payload, headers=self.headers) as response:
                if response.status == 401:
                    raise SlideSpeakAuthError("Invalid API Key.")
                response.raise_for_status()
                return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"API Request Failed: {e}")
            raise SlideSpeakError(f"API Request failed: {str(e)}")

    async def _get_request(self, session: aiohttp.ClientSession, url: str) -> Dict[str, Any]:
        """Internal helper for GET requests."""
        try:
            async with session.get(url, headers=self.headers) as response:
                response.raise_for_status()
                return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"API Status Check Failed: {e}")
            raise SlideSpeakError(f"Status check failed: {str(e)}")

    async def generate_presentation(
        self,
        plain_text: str,
        custom_user_instructions: str,
        length: int,
        language: str = "ENGLISH",
        fetch_images: bool = True,
        verbosity: str = "standard",
        tone: str = "educational",
        template: str = "default",
        timeout_seconds: int = 300  # Stop polling after 5 minutes
    ) -> Dict[str, Any]:
        """
        Generates a presentation asynchronously.
        
        This method starts the task and polls for completion without blocking 
        the event loop, allowing other users to be served simultaneously.
        """
        payload = {
            "plain_text": plain_text,
            "custom_user_instructions": custom_user_instructions,
            "length": length,
            "language": language,
            "fetch_images": fetch_images,
            "verbosity": verbosity,
            "tone": tone,
            "template": template
        }

        # Use a single session for the lifecycle of this request
        async with aiohttp.ClientSession() as session:
            # 1. Start Generation
            logger.info(f"Initiating generation request for topic: '{plain_text[:30]}...'")
            initial_data = await self._post_request(session, "/presentation/generate", payload)
            
            task_id = initial_data.get("task_id")
            if not task_id:
                raise SlideSpeakError(f"task_id not found in response: {initial_data}")
            
            logger.info(f"Task started. ID: {task_id}")
            
            # 2. Poll Status
            status_url = f"{self.base_url}/task_status/{task_id}"
            start_time = asyncio.get_running_loop().time()

            while True:
                # check timeout
                if asyncio.get_running_loop().time() - start_time > timeout_seconds:
                    raise SlideSpeakTimeoutError(f"Task {task_id} timed out after {timeout_seconds}s")

                status_data = await self._get_request(session, status_url)
                task_status = status_data.get("task_status")

                if task_status == "SUCCESS":
                    logger.info(f"Task {task_id} completed successfully.")
                    return status_data
                
                elif task_status == "FAILURE":
                    logger.error(f"Task {task_id} failed.")
                    raise SlideSpeakError(f"Generation failed: {status_data}")
                
                else:
                    # Non-blocking sleep: lets other tasks run
                    logger.debug(f"Task {task_id} status: {task_status}. Waiting...")
                    await asyncio.sleep(5)