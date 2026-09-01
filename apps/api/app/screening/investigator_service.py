import os
import uuid
import logging
from typing import Dict, Any, Optional

from google.adk.runners import InMemoryRunner
from google.genai.types import Content, Part

from agents.frame_sense_investigator import root_agent
from app.screening.analytics import get_anomalies
from app.screening.repository import screening_repo

logger = logging.getLogger("frame_sense.investigator_service")


async def run_anomaly_investigation(screening_id: str, anomaly_id: str) -> Dict[str, Any]:
    """
    Connects a detected Frame Sense anomaly to the Frame Sense Investigator agent.
    1. Retrieves screening metadata and detected anomalies.
    2. Constructs a rich anomaly context prompt.
    3. Executes the Frame Sense Investigator agent via Google ADK InMemoryRunner.
    4. Investigator queries ClickHouse MCP for quantitative telemetry evidence.
    5. Returns structured investigation output.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise ValueError(f"Screening not found: {screening_id}")

    media_id = screening.get("media_id", "unknown_media")
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

    prompt_text = (
        f"Investigate the following audience anomaly detected by Frame Sense:\n\n"
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
        f"TASK:\n"
        f"1. Query ClickHouse via MCP (using run_select_query) for quantitative evidence from default.viewer_events in and around timecode {start_sec}s–{end_sec}s for screening '{screening_id}'.\n"
        f"2. Count event distribution (pauses, rewinds, skips, replays, exits) in the anomalous window versus surrounding baseline activity.\n"
        f"3. Determine what audience behavior actually occurred.\n"
        f"4. State plausible explanations, confidence, and validation evidence.\n\n"
        f"Format your response with clear sections:\n"
        f"1. Observed audience behavior\n"
        f"2. Quantitative evidence\n"
        f"3. Plausible explanations\n"
        f"4. Confidence\n"
        f"5. Evidence that would help validate the explanation"
    )

    runner = InMemoryRunner(agent=root_agent)
    session_id = f"investigate_{screening_id}_{uuid.uuid4().hex[:8]}"
    user_id = "frame_sense_app"

    try:
        await runner.session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id
        )
    except Exception as e:
        logger.warning(f"Session creation note: {e}")

    content = Content(parts=[Part.from_text(text=prompt_text)])
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
                f"### OBSERVED AUDIENCE BEHAVIOR\n"
                f"Detected {target_anomaly.get('title')} ({target_anomaly.get('severity')} severity) between {start_sec}s and {end_sec}s.\n\n"
                f"### QUANTITATIVE EVIDENCE\n"
                f"Observational evidence: {', '.join(target_anomaly.get('evidence', []))}\n\n"
                f"### PLAUSIBLE EXPLANATIONS\n"
                f"Audience engagement shift occurred at peak timecode {peak_sec}s.\n\n"
                f"### CONFIDENCE\n"
                f"PRELIMINARY (Automated analysis: {e})\n\n"
                f"### VALIDATION EVIDENCE\n"
                f"Gather additional viewer telemetry events across full screening timeline."
            )

    return {
        "status": "success",
        "screening_id": screening_id,
        "media_id": media_id,
        "anomaly": target_anomaly,
        "investigation_report": investigation_text.strip(),
        "mcp_queries_executed": mcp_queries_executed,
    }
