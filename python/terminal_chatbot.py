import os
import asyncio
import logging
from typing import List, Dict, Any

# Import the RAGTutorConfig and AsyncRAGTutor from your provided file
from AI_tutor import RAGTutorConfig, AsyncRAGTutor

# Basic configuration for logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- ANSI Color Codes for Terminal Output ---
class Colors:
    """A class to hold ANSI color codes for styling terminal output."""
    RESET = "\033[0m"
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[0;33m"
    BLUE = "\033[0;34m"
    PURPLE = "\033[0;35m"
    CYAN = "\033[0;36m"

# --- Local Storage Manager ---
class LocalStorageManager:
    """
    A simple storage manager to read local files, making it compatible with
    the AsyncRAGTutor which expects a storage manager object.
    """
    async def get_file_content_bytes_async(self, file_path: str) -> bytes:
        """
        Asynchronously reads the content of a local file and returns it as bytes.
        """
        try:
            with open(file_path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            logging.error(f"File not found at path: {file_path}")
            return None
        except Exception as e:
            logging.error(f"Error reading file {file_path}: {e}")
            return None

# --- Main Chatbot Application ---
class TerminalChatbot:
    """
    The main class for the terminal-based chatbot application.
    """
    def __init__(self):
        """Initializes the chatbot, tutor, and chat history."""
        self.storage_manager = LocalStorageManager()
        self.config = RAGTutorConfig.from_env()
        self.tutor = AsyncRAGTutor(storage_manager=self.storage_manager, config=self.config)
        self.chat_history: List[Dict[str, Any]] = []
        self.is_kb_ready = False
        # --- ENHANCEMENT: Track last uploaded file for contextual queries ---
        self.last_uploaded_files: List[str] = []

    def print_help(self):
        """Prints the available commands to the user."""
        print(f"\n{Colors.CYAN}--- Help Menu ---{Colors.RESET}")
        print(f"{Colors.YELLOW}/upload <file_path>{Colors.RESET} - Upload a document or image to the knowledge base.")
        print(f"{Colors.YELLOW}/websearch [on|off]{Colors.RESET} - Enable or disable the web search tool.")
        print(f"{Colors.YELLOW}/new{Colors.RESET} - Start a new session, clearing the knowledge base and history.")
        print(f"{Colors.YELLOW}/help{Colors.RESET} - Display this help menu.")
        print(f"{Colors.YELLOW}/exit{Colors.RESET} - Exit the chatbot.\n")

    async def handle_command(self, user_input: str):
        """Parses and executes user commands."""
        command, *args = user_input.strip().lower().split()

        if command == "/upload":
            if not args:
                print(f"{Colors.RED}Usage: /upload <file_path>{Colors.RESET}")
                return
            file_path = args[0]
            if not os.path.exists(file_path):
                print(f"{Colors.RED}Error: File not found at '{file_path}'.{Colors.RESET}")
                return

            print(f"{Colors.PURPLE}Processing and ingesting '{file_path}'...{Colors.RESET}")
            success = await self.tutor.ingest_async([file_path])
            if success:
                self.is_kb_ready = True
                # --- ENHANCEMENT: Store the basename of the uploaded file ---
                self.last_uploaded_files = [os.path.basename(file_path)]
                print(f"{Colors.GREEN}Successfully ingested '{file_path}' into the knowledge base.{Colors.RESET}")
            else:
                print(f"{Colors.RED}Failed to ingest '{file_path}'.{Colors.RESET}")

        elif command == "/websearch":
            if not args or args[0] not in ["on", "off"]:
                print(f"{Colors.RED}Usage: /websearch [on|off]{Colors.RESET}")
                return
            status = args[0] == "on"
            self.tutor.update_web_search_status(status)
            status_text = "ENABLED" if status else "DISABLED"
            print(f"{Colors.GREEN}Web search is now {status_text}.{Colors.RESET}")

        elif command == "/new":
            print(f"{Colors.PURPLE}Starting a new session...{Colors.RESET}")
            await self.tutor.clear_knowledge_base_async()
            self.chat_history = []
            self.is_kb_ready = False
            # --- ENHANCEMENT: Clear uploaded file context on new session ---
            self.last_uploaded_files = []
            print(f"{Colors.GREEN}New session started. Knowledge base and history cleared.{Colors.RESET}")

        elif command == "/help":
            self.print_help()
            
        else:
            print(f"{Colors.RED}Unknown command: '{command}'. Type /help for a list of commands.{Colors.RESET}")

    async def start_chat(self):
        """The main loop to run the chatbot."""
        print(f"\n{Colors.GREEN}--- AI Tutor Chatbot ---{Colors.RESET}")
        print("Welcome! I'm your AI-powered tutor. How can I help you today?")
        self.print_help()

        while True:
            try:
                user_input = input(f"{Colors.YELLOW}You: {Colors.RESET}")

                if not user_input.strip():
                    continue
                
                if user_input.startswith('/'):
                    if user_input.lower() == '/exit':
                        print(f"{Colors.BLUE}Goodbye!{Colors.RESET}")
                        break
                    await self.handle_command(user_input)
                else:
                    print(f"\n{Colors.BLUE}Tutor: {Colors.RESET}", end="", flush=True)
                    
                    full_response = ""
                    # --- ENHANCEMENT: Pass the list of recently uploaded files to the agent ---
                    async for chunk in self.tutor.run_agent_async(
                        query=user_input,
                        history=self.chat_history,
                        is_knowledge_base_ready=self.is_kb_ready,
                        uploaded_files=self.last_uploaded_files
                    ):
                        print(chunk, end="", flush=True)
                        full_response += chunk
                    
                    print("\n") # Add a newline after the full response
                    
                    # --- ENHANCEMENT: Clear the last uploaded files list after use ---
                    if self.last_uploaded_files:
                        self.last_uploaded_files = []

                    # Update history
                    self.chat_history.append({"role": "user", "content": user_input})
                    self.chat_history.append({"role": "assistant", "content": full_response})

            except KeyboardInterrupt:
                print(f"\n{Colors.BLUE}Goodbye!{Colors.RESET}")
                break
            except Exception as e:
                print(f"{Colors.RED}\nAn unexpected error occurred: {e}{Colors.RESET}")
                logging.error("Chat loop error", exc_info=True)


async def main():
    """Entry point for the chatbot application."""
    # Ensure environment variables are set
    if not os.getenv("OPENAI_API_KEY"):
        print(f"{Colors.RED}FATAL ERROR: OPENAI_API_KEY environment variable is not set.{Colors.RESET}")
        return
        
    chatbot = TerminalChatbot()
    await chatbot.start_chat()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting application.")