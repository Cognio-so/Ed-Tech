import openai
import os
import requests
import replicate
import asyncio
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import base64
import textwrap
from dotenv import load_dotenv

load_dotenv()

# --- API Clients Initialization ---

# 1. Initialize OpenRouter Client for LLM (Story Generation)
try:
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        print("Warning: OPENROUTER_API_KEY not found. LLM generation may fail.")
    
    llm_client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=openrouter_key,
        default_headers={
            "HTTP-Referer": "https://localhost:8000", # Optional: Update with your actual site URL
            "X-Title": "Comic Generator Script"         # Optional: Update with your app name
        }
    )
except Exception as e:
    print(f"Error initializing OpenRouter client: {e}")
    exit()

# 2. Initialize Replicate for Image Generation
# Replicate API key is automatically read from REPLICATE_API_KEY environment variable
try:
    replicate_api_key = os.getenv("REPLICATE_API_KEY")
    if not replicate_api_key:
        print("Warning: REPLICATE_API_KEY not found. Image generation will fail.")
    else:
        # Set the API token for replicate
        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key
        print("Replicate initialized successfully for image generation.")
except Exception as e:
    print(f"Error initializing Replicate: {e}")

def get_user_input():
    """
    Gets the comic book topic, target audience, and number of panels from the user.
    """
    print("Welcome to the AI Comic Generator!")
    instructions = input("What educational topic would you like to make a comic about? (e.g., 'The water cycle')\n> ")
    student_class = input("What grade level is this for? (e.g., '3rd grade')\n> ")
    language = input("What language should the comic be in? (e.g., 'English')\n> ")
    while True:
        try:
            num_panels = int(input("How many panels should the comic have? (e.g., 4)\n> "))
            if num_panels > 0:
                break
            else:
                print("Please enter a positive number for the panels.")
        except ValueError:
            print("Invalid input. Please enter a number.")
    return instructions, student_class, num_panels, language

def create_comical_story_prompt(instructions, student_class, num_panels, language):
    """
    Uses OpenRouter (GPT-4o) to create a comic story with separate visual prompts and footer text.
    Enhanced to maintain character consistency across panels.
    """
    print("\nTurning your idea into a fun comic story using OpenRouter...")
    try:
        # Using llm_client (OpenRouter) here
        response = llm_client.chat.completions.create(
            model="openai/gpt-4o", # OpenRouter model ID
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
    except openai.APIError as e:
        print(f"An error occurred with the OpenRouter API: {e}")
        return None

def parse_story_panels(story_text: str):
    """
    Parses the generated story to extract visual prompts and footer text for each panel.
    """
    panels = []
    current_panel = {}
    for line in story_text.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        
        if line.split('.')[0].isdigit() and 'Panel_Prompt:' in line:
            if current_panel:
                panels.append(current_panel)
            current_panel = {}

        if 'Panel_Prompt:' in line:
            current_panel['prompt'] = line.split('Panel_Prompt:')[1].strip()
        elif 'Footer_Text:' in line:
            current_panel['footer'] = line.split('Footer_Text:')[1].strip()

    if current_panel:
        panels.append(current_panel)
        
    return [p for p in panels if 'prompt' in p and 'footer' in p]


def add_footer_text_to_image(image_base64: str, text: str, language: str = 'English') -> str:
    """
    Adds a styled footer with text to a base64 encoded image.
    Handles text wrapping and centering.
    """
    try:
        img_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(img_data))

        footer_height = int(img.height * 0.20)
        new_img = Image.new('RGB', (img.width, img.height + footer_height), 'white')
        new_img.paste(img, (0, 0))
        
        draw = ImageDraw.Draw(new_img)

        footer_box = [0, img.height, new_img.width, new_img.height]
        draw.rectangle(footer_box, fill="#f0f0f0", outline="black", width=2)
        
        # Font settings
        font_path = "arial.ttf" # A common font on Windows
        font_size = int(footer_height / 4.5)
        try:
            # On Windows, fonts are usually in C:/Windows/Fonts
            font = ImageFont.truetype(font_path, font_size)
        except IOError:
            print(f"Warning: Font '{font_path}' not found. Using default font.")
            try:
                # Fallback for non-Windows or if Arial is missing
                font = ImageFont.truetype("DejaVuSans.ttf", font_size)
            except IOError:
                 font = ImageFont.load_default()

        # Text wrapping
        margin = 40
        text_box_width = new_img.width - 2 * margin
        wrapped_lines = textwrap.wrap(text, width=int(text_box_width / (font_size * 0.5)))

        # Calculate text position for centering
        # Use getbbox for more accurate line height
        try:
            line_height = draw.textbbox((0, 0), "A", font=font)[3] + 5
        except Exception:
            line_height = font_size + 5 # Fallback
            
        total_text_height = len(wrapped_lines) * line_height
        y_text = img.height + (footer_height - total_text_height) / 2
        
        # Draw each line centered
        for line in wrapped_lines:
            try:
                # Use textlength for Pillow >= 9.2.0, or textsize for older versions
                 line_width = draw.textlength(line, font=font)
            except AttributeError:
                 line_width, _ = draw.textsize(line, font=font)

            x_text = (new_img.width - line_width) / 2
            
            draw.text((x_text, y_text), line, font=font, fill="black")
            y_text += line_height

        # Encode the final image back to base64
        buffered = BytesIO()
        new_img.save(buffered, format="PNG")
        final_image_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return final_image_base64

    except Exception as e:
        print(f"Error adding footer text: {e}")
        return image_base64 # Return original image on failure


