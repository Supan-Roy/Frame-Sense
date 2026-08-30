from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.screening.repository import screening_repo
from app.media.storage import storage_backend

router = APIRouter()

@router.get("/{public_token}")
def get_public_screening(public_token: str):
    record = screening_repo.get_by_token(public_token)
    if not record or record["status"] != "active":
        raise HTTPException(status_code=404, detail="Screening not found or inactive")
    return {
        "screening_id": record["screening_id"],
        "media_id": record["media_id"],
        "title": record["title"],
        "description": record["description"],
        "media_duration": record["media_duration"],
        "created_at": record["created_at"]
    }

@router.get("/{public_token}/media")
def stream_screening_media(public_token: str):
    record = screening_repo.get_by_token(public_token)
    if not record or record["status"] != "active":
        raise HTTPException(status_code=404, detail="Screening not found or inactive")
        
    try:
        file_path = storage_backend.get_file_path(record["media_filename"])
        # Fast API's FileResponse naturally handles range seeks on local files
        return FileResponse(file_path, media_type="video/mp4")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
