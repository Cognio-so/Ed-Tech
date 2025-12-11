"""
comic_generation.py
Generates comic prompts using LLM and images using Replicate, 
then overlays the story text directly onto the images.
"""
import openai
import os
import asyncio
import re
import requests
import io
import textwrap
from PIL import Image, ImageDraw, ImageFont
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from replicate_image_gen import generate_image_with_replicate

load_dotenv()

# --- API Clients Initialization ---

# 1. Initialize OpenRouter Client for LLM
try:
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    llm_client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers={
            "HTTP-Referer": "https://localhost:8000", 
            "X-Title": "Comic Generator Script"
        }
    )
except Exception as e:
    print(f"Error initializing OpenRouter client: {e}")

# 2. Initialize Replicate
try:
    replicate_api_key = os.getenv("REPLICATE_API_KEY")
    if not replicate_api_key:
        print("Warning: REPLICATE_API_KEY not found. Image generation will fail.")
    else:
        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key
except Exception as e:
    print(f"Error initializing Replicate: {e}")

# 3. Initialize Cloudinary (Required for hosting the edited images)
try:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET")
    )
except Exception as e:
    print(f"Error initializing Cloudinary: {e}")

def create_comical_story_prompt(instructions, student_class, num_panels, language):
    """
    Uses OpenRouter (GPT-4o) to create a comic story with separate visual prompts and footer text.
    """
    print("\nTurning your idea into a fun comic story using OpenRouter...")
    try:
        response = llm_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a creative storyteller for children's educational comics. "
                        "Your task is to take a user's topic and create a fun, educational comic story. "
                        "The story should be tailored for a specific grade level and have a specific number of panels. "
                        f"Generate all dialogue and narrative text in {language}. "
                        
                        "🎭 **CRITICAL CHARACTER CONSISTENCY REQUIREMENTS:**\n"
                        "1. **Define Main Characters First**: Create 1-3 main characters with specific visual descriptions (appearance, clothing, colors, style)\n"
                        "2. **Character Consistency**: Use the SAME characters throughout ALL panels with identical visual descriptions\n"
                        "3. **Visual Style Consistency**: Maintain the same art style, color palette, and visual approach across all panels\n"
                        "4. **Character Names**: Give each main character a memorable name and always refer to them by name\n"
                        
                        "For each panel, you must provide two separate components:\n"
                        "1. 'Panel_Prompt': A detailed visual description for an image generation model. This prompt must describe the entire scene, characters, and actions, but contain NO text elements, speech bubbles, or captions.\n"
                        "2. 'Footer_Text': The story narration and dialogue for that panel. This text will be placed in a footer box below the image.\n"
                        
                        "The language and complexity of the topic should be appropriate for the target students. "
                        f"Ensure the visual style is described as fun, kid-friendly, and colorful, based on {student_class} class students. "
                        
                        "📋 **OUTPUT FORMAT:**\n"
                        "Start with a character definition section, then structure the output as a numbered list for each panel:\n"
                        "CHARACTERS:\n"
                        "- [Character Name]: [Detailed visual description including appearance, clothing, colors, style]\n"
                        "- [Character Name]: [Detailed visual description including appearance, clothing, colors, style]\n\n"
                        "STORY PANELS:\n"
                        "1. Panel_Prompt: [Scene description with consistent character appearances from CHARACTERS section]\n"
                        "   Footer_Text: [Story text]\n"
                        "2. Panel_Prompt: [Scene description with consistent character appearances from CHARACTERS section]\n"
                        "   Footer_Text: [Story text]\n"
                        "...\n"
                        
                        "🎨 **VISUAL CONSISTENCY RULES:**\n"
                        "- Always reference the exact character descriptions from the CHARACTERS section\n"
                        "- Use the same color scheme and art style throughout\n"
                        "- Maintain consistent lighting and background style\n"
                        "- Keep the same character proportions and features\n"
                        
                        "Example:\n"
                        "CHARACTERS:\n"
                        "- Water Drop Wally: A friendly blue water drop with big eyes, a small smile, wearing a tiny blue hat, cartoon style with simple shapes\n"
                        "- Cloud Clara: A fluffy white cloud with a gentle face, soft features, wearing a small silver crown, same cartoon style\n\n"
                        "STORY PANELS:\n"
                        "1. Panel_Prompt: Water Drop Wally (blue water drop with big eyes, small smile, tiny blue hat) floating inside Cloud Clara (fluffy white cloud with gentle face, silver crown) against bright blue sky, cartoon style\n"
                        "   Footer_Text: I'm getting heavy! Time to fall as rain!\n"
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Create a comic story with the following details:\n"
                        f"- Topic: {instructions}\n"
                        f"- Target Audience: {student_class} class students\n"
                        f"- Number of Panels: {num_panels}\n"
                        f"- Language: {language}\n\n"
                        f"IMPORTANT: Ensure character consistency and visual style consistency across all {num_panels} panels."
                    )
                }
            ],
            temperature=0.7,
        )
        story_prompts = response.choices[0].message.content
        return story_prompts
    except Exception as e:
        print(f"An error occurred with the OpenRouter API: {e}")
        return None

