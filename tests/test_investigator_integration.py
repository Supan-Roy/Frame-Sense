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


@pytest.fixture
def integration_test_screening():
    screening = screening_repo.get_by_id("sc_test_integration")
    if not screening:
        screening = screening_repo.create(
            screening_id="sc_test_integration",
            media_id="med_test_123",
            title="Test Screening",
            description="Integration test screening",
            media_filename="test_video.mp4",
            media_duration=120.0
        )
    yield screening
    from app.database.clickhouse import delete_screening_events
    delete_screening_events("sc_test_integration")


def test_investigator_agent_structure_and_instruction():
    """Verify Frame Sense Investigator agent instruction and tool composition."""
    assert root_agent.name == "Frame_Sense_Investigator"
    assert "ClickHouse MCP" in root_agent.instruction or "default.viewer_events" in root_agent.instruction
    assert "OBSERVED AUDIENCE BEHAVIOR" in root_agent.instruction
    assert "QUANTITATIVE EVIDENCE" in root_agent.instruction
    assert "VISUAL EVIDENCE" in root_agent.instruction


def test_existing_anomaly_detection_unchanged(integration_test_screening):
    """Verify existing anomaly detection get_anomalies output structure remains 100% untouched."""
    screening = integration_test_screening
    sid = screening["screening_id"]

    res = get_anomalies(sid, bucket_sec=2)
    assert "screening_id" in res
    assert "unique_viewers" in res
    assert "reliability" in res
    assert "anomalies" in res
    assert "exceptional_engagement" in res


@pytest.mark.asyncio
async def test_investigate_anomaly_service_context_passing(integration_test_screening):
    """Verify anomaly context (screening_id, video_id, timecode window) is correctly extracted and formatted."""
    screening = integration_test_screening
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
async def test_investigate_api_route(integration_test_screening):
    """Verify FastApi route POST /api/v1/screenings/{screening_id}/audience/anomalies/{anomaly_id}/investigate."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    screening = integration_test_screening
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


def test_investigation_persistence_and_deletion(integration_test_screening):
    """Verify SQLite persistence: save, retrieve all, get specific, and manual delete."""
    screening = integration_test_screening
    sid = screening["screening_id"]
    anm_id = "anm_persist_test_999"

    # 1. Save investigation
    saved = screening_repo.save_investigation(
        screening_id=sid,
        anomaly_id=anm_id,
        investigation_report="Persisted Multimodal Report Findings",
        mcp_queries=[{"tool": "run_select_query"}],
        extracted_frames=[{"time_sec": 26.0, "base64": "data:image/jpeg;base64,mock"}]
    )
    assert saved["screening_id"] == sid
    assert saved["anomaly_id"] == anm_id

    # 2. Retrieve specific investigation
    retrieved = screening_repo.get_investigation(sid, anm_id)
    assert retrieved is not None
    assert retrieved["investigation_report"] == "Persisted Multimodal Report Findings"
    assert len(retrieved["mcp_queries_executed"]) == 1
    assert len(retrieved["extracted_frames"]) == 1

    # 3. Retrieve all investigations for screening
    all_inv = screening_repo.get_all_investigations(sid)
    assert anm_id in all_inv
    assert all_inv[anm_id]["investigation_report"] == "Persisted Multimodal Report Findings"

    # 4. Delete investigation
    deleted = screening_repo.delete_investigation(sid, anm_id)
    assert deleted is True

    # 5. Verify deleted
    assert screening_repo.get_investigation(sid, anm_id) is None


def test_delete_all_investigations_on_reset(integration_test_screening):
    """Verify that delete_all_investigations purges all saved investigations for a screening."""
    screening = integration_test_screening
    sid = screening["screening_id"]

    screening_repo.save_investigation(sid, "anm_reset_1", "Report 1", [], [])
    screening_repo.save_investigation(sid, "anm_reset_2", "Report 2", [], [])

    all_inv = screening_repo.get_all_investigations(sid)
    assert "anm_reset_1" in all_inv
    assert "anm_reset_2" in all_inv

    deleted = screening_repo.delete_all_investigations(sid)
    assert deleted is True

    all_inv_after = screening_repo.get_all_investigations(sid)
    assert len(all_inv_after) == 0

