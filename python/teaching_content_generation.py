import os
import logging
import asyncio
import re
from dotenv import load_dotenv

# LangChain components
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore, RetrievalMode
import qdrant_client

# Import from your websearch module (using the new Perplexity search)
from websearch_code import PerplexityWebSearchTool

# Import the SlideSpeakGenerator to create PPT files
from media_toolkit.slides_generation import SlideSpeakGenerator

from prompts import CORE_CONTENT_GENERATION_PROMPT_TEMPLATE

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Langsmith configuration (optional)
LANGSMITH_TRACING = "true"
LANGSMITH_ENDPOINT = "https://api.smith.langchain.com"
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = "Vamshi-test"

# Load environment variables from .env file
load_dotenv()

# --- Prompt Engineering ---
CONTENT_GENERATION_PROMPT_TEMPLATE = CORE_CONTENT_GENERATION_PROMPT_TEMPLATE

def _get_choice_from_user(options: list[str], prompt_text: str, default: str | None = None) -> str:
    """
    A robust helper function to get a choice from a list of options from the user.
    It allows for selection by number, exact name, or unique prefix (all case-insensitive).
    """
    while True:
        default_info = f" (default: {default})" if default else ""
        choice_str = input(f"   {prompt_text}{default_info}: ").lower().strip()

        if not choice_str and default:
            return default

        # 1. Check for numeric choice
        if choice_str.isdigit() and 1 <= int(choice_str) <= len(options):
            return options[int(choice_str) - 1]

        # 2. Check for exact match (case-insensitive)
        lower_options = [opt.lower() for opt in options]
        if choice_str in lower_options:
            return options[lower_options.index(choice_str)]

        # 3. Check for unique prefix match (case-insensitive)
        matches = [opt for opt in options if opt.lower().startswith(choice_str)]
        if len(matches) == 1:
            print(f"   --> Interpreted '{choice_str}' as '{matches[0]}'.")
            return matches[0]

        # 4. If no valid choice, print error and loop
        print("   Invalid choice. Please enter the full name, a unique starting part of the name, or the corresponding number.")


def get_user_input() -> dict:
    """
    Interactively collects content generation parameters from the user in the terminal.
    """
    print("--- Teaching Content Generation Model ---")

    # --- Language Selection ---
    print("\n1. Choose Language:")
    languages = ["English", "Arabic"]
    for i, lang in enumerate(languages, 1):
        print(f"   {i}. {lang}")
    language = _get_choice_from_user(languages, f"Enter name or number (1-{len(languages)})", default="English")


    # --- Content Type ---
    print("\n2. Choose Content Type:")
    content_types = ["lesson plan", "worksheet", "presentation", "quiz"]
    for i, ct in enumerate(content_types, 1):
        print(f"   {i}. {ct.title()}")
    content_type = _get_choice_from_user(content_types, f"Enter name or number (1-{len(content_types)})")

    # --- Lesson Plan Specific Configuration ---
    number_of_sessions = "1"
    session_duration = "N/A"
    if content_type == "lesson plan":
        print("\n   --- Lesson Plan Configuration ---")
        while True:
            sessions_input = input("   - Enter the number of sessions for this lesson: ").strip()
            if sessions_input.isdigit() and int(sessions_input) > 0:
                number_of_sessions = sessions_input
                break
            else:
                print("   Invalid input. Please enter a positive whole number (e.g., 1, 2, 3).")
        session_duration = input("   - Enter the duration of each session (e.g., 45 minutes, 1 hour): ")


    # --- Content Configuration ---
    print("\n3. Configure Content:")
    subject = input("   - Subject (e.g., Physics, History): ")
    lesson_topic = input("   - Lesson Topic (e.g., Newton's Laws of Motion): ")
    grade = input("   - Grade Level (e.g., 10th Grade): ")
    learning_objective = input("   - Learning Objective (optional, press Enter to skip): ") or "Not specified"

    # --- Advanced Settings ---
    print("\n4. Advanced Settings:")
    emotional_consideration = input("   - Emotional Considerations (comma-separated, e.g., anxiety, low confidence, Enter to skip): ") or "None"

    depths = ["Basic", "Standard", "Advanced"]
    print("   - Instructional Depth:")
    for i, d in enumerate(depths, 1):
        print(f"     {i}. {d.title()}")
    instructional_depth = _get_choice_from_user(depths, f"Enter name or number (1-{len(depths)})", default="Standard")

    versions = ["Simplified", "Standard", "Enriched"]
    print("   - Content Version:")
    for i, v in enumerate(versions, 1):
        print(f"     {i}. {v.title()}")
    content_version = _get_choice_from_user(versions, f"Enter name or number (1-{len(versions)})", default="Standard")

    # --- Additional AI Options ---
    print("\n5. Additional AI Options (optional):")
    ai_options = ["adaptive difficulty", "include assessment", "multimedia suggestion"]
    print(f"   Choose any of the following, separated by commas: {', '.join([opt.title() for opt in ai_options])}")
    selected_options_str = input("   Enter your choices (or press Enter to skip): ").lower().strip()
    
    selected_ai_options = []
    if selected_options_str:
        user_choices = [choice.strip() for choice in selected_options_str.split(',')]
        
        for choice in user_choices:
            # Use a case-insensitive check for exact matches
            lower_ai_options = [o.lower() for o in ai_options]
            if choice in lower_ai_options:
                original_option = ai_options[lower_ai_options.index(choice)]
                if original_option not in selected_ai_options:
                    selected_ai_options.append(original_option)
                    print(f"   --> Added '{original_option.title()}'.")
            else:
                # Use a case-insensitive check for prefixes
                matches = [opt for opt in ai_options if opt.lower().startswith(choice)]
                if len(matches) == 1:
                    if matches[0] not in selected_ai_options:
                        selected_ai_options.append(matches[0])
                        print(f"   --> Interpreted '{choice}' as '{matches[0].title()}'.")
                else:
                    print(f"   --> Invalid or ambiguous choice: '{choice}'. It will be ignored.")

    return {
        "content_type": content_type,
        "language": language,
        "subject": subject,
        "lesson_topic": lesson_topic,
        "grade": grade,
        "learning_objective": learning_objective,
        "emotional_consideration": emotional_consideration,
        "instructional_depth": instructional_depth,
        "content_version": content_version,
        "additional_ai_options": selected_ai_options,
        "number_of_sessions": number_of_sessions,
        "session_duration": session_duration
    }