def parse_story_panels(story_text: str):
    """
    Parses the generated story to extract visual prompts and footer text for each panel.
    """
    panels = []
    
    # Normalize text
    clean_text = re.sub(r'\*\*(Panel_Prompt|Footer_Text|Footer|Caption)\*\*', r'\1', story_text, flags=re.IGNORECASE)
    
    # Split by "Panel_Prompt:"
    segments = re.split(r'(?i)(?:^|\n)[\d\.\-\s]*Panel_Prompt:', clean_text)
    
    for segment in segments:
        segment = segment.strip()
        if not segment: 
            continue
        
        parts = re.split(r'(?i)(?:Footer_Text|Footer|Caption):', segment, maxsplit=1)
        
        if len(parts) == 2:
            prompt_text = parts[0].strip()
            footer_text = parts[1].strip()
            
            if prompt_text and footer_text:
                panels.append({
                    'prompt': prompt_text,
                    'footer_text': footer_text
                })
    
    return panels

def add_footer_text_to_image(image_url: str, text: str) -> bytes:
    """
    Downloads the image, adds a white footer with the text, and returns the image bytes.
    """
    try:
        # 1. Download Image
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        
        # 2. Setup Font
        # Try to load a nice font, fallback to default if not found
        try:
            # Using a large size for better quality
            font = ImageFont.truetype("arial.ttf", 24)
        except IOError:
            font = ImageFont.load_default()

        # 3. Calculate Text Layout
        img_w, img_h = img.size
        
        # Determine footer height based on text wrapping
        # Approximate char width for wrapping (adjust based on font)
        avg_char_width = 14 
        chars_per_line = int(img_w / avg_char_width)
        wrapper = textwrap.TextWrapper(width=chars_per_line)
        word_list = wrapper.wrap(text=text)
        
        # Padding and line height
        padding = 20
        line_height = 30  # Adjust based on font size
        footer_height = (len(word_list) * line_height) + (padding * 2)
        
        # 4. Create New Canvas (Original Image + Footer)
        new_h = img_h + footer_height
        new_img = Image.new('RGB', (img_w, new_h), color='white')
        
        # Paste original image
        new_img.paste(img, (0, 0))
        
        # 5. Draw Text
        draw = ImageDraw.Draw(new_img)
        current_h = img_h + padding
        
        for line in word_list:
            # Center text
            try:
                # Pillow >= 8.0.0
                bbox = draw.textbbox((0, 0), line, font=font)
                text_w = bbox[2] - bbox[0]
            except AttributeError:
                # Older Pillow
                text_w, _ = draw.textsize(line, font=font)
                
            x_pos = (img_w - text_w) / 2
            draw.text((x_pos, current_h), line, font=font, fill="black")
            current_h += line_height
            
        # 6. Save to Bytes
        img_byte_arr = io.BytesIO()
        new_img.save(img_byte_arr, format='JPEG', quality=90)
        img_byte_arr.seek(0)
        return img_byte_arr.getvalue()

    except Exception as e:
        print(f"Error adding footer text: {e}")
        return None

async def generate_comic_image(prompt, panel_number, footer_text="", language='English'):
    """
    Generates an image via Replicate, then overlays the footer text using PIL, 
    and uploads the final result to Cloudinary.
    """
    print(f"Generating image for panel {panel_number}...")
    
    try:
        # 1. Generate Base Image
        raw_image_url = await generate_image_with_replicate(prompt)
        
        if not raw_image_url:
            return None
            
        if not footer_text:
            return raw_image_url
            
        print(f"   Overlaying text for panel {panel_number}...")
        
        # 2. Add Text Overlay
        # Run synchronous PIL operations in a thread executor to avoid blocking async loop
        final_image_bytes = await asyncio.to_thread(
            add_footer_text_to_image, 
            raw_image_url, 
            footer_text
        )
        
        if not final_image_bytes:
            print("   Failed to overlay text, returning raw image.")
            return raw_image_url

        # 3. Upload to Cloudinary
        print(f"   Uploading processed panel {panel_number} to Cloudinary...")
        upload_result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            final_image_bytes,
            resource_type="image",
            folder="comic_panels"
        )
        
        final_url = upload_result.get('secure_url')
        print(f"✅ Final Image URL: {final_url}")
        return final_url
        
    except Exception as e:
        print(f"❌ Error in image generation/processing: {e}")
        # Fallback to the raw URL if something in the post-processing fails
        return raw_image_url if 'raw_image_url' in locals() else None