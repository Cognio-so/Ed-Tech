# --- START OF FILE comics_generation.py ---

import openai
import os
import requests
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import base64
import textwrap
from dotenv import load_dotenv

# --- FIX START: Import new libraries for handling Arabic text ---
import arabic_reshaper
from bidi.algorithm import get_display
# --- FIX END ---

load_dotenv()

# --- OpenAI API Initialization ---
try:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
except TypeError:
    print("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")
    exit()

def get_user_input():
    """
    Gets the comic book topic, target audience, and number of panels from the user.
    """
    print("Welcome to the AI Comic Generator!")
    instructions = input("What educational topic would you like to make a comic about? (e.g., 'The water cycle')\n> ")
    student_class = input("What grade level is this for? (e.g., '3rd grade')\n> ")
    language = input("What language should the comic be in? (e.g., 'English', 'Arabic')\n> ")
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
    Uses GPT-4o to create a comic story with separate visual prompts and footer text.
    """
    print("\nTurning your idea into a fun comic story...")
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a creative storyteller for children's educational comics. "
                        "Your task is to take a user's topic and create a fun, educational comic story. "
                        "The story should be tailored for a specific grade level and have a specific number of panels. "
                        f"Generate all dialogue and narrative text in {language}. "
                        "For each panel, you must provide two separate components:\n"
                        "1. 'Panel_Prompt': A detailed visual description for an image generation model (dall-e-3). This prompt must describe the entire scene, characters, and actions, but contain NO text elements, speech bubbles, or captions.\n"
                        "2. 'Footer_Text': The story narration and dialogue for that panel. This text will be placed in a footer box below the image.\n"
                        "The language and complexity of the topic should be appropriate for the target students. "
                        f"Ensure the visual style is described as fun, kid-friendly, and colorful, based on {student_class} class students. "
                        "Structure the output as a numbered list for each panel. Start each line with 'Panel_Prompt:' or 'Footer_Text:'. "
                        "For example:\n"
                        "1. Panel_Prompt: A friendly water drop character smiling inside a fluffy white cloud against a bright blue sky. The style is a colorful, simple cartoon.\n"
                        "   Footer_Text: I'm getting heavy! Time to fall as rain!\n"
                        "Follow the same animation style throughout the storyline."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Create a comic story with the following details:\n"
                        f"- Topic: {instructions}\n"
                        f"- Target Audience: {student_class} class students\n"
                        f"- Number of Panels: {num_panels}\n"
                        f"- Language: {language}"
                    )
                }
            ],
            temperature=0.8,
        )
        story_prompts = response.choices[0].message.content
        return story_prompts
    except openai.APIError as e:
        print(f"An error occurred with the OpenAI API: {e}")
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


# --- FIX START: This function is completely replaced to handle fonts and RTL text correctly on Windows ---
def add_footer_text_to_image(image_base64: str, text: str, language: str = 'English') -> str:
    """
    Adds a styled footer with text to a base64 encoded image.
    Handles text wrapping and centering for multiple languages, including Arabic, without libraqm.
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
        
        # Font settings - more robust font finding
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

        # Process text for RTL languages like Arabic
        is_rtl = language.lower() == 'arabic'
        if is_rtl:
            processed_lines = []
            for line in wrapped_lines:
                reshaped_text = arabic_reshaper.reshape(line)
                bidi_text = get_display(reshaped_text)
                processed_lines.append(bidi_text)
            wrapped_lines = processed_lines

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
            
            # Draw the text without the 'direction' parameter to avoid the libraqm error
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
# --- FIX END ---


def generate_comic_image(prompt, panel_number, footer_text="", language='English'):
    """
    Uses dall-e-3 to generate a comic book panel image and optionally adds footer text.
    """
    print(f"Generating image for panel {panel_number}...")
    try:
        # NOTE: You mentioned using 'gpt-image-1'.
        # If "gpt-image-1" is a custom model name you are using, keep it. Otherwise, it should be "dall-e-3".
        response = client.images.generate(
            model="gpt-image-1", # Ensure this is the correct model name for your API access
            prompt=prompt,
            size="1024x1024",
            quality="high",
            n=1,
        )
        image_base64 = response.data[0].b64_json
        
        if image_base64 and footer_text:
            print(f"Adding footer text to panel {panel_number}...")
            final_image_base64 = add_footer_text_to_image(image_base64, footer_text, language)
            return final_image_base64
            
        return image_base64
    except openai.APIError as e:
        print(f"An error occurred with the image generation API: {e}")
        return None

def main():
    """
    Main function to run the comic generator.
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
        
        final_image_base64 = generate_comic_image(visual_prompt, panel_number, footer_text, language)
        
        if final_image_base64:
            print(f"Comic Panel {panel_number} (b64_json):\n{final_image_base64}")
        else:
            print("Failed to generate image for this panel.")

if __name__ == "__main__":
    main()
