from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas.telemetry import ViewerEventBatch
from app.screening.repository import screening_repo
from app.database.clickhouse import insert_events

router = APIRouter()

@router.post("/events/batch")
def ingest_telemetry_batch(payload: ViewerEventBatch):
    if not payload.events:
        return {"status": "success", "processed": 0}
        
    # Get current server timestamp
    server_time = datetime.now(timezone.utc)
    
    # Cache validated screening lookups to optimize batch insertion
    screening_cache = {}
    
    validated_events = []
    for event in payload.events:
        # Validate screening exists
        screening_id = event.screening_id
        if screening_id not in screening_cache:
            screening = screening_repo.get_by_id(screening_id)
            if not screening:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid screening context: {screening_id}"
                )
            screening_cache[screening_id] = True
            
        # Ensure server timestamp is stamped
        event_dict = event.model_dump()
        event_dict["server_timestamp"] = server_time
        
        validated_events.append(event_dict)
        
    try:
        insert_events(validated_events)
        return {"status": "success", "processed": len(validated_events)}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ClickHouse Ingestion Failed: {str(e)}"
        )
