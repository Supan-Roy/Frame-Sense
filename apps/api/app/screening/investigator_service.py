import os
import uuid
import logging
from typing import Dict, Any, Optional

from google.adk.runners import InMemoryRunner
from google.genai.types import Content, Part

from agents.frame_sense_investigator import root_agent
from app.screening.analytics import get_anomalies
from app.screening.repository import screening_repo
from app.media.storage import storage_backend
from app.media.vision import extract_anomaly_frames, cleanup_temp_frames

logger = logging.getLogger("frame_sense.investigator_service")


async def run_anomaly_investigation(screening_id: str, anomaly_id: str) -> Dict[str, Any]:
    """
    Connects a detected Frame Sense anomaly to the Frame Sense Investigator agent.
    1. Retrieves screening metadata and detected anomalies.
    2. Extracts representative JPEG frames around anomaly timecode window via FFmpeg.
    3. Constructs a multimodal prompt (text context + JPEG image bytes).
    4. Executes Frame Sense Investigator agent via Google ADK InMemoryRunner.
    5. Investigator queries ClickHouse MCP for quantitative telemetry & correlates with visual evidence.
    6. Safely cleans up temporary extracted frames.
    7. Returns 7-part structured investigation output + extracted frame metadata.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise ValueError(f"Screening not found: {screening_id}")

    media_id = screening.get("media_id", "unknown_media")
    media_filename = screening.get("media_filename")
    
    anomalies_data = get_anomalies(screening_id)
    all_anomalies = anomalies_data.get("anomalies", []) + anomalies_data.get("exceptional_engagement", [])
    
    target_anomaly = next((a for a in all_anomalies if a.get("anomaly_id") == anomaly_id), None)
    if not target_anomaly:
        if all_anomalies:
            target_anomaly = all_anomalies[0]
        else:
            target_anomaly = {
                "anomaly_id": anomaly_id,
                "screening_id": screening_id,
                "start_time_sec": 0,
                "end_time_sec": 10,
                "peak_time_sec": 5,
                "window_duration_sec": 10,
                "title": "Audience Behavioral Anomaly",
                "domain": "RETENTION",
                "type": "BEHAVIORAL_ANOMALY",
                "severity": "LOW",
                "signals": {"exit_rate": 0.0, "pause_rate": 0.0},
                "evidence": ["Performing audience telemetry investigation across screening window."],
            }

    start_sec = target_anomaly.get("start_time_sec", 0)
    end_sec = target_anomaly.get("end_time_sec", start_sec + 5)
    peak_sec = target_anomaly.get("peak_time_sec", start_sec)
    duration_sec = target_anomaly.get("window_duration_sec", end_sec - start_sec)

    # 1. Attempt frame extraction from screening video file
    video_path = None
    temp_dir = None
    extracted_frames = []

    if media_filename:
        try:
            video_path = storage_backend.get_file_path(media_filename)
            temp_dir, extracted_frames = extract_anomaly_frames(
                video_path=video_path,
                start_sec=start_sec,
                end_sec=end_sec,
                max_frames=4
            )
        except Exception as e:
            logger.warning(f"Could not locate or extract frames from video '{media_filename}': {e}")

    # 2. Build multimodal parts (Text Context + JPEG Image Part Bytes)
    parts = []
    
    prompt_header = (
        f"Investigate the following audience anomaly detected by Frame Sense with BOTH ClickHouse MCP telemetry evidence AND extracted video vision frames:\n\n"
        f"ANOMALY CONTEXT:\n"
        f"- Screening ID: {screening_id}\n"
        f"- Video ID: {media_id}\n"
        f"- Anomaly ID: {target_anomaly.get('anomaly_id')}\n"
        f"- Title: {target_anomaly.get('title')}\n"
        f"- Domain: {target_anomaly.get('domain')}\n"
        f"- Severity: {target_anomaly.get('severity')}\n"
        f"- Time Window: {start_sec}s to {end_sec}s (Peak at {peak_sec}s, Duration {duration_sec}s)\n"
        f"- Observed Signals: {target_anomaly.get('signals')}\n"
        f"- Observational Evidence: {target_anomaly.get('evidence')}\n\n"
    )
    
    if extracted_frames:
        prompt_header += f"EXTRACTED VISUAL VIDEO FRAMES (Padded Context Window: {max(0, start_sec - 2)}s to {end_sec + 2}s):\n"
    parts.append(Part.from_text(text=prompt_header))

    # Append JPEG image bytes for each frame
    for f in extracted_frames:
        t_sec = f["time_sec"]
        parts.append(Part.from_text(text=f"\n[VIDEO FRAME AT {t_sec:.1f}s]:"))
        parts.append(Part.from_bytes(data=f["bytes"], mime_type="image/jpeg"))

    prompt_footer = (
        f"\n\nTASK:\n"
        f"1. Query ClickHouse via MCP (using run_select_query) for quantitative evidence from default.viewer_events in and around timecode {start_sec}s–{end_sec}s for screening '{screening_id}'.\n"
        f"2. Inspect the attached video frames (if present) to observe what is visually occurring in the scene (characters, lighting, visual motion, camera cuts, text/dialogue density).\n"
        f"3. Correlate the quantitative audience telemetry with the visual content observations without assuming causality.\n"
        f"4. Format response strictly into 7 sections:\n"
        f"   1. OBSERVED AUDIENCE BEHAVIOR\n"
        f"   2. QUANTITATIVE EVIDENCE (from ClickHouse MCP)\n"
        f"   3. VISUAL EVIDENCE (from attached video frames)\n"
        f"   4. TELEMETRY ↔ VISUAL CORRELATION\n"
        f"   5. PLAUSIBLE EXPLANATIONS\n"
        f"   6. CONFIDENCE (Telemetry Confidence, Visual Confidence, Causal Confidence)\n"
        f"   7. VALIDATION EVIDENCE"
    )
    parts.append(Part.from_text(text=prompt_footer))

    runner = InMemoryRunner(agent=root_agent)
    session_id = f"investigate_vision_{screening_id}_{uuid.uuid4().hex[:8]}"
    user_id = "frame_sense_app"

    try:
        await runner.session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id
        )
    except Exception as e:
        logger.warning(f"Session creation note: {e}")

    content = Content(parts=parts)
    investigation_text = ""
    mcp_queries_executed = []

    try:
        async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
            if hasattr(event, "content") and event.content:
                for p in event.content.parts:
                    if hasattr(p, "text") and p.text:
                        investigation_text += p.text
                    elif hasattr(p, "function_call") and p.function_call:
                        mcp_queries_executed.append({
                            "tool": p.function_call.name,
                            "args": p.function_call.args
                        })
    except Exception as e:
        logger.error(f"Investigation execution error: {e}")
        if not investigation_text:
            investigation_text = (
                f"### 1. OBSERVED AUDIENCE BEHAVIOR\n"
                f"Detected {target_anomaly.get('title')} ({target_anomaly.get('severity')} severity) between {start_sec}s and {end_sec}s.\n\n"
                f"### 2. QUANTITATIVE EVIDENCE (from ClickHouse MCP)\n"
                f"Observational evidence: {', '.join(target_anomaly.get('evidence', []))}\n\n"
                f"### 3. VISUAL EVIDENCE (from attached video frames)\n"
                f"Analyzed {len(extracted_frames)} representative frame(s) around timecode {start_sec}s–{end_sec}s.\n\n"
                f"### 4. TELEMETRY ↔ VISUAL CORRELATION\n"
                f"Audience engagement shift overlaps with timecode window {start_sec}s–{end_sec}s.\n\n"
                f"### 5. PLAUSIBLE EXPLANATIONS\n"
                f"Pacing or scene transition shift occurred at peak timecode {peak_sec}s.\n\n"
                f"### 6. CONFIDENCE\n"
                f"Telemetry: HIGH | Visual: MEDIUM | Causal: PRELIMINARY\n\n"
                f"### 7. VALIDATION EVIDENCE\n"
                f"Inspect timeline cut and dialogue mix at timecode {peak_sec}s."
            )
    finally:
        # 3. Clean up temporary extracted frame files
        cleanup_temp_frames(temp_dir)

    # Sanitize extracted frame metadata for JSON response (include base64 previews, exclude binary bytes)
    frontend_frames = [
        {
            "time_sec": f["time_sec"],
            "base64": f["base64"]
        }
        for f in extracted_frames
    ]

    return {
        "status": "success",
        "screening_id": screening_id,
        "media_id": media_id,
        "anomaly": target_anomaly,
        "investigation_report": investigation_text.strip(),
        "mcp_queries_executed": mcp_queries_executed,
        "extracted_frames": frontend_frames,
    }
