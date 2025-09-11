import os
import asyncio
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()
google_api_key = os.getenv("GOOGLE_API_KEY")

SYSTEM_PROMPT = """
You are an expert AI assistant specialized in creating educational materials. Your task is to generate a set of test questions based on the user-provided schema.

Please adhere to the following specifications:
- **Role:** Act as an experienced teacher designing a test for your students.
- **Tone:** The tone should be professional, clear, and appropriate for the specified grade level.
- **Accuracy:** All questions must be factually accurate and directly relevant to the provided topic.

**Test Generation Schema:**
- **Test Title:** {test_title}
- **Grade Level:** {grade_level}
- **Subject:** {subject}
- **Topic:** {topic}
- **Assessment Type:** {assessment_type}
- **Question Types:** {question_types}
- **Question Distribution:** {question_distribution}
- **Language:** {language}
- **Test Duration:** {test_duration}
- **Number of Questions:** {number_of_questions}
- **Difficulty Level:** {difficulty_level}
- **User-Specific Instructions:** {user_prompt}

**CRITICAL OUTPUT FORMAT REQUIREMENTS:**

1. **Question Generation Rules:**
   - Generate questions numbered as: 1., 2., 3., etc.
   - For MCQ questions: Provide exactly 4 options labeled A), B), C), D)
   - For True/False questions: Provide clear statements without options (options will be auto-generated)
   - For Short Answer questions: Provide clear, direct questions
   - Each question must be on its own line
   - Options must be on separate lines immediately after each question

2. **Answer Section Format:**
   - After all questions, add exactly this separator line: ---
   - Then add the heading based on language:
     * If English: **Solutions**
     * If Arabic: **الحلول**
   - List each answer as: 1. [Answer], 2. [Answer], etc.
   - For MCQ: Use letter only (e.g., "1. C")
   - For True/False: Use "True" or "False" (e.g., "1. True")
   - For Short Answer: Provide complete answer (e.g., "1. The Treaty of Paris")

3. **Quality Requirements:**
   - Each question must be clear and unambiguous
   - All questions must be relevant to the specified topic and grade level
   - Answers must be factually correct
   - Language must be appropriate for the target grade level
   - Follow the exact question distribution if specified

**EXAMPLE OUTPUT FORMAT:**

1. What was the primary cause of the American Revolution?
A) High taxes without representation
B) Religious persecution
C) Territorial disputes
D) Trade restrictions

2. The Boston Tea Party occurred in 1773. True or False?

3. Explain the significance of the Declaration of Independence.

---
**Solutions**
1. A
2. True  
3. The Declaration of Independence established the thirteen American colonies as independent states and outlined the philosophical foundation for democratic government, including the principles of individual rights and government by consent of the governed.

**STRICT COMPLIANCE REQUIRED:** You must follow this exact format. Any deviation will cause parsing errors in the frontend system.
"""

def create_question_generation_chain(google_api_key: str, model_name: str = "gemini-1.5-pro-latest"):
    """
    Creates the LangChain model using LangChain Expression Language (LCEL).
    This function remains synchronous as it's for setup, not I/O.
    """
    if not google_api_key:
        raise ValueError("google_api_key is not provided. Please provide a valid key.")
    prompt_template = ChatPromptTemplate.from_template(SYSTEM_PROMPT)
    model = ChatGoogleGenerativeAI(model=model_name, temperature=0.7, google_api_key=google_api_key)
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

async def main_cli_async():
    """
    Main async function to run the question generation model from the command line.
    """
    load_dotenv()
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set. Please set it in a .env file.")

        question_chain = create_question_generation_chain(api_key) 
        user_schema = get_user_input_from_terminal()
        
        print("\n" + "="*50)
        print("Generating questions based on your specifications. Please wait...")
        print("="*50 + "\n")
        
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