async def run_generation_pipeline_async(config: dict):
    """
    Constructs and runs the LCEL pipeline for content generation asynchronously.
    Returns the generated content instead of just printing it.
    """
    logger.info("Initializing Model and Tools for content generation")

    # FIX: Ensure session keys exist with default values to prevent KeyErrors in the prompt template.
    config.setdefault('number_of_sessions', '1')
    config.setdefault('session_duration', 'N/A')

    # --- LLM Initialization Block ---
    try:
        logger.info("Initializing local OpenAI LLM: gpt-4o")
        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.5,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=os.getenv("OPENAI_API_KEY"))
    except Exception as e:
        logger.error(f"Fatal: Could not initialize the OpenAI LLM or Embeddings. Error: {e}")
        raise Exception(f"Failed to initialize OpenAI components: {e}")

    # --- Process Additional AI Options ---
    additional_options = config.get("additional_ai_options") or []
    options_instructions = []
    if not additional_options:
        options_instructions.append("- No additional AI options were selected.")

    if "adaptive difficulty" in additional_options:
        options_instructions.append(
            "- **Adaptive Difficulty:** The generated content, especially assessments or activities, should offer varying levels of challenge. For example, include both foundational and advanced questions. If creating a worksheet, you might have a 'Getting Started' section and a 'Challenge Problems' section. This allows the teacher to tailor the experience to individual student needs."
        )
    if "include assessment" in additional_options:
        options_instructions.append(
            "- **Include Assessment:** You must create and include a distinct assessment component (e.g., a quiz, a set of discussion questions, a rubric for a project) that directly measures the specified learning objective. The assessment should be integrated into the content."
        )
    if "multimedia suggestion" in additional_options:
        options_instructions.append(
            "- **Multimedia Suggestions:** You must include a section with suggestions for relevant multimedia resources. This should include at least one recommended YouTube video (with a full URL) and a description of a relevant image or diagram (with a URL if possible). These suggestions should directly support the lesson topic."
        )
    
    config['additional_ai_options_instructions'] = "\n".join(options_instructions)

    # --- Process Citation Instructions (Conditional) ---
    citation_instructions = ""
    if "multimedia suggestion" in additional_options:
        logger.info("Multimedia suggestion is selected. Adding citation mandate to the prompt.")
        citation_instructions = (
            "- **Citation Mandate:** Because 'Multimedia Suggestion' was selected, you MUST include a final section that lists all source URLs provided in the 'Web Search Context'.\n"
            "  - For a 'lesson plan', this section must be titled 'References'.\n"
            "  - For a 'presentation', this must be the final slide, titled 'Bibliography'.\n"
            "  - For a 'worksheet' or 'quiz', this section must be titled 'Sources'."
        )
    else:
        logger.info("Multimedia suggestion not selected. No citation mandate will be included.")

    config['citation_instructions'] = citation_instructions

    # --- Qdrant Vector Search Block ---
    curriculum_context = "No internal curriculum context was found for this topic."
    try:
        logger.info("Initializing Qdrant client for curriculum search.")
        client = qdrant_client.QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
        )
        vector_store = QdrantVectorStore(
            client=client,
            collection_name="School_curriculum",
            embedding=embeddings,
            retrieval_mode=RetrievalMode.DENSE
        )

        vector_search_query = f"{config['subject']} Subject for grade: {config['grade']} of lesson topic: {config['lesson_topic']} , Learning Objective: {config['learning_objective']}"
        logger.info(f"Performing vector search with query: '{vector_search_query}'")
        
        found_docs = await vector_store.asimilarity_search(query=vector_search_query, k=20)
        
        if found_docs:
            logger.info(f"Found {len(found_docs)} relevant documents in the curriculum.")
            curriculum_context = "Relevant information from the school curriculum was found. Use this to guide your content:\n\n"
            for doc in found_docs:
                curriculum_context += f"---\n{doc.page_content}\n---\n\n"
        else:
            logger.warning("No relevant documents found in the curriculum vector store.")
    except Exception as e:
        logger.error(f"An error occurred during Qdrant vector search: {e}")
        curriculum_context = f"Vector search for curriculum failed with an error: {e}. Rely on general knowledge and web search."

    config['curriculum_context'] = curriculum_context

    # --- Web Search Block (Conditional) ---
    web_context = "No web search was performed for this generation."
    
    # FIX: Ensure 'additional_ai_options' is treated as an iterable, even if its value is None.
    additional_ai_options_list = config.get("additional_ai_options") or []

    if "multimedia suggestion" in additional_ai_options_list:
        logger.info("Web search is enabled for multimedia suggestions. Fetching latest content...")
        try:
            search_tool = PerplexityWebSearchTool(max_results=5, model="sonar")
            
            language = config.get('language', 'English')
            search_query = ""

            if language == 'Arabic':
                content_type_ar_map = {
                    "lesson plan": "خطة درس",
                    "worksheet": "ورقة عمل",
                    "presentation": "عرض تقديمي",
                    "quiz": "اختبار قصير"
                }
                content_type_ar = content_type_ar_map.get(config['content_type'], config['content_type'])
                search_query = (
                    f"مصادر تعليمية تتضمن فيديوهات يوتيوب وصور لـ {config['grade']} في مادة {config['subject']} "
                    f"لـ {content_type_ar} حول '{config['lesson_topic']}'"
                )
                if config.get('learning_objective', '') != 'Not specified':
                    search_query += f" مع هدف التعلم: '{config['learning_objective']}'"
            else:  # Default to English
                search_query = (
                    f"Teaching resources with youtube videos and images for a {config['grade']} {config['subject']} "
                    f"{config['content_type']} on '{config['lesson_topic']}'"
                )
                if config.get('learning_objective', '') != 'Not specified':
                    search_query += f" with the learning objective: '{config['learning_objective']}'"

            logger.info(f"Performing web search with query: {search_query}")
            results = await search_tool.search(query=search_query)

            if results:
                web_context = "Web search has been performed to find multimedia resources. Use the following latest information and source URLs to enrich your content:\n\n"
                for result in results:
                    web_context += result["content"] + "\n\n"
                logger.info("Web search completed and context created with results.")
            else:
                web_context = "Web search for multimedia was enabled but returned no relevant results. Proceed with general knowledge."
                logger.warning(f"Web search for query '{search_query}' returned no results.")
        except Exception as e:
            logger.error(f"An error occurred during the web search process: {e}")
            web_context = f"Web search for multimedia was enabled but failed with an error: {e}."

    config['web_context'] = web_context

    prompt = ChatPromptTemplate.from_template(CONTENT_GENERATION_PROMPT_TEMPLATE)
    output_parser = StrOutputParser()
    
    # This is the LangChain Expression Language (LCEL) chain
    chain = prompt | llm | output_parser

    logger.info("Generating content with AI...")

    try:
        response = await chain.ainvoke(config)
        logger.info("Content generated successfully.")
        return response
    except Exception as e:
        logger.error(f"Error during content generation: {e}", exc_info=True)
        raise

