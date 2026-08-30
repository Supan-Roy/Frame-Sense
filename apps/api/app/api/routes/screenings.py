import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.screening import ScreeningCreate, ScreeningResponse, ScreeningStats
from app.screening.repository import screening_repo
from app.media.storage import storage_backend
from app.database.clickhouse import get_screening_stats

router = APIRouter()

@router.get("", response_model=List[ScreeningResponse])
def list_screenings():
    records = screening_repo.get_all()
    # Add absolute share_url format for frontend clipboard use
    response = []
    for r in records:
        response.append(ScreeningResponse(
            **r,
            share_url=f"/screening/{r['public_token']}"
        ))
    return response

@router.post("", response_model=ScreeningResponse)
def create_screening(payload: ScreeningCreate):
    screening_id = f"sc_{uuid.uuid4().hex[:12]}"
    media_id = f"med_{uuid.uuid4().hex[:12]}"
    
    record = screening_repo.create(
        screening_id=screening_id,
        media_id=media_id,
        title=payload.title,
        media_filename=payload.media_filename,
        media_duration=payload.media_duration,
        description=payload.description
    )
    
    return ScreeningResponse(
        **record,
        share_url=f"/screening/{record['public_token']}"
    )

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    try:
        unique_filename = await storage_backend.upload_file(file)
        media_id = f"med_{uuid.uuid4().hex[:12]}"
        return {
            "media_id": media_id,
            "media_filename": unique_filename
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{screening_id}/stats", response_model=ScreeningStats)
def get_stats(screening_id: str):
    # Verify screening exists
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
        
    try:
        stats = get_screening_stats(screening_id)
        return ScreeningStats(
            total_sessions=stats.get("total_sessions", 0),
            unique_viewers=stats.get("unique_viewers", 0),
            total_events=stats.get("total_events", 0),
            completed_sessions=stats.get("completed_sessions", 0),
            event_breakdown=stats.get("event_breakdown", {})
        )
    except Exception as e:
        # Fallback to zero stats if ClickHouse isn't populated or throws error
        return ScreeningStats(
            total_sessions=0,
            unique_viewers=0,
            total_events=0,
            completed_sessions=0,
            event_breakdown={}
        )
