import uuid
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from app.schemas.screening import (
    ScreeningCreate,
    ScreeningResponse,
    ScreeningStats,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
)
from app.screening.repository import screening_repo
from app.media.storage import storage_backend
from app.database.clickhouse import get_screening_stats

router = APIRouter()

@router.get("/dashboard/stats")
def get_dashboard_stats():
    screenings_list = screening_repo.get_all()
    total_screenings = len(screenings_list)
    
    from app.database.clickhouse import get_global_stats
    db_stats = get_global_stats()
    
    return {
        "active_projects": total_screenings,
        "total_sessions": db_stats["total_sessions"],
        "total_events": db_stats["total_events"],
        "unique_viewers": db_stats["total_viewers"]
    }

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

@router.delete("/{screening_id}")
def delete_screening(screening_id: str):
    # 1. Fetch metadata record to get the media filename
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")

    # 2. Delete media file from disk
    try:
        storage_backend.delete_file(screening["media_filename"])
    except Exception as e:
        print(f"Warning: Failed to delete media file: {e}")

    # 3. Delete telemetry events from ClickHouse
    try:
        from app.database.clickhouse import delete_screening_events
        delete_screening_events(screening_id)
    except Exception as e:
        print(f"Warning: Failed to delete ClickHouse events: {e}")

    # 4. Delete metadata from SQLite
    deleted = screening_repo.delete(screening_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete screening metadata")

    return {"status": "success", "message": "Screening deleted successfully"}


# ---------------------------------------------------------------------------
# Audience Intelligence endpoints
# ---------------------------------------------------------------------------

@router.get("/{screening_id}/audience/overview")
def audience_overview(screening_id: str):
    """High-level audience statistics: viewers, sessions, events, completion rate, reliability."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.analytics import get_audience_overview
        return get_audience_overview(screening_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {e}")


@router.get("/{screening_id}/audience/retention")
def audience_retention(
    screening_id: str,
    bucket_sec: int = Query(default=1, ge=1, le=60, description="Time bucket size in seconds"),
):
    """Viewer retention curve: how many viewers remain at each point in the video."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.analytics import get_retention_curve
        return get_retention_curve(screening_id, bucket_sec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {e}")


@router.get("/{screening_id}/audience/signals")
def audience_signals(
    screening_id: str,
    bucket_sec: int = Query(default=1, ge=1, le=60, description="Time bucket size in seconds"),
):
    """Per-time-bucket behavioral signal breakdown (pause, rewind, skip, replay, exit rates)."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.analytics import get_behavioral_signals
        return get_behavioral_signals(screening_id, bucket_sec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {e}")


@router.get("/{screening_id}/video")
def stream_screening_video(screening_id: str):
    """Streams the video file for a screening directly by screening_id."""
    record = screening_repo.get_by_id(screening_id)
    if not record:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        file_path = storage_backend.get_file_path(record["media_filename"])
        return FileResponse(
            file_path,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
            }
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{screening_id}/audience/anomalies")
def audience_anomalies(
    screening_id: str,
    bucket_sec: int = Query(default=2, ge=1, le=60, description="Time bucket size in seconds"),
):
    """
    Detect statistically unusual audience behavior using z-score baseline comparison.
    Returns behavioral anomalies and exceptional engagement moments.
    Evidence strings are observational ONLY - no semantic interpretation.
    Designed for future Gemini agent consumption.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.analytics import get_anomalies
        return get_anomalies(screening_id, bucket_sec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {e}")


@router.post("/{screening_id}/audience/anomalies/{anomaly_id}/investigate")
async def investigate_screening_anomaly(screening_id: str, anomaly_id: str):
    """
    Executes the Frame Sense Investigator agent via ClickHouse Cloud MCP & FFmpeg Vision to analyze a detected anomaly.
    Persists findings into SQLite and returns structured response.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.investigator_service import run_anomaly_investigation
        return await run_anomaly_investigation(screening_id, anomaly_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investigation error: {e}")


@router.get("/{screening_id}/audience/anomalies/investigations")
def get_screening_investigations(screening_id: str):
    """
    Returns all preserved AI investigation findings for a screening.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        return screening_repo.get_all_investigations(screening_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch investigations: {e}")


@router.delete("/{screening_id}/audience/anomalies/{anomaly_id}/investigate")
def delete_screening_anomaly_investigation(screening_id: str, anomaly_id: str):
    """
    Manually deletes a preserved AI investigation finding for an anomaly.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.investigator_service import delete_anomaly_investigation
        deleted = delete_anomaly_investigation(screening_id, anomaly_id)
        return {"status": "success", "deleted": deleted, "anomaly_id": anomaly_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete investigation: {e}")


@router.post("/{screening_id}/audience/anomalies/{anomaly_id}/elaborate")
async def elaborate_screening_anomaly(screening_id: str, anomaly_id: str):
    """
    Calls Gemini API to elaborate on investigation findings and suggest actionable creative edit recommendations.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.investigator_service import run_elaborated_investigation
        return await run_elaborated_investigation(screening_id, anomaly_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Elaboration error: {e}")


# --- Sense AI Interactive Chat Endpoints ---

class CreateChatSessionRequest(BaseModel):
    title: Optional[str] = "New Chat Session"


class SendChatMessageRequest(BaseModel):
    prompt: str


@router.get("/{screening_id}/chat/sessions")
def get_screening_chat_sessions(screening_id: str):
    """Returns all Sense AI chat sessions for a screening."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    return screening_repo.get_chat_sessions(screening_id)


@router.post("/{screening_id}/chat/sessions")
def create_screening_chat_session(screening_id: str, body: CreateChatSessionRequest):
    """Creates a new Sense AI chat session for a screening."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    return screening_repo.create_chat_session(screening_id, title=body.title or "New Chat Session")


@router.delete("/{screening_id}/chat/sessions/{session_id}")
def delete_screening_chat_session(screening_id: str, session_id: str):
    """Deletes a chat session and its message history."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    deleted = screening_repo.delete_chat_session(session_id)
    return {"status": "success", "deleted": deleted, "session_id": session_id}


@router.get("/{screening_id}/chat/sessions/{session_id}/messages")
def get_screening_chat_messages(screening_id: str, session_id: str):
    """Returns all messages for a Sense AI chat session."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    return screening_repo.get_chat_messages(session_id)


@router.post("/{screening_id}/chat/sessions/{session_id}/messages")
async def send_screening_chat_message(screening_id: str, session_id: str, body: SendChatMessageRequest):
    """Sends a user prompt to Sense AI agent (ClickHouse MCP + Vision + Search) and returns complete response."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.chat_service import run_sense_ai_chat
        return await run_sense_ai_chat(screening_id, session_id, body.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sense AI Chat Error: {e}")


@router.post("/{screening_id}/chat/sessions/{session_id}/messages/stream")
async def send_screening_chat_message_stream(screening_id: str, session_id: str, body: SendChatMessageRequest):
    """Streams a user prompt to Sense AI agent via SSE real-time token chunks."""
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.chat_service import stream_sense_ai_chat
        return StreamingResponse(
            stream_sense_ai_chat(screening_id, session_id, body.prompt),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sense AI Chat Stream Error: {e}")




@router.delete("/{screening_id}/audience")
def reset_screening_audience_data(screening_id: str):
    """
    Clears all audience telemetry events for a screening from ClickHouse and
    purges all preserved AI investigation findings for that screening.
    Resets Audience Intelligence metrics and Editorial Findings back to zero.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.database.clickhouse import delete_screening_events
        delete_screening_events(screening_id)
        from app.screening.investigator_service import delete_all_screening_investigations
        delete_all_screening_investigations(screening_id)
        return {
            "status": "success",
            "message": f"All audience telemetry and saved investigation findings for screening {screening_id} have been reset.",
            "screening_id": screening_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset error: {e}")


@router.post("/{screening_id}/audience/rollback")
def rollback_screening_audience_batch(screening_id: str):
    """
    Rolls back the most recent audience telemetry run/batch for a screening.
    Deletes events generated in the latest simulation run or viewer cluster,
    restoring telemetry to its state prior to that run.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.database.clickhouse import rollback_last_batch
        from app.screening.investigator_service import delete_all_screening_investigations
        delete_all_screening_investigations(screening_id)
        return rollback_last_batch(screening_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rollback error: {e}")


@router.get("/{screening_id}/audience/fingerprint")
def get_screening_audience_fingerprint(screening_id: str, bucket_sec: int = Query(default=10, ge=1, le=60)):
    """
    Extracts the aggregate behavioral fingerprint derived from actual real viewer telemetry.
    Returns bucketed probabilities for pause, rewind, skip, replay, and exit activity.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.analytics import build_behavioral_fingerprint
        return build_behavioral_fingerprint(screening_id, bucket_sec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fingerprint extraction error: {e}")


# ---------------------------------------------------------------------------
# Developer / Demo simulator endpoint (ISOLATED - not part of public API)
# ---------------------------------------------------------------------------

@router.post("/{screening_id}/dev/simulate")
def dev_simulate(
    screening_id: str,
    num_viewers: int = Query(default=100, ge=1, le=100000, description="Number of synthetic viewers"),
    mode: str = Query(default="AUTO", description="Simulation mode: AUTO, EXACT_REPLAY, REAL_ANCHORED, HYBRID, COLD_START"),
    variation: str = Query(default="MEDIUM", description="Controlled variation strength: LOW, MEDIUM, HIGH"),
    inject_ground_truth: bool = Query(default=False, description="Inject synthetic demo ground truth windows"),
    seed: Optional[int] = Query(default=None, description="Random seed for reproducibility"),
):
    """
    [DEVELOPER / DEMO TOOL ONLY]

    Generates real-anchored synthetic viewer telemetry for a screening and inserts it directly
    into ClickHouse using the exact same ViewerEvent contract as real browser telemetry.

    Modes:
      - COLD_START     (0 real viewers)  - Generic probabilistic model & ground-truth.
      - HYBRID         (1-9 real viewers) - Blends observed real fingerprint with generic priors.
      - REAL_ANCHORED  (10+ real viewers) - Derives time-local probabilities from actual screening telemetry.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")
    try:
        from app.screening.simulator import run_simulation
        from app.screening.investigator_service import delete_all_screening_investigations
        delete_all_screening_investigations(screening_id)
        result = run_simulation(
            screening_id=screening_id,
            video_id=screening["media_id"],
            duration=float(screening["media_duration"]),
            num_viewers=num_viewers,
            mode=mode,
            variation_strength=variation,
            inject_ground_truth=inject_ground_truth,
            seed=seed,
        )
        return {
            "status": "success",
            "tool": "real_anchored_synthetic_audience_generator",
            "note": "Developer/demo tool only. Not part of normal screening workflow.",
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulator error: {e}")


# ---------------------------------------------------------------------------
# Comment / Feedback Endpoints (Screening Room & Studio Admin)
# ---------------------------------------------------------------------------

def _resolve_screening(identifier: str):
    """Resolves screening by screening_id or public_token."""
    record = screening_repo.get_by_id(identifier)
    if not record:
        record = screening_repo.get_by_token(identifier)
    if not record:
        raise HTTPException(status_code=404, detail="Screening room not found.")
    return record


@router.post("/{identifier}/comments", response_model=CommentResponse)
def add_screening_comment(identifier: str, payload: CommentCreate):
    """Submits a new timecode-anchored comment for a screening."""
    screening = _resolve_screening(identifier)
    try:
        return screening_repo.add_comment(
            screening_id=screening["screening_id"],
            viewer_id=payload.viewer_id,
            display_name=payload.display_name,
            video_timecode_sec=payload.video_timecode_sec,
            content=payload.content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit comment: {e}")


@router.get("/{identifier}/comments", response_model=List[CommentResponse])
def get_screening_comments(
    identifier: str,
    viewer_id: Optional[str] = Query(default=None, description="Optional viewer ID filter")
):
    """Fetches audience comments for a screening. If viewer_id is provided, filters to that viewer's comments only."""
    screening = _resolve_screening(identifier)
    try:
        comments = screening_repo.get_comments_by_screening(screening["screening_id"])
        if viewer_id:
            comments = [c for c in comments if c["viewer_id"] == viewer_id]
        return comments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch comments: {e}")


@router.put("/comments/{comment_id}", response_model=CommentResponse)
def edit_screening_comment(comment_id: str, payload: CommentUpdate):
    """Edits an existing comment (author validation via viewer_id)."""
    try:
        updated = screening_repo.update_comment(
            comment_id=comment_id,
            viewer_id=payload.viewer_id,
            content=payload.content,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Comment not found.")
        return updated
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to edit comment: {e}")


@router.delete("/comments/{comment_id}")
def delete_screening_comment(
    comment_id: str,
    viewer_id: Optional[str] = Query(default=None, description="Viewer ID for author validation"),
    is_admin: bool = Query(default=False, description="Admin override flag"),
):
    """Deletes a comment (restricted to author viewer_id or studio admin)."""
    try:
        success = screening_repo.delete_comment(
            comment_id=comment_id,
            viewer_id=viewer_id,
            is_admin=is_admin,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found.")
        return {"status": "success", "message": "Comment deleted successfully."}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {e}")

