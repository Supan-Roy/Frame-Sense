"""
Audience Intelligence Analytics Engine
=======================================
Computes all analytical metrics from the existing viewer_events ClickHouse table.

All heavy aggregation is performed inside ClickHouse SQL.
Raw events are never pulled into Python for computation.

Baseline methodology:
  For each metric M across all time buckets:
    - baseline_mean = mean(M over all buckets)
    - baseline_std  = std(M over all buckets)
    - z_score       = (observed - baseline_mean) / (baseline_std + e)
  Anomaly thresholds:
    HIGH   z > 3.0
    MEDIUM z > 2.0
    LOW    z > 1.5
"""
import uuid
import math
from typing import List, Dict, Any, Optional
from app.database.clickhouse import get_client


def _reliability(unique_viewers: int) -> Dict[str, str]:
    if unique_viewers < 10:
        return {"status": "INSUFFICIENT_DATA", "label": "Insufficient audience data for reliable anomaly detection."}
    if unique_viewers < 100:
        return {"status": "PRELIMINARY_SIGNAL", "label": f"Preliminary signal ({unique_viewers} viewers)."}
    return {"status": "STRONG_SIGNAL", "label": f"Strong screening signal ({unique_viewers} viewers)."}


def get_audience_overview(screening_id: str) -> Dict[str, Any]:
    client = get_client()
    sid = screening_id.replace("'", "")
    unique_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    unique_sessions = int(client.command(f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    total_events = int(client.command(f"SELECT count() FROM viewer_events WHERE screening_id = '{sid}'"))
    completed_sessions = int(client.command(f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{sid}' AND event_type = 'COMPLETE'"))
    completion_rate = round(completed_sessions / unique_sessions, 4) if unique_sessions > 0 else None
    return {
        "screening_id": screening_id,
        "unique_viewers": unique_viewers,
        "unique_sessions": unique_sessions,
        "total_events": total_events,
        "completed_sessions": completed_sessions,
        "completion_rate": completion_rate,
        "reliability": _reliability(unique_viewers),
    }


def get_retention_curve(screening_id: str, bucket_sec: int = 10) -> Dict[str, Any]:
    """
    Viewer retention time series.
    For each bucket t, count viewers whose max watched timecode >= t.
    retention_rate = viewers_at_t / total_starters.
    """
    client = get_client()
    sid = screening_id.replace("'", "")
    b = max(1, int(bucket_sec))

    query = f"""
    WITH viewer_max AS (
        SELECT anonymous_viewer_id, max(video_timecode_sec) AS max_reached
        FROM viewer_events
        WHERE screening_id = '{sid}' AND event_type IN ('PLAY','PROGRESS','PAUSE','COMPLETE')
        GROUP BY anonymous_viewer_id
    ),
    total AS (SELECT count(DISTINCT anonymous_viewer_id) AS n FROM viewer_events WHERE screening_id = '{sid}')
    SELECT bucket, countIf(max_reached >= bucket) AS viewers_at, any(n) AS total
    FROM (
        SELECT arrayJoin(range(0, toUInt32(max_reached) + {b}, {b})) AS bucket, max_reached, (SELECT n FROM total) AS n
        FROM viewer_max
    )
    GROUP BY bucket ORDER BY bucket
    """
    result = client.query(query)
    total_viewers = 0
    buckets = []
    for row in result.result_rows:
        bucket_t, viewers_at, total_v = row
        if total_viewers == 0 and total_v:
            total_viewers = int(total_v)
        retention = round(int(viewers_at) / max(1, int(total_v)), 4) if total_v else 0.0
        buckets.append({"time_sec": int(bucket_t), "viewers": int(viewers_at), "retention_rate": retention})
    return {"screening_id": screening_id, "bucket_sec": b, "total_starters": total_viewers, "curve": buckets}


def get_behavioral_signals(screening_id: str, bucket_sec: int = 10) -> Dict[str, Any]:
    """Per-time-bucket behavioral event rates. All aggregation in ClickHouse."""
    client = get_client()
    sid = screening_id.replace("'", "")
    b = max(1, int(bucket_sec))

    unique_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    if unique_viewers == 0:
        return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": 0, "reliability": _reliability(0), "signals": []}

    query = f"""
    SELECT
        intDiv(toInt32(video_timecode_sec), {b}) * {b} AS bucket,
        countIf(event_type = 'PAUSE')         AS pauses,
        countIf(event_type = 'SEEK_BACKWARD') AS rewinds,
        countIf(event_type = 'SEEK_FORWARD')  AS skips,
        countIf(event_type = 'REPLAY')        AS replays,
        countIf(event_type = 'VOLUME_CHANGE') AS volume_changes,
        countIf(event_type = 'TAB_HIDDEN')    AS tab_hides,
        countIf(event_type = 'EXIT')          AS exits,
        countIf(event_type = 'COMPLETE')      AS completions,
        count(DISTINCT session_id)             AS sessions_active
    FROM viewer_events
    WHERE screening_id = '{sid}' AND video_timecode_sec >= 0
    GROUP BY bucket ORDER BY bucket
    """
    result = client.query(query)
    denom = max(1, unique_viewers)
    signals = []
    for row in result.result_rows:
        bucket_t, pauses, rewinds, skips, replays, vol, tabs, exits, completions, sessions = row
        signals.append({
            "time_sec": int(bucket_t),
            "sessions_active": int(sessions),
            "pauses": int(pauses), "rewinds": int(rewinds),
            "skips": int(skips), "replays": int(replays),
            "volume_changes": int(vol), "tab_hides": int(tabs),
            "exits": int(exits), "completions": int(completions),
            "pause_rate":  round(int(pauses)  / denom, 4),
            "rewind_rate": round(int(rewinds) / denom, 4),
            "skip_rate":   round(int(skips)   / denom, 4),
            "replay_rate": round(int(replays) / denom, 4),
            "exit_rate":   round(int(exits)   / denom, 4),
        })
    return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": unique_viewers, "reliability": _reliability(unique_viewers), "signals": signals}


def _mean_std(values: List[float]):
    if not values:
        return 0.0, 0.0
    n = len(values)
    mu = sum(values) / n
    variance = sum((x - mu) ** 2 for x in values) / n
    return mu, math.sqrt(variance)


def _severity(z: float) -> Optional[str]:
    az = abs(z)
    if az >= 3.0: return "HIGH"
    if az >= 2.0: return "MEDIUM"
    if az >= 1.5: return "LOW"
    return None


def get_anomalies(screening_id: str, bucket_sec: int = 10) -> Dict[str, Any]:
    """
    Z-score anomaly detection over per-bucket behavioral metrics.
    Returns structured anomaly objects suitable for future Gemini agent consumption.
    Evidence strings are observational ONLY - no semantic interpretation.
    """
    b = max(1, int(bucket_sec))
    signals_data = get_behavioral_signals(screening_id, b)
    buckets = signals_data["signals"]
    unique_viewers = signals_data["unique_viewers"]

    # For short videos (< 60s), if 10s buckets produce fewer than 4 buckets, auto-reduce to 5s buckets for higher resolution
    if len(buckets) < 4 and b > 4 and unique_viewers > 0:
        b = 5
        signals_data = get_behavioral_signals(screening_id, b)
        buckets = signals_data["signals"]

    if unique_viewers == 0 or len(buckets) < 3:
        return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": unique_viewers,
                "reliability": _reliability(unique_viewers), "anomalies": [], "exceptional_engagement": []}

    metrics = ["exit_rate", "rewind_rate", "pause_rate", "skip_rate", "replay_rate"]
    series = {m: [b[m] for b in buckets] for m in metrics}
    baselines = {m: _mean_std(series[m]) for m in metrics}
    eps = 1e-6

    anomalies, exceptional_engagement = [], []

    for b in buckets:
        if b["time_sec"] == 0:
            continue

        anomaly_signals: Dict[str, Any] = {}
        evidence: List[str] = []
        max_sev_score = 0.0

        for m in ["exit_rate", "rewind_rate", "pause_rate", "skip_rate"]:
            mu, sigma = baselines[m]
            observed = b[m]
            z = (observed - mu) / (sigma + eps)
            sev = _severity(z)
            if z > 0 and sev:
                ratio = observed / (mu + eps)
                anomaly_signals[m] = round(observed, 4)
                anomaly_signals[f"baseline_{m}"] = round(mu, 4)
                anomaly_signals[f"{m}_ratio"] = round(ratio, 2)
                evidence.append(f"{m.replace('_',' ').title()} is {ratio:.1f}x above baseline (observed {observed*100:.1f}%, baseline {mu*100:.1f}%)")
                max_sev_score = max(max_sev_score, {"LOW": 1.5, "MEDIUM": 2.0, "HIGH": 3.0}.get(sev, 0))

        if evidence:
            sev_label = "HIGH" if max_sev_score >= 3.0 else ("MEDIUM" if max_sev_score >= 2.0 else "LOW")
            anomalies.append({
                "anomaly_id": f"anm_{uuid.uuid4().hex[:12]}",
                "screening_id": screening_id,
                "start_time_sec": b["time_sec"],
                "end_time_sec": b["time_sec"] + bucket_sec,
                "type": "BEHAVIORAL_ANOMALY",
                "severity": sev_label,
                "signals": anomaly_signals,
                "evidence": evidence,
            })

        # Exceptional engagement: high replay, low exits
        rmu, rsigma = baselines["replay_rate"]
        emu, esigma = baselines["exit_rate"]
        rz = (b["replay_rate"] - rmu) / (rsigma + eps)
        ez = (b["exit_rate"] - emu) / (esigma + eps)
        if rz > 2.0 or (rz > 1.5 and ez < -1.0):
            ratio = b["replay_rate"] / (rmu + eps)
            completion_pct = b["completions"] / max(1, unique_viewers)
            exceptional_engagement.append({
                "anomaly_id": f"eng_{uuid.uuid4().hex[:12]}",
                "screening_id": screening_id,
                "start_time_sec": b["time_sec"],
                "end_time_sec": b["time_sec"] + bucket_sec,
                "type": "EXCEPTIONAL_ENGAGEMENT",
                "severity": "HIGH" if rz > 3.0 else "MEDIUM",
                "signals": {
                    "replay_rate": round(b["replay_rate"], 4),
                    "baseline_replay_rate": round(rmu, 4),
                    "replay_ratio": round(ratio, 2),
                    "completion_rate": round(completion_pct, 4),
                    "exit_rate": round(b["exit_rate"], 4),
                },
                "evidence": [
                    f"Replay activity is {ratio:.1f}x above baseline",
                    f"Completion rate in this window: {completion_pct*100:.1f}%",
                ],
            })

    return {
        "screening_id": screening_id,
        "bucket_sec": bucket_sec,
        "unique_viewers": unique_viewers,
        "reliability": _reliability(unique_viewers),
        "anomalies": anomalies,
        "exceptional_engagement": exceptional_engagement,
        "baseline_methodology": "Z-score vs population mean/std across all buckets. HIGH>=3sigma, MEDIUM>=2sigma, LOW>=1.5sigma.",
    }


def build_behavioral_fingerprint(screening_id: str, bucket_sec: int = 10) -> Dict[str, Any]:
    """
    Extracts an aggregate behavioral fingerprint from actual ClickHouse viewer events.
    Computes time-local probability distributions across time buckets without semantic inference.
    Used by the Real-Anchored Synthetic Audience Generator.
    """
    overview = get_audience_overview(screening_id)
    unique_viewers = overview["unique_viewers"]

    if unique_viewers == 0:
        return {
            "screening_id": screening_id,
            "real_viewers_count": 0,
            "mode_recommendation": "COLD_START",
            "completion_rate": 0.0,
            "time_buckets": [],
            "hotspots": [],
        }

    signals_data = get_behavioral_signals(screening_id, bucket_sec)
    retention_data = get_retention_curve(screening_id, bucket_sec)

    mode_rec = "REAL_ANCHORED" if unique_viewers >= 10 else "HYBRID"
    ret_map = {p["time_sec"]: p["retention_rate"] for p in retention_data["curve"]}

    time_buckets = []
    hotspots = []
    signals = signals_data["signals"]

    if signals:
        metrics = ["pause_rate", "rewind_rate", "skip_rate", "replay_rate", "exit_rate"]
        means = {m: sum(s[m] for s in signals) / len(signals) for m in metrics}

        for s in signals:
            t = s["time_sec"]
            retention = ret_map.get(t, 1.0)

            b_info = {
                "time_sec": t,
                "retention_rate": retention,
                "pause_prob": s["pause_rate"],
                "rewind_prob": s["rewind_rate"],
                "skip_prob": s["skip_rate"],
                "replay_prob": s["replay_rate"],
                "exit_prob": s["exit_rate"],
            }
            time_buckets.append(b_info)

            for m in metrics:
                if means[m] > 0.001 and s[m] >= 2.0 * means[m]:
                    hotspots.append({
                        "time_sec": t,
                        "metric": m,
                        "observed_rate": s[m],
                        "baseline_rate": round(means[m], 4),
                        "multiplier": round(s[m] / (means[m] + 1e-6), 2)
                    })

    return {
        "screening_id": screening_id,
        "real_viewers_count": unique_viewers,
        "unique_sessions": overview["unique_sessions"],
        "mode_recommendation": mode_rec,
        "completion_rate": overview["completion_rate"] or 0.0,
        "bucket_sec": bucket_sec,
        "time_buckets": time_buckets,
        "hotspots": hotspots,
    }

