"""
Adversarial Regression Test Suite for Viewer-Level Behavioral Semantics
================================================----------------=========
Verifies that Frame Sense reasons about viewer behavior as sequence trajectories
rather than raw event multiplicity, preventing false "Critical Scene Exit Drop" anomalies.
"""
import uuid
import time
import pytest
from app.database.clickhouse import get_client, insert_events
from app.screening.analytics import get_anomalies, get_audience_overview
from app.screening.repository import screening_repo


@pytest.fixture
def test_screening_id():
    sid = f"test_scr_{uuid.uuid4().hex[:12]}"
    screening_repo.create(
        screening_id=sid,
        media_id=f"m_{sid}",
        title="Behavioral Test Cut",
        media_filename="sample.mp4",
        media_duration=60.0,
        description="Adversarial test for viewer trajectory reasoning."
    )
    yield sid
    # Cleanup
    client = get_client()
    sid_clean = sid.replace("'", "")
    try:
        client.command(f"ALTER TABLE viewer_events DELETE WHERE screening_id = '{sid_clean}' SETTINGS mutations_sync = 2")
    except Exception:
        pass
    screening_repo.delete(sid)


def _emit(sid: str, vid: str, event_type: str, timecode: float, sess_id: str = None):
    if not sess_id:
        sess_id = f"s_{vid}"
    return {
        "event_id": str(uuid.uuid4()),
        "screening_id": sid,
        "session_id": sess_id,
        "anonymous_viewer_id": vid,
        "video_id": "v_test",
        "event_type": event_type,
        "video_timecode_sec": timecode,
        "client_timestamp": "2026-09-03T20:00:00Z",
        "server_timestamp": "2026-09-03T20:00:00Z"
    }


def test_scenario_1_single_viewer_repeated_replay(test_screening_id):
    """
    1 viewer replaying 25-28s repeatedly (generating 20 events)
    -> MUST NOT become Critical Scene Exit Drop.
    """
    sid = test_screening_id
    vid = "viewer_single_replay"
    events = [
        _emit(sid, vid, "TAB_VISIBLE", 0),
        _emit(sid, vid, "PLAY", 0),
        _emit(sid, vid, "PROGRESS", 10),
        _emit(sid, vid, "PROGRESS", 20),
    ]
    # Replay 25-28s 10 times
    for _ in range(10):
        events.append(_emit(sid, vid, "PAUSE", 27.0))
        events.append(_emit(sid, vid, "SEEK_BACKWARD", 25.0))
        events.append(_emit(sid, vid, "PLAY", 25.0))
        events.append(_emit(sid, vid, "PROGRESS", 28.0))
    # Continue to completion
    events.append(_emit(sid, vid, "PROGRESS", 40))
    events.append(_emit(sid, vid, "PROGRESS", 50))
    events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles, f"False exit drop triggered: {titles}"


def test_scenario_2_500_viewers_replaying_and_continuing(test_screening_id):
    """
    500 synthetic viewers replaying 25-28s and continuing playback to completion
    -> MUST NOT become Critical Scene Exit Drop.
    """
    sid = test_screening_id
    events = []
    for i in range(500):
        vid = f"v_cont_{i}"
        events.append(_emit(sid, vid, "TAB_VISIBLE", 0))
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "PROGRESS", 15))
        # Replay at 26s
        events.append(_emit(sid, vid, "PAUSE", 26.0))
        events.append(_emit(sid, vid, "SEEK_BACKWARD", 24.0))
        events.append(_emit(sid, vid, "PLAY", 24.0))
        events.append(_emit(sid, vid, "PROGRESS", 35))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles, f"False exit drop triggered for replaying viewers: {titles}"


def test_scenario_3_genuine_abandonment_500_viewers(test_screening_id):
    """
    500 viewers actually abandoning at 26s (never returning)
    -> SHOULD produce a retention anomaly (Critical Scene Exit Drop).
    """
    sid = test_screening_id
    events = []
    for i in range(500):
        vid = f"v_abandon_{i}"
        events.append(_emit(sid, vid, "TAB_VISIBLE", 0))
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "PROGRESS", 15))
        events.append(_emit(sid, vid, "PAUSE", 26.0))
        events.append(_emit(sid, vid, "EXIT", 26.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" in titles, f"Failed to detect genuine exit drop: {res}"


def test_scenario_4_viewers_pausing_and_continuing(test_screening_id):
    """
    500 viewers pausing and then continuing playback
    -> MUST NOT be treated as abandonment.
    """
    sid = test_screening_id
    events = []
    for i in range(500):
        vid = f"v_pause_cont_{i}"
        events.append(_emit(sid, vid, "TAB_VISIBLE", 0))
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "PAUSE", 20.0))
        events.append(_emit(sid, vid, "PLAY", 20.0))
        events.append(_emit(sid, vid, "PROGRESS", 40))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles, f"Pause & continuation misclassified as exit: {titles}"


