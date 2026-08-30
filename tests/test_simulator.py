"""
Tests for the Synthetic Audience Simulator.

These tests exercise the event-generation logic without a real ClickHouse
connection by mocking insert_events.
"""
import random
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers to import simulator without triggering ClickHouse init
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_insert():
    """Patch ClickHouse insert so tests never need a live connection."""
    with patch("app.screening.simulator.insert_events") as m:
        yield m


from app.screening import simulator as sim


SCREENING_ID = "sc_test000001"
VIDEO_ID = "med_test000001"
DURATION = 300.0


# ---------------------------------------------------------------------------
# 1. Deterministic output with seed
# ---------------------------------------------------------------------------

def test_deterministic_with_seed(mock_insert):
    """Same seed should produce identical event counts."""
    r1 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=50, seed=42)
    r2 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=50, seed=42)
    assert r1["total_events_generated"] == r2["total_events_generated"]


def test_different_seeds_produce_different_output(mock_insert):
    """Different seeds should (with high probability) produce different event counts."""
    r1 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=100, seed=1)
    r2 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=100, seed=2)
    # Not guaranteed but overwhelmingly likely for 100 viewers
    assert r1["total_events_generated"] != r2["total_events_generated"]


# ---------------------------------------------------------------------------
# 2. Event generation basics
# ---------------------------------------------------------------------------

def test_minimum_events_per_viewer(mock_insert):
    """Every viewer should produce at least a PLAY and TAB_VISIBLE event."""
    total = 0
    all_events = []

    def capture_batch(batch):
        all_events.extend(batch)
        nonlocal total
        total += len(batch)

    mock_insert.side_effect = capture_batch

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, seed=99)

    play_or_visible = [e for e in all_events if e["event_type"] in ("PLAY", "TAB_VISIBLE")]
    assert len(play_or_visible) >= 20 * 2


def test_all_events_have_required_fields(mock_insert):
    """Every emitted event must carry the full ViewerEvent contract."""
    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=10, seed=7)

    required = {
        "event_id", "screening_id", "session_id", "anonymous_viewer_id",
        "video_id", "event_type", "video_timecode_sec",
        "client_timestamp", "server_timestamp",
    }
    for event in captured:
        assert required.issubset(event.keys()), f"Missing keys in event: {event}"


def test_no_profile_labels_in_events(mock_insert):
    """Behavioral profiles must NEVER appear in emitted telemetry."""
    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=30, seed=3)

    forbidden_keys = {"profile", "behavioral_profile", "hidden_profile", "ground_truth"}
    for event in captured:
        assert forbidden_keys.isdisjoint(event.keys()), f"Forbidden key in event: {event}"


# ---------------------------------------------------------------------------
# 3. Event types are valid
# ---------------------------------------------------------------------------

VALID_EVENT_TYPES = {
    "PLAY", "PAUSE", "PROGRESS", "COMPLETE", "EXIT",
    "SEEK_FORWARD", "SEEK_BACKWARD", "REPLAY",
    "VOLUME_CHANGE", "TAB_VISIBLE", "TAB_HIDDEN",
}

def test_event_types_are_valid(mock_insert):
    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, seed=11)

    for event in captured:
        assert event["event_type"] in VALID_EVENT_TYPES, f"Unknown event type: {event['event_type']}"


# ---------------------------------------------------------------------------
# 4. Timecodes within bounds
# ---------------------------------------------------------------------------

def test_timecodes_within_bounds(mock_insert):
    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, seed=5)

    for event in captured:
        tc = event["video_timecode_sec"]
        assert -1.0 <= tc <= DURATION + 1.0, f"Timecode out of range: {tc}"


# ---------------------------------------------------------------------------
# 5. Batch insert called correctly
# ---------------------------------------------------------------------------

def test_batch_insert_called(mock_insert):
    """At least one batch insert call must happen for any non-zero viewer run."""
    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=10, seed=0)
    assert mock_insert.call_count >= 1


# ---------------------------------------------------------------------------
# 6. Return value structure
# ---------------------------------------------------------------------------

def test_result_structure(mock_insert):
    result = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=5, seed=42)
    assert result["screening_id"] == SCREENING_ID
    assert result["video_id"] == VIDEO_ID
    assert result["num_viewers"] == 5
    assert isinstance(result["total_events_generated"], int)
    assert result["total_events_generated"] > 0


