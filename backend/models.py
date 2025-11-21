from pydantic import BaseModel
from typing import Optional


class DocumentInfo(BaseModel):
    """Model for document information."""
    id: str
    filename: str
    content: str
    file_type: str
    file_url: str
    size: int