def test_scenario_5_viewers_seeking_backward_and_continuing(test_screening_id):
    """
    500 viewers seeking backward and continuing
    -> Should favor replay/engagement or cognitive interpretation, not retention loss.
    """
    sid = test_screening_id
    events = []
    for i in range(500):
        vid = f"v_seek_cont_{i}"
        events.append(_emit(sid, vid, "TAB_VISIBLE", 0))
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "SEEK_BACKWARD", 15.0))
        events.append(_emit(sid, vid, "PLAY", 15.0))
        events.append(_emit(sid, vid, "PROGRESS", 45))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles


def test_scenario_6_competing_signals_replaying_and_exiting(test_screening_id):
    """
    250 viewers replaying & continuing, 250 viewers replaying & exiting
    -> Ambiguous signal: should surface competing signals or retention without misrepresenting replay as pure exit.
    """
    sid = test_screening_id
    events = []
    # 250 replaying & continuing
    for i in range(250):
        vid = f"v_mix_cont_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "REPLAY", 25.0))
        events.append(_emit(sid, vid, "PLAY", 25.0))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))
    # 250 replaying & exiting
    for i in range(250):
        vid = f"v_mix_exit_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "REPLAY", 25.0))
        events.append(_emit(sid, vid, "EXIT", 25.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    anomalies = res.get("anomalies", [])
    assert len(anomalies) > 0, "Should detect anomaly for 500 viewers with mixed reactions."


def test_scenario_7_one_viewer_generating_20_events(test_screening_id):
    """
    One viewer generating 20 events
    -> Trajectory signals must reflect unique_exposed = 1, unique_permanent_exits = 0 (or 1 if exited at end).
    """
    sid = test_screening_id
    vid = "single_hyperactive_viewer"
    events = [_emit(sid, vid, "PLAY", 0)]
    for tc in range(1, 21):
        events.append(_emit(sid, vid, "PAUSE", tc * 1.5))
        events.append(_emit(sid, vid, "PLAY", tc * 1.5))
    events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    for a in res.get("anomalies", []):
        assert a.get("trajectory_signals", {}).get("unique_exposed", 0) <= 1


def test_scenario_8_multiple_exit_events_same_session(test_screening_id):
    """
    Multiple EXIT events from the same session
    -> Should not inflate unique viewer abandonment count.
    """
    sid = test_screening_id
    vid = "viewer_dup_exit"
    events = [
        _emit(sid, vid, "PLAY", 0),
        _emit(sid, vid, "PROGRESS", 20),
        _emit(sid, vid, "EXIT", 20.0),
        _emit(sid, vid, "EXIT", 20.0),
        _emit(sid, vid, "EXIT", 20.0),
    ]

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    for a in res.get("anomalies", []):
        assert a.get("trajectory_signals", {}).get("unique_permanent_exits", 0) <= 1


def test_scenario_9_tab_hidden_followed_by_tab_visible(test_screening_id):
    """
    TAB_HIDDEN followed by TAB_VISIBLE
    -> MUST NOT be treated as permanent exit.
    """
    sid = test_screening_id
    events = []
    for i in range(50):
        vid = f"v_tab_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "TAB_HIDDEN", 15.0))
        events.append(_emit(sid, vid, "TAB_VISIBLE", 17.0))
        events.append(_emit(sid, vid, "PROGRESS", 30.0))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles


def test_scenario_10_complete_is_not_abandonment(test_screening_id):
    """
    COMPLETE event
    -> MUST NOT be treated as abandonment.
    """
    sid = test_screening_id
    events = []
    for i in range(100):
        vid = f"v_comp_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "PROGRESS", 30))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    for a in res.get("anomalies", []):
        assert a.get("trajectory_signals", {}).get("unique_permanent_exits", 0) == 0


def test_scenario_11_pause_followed_by_exit_semantics(test_screening_id):
    """
    PAUSE followed by EXIT
    -> Potential abandonment ONLY when exit semantics genuinely indicate session termination.
    """
    sid = test_screening_id
    events = []
    # 50 viewers pause and exit (abandonment)
    for i in range(50):
        vid = f"v_pe_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "PAUSE", 25.0))
        events.append(_emit(sid, vid, "EXIT", 25.0))

    insert_events(events)
    time.sleep(1.0)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" in titles


def test_scenario_12_seek_replay_followed_by_continuation_protects_retention(test_screening_id):
    """
    SEEK_BACKWARD / REPLAY followed by continued playback
    -> Protects against false retention anomalies.
    """
    sid = test_screening_id
    events = []
    for i in range(100):
        vid = f"v_protect_{i}"
        events.append(_emit(sid, vid, "PLAY", 0))
        events.append(_emit(sid, vid, "SEEK_BACKWARD", 25.0))
        events.append(_emit(sid, vid, "REPLAY", 25.0))
        events.append(_emit(sid, vid, "PLAY", 25.0))
        events.append(_emit(sid, vid, "PROGRESS", 50.0))
        events.append(_emit(sid, vid, "COMPLETE", 60.0))

    insert_events(events)
    time.sleep(0.3)

    res = get_anomalies(sid)
    titles = [a["title"] for a in res.get("anomalies", [])]
    assert "Critical Scene Exit Drop" not in titles
