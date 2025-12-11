import os
import openai
from dotenv import load_dotenv
import asyncio

# Import the replicate generation function
from replicate_image_gen import generate_image_with_replicate

load_dotenv()

class ImageGenerator:
    """
    A class to generate images based on a structured schema using Replicate's Flux model,
    with prompts enhanced by gpt-4o-mini via OpenRouter.
    """

    def __init__(self):
        """
        Initializes the OpenAI/OpenRouter client for text prompt generation.
        """
        # We still need OpenAI/OpenRouter for the text-based prompt engineering
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")
        
        # Primary client for fallback
        self.client = openai.OpenAI(api_key=self.openai_api_key)

        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        
        if self.openrouter_api_key:
            self.openrouter_client = openai.OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.openrouter_api_key,
                default_headers={
                    "HTTP-Referer": "https://localhost:8000", 
                    "X-Title": "Ed-Tech Content Generator"
                }
            )
        else:
            print("Warning: OPENROUTER_API_KEY not found. Falling back to standard OpenAI client for prompt rephrasing.")
            self.openrouter_client = self.client

    def _rephrase_schema_to_prompt(self, schema: dict) -> str:
        """
        Rephrases a schema dictionary into a detailed prompt for the Flux model
        using gpt-4o-mini via OpenRouter.
        """
        required_keys = ["topic", "preferred_visual_type", "instructions", "subject", "grade_level","language"]
        for key in required_keys:
            if key not in schema:
                raise KeyError(f"The schema is missing the required key: '{key}'")

        visual_type = schema['preferred_visual_type'].lower()
        visual_type_instructions = self._get_visual_type_instructions(visual_type)

        # Construct a detailed meta-prompt. 
        # Note: Updated 'GPT-Image-1' references to 'Flux' to optimize for the Replicate model.
        comic_prompt = (
            f"""
            <InstructionPrompt>
                <Role>
                    You are an expert prompt engineer for the Flux image generation model.
                </Role>
                <Task>
                    Your task is to take the following schema and create a detailed, visually rich, and optimized prompt that generates a high-quality, educational {visual_type} with readable, properly positioned text labels suitable for a school-level {schema['subject']} {visual_type}. The output must use Flux's strengths in photorealism and text rendering.
                </Task>

                <Constraints title="Important constraints">
                    <Constraint>All text labels must be in **{schema['language']}**.</Constraint>
                    <Constraint>All labels should be rendered in **clean, black, sans-serif font (like Arial or Helvetica)**.</Constraint>
                    <Constraint>Labels must be inside **white rectangular or circular callout boxes** connected with clear lines or arrows to the correct parts.</Constraint>
                    <Constraint>Avoid any artistic distortion, cursive, handwriting, or stylized fonts.</Constraint>
                    <Constraint>Labels should be **concise and accurately spelled** without any distortions.</Constraint>
                    <Constraint>Do not place labels diagonally or on complex textures; use **plain background zones** for clarity.</Constraint>
                </Constraints>

                <VisualTypeRequirements title="VISUAL TYPE SPECIFIC REQUIREMENTS">
                    {visual_type_instructions}
                </VisualTypeRequirements>

                <Schema>
                    <Topic>{schema['topic']}</Topic>
                    <Subject>{schema['subject']}</Subject>
                    <GradeLevel>{schema['grade_level']}</GradeLevel>
                    <VisualType>{schema['preferred_visual_type']}</VisualType>
                    <Language>{schema['language']}</Language>
                    <Instructions>{schema['instructions']}</Instructions>
                </Schema>

                <GenerationGuidelines introduction="Based on this schema, generate a prompt. The prompt must:">
                    <Guideline id="1">Be highly descriptive and provide rich visual details.</Guideline>
                    <Guideline id="2">Include all relevant parts and their correct visual positions.</Guideline>
                    <Guideline id="3">Specify that each label must be written in a **clear, legible font** in a white box near the corresponding part.</Guideline>
                    <Guideline id="4">Ensure the style is visually appealing and age-appropriate for the given grade.</Guideline>
                    <Guideline id="5">If the schema includes a difficulty flag set to {schema.get('difficulty_flag')}, increase the level of detail, accuracy, shading, and depth.</Guideline>
                    <Guideline id="6">Explicitly list all labels that must appear for: {schema['topic']} and ensure they are in **{schema['language']}**.</Guideline>
                    <Guideline id="7" criticality="CRITICAL">Follow the visual type specific requirements above to ensure the generated image is a proper {visual_type}.</Guideline>
                </GenerationGuidelines>

                <FinalOutput>
                    Final Output Prompt for Flux should be natural, instructional, and not include markdown formatting.
                </FinalOutput>
            </InstructionPrompt> 
            """
        )

        if schema.get('difficulty_flag', 'false').lower() == 'true':
            comic_prompt += f"\n- **Difficulty:** Advanced. The {visual_type} should be detailed and comprehensive with enhanced visual elements."

        print("Requesting prompt rephrasing from gpt-4o-mini (via OpenRouter)...")

        try:
            model_name = "openai/gpt-4o-mini" if self.openrouter_api_key else "gpt-4o-mini"
            
            response = self.openrouter_client.chat.completions.create(
                model=model_name, 
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates effective prompts for image generation."},
                    {"role": "user", "content": comic_prompt}
                ],
                max_tokens=500,
                temperature=0.7,
            )
            
            rephrased_prompt = response.choices[0].message.content.strip()
            print(f"Generated Prompt by gpt-4o-mini: {rephrased_prompt}")
            return rephrased_prompt

        except openai.APIError as e:
            print(f"An OpenAI/OpenRouter API error occurred while rephrasing the prompt: {e}")
            # Fallback simple prompt
            return f"A high-quality educational {schema['preferred_visual_type']} about {schema['topic']} for a {schema['subject']} lesson at grade {schema['grade_level']}. {schema['instructions']}. Labels in {schema['language']}."
        except Exception as e:
            print(f"An unexpected error occurred during prompt rephrasing: {e}")
            return None

    def _get_visual_type_instructions(self, visual_type: str) -> str:
        """
        Get specific instructions based on the visual type.
        """
        instructions = {
            'chart': (
                """<Chart_Requirements>
                        <Title>CHART REQUIREMENTS</Title>
                        <Requirement>Create a data visualization with clear axes, labels, and data points.</Requirement>
                        <Requirement>Include proper chart elements: title, x-axis, y-axis, legend, data series.</Requirement>
                        <Requirement>Use appropriate chart type (bar, line, pie, scatter, etc.) based on the topic.</Requirement>
                        <Requirement>Ensure data is clearly represented with distinct colors and patterns.</Requirement>
                        <Requirement>Add grid lines or background elements for better readability.</Requirement>
                        <Requirement>Include numerical values and percentages where relevant.</Requirement>
                        <Requirement>Make it suitable for educational presentation and analysis.</Requirement>
                    </Chart_Requirements>"""
            ),
            'diagram': (
                """<Diagram_Requirements>
                        <Title>DIAGRAM REQUIREMENTS</Title>
                        <Requirement>Create a technical or scientific diagram with clear structural elements.</Requirement>
                        <Requirement>Include labeled parts, components, or processes with connecting lines/arrows.</Requirement>
                        <Requirement>Use clean, technical drawing style with precise geometric shapes.</Requirement>
                        <Requirement>Show relationships, flow, or hierarchy between different elements.</Requirement>
                        <Requirement>Include process steps, system components, or anatomical parts as needed.</Requirement>
                        <Requirement>Use consistent visual language and symbols throughout.</Requirement>
                        <Requirement>Make it suitable for educational explanation and understanding.</Requirement>
                    </Diagram_Requirements>"""
            ),
            'image': (
                """"<Image_Requirements>
                        <Title>IMAGE REQUIREMENTS</Title>
                        <Requirement>Create a general educational illustration or visual representation.</Requirement>
                        <Requirement>Focus on clear, engaging visual content that supports learning.</Requirement>
                        <Requirement>Include relevant visual elements, scenes, or concepts.</Requirement>
                        <Requirement>Use appropriate artistic style for the grade level and subject.</Requirement>
                        <Requirement>Ensure the image is informative and educational.</Requirement>
                        <Requirement>Include any necessary labels or annotations for clarity.</Requirement>
                        <Requirement>Make it visually appealing and suitable for classroom use.</Requirement>
                    </Image_Requirements>"""
            )
        }
        
        return instructions.get(visual_type, instructions['image'])

    async def generate_image_from_schema(self, schema: dict) -> str:
        """
        Generates an image using Replicate (Flux) based on the provided schema,
        with the prompt enhanced by gpt-4o-mini.

        Args:
            schema: A dictionary containing the image generation parameters.

        Returns:
            The URL of the generated image.
        """
        try:
            # 1. Rephrase the schema into a prompt using OpenAI/LLM
            prompt: str = self._rephrase_schema_to_prompt(schema)
            
            if not prompt:
                print("Prompt generation failed.")
                return None

            print("Requesting image from Replicate API...")
            
            # 2. Call Replicate using the utility function
            image_url = await generate_image_with_replicate(prompt=prompt)
            
            if image_url:
                print("Successfully generated image.")
                return image_url
            else:
                print("Replicate returned no image.")
                return None

        except KeyError as e:
            print(f"Error: {e}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

if __name__ == "__main__":
    # Async wrapper for main execution
    async def main():
        image_topic = input("topic of image :")
        grade_level = input("Which Grade student:")
        preferred_visual_type = input("type of visual ( image, chart, diagram):")
        which_subject = input("for which subject:")
        language = input("Language for labels (e.g., English,Hindi): ")
        difficulty_flag = input("difficulty_level (true/false):").lower()
        instructions = input("instruction for image generation :")

        image_schema = {
            "topic": image_topic,
            "grade_level": grade_level,
            "preferred_visual_type": preferred_visual_type,
            "subject": which_subject,
            "language": language,
            "difficulty_flag": difficulty_flag,
            "instructions": instructions
        }

        try:
            generator = ImageGenerator()
            
            # Await the async generation
            generated_image_url = await generator.generate_image_from_schema(image_schema)

            if generated_image_url:
                print("\nGenerated Image URL:")
                print(generated_image_url)
            else:
                print("\nImage generation failed.")
                
        except ValueError as e:
            print(f"Initialization Error: {e}")

    # Run the async main function
    asyncio.run(main())