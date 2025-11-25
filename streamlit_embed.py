import streamlit as st
import sys
from pathlib import Path
import asyncio
from typing import List, Dict, Any, Tuple
import os

# Add backend to path
backend_path = Path(__file__).resolve().parent
if str(backend_path) not in sys.path:
    sys.path.append(str(backend_path))

from backend.doument_processor import process_knowledge_base_files
from backend.embedding import embed_chunks_parallel
from backend.models import DocumentInfo
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient, models
import uuid

# Qdrant configuration
QDRANT_URL = os.getenv("QDRANT_URL", ":memory:")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_TIMEOUT = float(os.getenv("QDRANT_TIMEOUT", "60"))
VECTOR_SIZE = 1536
QDRANT_UPSERT_BATCH_SIZE = int(os.getenv("QDRANT_UPSERT_BATCH_SIZE", "64"))

# Initialize Qdrant client
try:
    if QDRANT_URL == ":memory:":
        QDRANT_CLIENT = QdrantClient(":memory:", timeout=QDRANT_TIMEOUT)
    else:
        QDRANT_CLIENT = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=QDRANT_TIMEOUT)
        QDRANT_CLIENT.get_collections()
        st.success(f"✅ Connected to Qdrant at {QDRANT_URL}")
except Exception as e:
    st.error(f"❌ Failed to connect to Qdrant: {e}")
    QDRANT_CLIENT = QdrantClient(":memory:")
    st.warning("Using in-memory Qdrant (data will be lost on restart)")

# Set page configuration
st.set_page_config(
    page_title="Knowledge Base Embedding Tool",
    page_icon="📚",
    layout="wide"
)

st.title("📚 Knowledge Base Embedding Tool")
st.markdown("Upload educational books and store them in Qdrant vector database with embeddings.")

# Subject options
SUBJECTS = {
    "Mathematics": "mathematics",
    "English": "english",
    "Hindi": "hindi",
    "Social Science": "social_science",
    "Science": "science",
    "Biology": "biology",
    "Physics": "physics",
    "Chemistry": "chemistry",
    "Language": "language"
}

# Language options (for Language subject)
LANGUAGES = {
    "English": "en",
    "Hindi": "hi"
}

def generate_collection_name(grade: int, subject: str, language: str = "en") -> str:
    """
    Generate collection name based on metadata.
    Format: kb_grad_{grade}_sub_{subject}_lang_{language}
    Example: kb_grad_10_sub_mathematics_lang_en
    """
    # Normalize subject name (lowercase, replace spaces with underscores)
    subject_normalized = subject.lower().replace(" ", "_")
    lang_code = language.lower()
    return f"kb_grad_{grade}_sub_{subject_normalized}_lang_{lang_code}"

async def ensure_collection(collection_name: str) -> Tuple[bool, str]:
    """Ensure collection exists, create if not."""
    try:
        collections_response = await asyncio.to_thread(QDRANT_CLIENT.get_collections)
        collections = [c.name for c in collections_response.collections]
        
        if collection_name not in collections:
            await asyncio.to_thread(
                QDRANT_CLIENT.recreate_collection,
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
            )
            
            # Create payload indexes
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="doc_id",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="filename",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            await asyncio.to_thread(
                QDRANT_CLIENT.create_payload_index,
                collection_name=collection_name,
                field_name="file_type",
                field_schema=models.PayloadSchemaType.KEYWORD
            )
            return True, f"Created new collection: {collection_name}"
        else:
            return True, f"Collection already exists: {collection_name}"
    except Exception as e:
        return False, f"Error ensuring collection: {e}"

async def store_documents_in_collection(
    collection_name: str,
    documents: List[DocumentInfo],
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> Tuple[bool, str]:
    """
    Store documents in Qdrant with embeddings.
    """
    if not documents:
        return False, "No documents to store"
    
    try:
        # Ensure collection exists
        success, message = await ensure_collection(collection_name)
        if not success:
            return False, message
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        
        all_chunks = []
        all_metadatas = []
        
        for doc_info in documents:
            chunks = text_splitter.split_text(doc_info.content)
            base_meta = {
                "doc_id": doc_info.id,
                "filename": doc_info.filename,
                "file_type": doc_info.file_type,
                "file_url": doc_info.file_url,
                "size": doc_info.size
            }
            
            for i, chunk in enumerate(chunks):
                chunk_meta = base_meta.copy()
                chunk_meta["chunk_index"] = i
                chunk_meta["total_chunks"] = len(chunks)
                all_chunks.append(chunk)
                all_metadatas.append(chunk_meta)
        
        st.info(f"📄 Split {len(documents)} documents into {len(all_chunks)} chunks")
        
        # Generate embeddings
        with st.spinner(f"🔄 Generating embeddings for {len(all_chunks)} chunks..."):
            embeddings = await embed_chunks_parallel(all_chunks, batch_size=200)
        
        # Create points for Qdrant
        points = []
        for i, (chunk, embedding, meta) in enumerate(zip(all_chunks, embeddings, all_metadatas)):
            payload = {
                "text": chunk,
                "chunk_index": i,
                **meta
            }
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload=payload
                )
            )
        
        # Upsert in batches
        with st.spinner(f"💾 Storing {len(points)} chunks in Qdrant..."):
            for i in range(0, len(points), QDRANT_UPSERT_BATCH_SIZE):
                batch = points[i:i + QDRANT_UPSERT_BATCH_SIZE]
                await asyncio.to_thread(
                    QDRANT_CLIENT.upsert,
                    collection_name=collection_name,
                    points=batch
                )
        
        return True, f"✅ Successfully stored {len(points)} chunks in collection '{collection_name}'"
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False, f"❌ Error storing documents: {e}"

