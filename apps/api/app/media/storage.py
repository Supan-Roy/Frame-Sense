import os
import shutil
import uuid
from abc import ABC, abstractmethod
from fastapi import UploadFile, HTTPException

ALLOWED_EXTENSIONS = {"mp4", "webm", "mov"}
MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024  # 150 MB

class BaseStorage(ABC):
    @abstractmethod
    async def upload_file(self, file: UploadFile) -> str:
        """Upload a file to storage and return a unique file path or ID."""
        pass

    @abstractmethod
    def get_file_path(self, filename: str) -> str:
        """Get the absolute filepath of the media file."""
        pass

    @abstractmethod
    def delete_file(self, filename: str) -> None:
        """Permanently delete a file from storage."""
        pass

class LocalStorage(BaseStorage):
    def __init__(self, base_dir: str = "data/media"):
        self.base_dir = os.path.abspath(base_dir)
        # Ensure target directory exists
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload_file(self, file: UploadFile) -> str:
        # 1. Validate extension
        filename = file.filename or ""
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # 2. Prevent path traversal
        safe_filename = os.path.basename(filename)
        
        # 3. Create unique filename to prevent collision
        unique_id = str(uuid.uuid4())
        unique_filename = f"{unique_id}_{safe_filename}"
        target_path = os.path.join(self.base_dir, unique_filename)

        # 4. Stream and write with size limit checking
        size = 0
        try:
            with open(target_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):  # 1MB chunk
                    size += len(chunk)
                    if size > MAX_FILE_SIZE_BYTES:
                        # Clean up partial file
                        buffer.close()
                        os.remove(target_path)
                        raise HTTPException(
                            status_code=400,
                            detail=f"File exceeds maximum allowed size ({MAX_FILE_SIZE_BYTES / (1024*1024)}MB)."
                        )
                    buffer.write(chunk)
        except Exception as e:
            if os.path.exists(target_path):
                os.remove(target_path)
            raise e

        return unique_filename

    def get_file_path(self, filename: str) -> str:
        # Prevent traversal in filepath requests
        safe_filename = os.path.basename(filename)
        target_path = os.path.join(self.base_dir, safe_filename)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail="File not found")
        return target_path

    def delete_file(self, filename: str) -> None:
        safe_filename = os.path.basename(filename)
        target_path = os.path.join(self.base_dir, safe_filename)
        if os.path.exists(target_path):
            os.remove(target_path)

# Export a default instance
storage_backend = LocalStorage()
