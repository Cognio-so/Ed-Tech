from typing import TypedDict, List, Optional, Dict, Any, Annotated
from langchain_core.messages import BaseMessage


class StudentGraphState(TypedDict, total=False):
    messages: Annotated[List[BaseMessage], "add_messages"]
    user_query: Optional[str]
    student_id: str
    student_profile: Optional[Dict[str, Any]]
    pending_assignments: Optional[List[Dict[str, Any]]]
    assessment_data: Optional[Dict[str, Any]]
    achievements: Optional[List[str]]
    doc_url: Optional[str]
    subject: Optional[str]
    language: Optional[str]
    context: Optional[Dict[str, Any]]
    should_continue: bool
    chunk_callback: Optional[Any]
    token_usage: Optional[Dict[str, int]]
    response: Optional[str]
    final_answer: Optional[str]
    simple_llm_response: Optional[str]
    rag_response: Optional[str]
    websearch_results: Optional[str]
    image_result: Optional[str]
    route: Optional[str]
    tasks: Optional[List[str]]
    task_index: Optional[int]
    current_task: Optional[str]
    resolved_query: Optional[str]
    intermediate_results: Optional[List[Dict[str, Any]]]

