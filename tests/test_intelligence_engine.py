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


def test_single_viewer_one_event_gating():
    """
    1 viewer, 1 exit event = 100% raw exit rate.
    Must NOT produce a HIGH-confidence anomaly. Must have LOW confidence and INSUFFICIENT sample sufficiency.
    """
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


def test_laplace_and_wilson_calculations():
    """Verify Laplace smoothing (k+1)/(n+2) and Wilson score lower bound calculation."""
    # 1 event, 1 viewer: Laplace = 2/3 = 0.6667
    lap = analytics._laplace_smoothed_rate(1, 1)
    assert abs(lap - 0.6667) < 1e-3

    # Wilson lower bound for 1/1 should be low (~0.2065) due to high uncertainty
    w_low_1 = analytics._wilson_lower_bound(1, 1)
    assert w_low_1 < 0.25

    # 40 events, 100 viewers: Wilson lower bound should be substantial (~0.30)
    w_low_100 = analytics._wilson_lower_bound(40, 100)
    assert w_low_100 > 0.25


def test_large_sample_high_confidence_anomaly():
    """
    100 viewers, exit spike at bucket 10 (40 exits).
    Must produce a HIGH confidence anomaly with SUFFICIENT or STRONG sample sufficiency.
    """
    buckets = []
    for i in range(20):
        t = i * 2
        if i == 10:
            buckets.append({
                "time_sec": t, "sessions_active": 80,
                "pauses": 2, "rewinds": 1, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
                "exits": 40, "completions": 0,
                "pause_rate": 0.02, "rewind_rate": 0.01, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0.40,
            })
        else:
            buckets.append({
                "time_sec": t, "sessions_active": 95,
                "pauses": 1, "rewinds": 0, "skips": 0, "replays": 0, "volume_changes": 0, "tab_hides": 0,
                "exits": 2, "completions": 0,
                "pause_rate": 0.01, "rewind_rate": 0, "skip_rate": 0, "replay_rate": 0, "exit_rate": 0.02,
            })

    with patch.object(analytics, "get_behavioral_signals") as mock_sig:
        mock_sig.return_value = _make_mock_signals(unique_viewers=100, bucket_data=buckets)
        res = analytics.get_anomalies("sc_test_intel", bucket_sec=2)

    anomalies = res["anomalies"]
    assert len(anomalies) >= 1
    anm = next(a for a in anomalies if a["start_time_sec"] == 20)
    assert anm["severity"] == "HIGH"
    assert anm["confidence"] == "HIGH"
    assert anm["confidence_score"] >= 0.70
    assert anm["sample_sufficiency"] == "STRONG"
    assert "raw_signals" in anm
    assert anm["raw_signals"]["exit_count"] >= 40
    assert "smoothed_signals" in anm
    assert "local_baseline" in anm
    assert "taxonomy" in anm


def test_scientific_taxonomy_structure():
    """
    Every anomaly payload must expose structured taxonomy:
    observation, interpretation, hypothesis, validation.
    """
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

    # Verify OBSERVATION contains factual numbers, not emotional claims
    assert "Observed" in tax["observation"]
    assert "Plausible" in tax["hypothesis"]


def test_exceptional_engagement_positive_anomaly():
    """
    High replay rate (60 replays) with low exit rate (1 exit).
    Must generate an EXCEPTIONAL_ENGAGEMENT item in exceptional_engagement list.
    """
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
    assert "signals" in item
    assert item["signals"]["replay_ratio"] > 1.0
    assert "taxonomy" in item


def test_local_baseline_excludes_anomaly_window():
    """
    Local baseline calculation must exclude the anomaly seconds [start_t, end_t]
    so the burst does not contaminate surrounding local window baseline.
    """
    second_map = {
        0: {"pauses": 1, "exits": 0},
        2: {"pauses": 1, "exits": 0},
        4: {"pauses": 10, "exits": 5}, # Anomaly window
        6: {"pauses": 10, "exits": 5}, # Anomaly window
        8: {"pauses": 1, "exits": 0},
        10: {"pauses": 1, "exits": 0},
    }

    local_bl = analytics._calculate_local_baseline(second_map, start_t=4, end_t=6, window_sec=15)
    # Surrounding non-anomaly seconds have pauses=1, exits=0
    assert local_bl["pauses"]["mean"] == 1.0
    assert local_bl["exits"]["mean"] == 0.0
