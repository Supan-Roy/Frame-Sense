"""
Tests for the Audience Intelligence Analytics Engine.

Tests exercise the pure-Python calculation logic (z-score, severity, baseline,
reliability) without a live ClickHouse connection.
"""
import math
import pytest
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Import analytics module with ClickHouse client mocked at module load
# ---------------------------------------------------------------------------
with patch("app.database.clickhouse.get_client"):
    from app.screening import analytics


# ---------------------------------------------------------------------------
# Helper: build a fake signals dataset with known anomalies
# ---------------------------------------------------------------------------

def _make_buckets(n: int = 20, spike_idx: int = 10):
    """
    20 buckets, all with ~normal exit_rate=0.05, rewind_rate=0.03.
    Bucket at spike_idx has exit_rate=0.50 (spike), rewind_rate=0.40.
    """
    buckets = []
    for i in range(n):
        t = i * 10
        if i == spike_idx:
            buckets.append({
                "time_sec": t, "sessions_active": 80,
                "pauses": 5, "rewinds": 32, "skips": 10,
                "replays": 2, "volume_changes": 3, "tab_hides": 1,
                "exits": 40, "completions": 0,
                "pause_rate":  0.06, "rewind_rate": 0.40,
                "skip_rate":   0.12, "replay_rate": 0.02,
                "exit_rate":   0.50,
            })
        else:
            buckets.append({
                "time_sec": t, "sessions_active": 95,
                "pauses": 3, "rewinds": 2, "skips": 1,
                "replays": 1, "volume_changes": 1, "tab_hides": 0,
                "exits": 5, "completions": 0,
                "pause_rate":  0.03, "rewind_rate": 0.03,
                "skip_rate":   0.01, "replay_rate": 0.01,
                "exit_rate":   0.05,
            })
    return buckets


def _make_engagement_buckets(n: int = 20, spike_idx: int = 8):
    """
    Like above but spike_idx has very high replay_rate and low exit_rate.
    """
    buckets = []
    for i in range(n):
        t = i * 10
        if i == spike_idx:
            buckets.append({
                "time_sec": t, "sessions_active": 98,
                "pauses": 2, "rewinds": 1, "skips": 0,
                "replays": 60, "volume_changes": 0, "tab_hides": 0,
                "exits": 1, "completions": 8,
                "pause_rate":  0.02, "rewind_rate": 0.01,
                "skip_rate":   0.00, "replay_rate": 0.60,
                "exit_rate":   0.01,
            })
        else:
            buckets.append({
                "time_sec": t, "sessions_active": 90,
                "pauses": 3, "rewinds": 2, "skips": 1,
                "replays": 1, "volume_changes": 1, "tab_hides": 0,
                "exits": 5, "completions": 0,
                "pause_rate":  0.03, "rewind_rate": 0.03,
                "skip_rate":   0.01, "replay_rate": 0.01,
                "exit_rate":   0.05,
            })
    return buckets


# ---------------------------------------------------------------------------
# 1. Reliability indicator
# ---------------------------------------------------------------------------

def test_reliability_insufficient():
    r = analytics._reliability(0)
    assert r["status"] == "INSUFFICIENT_DATA"


def test_reliability_preliminary():
    r = analytics._reliability(50)
    assert r["status"] == "PRELIMINARY_SIGNAL"


def test_reliability_strong():
    r = analytics._reliability(500)
    assert r["status"] == "STRONG_SIGNAL"


# ---------------------------------------------------------------------------
# 2. Mean / std calculation
# ---------------------------------------------------------------------------

def test_mean_std_uniform():
    mu, sigma = analytics._mean_std([2.0, 2.0, 2.0, 2.0])
    assert abs(mu - 2.0) < 1e-9
    assert abs(sigma) < 1e-9


def test_mean_std_known_values():
    values = [0, 2, 4, 6, 8]
    mu, sigma = analytics._mean_std(values)
    assert abs(mu - 4.0) < 1e-9
    expected_std = math.sqrt(8.0)
    assert abs(sigma - expected_std) < 1e-6


def test_mean_std_empty():
    mu, sigma = analytics._mean_std([])
    assert mu == 0.0 and sigma == 0.0


