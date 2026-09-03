"""
Core Intelligence Engine Test Suite
====================================
Tests sample-aware statistical gating, Laplace/Wilson bounds, local vs global baselines,
multi-signal correlation, scientific taxonomy, and positive engagement anomalies.
"""
import math
import pytest
from unittest.mock import patch, MagicMock

with patch("app.database.clickhouse.get_client"):
    from app.screening import analytics


def _make_mock_signals(unique_viewers: int, bucket_data: list):
    return {
        "screening_id": "sc_test_intel",
        "bucket_sec": 2,
        "unique_viewers": unique_viewers,
        "reliability": analytics._reliability(unique_viewers),
        "signals": bucket_data,
    }


def test_1_viewer_1_event():
    """1 viewer, 1 exit event -> INSUFFICIENT, LOW confidence, LOW severity."""
    buckets = [
        {"time_sec": 0, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 1, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 1.0},
        {"time_sec": 20, "sessions_active": 0, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=1, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    anomalies = res["anomalies"]
    if anomalies:
        for anm in anomalies:
            assert anm["severity"] == "LOW"
            assert anm["confidence"] == "LOW"
            assert anm["sample_sufficiency"] == "INSUFFICIENT"
            assert anm["confidence_score"] <= 0.35


def test_1_viewer_2_events():
    """1 viewer, 2 events (pause + exit) -> INSUFFICIENT, LOW confidence, LOW severity."""
    buckets = [
        {"time_sec": 0, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 1, "pauses": 1, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 1, "completions": 0, "pause_rate": 1.0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 1.0},
        {"time_sec": 20, "sessions_active": 0, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=1, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    for anm in res["anomalies"]:
        assert anm["severity"] == "LOW"
        assert anm["confidence"] == "LOW"
        assert anm["sample_sufficiency"] == "INSUFFICIENT"


def test_1_viewer_many_events():
    """1 viewer emitting 15 events -> STILL INSUFFICIENT because n=1."""
    buckets = [
        {"time_sec": 0, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 1, "pauses": 5, "rewinds": 5, "skips": 4, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 1, "completions": 0, "pause_rate": 5.0, "rewind_rate": 5.0, "skip_rate": 4.0, "replay_rate": 0, "exit_rate": 1.0},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=1, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    for anm in res["anomalies"]:
        assert anm["severity"] == "LOW"
        assert anm["confidence"] == "LOW"
        assert anm["sample_sufficiency"] == "INSUFFICIENT"


def test_3_viewers_many_events():
    """3 viewers emitting 20 events -> STILL INSUFFICIENT because n=3 < 5."""
    buckets = [
        {"time_sec": 0, "sessions_active": 3, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 3, "pauses": 8, "rewinds": 8, "skips": 2, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 2, "completions": 0, "pause_rate": 2.66, "rewind_rate": 2.66, "skip_rate": 0.66, "replay_rate": 0, "exit_rate": 0.66},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=3, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    for anm in res["anomalies"]:
        assert anm["severity"] == "LOW"
        assert anm["confidence"] == "LOW"
        assert anm["sample_sufficiency"] == "INSUFFICIENT"


def test_5_viewers_2_events():
    """5 viewers, 2 exit events -> PRELIMINARY sample, LOW confidence (due to weak event evidence)."""
    buckets = [
        {"time_sec": 0, "sessions_active": 5, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 5, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 2, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0.40},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=5, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    for anm in res["anomalies"]:
        assert anm["sample_sufficiency"] == "PRELIMINARY"
        assert anm["confidence"] in ("LOW", "MEDIUM")
        assert anm["severity"] in ("LOW", "MEDIUM")
        # Cannot be HIGH
        assert anm["confidence"] != "HIGH"
        assert anm["severity"] != "HIGH"


def test_10_plus_viewers_meaningful_deviation():
    """15 viewers with meaningful deviation (6 exits) -> SUFFICIENT sample, eligible for MEDIUM/HIGH."""
    buckets = []
    for i in range(15):
        t = i * 2
        ex = 6 if i == 5 else 0
        buckets.append({
            "time_sec": t, "sessions_active": 15,
            "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
            "exits": ex, "completions": 0,
            "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": ex / 15.0,
        })
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=15, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    assert len(res["anomalies"]) >= 1
    anm = res["anomalies"][0]
    assert anm["sample_sufficiency"] == "SUFFICIENT"
    assert anm["confidence"] in ("MEDIUM", "HIGH")


def test_30_plus_viewers_strong_deviation():
    """50 viewers, 25 exits (strong deviation) -> STRONG sample, HIGH confidence."""
    buckets = []
    for i in range(15):
        t = i * 2
        ex = 25 if i == 5 else 1
        buckets.append({
            "time_sec": t, "sessions_active": 45,
            "pauses": 1, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
            "exits": ex, "completions": 0,
            "pause_rate": 0.02, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": ex / 45.0,
        })
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=50, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    assert len(res["anomalies"]) >= 1
    anm = res["anomalies"][0]
    assert anm["sample_sufficiency"] == "STRONG"
    assert anm["confidence"] == "HIGH"
    assert anm["severity"] == "HIGH"


def test_adequate_viewers_weak_deviation():
    """50 viewers but only 1 exit event (weak event evidence) -> Cannot be HIGH confidence."""
    buckets = []
    for i in range(15):
        t = i * 2
        ex = 1 if i == 5 else 0
        buckets.append({
            "time_sec": t, "sessions_active": 50,
            "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
            "exits": ex, "completions": 0,
            "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": ex / 50.0,
        })
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=50, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    for anm in res["anomalies"]:
        assert anm["confidence"] != "HIGH"


def test_raw_100_percent_rate_tiny_sample():
    """Raw 100% rate with N=1 must preserve raw_exit_rate=1.0 and Laplace rate=0.6667 while forcing LOW confidence."""
    buckets = [
        {"time_sec": 0, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 0, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0},
        {"time_sec": 10, "sessions_active": 1, "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0, "exits": 1, "completions": 0, "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 1.0},
    ]
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=1, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    if res["anomalies"]:
        anm = res["anomalies"][0]
        assert anm["raw_signals"]["raw_exit_rate"] == 1.0
        assert abs(anm["smoothed_signals"]["laplace_exit_rate"] - 0.6667) < 1e-3
        assert anm["confidence"] == "LOW"
        assert anm["severity"] == "LOW"


def test_laplace_and_wilson_calculations():
    """Verify Laplace smoothing (k+1)/(n+2) and Wilson score lower bound calculation."""
    lap = analytics._laplace_smoothed_rate(1, 1)
    assert abs(lap - 0.6667) < 1e-3
    w_low_1 = analytics._wilson_lower_bound(1, 1)
    assert w_low_1 < 0.25
    w_low_100 = analytics._wilson_lower_bound(40, 100)
    assert w_low_100 > 0.25


def test_scientific_taxonomy_structure():
    """Every anomaly payload must expose structured taxonomy: observation, interpretation, hypothesis, validation."""
    buckets = []
    for i in range(15):
        t = i * 2
        ex = 30 if i == 5 else 1
        buckets.append({
            "time_sec": t, "sessions_active": 80,
            "pauses": 0, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
            "exits": ex, "completions": 0,
            "pause_rate": 0, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": ex / 80.0,
        })
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=80, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    assert len(res["anomalies"]) >= 1
    anm = res["anomalies"][0]
    tax = anm["taxonomy"]
    assert "observation" in tax
    assert "interpretation" in tax
    assert "hypothesis" in tax
    assert "validation" in tax


def test_exceptional_engagement_positive_anomaly():
    """High replay rate with low exit rate -> EXCEPTIONAL_ENGAGEMENT item."""
    buckets = []
    for i in range(15):
        t = i * 2
        rp = 50 if i == 5 else 1
        buckets.append({
            "time_sec": t, "sessions_active": 90,
            "pauses": 1, "rewinds": 0, "skips": 0, "replays": rp, "volume_changes": 0, "tab_hides": 0,
            "exits": 1, "completions": 0,
            "pause_rate": 0.01, "rewind_rate": 0, "skip_rate": 0, "replay_rate": rp / 90.0, "exit_rate": 0.01,
        })
    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=90, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    eng = res["exceptional_engagement"]
    assert len(eng) >= 1
    item = eng[0]
    assert item["type"] == "EXCEPTIONAL_ENGAGEMENT"


def test_local_baseline_excludes_anomaly_window():
    """Local baseline calculation must exclude the anomaly seconds [start_t, end_t]."""
    second_map = {
        0: {"pauses": 1, "exits": 0},
        2: {"pauses": 1, "exits": 0},
        4: {"pauses": 10, "exits": 5},
        6: {"pauses": 10, "exits": 5},
        8: {"pauses": 1, "exits": 0},
        10: {"pauses": 1, "exits": 0},
    }
    local_bl = analytics._calculate_local_baseline(second_map, start_t=4, end_t=6, window_sec=15)
    assert local_bl["pauses"]["mean"] == 1.0
    assert local_bl["exits"]["mean"] == 0.0

