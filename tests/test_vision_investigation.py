import os
import sys
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure apps/api is on sys.path
API_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "apps", "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

from app.media.vision import extract_anomaly_frames, cleanup_temp_frames
from app.screening.investigator_service import run_anomaly_investigation
from app.screening.repository import screening_repo


def _get_or_create_test_screening():
    screenings = screening_repo.get_all()
    if screenings:
        return screenings[0]
    return screening_repo.create(
        screening_id="sc_test_vision_123",
        media_id="med_test_vision_123",
        title="Test Vision Screening",
        description="Vision test screening",
        media_filename="non_existent_video.mp4",
        media_duration=120.0
    )


def test_missing_video_graceful_fallback():
    """Verify frame extraction handles missing or invalid video files gracefully without crashing."""
    temp_dir, frames = extract_anomaly_frames(
        video_path="non_existent_path_file.mp4",
        start_sec=26.0,
        end_sec=28.0,
        max_frames=4
    )
    assert temp_dir is None
    assert len(frames) == 0
    cleanup_temp_frames(temp_dir)


def test_ffmpeg_frame_extraction_on_real_video():
    """Verify FFmpeg extracts expected number of frames and metadata when a real video file is present."""
    media_dir = os.path.abspath(os.path.join(API_DIR, "data", "media"))
    if not os.path.exists(media_dir):
        pytest.skip("Media directory does not exist.")

    files = [f for f in os.listdir(media_dir) if f.endswith(".mp4")]
    if not files:
        pytest.skip("No real mp4 file found in data/media for live extraction test.")

    video_path = os.path.join(media_dir, files[0])
    temp_dir, frames = extract_anomaly_frames(
        video_path=video_path,
        start_sec=10.0,
        end_sec=15.0,
        max_frames=4
    )

    assert temp_dir is not None
    assert len(frames) == 4
    for f in frames:
        assert "time_sec" in f
        assert "bytes" in f
        assert "base64" in f
        assert f["base64"].startswith("data:image/jpeg;base64,")

    cleanup_temp_frames(temp_dir)


@pytest.mark.asyncio
async def test_multimodal_investigation_service_execution():
    """Verify run_anomaly_investigation attaches visual metadata and returns 7-section report structure."""
    screening = _get_or_create_test_screening()
    sid = screening["screening_id"]

    mock_event = MagicMock()
    mock_part = MagicMock()
    mock_part.text = (
        "### 1. OBSERVED AUDIENCE BEHAVIOR\n"
        "Critical exit drop observed at 26s–28s.\n\n"
        "### 2. QUANTITATIVE EVIDENCE (from ClickHouse MCP)\n"
        "4 exit events recorded between 26s and 28s.\n\n"
        "### 3. VISUAL EVIDENCE (from attached video frames)\n"
        "Frames analyzed at 24s, 26s, 28s, 30s show a dark scene transition.\n\n"
        "### 4. TELEMETRY ↔ VISUAL CORRELATION\n"
        "Viewer exits coincide with character departure scene.\n\n"
        "### 5. PLAUSIBLE EXPLANATIONS\n"
        "Scene transition pacing created momentary audience drop-off.\n\n"
        "### 6. CONFIDENCE\n"
        "Telemetry: HIGH | Visual: MEDIUM | Causal: PRELIMINARY\n\n"
        "### 7. VALIDATION EVIDENCE\n"
        "Review dialogue mix and cut timing at 26s."
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

        result = await run_anomaly_investigation(sid, "anm_mock_vision")

        assert result["status"] == "success"
        assert result["screening_id"] == sid
        assert "investigation_report" in result
        assert "extracted_frames" in result
        assert "OBSERVED AUDIENCE BEHAVIOR" in result["investigation_report"]
        assert "VISUAL EVIDENCE" in result["investigation_report"]
        assert "TELEMETRY ↔ VISUAL CORRELATION" in result["investigation_report"]