def trigger_slide_generation(generated_content: str, config: dict):
    """
    Takes generated presentation text and user config to generate a PPT
    using the SlideSpeak API.
    """
    print("\n--- Configuring SlideSpeak Presentation ---")

    plain_text = generated_content
    custom_instructions = (
        f"Generate a presentation for a {config['grade']} {config['subject']} class "
        f"on '{config['lesson_topic']}'. Strictly follow the slide structure, titles, "
        "body text, and speaker notes provided in the input text."
    )
    language = config['language'].upper()

    # Automatically count the number of slides from the generated text.
    num_slides = len(re.findall(r"(?:Slide|الشريحة)\s\d+:", plain_text, re.IGNORECASE))
    
    if num_slides == 0:
        # Fallback for different formatting
        num_slides = len(re.findall(r"slide title:", plain_text, re.IGNORECASE))

    if num_slides > 0:
        print(f"   - Automatically detected {num_slides} slides from the generated content.")
    else:
        print("   ! Warning: Could not automatically determine the number of slides.")
        while True:
            try:
                num_slides_input = input("   - Please enter the desired number of slides: ")
                if num_slides_input.isdigit() and int(num_slides_input) > 0:
                    num_slides = int(num_slides_input)
                    break
                else:
                    print("   Please enter a positive number.")
            except ValueError:
                print("   Invalid input. Please enter a number.")

    # Map instructional depth to SlideSpeak's verbosity settings
    depth_map = {"Basic": "concise", "Standard": "standard", "Advanced": "text-heavy"}
    verbosity = depth_map.get(config['instructional_depth'], "standard")
    print(f"   - Verbosity set to '{verbosity}' based on Instructional Depth '{config['instructional_depth']}'.")

    fetch_images_input = input("   - Fetch stock images for the presentation? (yes/no) [default: yes]: ").lower().strip()
    fetch_images = fetch_images_input not in ["no", "n"]
    template = input("   - Enter a SlideSpeak template name (or leave blank for default): ") or "default"

    try:
        generator = SlideSpeakGenerator()
        print("\nGenerating your SlideSpeak presentation... This may take a moment.")
        final_result = generator.generate_presentation(
            plain_text=plain_text,
            custom_user_instructions=custom_instructions,
            length=num_slides,
            language=language,
            fetch_images=fetch_images,
            verbosity=verbosity,
            tone="educational",
            template=template
        )

        print("\n--- SlideSpeak Generation Result ---")
        print(final_result)

        if final_result.get("task_status") == "SUCCESS":
            presentation_url = final_result.get("task_result", {}).get("presentation_url")
            if presentation_url:
                print("\n" + "="*50)
                print(f"✅ Your presentation is ready!")
                print(f"   You can view and download it here: {presentation_url}")
                print("="*50 + "\n")
        else:
            print("\n" + "="*50)
            print("❌ Presentation generation failed or ended with a non-success status.")
            print(f"   Details: {final_result.get('task_result') or final_result.get('error', 'No details provided.')}")
            print("="*50 + "\n")

    except Exception as e:
        print(f"\nAn error occurred during the presentation generation process: {e}")


if __name__ == "__main__":
    required_keys = ["OPENAI_API_KEY", "PPLX_API_KEY", "QDRANT_URL", "QDRANT_API_KEY"]
    if not all(os.getenv(key) for key in required_keys):
        print(f"FATAL ERROR: Make sure you have created a .env file with all required keys: {', '.join(required_keys)}")
    else:
        user_config = get_user_input()
        response = asyncio.run(run_generation_pipeline_async(user_config))
        print("\n--- Generated Content ---")
        print(response)

        if user_config.get("content_type") == "presentation":
            while True:
                generate_ppt_choice = input("\nWould you like to generate a PowerPoint (PPT) file from this content? (yes/no): ").lower().strip()
                if generate_ppt_choice in ["yes", "y"]:
                    if not os.getenv("SLIDESPEAK_API_KEY"):
                        print("\nFATAL ERROR: To generate a PPT, please add your SLIDESPEAK_API_KEY to the .env file.")
                        break
                    
                    trigger_slide_generation(response, user_config)
                    break
                elif generate_ppt_choice in ["no", "n"]:
                    print("Skipping PPT generation. The text content is available above.")
                    break
                else:
                    print("Invalid input. Please enter 'yes' or 'no'.")