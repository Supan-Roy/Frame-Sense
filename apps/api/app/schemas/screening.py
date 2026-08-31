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


class CommentCreate(BaseModel):
    viewer_id: str
    display_name: str
    video_timecode_sec: float = 0.0
    content: str


class CommentUpdate(BaseModel):
    viewer_id: str
    content: str


class CommentResponse(BaseModel):
    comment_id: str
    screening_id: str
    viewer_id: str
    display_name: str
    video_timecode_sec: float
    content: str
    created_at: str
    updated_at: str
