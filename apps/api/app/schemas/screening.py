from pydantic import BaseModel
from typing import List, Dict, Any

class ScreeningCreate(BaseModel):
    title: str
    media_filename: str
    media_duration: float  # in seconds
    description: str | None = None

class ScreeningResponse(BaseModel):
    screening_id: str
    media_id: str
    title: str
    description: str | None = None
    media_filename: str
    media_duration: float
    created_at: str
    status: str
    public_token: str
    share_url: str

class ScreeningStats(BaseModel):
    total_sessions: int
    unique_viewers: int
    total_events: int
    completed_sessions: int
    event_breakdown: Dict[str, int]