# Main UI
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("📋 Book Metadata")
    
    # Class selection (1-12)
    grade = st.selectbox(
        "Class/Grade",
        options=list(range(1, 13)),
        format_func=lambda x: f"Class {x}",
        index=9  # Default to Class 10
    )
    
    # Subject selection
    subject_display = st.selectbox(
        "Subject",
        options=list(SUBJECTS.keys()),
        index=0  # Default to Mathematics
    )
    subject_code = SUBJECTS[subject_display]
    
    # Language selection (only show if Language subject is selected)
    language_code = "en"  # Default
    if subject_display == "Language":
        language_display = st.selectbox(
            "Language",
            options=list(LANGUAGES.keys()),
            index=0  # Default to English
        )
        language_code = LANGUAGES[language_display]
    else:
        # For other subjects, determine language from subject
        if subject_display == "Hindi":
            language_code = "hi"
        else:
            language_code = "en"

with col2:
    st.subheader("📤 Upload Book")
    
    uploaded_file = st.file_uploader(
        "Choose a book file",
        type=["pdf", "docx", "txt", "json"],
        help="Upload PDF, DOCX, TXT, or JSON files"
    )
    
    if uploaded_file:
        st.info(f"📄 Selected: {uploaded_file.name} ({uploaded_file.size / 1024:.2f} KB)")

# Display collection name preview
if grade and subject_code:
    collection_name = generate_collection_name(grade, subject_code, language_code)
    st.markdown("---")
    st.subheader("📦 Collection Information")
    st.code(f"Collection Name: {collection_name}", language="text")
    
    # Show existing collections
    try:
        collections_response = asyncio.run(asyncio.to_thread(QDRANT_CLIENT.get_collections))
        existing_collections = [c.name for c in collections_response.collections]
        
        if collection_name in existing_collections:
            st.warning(f"⚠️ Collection '{collection_name}' already exists. New documents will be added to it.")
        else:
            st.info(f"ℹ️ New collection '{collection_name}' will be created.")
    except Exception as e:
        st.warning(f"Could not check existing collections: {e}")

# Process button
if uploaded_file and grade and subject_code:
    st.markdown("---")
    
    if st.button("🚀 Process and Store Book", type="primary", use_container_width=True):
        try:
            # Create a simple UploadFile-like wrapper for Streamlit files
            class StreamlitUploadFile:
                def __init__(self, streamlit_file):
                    self.filename = streamlit_file.name
                    self._content = streamlit_file.read()
                    streamlit_file.seek(0)  # Reset for potential reuse
                
                async def read(self):
                    return self._content
            
            # Create wrapper
            file_obj = StreamlitUploadFile(uploaded_file)
            
            # Process the file (async)
            async def process_and_store():
                # Process the file
                processed_docs = await process_knowledge_base_files([file_obj])
                
                if not processed_docs:
                    return False, "Failed to extract text from the file. Please check the file format.", 0
                
                # Store documents
                success, message = await store_documents_in_collection(
                    collection_name=collection_name,
                    documents=processed_docs
                )
                
                return success, message, len(processed_docs)
            
            # Run async function
            with st.spinner("📖 Processing book and generating embeddings..."):
                result = asyncio.run(process_and_store())
            
            if isinstance(result, tuple) and len(result) == 3:
                success, message, doc_count = result
                if success:
                    st.success(f"✅ Extracted text from {doc_count} document(s)")
                    st.success(message)
                    st.balloons()
                else:
                    st.error(message)
            else:
                st.error("❌ Unexpected error during processing")
                    
        except Exception as e:
            st.error(f"❌ Error processing file: {e}")
            import traceback
            st.code(traceback.format_exc(), language="python")

# Display existing collections
st.markdown("---")
st.subheader("📚 Existing Collections")

try:
    collections_response = asyncio.run(asyncio.to_thread(QDRANT_CLIENT.get_collections))
    existing_collections = [c.name for c in collections_response.collections]
    
    # Filter KB collections
    kb_collections = [c for c in existing_collections if c.startswith("kb_")]
    
    if kb_collections:
        st.info(f"Found {len(kb_collections)} knowledge base collection(s):")
        for coll in sorted(kb_collections):
            st.code(coll, language="text")
    else:
        st.info("No knowledge base collections found yet.")
        
except Exception as e:
    st.warning(f"Could not retrieve collections: {e}")

