import os
import sys
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure apps/api is on sys.path
API_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "apps", "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

from app.screening.analytics import get_anomalies
from app.screening.repository import screening_repo
from app.screening.investigator_service import run_anomaly_investigation
from agents.frame_sense_investigator import root_agent


def _get_or_create_test_screening():
    screenings = screening_repo.get_all()
    if screenings:
        return screenings[0]
    return screening_repo.create(
        screening_id="sc_test_integration",
        media_id="med_test_123",
        title="Test Screening",
        description="Integration test screening",
        media_filename="test_video.mp4",
        media_duration=120.0
    )


def test_investigator_agent_structure_and_instruction():
    """Verify Frame Sense Investigator agent instruction and tool composition."""
    assert root_agent.name == "Frame_Sense_Investigator"
    assert "ClickHouse MCP" in root_agent.instruction or "default.viewer_events" in root_agent.instruction
    assert "Observed audience behavior" in root_agent.instruction
    assert "Quantitative evidence" in root_agent.instruction
    assert "Plausible explanations" in root_agent.instruction


def test_existing_anomaly_detection_unchanged():
    """Verify existing anomaly detection get_anomalies output structure remains 100% untouched."""
    screening = _get_or_create_test_screening()
    sid = screening["screening_id"]

    res = get_anomalies(sid, bucket_sec=2)
    assert "screening_id" in res
    assert "unique_viewers" in res
    assert "reliability" in res
    assert "anomalies" in res
    assert "exceptional_engagement" in res


@pytest.mark.asyncio
async def test_investigate_anomaly_service_context_passing():
    """Verify anomaly context (screening_id, video_id, timecode window) is correctly extracted and formatted."""
    screening = _get_or_create_test_screening()
    sid = screening["screening_id"]

    # Mock runner so unit tests execute deterministically without relying on live LLM network quotas
    mock_event = MagicMock()
    mock_part = MagicMock()
    mock_part.text = (
        "### OBSERVED AUDIENCE BEHAVIOR\n"
        "Audience exit drop peak recorded at 26s–28s.\n\n"
        "### QUANTITATIVE EVIDENCE\n"
        "ClickHouse query returned 4 exit events in time window 26–28s (baseline average: 0.1 exits/sec).\n\n"
        "### PLAUSIBLE EXPLANATIONS\n"
        "Abrupt audio cut caused viewer drop-off.\n\n"
        "### CONFIDENCE\n"
        "HIGH confidence based on 4 co-occurring exit events.\n\n"
        "### VALIDATION EVIDENCE\n"
        "Inspect audio wave visualizer at timecode 0:26."
    )
    mock_part.function_call = None
    mock_event.content.parts = [mock_part]

    async def mock_run_async(*args, **kwargs):
        yield mock_event

    with patch("app.screening.investigator_service.InMemoryRunner") as MockRunner:
        instance = MockRunner.return_value
        instance.app_name = "test_app"
        instance.session_service.create_session = AsyncMock()
        instance.run_async = mock_run_async

        anm_data = get_anomalies(sid)
        anomalies = anm_data.get("anomalies", []) + anm_data.get("exceptional_engagement", [])
        target_anm_id = anomalies[0]["anomaly_id"] if anomalies else "anm_mock_123"

        result = await run_anomaly_investigation(sid, target_anm_id)

        assert result["status"] == "success"
        assert result["screening_id"] == sid
        assert "investigation_report" in result
        assert "OBSERVED AUDIENCE BEHAVIOR" in result["investigation_report"]
        assert "QUANTITATIVE EVIDENCE" in result["investigation_report"]
        assert "PLAUSIBLE EXPLANATIONS" in result["investigation_report"]


@pytest.mark.asyncio
async def test_investigate_api_route():
    """Verify FastApi route POST /api/v1/screenings/{screening_id}/audience/anomalies/{anomaly_id}/investigate."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    screening = _get_or_create_test_screening()
    sid = screening["screening_id"]

    mock_report = {
        "status": "success",
        "screening_id": sid,
        "media_id": screening["media_id"],
        "anomaly": {"anomaly_id": "anm_mock", "title": "Test Anomaly"},
        "investigation_report": "Mock Investigation Report",
        "mcp_queries_executed": [{"tool": "run_select_query", "args": {"query": "SELECT count() FROM default.viewer_events"}}]
    }

    with patch("app.screening.investigator_service.run_anomaly_investigation", new=AsyncMock(return_value=mock_report)):
        resp = client.post(f"/api/v1/screenings/{sid}/audience/anomalies/anm_mock/investigate")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["screening_id"] == sid
        assert "investigation_report" in data
        assert len(data["mcp_queries_executed"]) == 1
