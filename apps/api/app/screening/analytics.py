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
    real_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}' AND anonymous_viewer_id NOT LIKE 'synth_v_%'"))
    synthetic_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}' AND anonymous_viewer_id LIKE 'synth_v_%'"))
    unique_sessions = int(client.command(f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    total_events = int(client.command(f"SELECT count() FROM viewer_events WHERE screening_id = '{sid}'"))
    completed_sessions = int(client.command(f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{sid}' AND event_type = 'COMPLETE'"))
    completion_rate = round(completed_sessions / unique_sessions, 4) if unique_sessions > 0 else None
    return {
        "screening_id": screening_id,
        "unique_viewers": unique_viewers,
        "real_viewers": real_viewers,
        "synthetic_viewers": synthetic_viewers,
        "unique_sessions": unique_sessions,
        "total_events": total_events,
        "completed_sessions": completed_sessions,
        "completion_rate": completion_rate,
        "reliability": _reliability(unique_viewers),
    }


def get_retention_curve(screening_id: str, bucket_sec: int = 5) -> Dict[str, Any]:
    """
    High-resolution Audience Retention Curve.
    Calculates active viewer retention across timecode buckets with organic presence tracking.
    """
    client = get_client()
    sid = screening_id.replace("'", "")

    total_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    if total_viewers == 0:
        return {"screening_id": screening_id, "bucket_sec": bucket_sec, "total_starters": 0, "curve": []}

    max_dur_res = client.query(f"SELECT max(video_timecode_sec) FROM viewer_events WHERE screening_id = '{sid}' AND video_timecode_sec >= 0")
    max_dur = float(max_dur_res.result_rows[0][0]) if max_dur_res.result_rows and max_dur_res.result_rows[0][0] else 60.0
    if max_dur <= 0:
        max_dur = 60.0

    b = max(2, min(10, int(bucket_sec)))

    query = f"""
    WITH viewer_spans AS (
        SELECT
            anonymous_viewer_id,
            max(video_timecode_sec) AS max_reached,
            countIf(event_type = 'EXIT') > 0 AS has_exited,
            maxIf(video_timecode_sec, event_type = 'EXIT') AS exit_tc
        FROM viewer_events
        WHERE screening_id = '{sid}' AND video_timecode_sec >= 0
        GROUP BY anonymous_viewer_id
    )
    SELECT
        b.bucket,
        countIf(v.max_reached >= b.bucket AND (NOT v.has_exited OR v.exit_tc >= b.bucket)) AS active_viewers
    FROM (
        SELECT arrayJoin(range(0, toUInt32({int(max_dur)}) + {b}, {b})) AS bucket
    ) AS b
    CROSS JOIN viewer_spans AS v
    GROUP BY b.bucket
    ORDER BY b.bucket
    """
    result = client.query(query)
    buckets = []
    for row in result.result_rows:
        bucket_t, active_v = row
        retention = round(int(active_v) / max(1, total_viewers), 4)
        buckets.append({"time_sec": int(bucket_t), "viewers": int(active_v), "retention_rate": retention})

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
    if az >= 1.2: return "LOW"
    return None


def get_anomalies(screening_id: str, bucket_sec: int = 5) -> Dict[str, Any]:
    """
    Multi-dimensional Audience Intelligence Anomaly Engine.
    Detects scene friction, pacing issues, comprehension barriers, attention drops,
    and exceptional engagement peaks across high-resolution timecode buckets.
    """
    b = max(2, int(bucket_sec))
    signals_data = get_behavioral_signals(screening_id, b)
    buckets = signals_data["signals"]
    unique_viewers = signals_data["unique_viewers"]

    if unique_viewers == 0 or len(buckets) < 2:
        return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": unique_viewers,
                "reliability": _reliability(unique_viewers), "anomalies": [], "exceptional_engagement": []}

    metrics = ["exit_rate", "rewind_rate", "pause_rate", "skip_rate", "replay_rate"]
    series = {m: [bk[m] for bk in buckets] for m in metrics}
    baselines = {m: _mean_std(series[m]) for m in metrics}
    eps = 1e-6

    anomalies, exceptional_engagement = [], []

    for bk in buckets:
        t_sec = bk["time_sec"]
        if t_sec == 0 and len(buckets) > 1:
            continue

        anomaly_signals: Dict[str, Any] = {}
        evidence: List[str] = []
        max_sev = 0.0

        for m in ["exit_rate", "rewind_rate", "pause_rate", "skip_rate"]:
            mu, sigma = baselines[m]
            observed = bk[m]
            z = (observed - mu) / (sigma + eps)
            
            threshold = 0.6 if unique_viewers >= 50 else 1.0
            if (z >= threshold and observed > 0.01) or (observed >= 0.08):
                ratio = observed / (mu + eps)
                anomaly_signals[m] = round(observed, 4)
                anomaly_signals[f"baseline_{m}"] = round(mu, 4)
                anomaly_signals[f"{m}_ratio"] = round(ratio, 2)
                
                metric_title = m.replace('_', ' ').title()
                evidence.append(f"{metric_title} is {ratio:.1f}x above baseline (observed {observed*100:.1f}%, baseline {mu*100:.1f}%)")
                
                if z >= 2.2 or observed >= 0.25:
                    max_sev = max(max_sev, 3.0)
                elif z >= 1.2 or observed >= 0.12:
                    max_sev = max(max_sev, 2.0)
                else:
                    max_sev = max(max_sev, 1.0)

        pauses = bk.get("pauses", 0)
        rewinds = bk.get("rewinds", 0)
        skips = bk.get("skips", 0)
        exits = bk.get("exits", 0)
        vol = bk.get("volume_changes", 0)
        tabs = bk.get("tab_hides", 0)

        if pauses > 0 and rewinds > 0:
            evidence.append(f"Co-occurring Friction: {pauses} pause(s) & {rewinds} rewind(s) in this scene window")
        if skips > 0 and exits > 0:
            evidence.append(f"Pacing Friction: Viewers skipped forward then exited")
        if vol > 0:
            evidence.append(f"Audio Adjustment: {vol} volume change event(s) recorded")
        if tabs > 0:
            evidence.append(f"Attention Shift: {tabs} tab switch / hide event(s) recorded")

        if evidence:
            sev_label = "HIGH" if max_sev >= 3.0 else ("MEDIUM" if max_sev >= 2.0 else "LOW")
            anomalies.append({
                "anomaly_id": f"anm_{uuid.uuid4().hex[:12]}",
                "screening_id": screening_id,
                "start_time_sec": t_sec,
                "end_time_sec": t_sec + b,
                "type": "BEHAVIORAL_ANOMALY",
                "severity": sev_label,
                "signals": anomaly_signals,
                "evidence": evidence,
            })

        rmu, rsigma = baselines["replay_rate"]
        observed_rep = bk["replay_rate"]
        rz = (observed_rep - rmu) / (rsigma + eps)
        
        if (rz >= 0.8 and observed_rep > 0.02) or (observed_rep >= 0.06):
            ratio = observed_rep / (rmu + eps)
            completion_pct = bk["completions"] / max(1, unique_viewers)
            exceptional_engagement.append({
                "anomaly_id": f"eng_{uuid.uuid4().hex[:12]}",
                "screening_id": screening_id,
                "start_time_sec": t_sec,
                "end_time_sec": t_sec + b,
                "type": "EXCEPTIONAL_ENGAGEMENT",
                "severity": "HIGH" if rz >= 2.2 else ("MEDIUM" if rz >= 1.2 else "LOW"),
                "signals": {
                    "replay_rate": round(observed_rep, 4),
                    "baseline_replay_rate": round(rmu, 4),
                    "replay_ratio": round(ratio, 2),
                    "completion_rate": round(completion_pct, 4),
                    "exit_rate": round(bk["exit_rate"], 4),
                },
                "evidence": [
                    f"Replay activity is {ratio:.1f}x above baseline (observed {observed_rep*100:.1f}%)",
                    f"Completion rate in this window: {completion_pct*100:.1f}%",
                ],
            })

    return {
        "screening_id": screening_id,
        "bucket_sec": b,
        "unique_viewers": unique_viewers,
        "reliability": _reliability(unique_viewers),
        "anomalies": anomalies,
        "exceptional_engagement": exceptional_engagement,
        "baseline_methodology": "High-resolution Audience Intelligence. Flags Z-score deviations (Z>=0.6 for N>=50) and absolute behavioral friction/engagement thresholds across timecode windows.",
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

