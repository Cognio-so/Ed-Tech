from typing import List, Dict, Any
import pypdf
import docx
import json
from io import BytesIO
import uuid
from fastapi import UploadFile
from backend.models import DocumentInfo

# Try to import fitz (PyMuPDF), fallback to pypdf if not available
try:
    import fitz
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file using PyMuPDF (fitz) or pypdf as fallback"""
    # Try PyMuPDF first (fitz) - better quality extraction
    if HAS_FITZ:
        try:
            doc = fitz.open(stream=file_content, filetype="pdf")
            text = ""
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                if page_text.strip():  
                    text += page_text + "\n"
            
            doc.close()
            return text.strip()
        except Exception as e:
            print(f"Error reading PDF with PyMuPDF: {e}, trying pypdf fallback...")
    
    # Fallback to pypdf
    try:
        pdf_reader = pypdf.PdfReader(BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text.strip():
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error reading PDF with pypdf: {e}")
        return ""

def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(BytesIO(file_content))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        print(f"Error reading DOCX: {e}")
        return ""

def extract_text_from_txt(file_content: bytes) -> str:
    """Extract text from TXT file"""
    try:
        return file_content.decode('utf-8')
    except Exception as e:
        print(f"Error reading TXT: {e}")
        return ""

def extract_text_from_json(file_content: bytes) -> str:
    """Extract text from JSON file"""
    try:
        data = json.loads(file_content.decode('utf-8'))
        # Convert JSON to readable text format
        if isinstance(data, dict):
            text = ""
            for key, value in data.items():
                text += f"{key}: {value}\n"
            return text
        elif isinstance(data, list):
            text = ""
            for i, item in enumerate(data):
                text += f"Item {i+1}: {item}\n"
            return text
        else:
            return str(data)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return ""



async def process_uploaded_files_api(uploaded_files: List[UploadFile]) -> List[DocumentInfo]:
    """Process uploaded files and extract text content for API"""
    processed_docs = []
    import asyncio
    
    for file in uploaded_files:
        if file is not None:
            try:
                # Read file content
                file_content = await file.read()
                file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'txt'
                file_id = str(uuid.uuid4())
                
                
                text = ""
                if file_extension == 'pdf':
                    text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                elif file_extension == 'docx':
                    text = await asyncio.to_thread(extract_text_from_docx, file_content)
                elif file_extension == 'txt':
                    text = extract_text_from_txt(file_content)  
                elif file_extension == 'json':
                    text = extract_text_from_json(file_content) 
                else:
                    text = extract_text_from_txt(file_content)  
                
                if text.strip():
                   
                    doc_info = DocumentInfo(
                        id=file_id,
                        filename=file.filename,
                        content=text,
                        file_type=file_extension,
                        file_url=f"uploaded/{file.filename}",  
                        size=len(file_content)
                    )
                    processed_docs.append(doc_info)
                else:
                    print(f"No text content found in {file.filename}")
                    
            except Exception as e:
                print(f"Error processing {file.filename}: {e}")
                continue
    
    return processed_docs

async def process_knowledge_base_files(uploaded_files: List[UploadFile]) -> List[DocumentInfo]:
    """Process knowledge base files and extract text content"""
    processed_docs = []
    import asyncio
    
    for file in uploaded_files:
        if file is not None:
            try:
                # Read file content
                file_content = await file.read()
                file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'txt'
                file_id = str(uuid.uuid4())
                text = ""
                if file_extension == 'pdf':
                    text = await asyncio.to_thread(extract_text_from_pdf, file_content)
                elif file_extension == 'docx':
                    text = await asyncio.to_thread(extract_text_from_docx, file_content)
                elif file_extension == 'txt':
                    text = extract_text_from_txt(file_content)  
                elif file_extension == 'json':
                    text = extract_text_from_json(file_content) 
                else:
                    text = extract_text_from_txt(file_content) 
                
                if text.strip():
                    doc_info = DocumentInfo(
                        id=file_id,
                        filename=file.filename,
                        content=text,
                        file_type=file_extension,
                        file_url=f"kb/{file.filename}",  
                        size=len(file_content)
                    )
                    processed_docs.append(doc_info)
                else:
                    print(f"No text content found in KB file {file.filename}")
                    
            except Exception as e:
                print(f"Error processing KB file {file.filename}: {e}")
                continue
    
    return processed_docs