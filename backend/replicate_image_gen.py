"""
Central Replicate image generation utility.
Provides a reusable function for generating images using Replicate's Flux model.
"""
import os
import replicate
import asyncio
from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = "black-forest-labs/flux-schnell"


async def generate_image_with_replicate(
    prompt: str,
    model: str = DEFAULT_MODEL,
    max_retries: int = 3,
    retry_delay: int = 10
) -> str:
    """
    hi
    """
    replicate_api_key = os.getenv("REPLICATE_API_KEY") or os.getenv("REPLICATE_API_TOKEN")
    if not replicate_api_key:
        print("Warning: REPLICATE_API_KEY not found. Skipping image generation.")
        return None
    
    print(f"   Using Model: {model}")
    print(f"   Prompt: {prompt[:200]}...")
    output = None
    current_delay = retry_delay
    
    for attempt in range(max_retries):
        try:
            output = await replicate.async_run(
                model,
                input={"prompt": prompt}
            )
            break
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "throttled" in error_str or "rate limit" in error_str:
                if attempt < max_retries - 1:
                    print(f"⚠️ Rate limit hit. Retrying in {current_delay}s... (Attempt {attempt+1}/{max_retries})")
                    await asyncio.sleep(current_delay)
                    current_delay *= 2  
                else:
                    print("❌ Rate limit retries exhausted.")
                    raise e
            else:
                raise e
                
    if isinstance(output, list):
        first = output[0]
        if hasattr(first, "url"):
            image_url = first.url
        else:
            image_url = str(first)
    elif hasattr(output, "url"):
        image_url = output.url
    else:
        image_url = str(output)
    
    print(f"✅ Generated image URL: {image_url}")
    
    if not image_url:
        print("❌ No image URL returned from Replicate")
        return None
    
    return image_url

