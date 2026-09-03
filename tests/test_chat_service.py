import os
import sys
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure apps/api is on sys.path
API_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "apps", "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

from app.screening.repository import screening_repo
from app.screening.chat_service import run_sense_ai_chat
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def chat_test_screening():
    screening = screening_repo.get_by_id("sc_test_chat_123")
    if not screening:
        screening = screening_repo.create(
            screening_id="sc_test_chat_123",
            media_id="med_test_chat_123",
            title="Test Chat Screening",
            description="Chat test screening",
            media_filename="non_existent_video.mp4",
            media_duration=120.0
        )
    yield screening
    from app.database.clickhouse import delete_screening_events
    delete_screening_events("sc_test_chat_123")


def test_chat_session_repository_lifecycle(chat_test_screening):
    """Verify chat session creation, listing, message saving, and deletion in ClickHouse."""
    screening = chat_test_screening
    sid = screening["screening_id"]

    # 1. Create chat session
    session = screening_repo.create_chat_session(sid, title="Test Audience Q&A")
    assert session is not None
    assert session["screening_id"] == sid
    session_id = session["session_id"]

    # 2. Get sessions list
    sessions = screening_repo.get_chat_sessions(sid)
    assert any(s["session_id"] == session_id for s in sessions)

    # 3. Save user & assistant messages
    msg1 = screening_repo.save_chat_message(session_id, sid, "user", "What percentage paused?")
    assert msg1["role"] == "user"

    msg2 = screening_repo.save_chat_message(session_id, sid, "assistant", "Based on ClickHouse MCP, 12% paused.")
    assert msg2["role"] == "assistant"

    # 4. Get messages
    messages = screening_repo.get_chat_messages(session_id)
    assert len(messages) == 2
    assert messages[0]["content"] == "What percentage paused?"
    assert messages[1]["content"] == "Based on ClickHouse MCP, 12% paused."

    # 5. Delete session
    deleted = screening_repo.delete_chat_session(session_id)
    assert deleted is True
    assert len(screening_repo.get_chat_messages(session_id)) == 0


@pytest.mark.asyncio
async def test_sense_ai_chat_service_and_api_execution(chat_test_screening):
    """Verify run_sense_ai_chat executes agent and API endpoints respond correctly."""
    screening = chat_test_screening
    sid = screening["screening_id"]

    # Create session
    session = screening_repo.create_chat_session(sid, title="API Chat Test")
    cs_id = session["session_id"]

    mock_event = MagicMock()
    mock_part = MagicMock()
    mock_part.text = "According to ClickHouse telemetry, viewer retention remains strong at 88%."
    mock_part.function_call = None
    mock_event.content.parts = [mock_part]

    async def mock_run_async(*args, **kwargs):
        yield mock_event

    with patch("app.screening.chat_service.InMemoryRunner") as MockRunner:
        instance = MockRunner.return_value
        instance.app_name = "test_chat_app"
        instance.session_service.create_session = AsyncMock()
        instance.run_async = mock_run_async

        # Service execution
        result = await run_sense_ai_chat(sid, cs_id, "How is the retention curve?")
        assert result["status"] == "success"
        assert result["session_id"] == cs_id
        assert len(result["messages"]) >= 2
        assert any("88%" in m["content"] for m in result["messages"])

    # Test API endpoints
    client = TestClient(app)

    # GET sessions
    res = client.get(f"/api/v1/screenings/{sid}/chat/sessions")
    assert res.status_code == 200
    assert len(res.json()) > 0

    # GET messages
    res = client.get(f"/api/v1/screenings/{sid}/chat/sessions/{cs_id}/messages")
    assert res.status_code == 200
    assert len(res.json()) >= 2