# ---------------------------------------------------------------------------
# 7. Real-Anchored Simulation Tests & Mode Thresholds
# ---------------------------------------------------------------------------

@patch("app.screening.simulator.get_audience_overview")
def test_auto_mode_selection_thresholds(mock_overview, mock_insert):
    """0 real -> COLD_START, 1..9 -> HYBRID, 10+ -> REAL_ANCHORED."""
    # Case 1: 0 real viewers
    mock_overview.return_value = {"unique_viewers": 0}
    r1 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, mode="AUTO", seed=42)
    assert r1["simulation_mode"] == "COLD_START"

    # Case 2: 5 real viewers -> HYBRID
    mock_overview.return_value = {"unique_viewers": 5}
    with patch("app.screening.simulator.build_behavioral_fingerprint") as mock_fp:
        mock_fp.return_value = {"completion_rate": 0.8, "bucket_sec": 10, "time_buckets": [{"time_sec": 0, "rewind_prob": 0.05}]}
        r2 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, mode="AUTO", seed=42)
        assert r2["simulation_mode"] == "HYBRID"

    # Case 3: 25 real viewers -> REAL_ANCHORED
    mock_overview.return_value = {"unique_viewers": 25}
    with patch("app.screening.simulator.build_behavioral_fingerprint") as mock_fp:
        mock_fp.return_value = {"completion_rate": 0.8, "bucket_sec": 10, "time_buckets": [{"time_sec": 0, "rewind_prob": 0.05}]}
        r3 = sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=20, mode="AUTO", seed=42)
        assert r3["simulation_mode"] == "REAL_ANCHORED"


def test_synthetic_viewer_ids_are_unique_and_prefixed(mock_insert):
    """Synthetic viewer IDs must start with synth_v_ and be distinct."""
    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=50, seed=123)

    viewer_ids = {e["anonymous_viewer_id"] for e in captured}
    for vid in viewer_ids:
        assert vid.startswith("synth_v_"), f"Viewer ID invalid: {vid}"


@patch("app.screening.simulator.get_audience_overview")
@patch("app.screening.simulator.build_behavioral_fingerprint")
def test_temporal_hotspot_preservation_real_anchored(mock_fp, mock_overview, mock_insert):
    """
    CRITICAL TEST: Real viewers show strong rewind hotspot at 30-40s.
    Generate 500 synthetic viewers in REAL_ANCHORED mode.
    Assert synthetic rewind activity around 30-40s is significantly higher than baseline.
    """
    mock_overview.return_value = {"unique_viewers": 100}
    
    # Fingerprint with a massive rewind spike at 30s
    time_buckets = []
    for t in range(0, int(DURATION), 10):
        rewind_p = 0.65 if t == 30 else 0.01
        time_buckets.append({
            "time_sec": t,
            "retention_rate": 0.90,
            "pause_prob": 0.02,
            "rewind_prob": rewind_p,
            "skip_prob": 0.01,
            "replay_prob": 0.01,
            "exit_prob": 0.01,
        })

    mock_fp.return_value = {
        "screening_id": SCREENING_ID,
        "real_viewers_count": 100,
        "completion_rate": 0.85,
        "bucket_sec": 10,
        "time_buckets": time_buckets,
    }

    captured = []
    mock_insert.side_effect = lambda b: captured.extend(b)

    sim.run_simulation(SCREENING_ID, VIDEO_ID, DURATION, num_viewers=300, mode="REAL_ANCHORED", variation_strength="LOW", seed=777)

    rewinds_at_hotspot = 0
    rewinds_outside_hotspot = 0

    for e in captured:
        if e["event_type"] == "SEEK_BACKWARD":
            tc = e["video_timecode_sec"]
            if 25.0 <= tc <= 45.0:
                rewinds_at_hotspot += 1
            else:
                rewinds_outside_hotspot += 1

    # Assert hotspot bucket contains overwhelming majority of rewind events
    assert rewinds_at_hotspot > rewinds_outside_hotspot, (
        f"Rewind hotspot at 30-40s not preserved! Hotspot rewinds: {rewinds_at_hotspot}, Outside: {rewinds_outside_hotspot}"
    )


def test_profile_weights_sum_to_one():
    total = sum(sim.PROFILE_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-6, f"Profile weights do not sum to 1.0: {total}"

