import os
import asyncio
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore, RetrievalMode
import qdrant_client
from dotenv import load_dotenv
from prompts import ASSESSMENT_GENERATION_PROMPT_TEMPLATE

load_dotenv()
# Switched from GOOGLE_API_KEY to OPENAI_API_KEY
openai_api_key = os.getenv("OPENAI_API_KEY")

ASSESSMENT_PROMPT_TEMPLATE = ASSESSMENT_GENERATION_PROMPT_TEMPLATE

def create_question_generation_chain(openai_api_key: str, model_name: str = "gpt-4o"):
    """
    Creates the LangChain model using LangChain Expression Language (LCEL).
    This function remains synchronous as it's for setup, not I/O.
    """
    if not openai_api_key:
        raise ValueError("openai_api_key is not provided. Please provide a valid key.")
    prompt_template = ChatPromptTemplate.from_template(ASSESSMENT_PROMPT_TEMPLATE)
    model = ChatOpenAI(model=model_name, temperature=0.7, openai_api_key=openai_api_key)
    output_parser = StrOutputParser()
    chain = prompt_template | model | output_parser
    return chain

async def generate_test_questions_async(chain, schema: dict):
    """
    Invokes the provided chain asynchronously to generate test questions.

    Args:
        chain: The LangChain runnable sequence.
        schema (dict): A dictionary containing the test specifications.

    Returns:
        The generated text content with properly formatted questions and solutions.
    """
    try:
        # Generate the content
        raw_content = await chain.ainvoke(schema)
        
        # Validate the output format
        if not validate_output_format(raw_content):
            print("Warning: Generated content may not be in the expected format")
        
        return raw_content
    except Exception as e:
        print(f"Error generating test questions: {e}")
        raise

def validate_output_format(content: str) -> bool:
    """
    Validates that the generated content follows the expected format.
    
    Args:
        content (str): The generated content to validate
        
    Returns:
        bool: True if format is valid, False otherwise
    """
    if not content:
        return False
    
    # Check for numbered questions
    has_questions = any(line.strip().startswith(f"{i}.") for i in range(1, 21) for line in content.split('\n'))
    
    # Check for solutions section
    has_separator = "---" in content
    has_solutions = "**Solutions**" in content or "**الحلول**" in content
    
    return has_questions and has_separator and has_solutions

def get_user_input_from_terminal():
    """
    Prompts the user to enter the test specifications in the terminal.
    This remains synchronous as input() is a blocking operation.
    """
    print("--- Create Your Custom Test (CLI Mode) ---")
    
    # Input for multiple assessment types
    assessment_types_input = input("Enter assessment types (comma-separated: MCQ, True or False, Short Answer): ")
    assessment_types = [item.strip() for item in assessment_types_input.split(',')]
    
    schema = {
        "test_title": input("Enter the title of the test: "),
        "grade_level": input("Enter the grade or class (e.g., '10th Grade'): "),
        "subject": input("Enter the subject (e.g., 'History'): "),
        "topic": input("Enter the specific topic (e.g., 'The American Revolution'): "),
        "assessment_type": assessment_types[0] if len(assessment_types) == 1 else "Mixed",
        "assessment_types": assessment_types,
        "question_types": [t.lower().replace(" ", "_") for t in assessment_types],
        "question_distribution": {},  # Will be calculated if needed
        "language": input("Enter the language for the test (English or Arabic): "),
        "test_duration": input("Enter the test duration (e.g., '45 minutes'): "),
        "number_of_questions": int(input("Enter the number of questions: ")),
        "difficulty_level": input("Enter the difficulty level (Easy, Medium, Hard): "),
        "user_prompt": input("Enter optional instructions (or press Enter to skip): ")
    }
    
    if not schema["user_prompt"]:
        schema["user_prompt"] = "None."
        
    # Calculate question distribution for mixed assessments
    if schema["assessment_type"] == "Mixed" and len(assessment_types) > 1:
        total_questions = schema["number_of_questions"]
        questions_per_type = total_questions // len(assessment_types)
        remainder = total_questions % len(assessment_types)
        
        for i, q_type in enumerate(schema["question_types"]):
            schema["question_distribution"][q_type] = questions_per_type + (1 if i < remainder else 0)
    
    return schema

async def get_curriculum_context_async(schema: dict, embeddings: OpenAIEmbeddings) -> str:
    """
    Performs a vector search on the Qdrant collection to find relevant curriculum context.
    """
    curriculum_context = "No internal curriculum context was found for this topic."
    try:
        print("Initializing Qdrant client for curriculum search...")
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

        vector_search_query = f"Subject: {schema['subject']}, Grade: {schema['grade_level']}, Topic: {schema['topic']}, Instructions: {schema['user_prompt']}"
        print(f"Performing vector search with query: '{vector_search_query}'")
        
        found_docs = await vector_store.asimilarity_search(query=vector_search_query, k=20)
        
        if found_docs:
            print(f"Found {len(found_docs)} relevant documents in the curriculum.")
            context_parts = ["Relevant information from the school curriculum was found. Use this to guide your content:\n\n"]
            for doc in found_docs:
                context_parts.append(f"---\n{doc.page_content}\n---\n\n")
            curriculum_context = "".join(context_parts)
        else:
            print("Warning: No relevant documents found in the curriculum vector store.")
    except Exception as e:
        print(f"Warning: An error occurred during Qdrant vector search: {e}. Proceeding without curriculum context.")
        curriculum_context = f"Vector search for curriculum failed with an error: {e}. Rely on general knowledge."
    
    return curriculum_context

async def main_cli_async():
    """
    Main async function to run the question generation model from the command line.
    """
    load_dotenv()
    try:
        # Check for all required environment variables
        required_keys = ["OPENAI_API_KEY", "QDRANT_URL", "QDRANT_API_KEY"]
        if not all(os.getenv(key) for key in required_keys):
            raise ValueError(f"One or more required environment variables are not set. Please set them in a .env file: {', '.join(required_keys)}")

        api_key = os.environ.get("OPENAI_API_KEY")
        
        # Get user input for the test
        user_schema = get_user_input_from_terminal()
        
        # Initialize embeddings for vector search
        embeddings = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=api_key)

        # Fetch curriculum context from Qdrant
        curriculum_context = await get_curriculum_context_async(user_schema, embeddings)
        user_schema['curriculum_context'] = curriculum_context

        # Create the generation chain
        question_chain = create_question_generation_chain(api_key) 
        
        print("\n" + "="*50)
        print("Generating questions based on your specifications and curriculum data. Please wait...")
        print("="*50 + "\n")
        
        # Generate the test content
        generated_content = await generate_test_questions_async(question_chain, user_schema)
        
        print("--- Generated Test Questions ---")
        print(generated_content)
        print("--- End of Test ---")
        
        # Optionally save to file
        save_option = input("\nWould you like to save this test to a file? (y/n): ")
        if save_option.lower() == 'y':
            filename = f"test_{user_schema['topic'].replace(' ', '_').lower()}.txt"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(generated_content)
            print(f"Test saved to {filename}")
        
    except ValueError as ve:
        print(f"Error: {ve}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main_cli_async())