async def generate_comic_image(prompt, panel_number, footer_text="", language='English'):
    """
    Uses Replicate to generate a comic book panel image and optionally adds footer text.
    Based on the pattern from Student AI Tutor image generation.
    """
    print(f"Generating image for panel {panel_number}...")
    
    replicate_api_key = os.getenv("REPLICATE_API_KEY") or os.getenv("REPLICATE_API_TOKEN")
    if not replicate_api_key:
        print("Warning: REPLICATE_API_KEY not found. Skipping image generation.")
        return None
    
    try:
        # Use Replicate with Flux model (same as student AI tutor)
        model = "black-forest-labs/flux-schnell"
        print(f"   Using Model: {model}")
        print(f"   Prompt: {prompt[:200]}...")
        
        # Generate image using Replicate (async) with retry for rate limits
        max_retries = 3
        retry_delay = 10
        output = None
        
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
                        print(f"⚠️ Rate limit hit. Retrying in {retry_delay}s... (Attempt {attempt+1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        print("❌ Rate limit retries exhausted.")
                        raise e
                else:
                    raise e
        
        # Extract image URL from output (following pattern from student image.py)
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
        
        # Download the image from URL and convert to base64
        if not image_url:
            print("❌ No image URL returned from Replicate")
            return None
        
        # Download image
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # Convert to base64
        image_base64 = base64.b64encode(response.content).decode("utf-8")
        
        # Add footer text if provided
        if image_base64 and footer_text:
            print(f"Adding footer text to panel {panel_number}...")
            final_image_base64 = add_footer_text_to_image(image_base64, footer_text, language)
            return final_image_base64
            
        return image_base64
        
    except Exception as e:
        print(f"❌ Error in image generation: {e}")
        import traceback
        traceback.print_exc()
        return None

async def main_async():
    """
    Async main function to run the comic generator.
    """
    instructions, student_class, num_panels, language = get_user_input()
    if not instructions:
        print("No instructions provided. Exiting.")
        return

    comical_story_prompts_text = create_comical_story_prompt(instructions, student_class, num_panels, language)
    if not comical_story_prompts_text:
        print("Could not generate a story. Exiting.")
        return

    print("\n--- Your Comic Story Prompts ---\n")
    print(comical_story_prompts_text)
    print("\n--- Generating Comic Panel Images ---\n")

    panel_data = parse_story_panels(comical_story_prompts_text)
    
    if not panel_data:
        print("Could not parse the story panels. Please check the output from the story generation.")
        return
        
    if len(panel_data) != num_panels:
        print(f"Warning: The AI generated {len(panel_data)} panels, but {num_panels} were requested. Proceeding with the generated panels.")

    for i, panel in enumerate(panel_data):
        panel_number = i + 1
        print(f"\n--- Panel {panel_number} ---")
        
        visual_prompt = panel['prompt']
        footer_text = panel['footer']
        
        final_image_base64 = await generate_comic_image(visual_prompt, panel_number, footer_text, language)
        
        if final_image_base64:
            print(f"Comic Panel {panel_number} (b64_json):\n{final_image_base64[:100]}...")
        else:
            print("Failed to generate image for this panel.")

def main():
    """
    Main function to run the comic generator (wrapper for async function).
    """
    asyncio.run(main_async())

if __name__ == "__main__":
    main()