from typing import TypedDict, List, Optional, Dict, Any, Annotated
from langchain_core.messages import BaseMessage


class GraphState(TypedDict):
    messages: Annotated[List[BaseMessage], "add_messages"]
    user_query: Optional[str]
    teacher_id: str
    session_id: Optional[str]
    student_data: Optional[Dict[str, Any]]
    teacher_data: Optional[Dict[str, Any]]
    topic: Optional[str]
    subject: Optional[str]
    content_type: Optional[Any]  
    doc_url: Optional[str]
    language: Optional[str]
    model: Optional[str]  
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
    uploaded_doc: Optional[bool]
    new_uploaded_docs: Optional[List[Dict[str, Any]]]  
    active_docs: Optional[List[Dict[str, Any]]]  
    is_image: Optional[bool]  
    edit_img_urls: Optional[List[str]] 
    img_urls: Optional[List[str]]
    next_node: Optional[str]  