# ---------------------------------------------------------------------------
# 3. Severity thresholds
# ---------------------------------------------------------------------------

def test_severity_high():
    assert analytics._severity(3.5) == "HIGH"
    assert analytics._severity(-3.5) == "HIGH"


def test_severity_medium():
    assert analytics._severity(2.3) == "MEDIUM"


def test_severity_low():
    assert analytics._severity(1.4) == "LOW"


def test_severity_none():
    assert analytics._severity(0.8) is None
    assert analytics._severity(0.5) is None


# ---------------------------------------------------------------------------
# 4. Anomaly detection - behavioral spike
# ---------------------------------------------------------------------------

def test_anomaly_detected_in_spike_bucket():
    """
    With a large exit_rate spike at bucket 10, get_anomalies should flag it.
    We mock get_behavioral_signals to return our crafted dataset.
    """
    buckets = _make_buckets(n=20, spike_idx=10)

    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 100,
            "reliability": analytics._reliability(100),
            "signals": buckets,
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    anomalies = result["anomalies"]
    assert len(anomalies) >= 1

    # The spike is at time_sec=100 (bucket index 10)
    spike_anomaly = next((a for a in anomalies if a["start_time_sec"] == 100), None)
    assert spike_anomaly is not None
    assert spike_anomaly["severity"] in ("HIGH", "MEDIUM")
    assert len(spike_anomaly["evidence"]) >= 1


def test_anomaly_evidence_is_observational():
    """Evidence strings must describe measurements, not diagnoses."""
    buckets = _make_buckets(n=20, spike_idx=10)

    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 100,
            "reliability": analytics._reliability(100),
            "signals": buckets,
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    forbidden_terms = ["confused", "problem", "issue", "error", "bad", "wrong"]
    for anomaly in result["anomalies"]:
        for ev in anomaly["evidence"]:
            for term in forbidden_terms:
                assert term.lower() not in ev.lower(), f"Semantic diagnosis found: '{ev}'"


# ---------------------------------------------------------------------------
# 5. Exceptional engagement detection
# ---------------------------------------------------------------------------

def test_engagement_spike_detected():
    buckets = _make_engagement_buckets(n=20, spike_idx=8)

    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 100,
            "reliability": analytics._reliability(100),
            "signals": buckets,
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    assert len(result["exceptional_engagement"]) >= 1
    eng = result["exceptional_engagement"][0]
    assert eng["type"] == "EXCEPTIONAL_ENGAGEMENT"
    assert eng["signals"]["replay_ratio"] > 1.0


# ---------------------------------------------------------------------------
# 6. Small sample returns empty results
# ---------------------------------------------------------------------------

def test_small_sample_returns_empty():
    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 3,
            "reliability": analytics._reliability(3),
            "signals": [],
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    assert result["reliability"]["status"] == "INSUFFICIENT_DATA"
    assert result["anomalies"] == []
    assert result["exceptional_engagement"] == []


# ---------------------------------------------------------------------------
# 7. API schema validation
# ---------------------------------------------------------------------------

def test_anomaly_has_required_keys():
    buckets = _make_buckets(n=20, spike_idx=10)

    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 100,
            "reliability": analytics._reliability(100),
            "signals": buckets,
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    required_keys = {
        "anomaly_id", "screening_id", "start_time_sec", "end_time_sec",
        "type", "severity", "signals", "evidence",
    }
    for anomaly in result["anomalies"]:
        assert required_keys.issubset(anomaly.keys()), f"Missing keys: {anomaly}"


# ---------------------------------------------------------------------------
# 8. Baseline methodology documented
# ---------------------------------------------------------------------------

def test_baseline_methodology_present():
    with patch.object(analytics, "get_behavioral_signals") as mock_signals:
        mock_signals.return_value = {
            "screening_id": "sc_test", "bucket_sec": 10,
            "unique_viewers": 200,
            "reliability": analytics._reliability(200),
            "signals": _make_buckets(n=20, spike_idx=10),
        }
        result = analytics.get_anomalies("sc_test", bucket_sec=10)

    assert "baseline_methodology" in result
    assert len(result["baseline_methodology"]) > 10
