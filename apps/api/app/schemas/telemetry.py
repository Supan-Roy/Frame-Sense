from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
import uuid

ALLOWED_EVENT_TYPES = {
    "PLAY", "PAUSE", "SEEK_FORWARD", "SEEK_BACKWARD", "REPLAY",
    "PROGRESS", "VOLUME_CHANGE", "TAB_HIDDEN", "TAB_VISIBLE",
    "COMPLETE", "EXIT"
}

class ViewerEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    screening_id: str
    session_id: str
    anonymous_viewer_id: str
    video_id: str
    event_type: str
    video_timecode_sec: float
    client_timestamp: datetime
    server_timestamp: Optional[datetime] = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        upper_v = v.upper()
        if upper_v not in ALLOWED_EVENT_TYPES:
            raise ValueError(f"Invalid event_type: {v}. Allowed: {', '.join(ALLOWED_EVENT_TYPES)}")
        return upper_v

class ViewerEventBatch(BaseModel):
    events: List[ViewerEvent]
