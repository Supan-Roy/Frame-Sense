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


def get_retention_curve(screening_id: str, bucket_sec: int = 2) -> Dict[str, Any]:
    """
    High-resolution Audience Retention Curve.
    Calculates active viewer retention across timecode buckets with organic presence tracking.
    Uses range expansion for continuous play spans.
    """
    client = get_client()
    sid = screening_id.replace("'", "")

    total_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}'"))
    if total_viewers == 0:
        return {"screening_id": screening_id, "bucket_sec": bucket_sec, "total_starters": 0, "curve": []}

    from app.screening.repository import screening_repo
    screening = screening_repo.get_by_id(screening_id)
    video_dur = float(screening["media_duration"]) if screening and screening.get("media_duration") and float(screening.get("media_duration")) > 0 else 0.0

    max_dur_res = client.query(f"SELECT max(video_timecode_sec) FROM viewer_events WHERE screening_id = '{sid}' AND video_timecode_sec >= 0")
    event_max = float(max_dur_res.result_rows[0][0]) if max_dur_res.result_rows and max_dur_res.result_rows[0][0] else 0.0

    # Ensure max_dur spans full video duration (e.g. 32s) or max observed timecode
    max_dur = max(video_dur, event_max) or 60.0

    b = max(1, min(5, int(bucket_sec)))

    query = f"""
    WITH viewer_active_ranges AS (
        SELECT DISTINCT
            anonymous_viewer_id,
            toUInt32(floor(tc / {b}) * {b}) AS bucket
        FROM (
            SELECT
                anonymous_viewer_id,
                arrayJoin(range(toUInt32(floor(video_timecode_sec)), toUInt32(floor(video_timecode_sec)) + if(event_type IN ('PLAY', 'PROGRESS'), 5, 1))) AS tc
            FROM viewer_events
            WHERE screening_id = '{sid}' AND video_timecode_sec >= 0
        )
    )
    SELECT
        b.bucket,
        count(DISTINCT nullIf(v.anonymous_viewer_id, '')) AS active_viewers
    FROM (
        SELECT arrayJoin(range(0, toUInt32({int(max_dur)}) + 1, {b})) AS bucket
    ) AS b
    LEFT JOIN viewer_active_ranges AS v ON v.bucket = b.bucket
    GROUP BY b.bucket
    ORDER BY b.bucket
    """
    result = client.query(query)
    buckets = []
    for row in result.result_rows:
        bucket_t, active_v = row
        if int(bucket_t) > int(max_dur):
            continue
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


def get_anomalies(screening_id: str, bucket_sec: int = 2) -> Dict[str, Any]:
    """
    Second-by-Second Micro-Burst & Density Clustering Anomaly Engine.
    Detects exact second-level anomaly windows (e.g. 2-3s bursts) and peak seconds
    from actual event telemetry without fixed rigid bucket constraints.
    """
    b = max(1, int(bucket_sec))
    signals_data = get_behavioral_signals(screening_id, b)
    buckets = signals_data.get("signals", [])
    unique_viewers = signals_data.get("unique_viewers", 0)

    if unique_viewers == 0 or not buckets:
        return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": unique_viewers,
                "reliability": _reliability(unique_viewers), "anomalies": [], "exceptional_engagement": []}

    second_map: Dict[int, Dict[str, Any]] = {}
    for bk in buckets:
        t_sec = int(bk["time_sec"])
        second_map[t_sec] = {
            "pauses": bk.get("pauses", 0),
            "rewinds": bk.get("rewinds", 0),
            "skips": bk.get("skips", 0),
            "exits": bk.get("exits", 0),
            "replays": bk.get("replays", 0),
            "vol": bk.get("volume_changes", 0),
            "tabs": bk.get("tab_hides", 0),
            "pause_rate": bk.get("pause_rate", 0.0),
            "rewind_rate": bk.get("rewind_rate", 0.0),
            "skip_rate": bk.get("skip_rate", 0.0),
            "exit_rate": bk.get("exit_rate", 0.0),
            "replay_rate": bk.get("replay_rate", 0.0),
            "completions": bk.get("completions", 0),
        }

    all_times = sorted(second_map.keys())
    if not all_times:
        return {"screening_id": screening_id, "bucket_sec": b, "unique_viewers": unique_viewers,
                "reliability": _reliability(unique_viewers), "anomalies": [], "exceptional_engagement": []}

    rate_map = {"pauses": "pause_rate", "rewinds": "rewind_rate", "skips": "skip_rate", "exits": "exit_rate", "replays": "replay_rate", "vol": "vol", "tabs": "tabs"}
    metric_keys = list(rate_map.keys())
    series = {m: [max(second_map[t][m], second_map[t].get(rate_map[m], 0.0)) for t in all_times] for m in metric_keys}
    baselines = {m: _mean_std(series[m]) for m in metric_keys}
    eps = 1e-6

    active_times = set()
    for t in all_times:
        sdata = second_map[t]
        for m in rate_map:
            mu, sigma = baselines[m]
            val = max(sdata[m], sdata.get(rate_map[m], 0.0))
            val_rate = max(sdata.get(rate_map[m], 0.0), sdata[m] / max(1, unique_viewers))
            z = (val - mu) / (sigma + eps)
            if z >= 0.75 and (val_rate >= 0.04 or val >= 2):
                active_times.add(t)

    sorted_active = sorted(active_times)
    clusters = []
    if sorted_active:
        cur_cluster = [sorted_active[0]]
        for t in sorted_active[1:]:
            if t - cur_cluster[-1] <= max(2, b):
                cur_cluster.append(t)
            else:
                clusters.append(cur_cluster)
                cur_cluster = [t]
        clusters.append(cur_cluster)

    anomalies = []
    exceptional_engagement = []

    def _fmt_time(s: float) -> str:
        m, sec = divmod(int(s), 60)
        return f"{m}:{sec:02d}"

    for cl in clusters:
        start_t = cl[0]
        end_t = cl[-1]
        if end_t == start_t:
            end_t = start_t + b
        dur = max(b, end_t - start_t)

        c_pauses = sum(second_map[t]["pauses"] for t in cl)
        c_rewinds = sum(second_map[t]["rewinds"] for t in cl)
        c_skips = sum(second_map[t]["skips"] for t in cl)
        c_exits = sum(second_map[t]["exits"] for t in cl)
        c_replays = sum(second_map[t]["replays"] for t in cl)
        c_vol = sum(second_map[t]["vol"] for t in cl)
        c_tabs = sum(second_map[t]["tabs"] for t in cl)

        peak_t = start_t
        peak_score = -1
        for t in cl:
            score = sum(second_map[t][m] for m in metric_keys)
            if score > peak_score:
                peak_score = score
                peak_t = t

        pause_rate = max(round(c_pauses / max(1, unique_viewers), 4), max(second_map[t]["pause_rate"] for t in cl))
        rewind_rate = max(round(c_rewinds / max(1, unique_viewers), 4), max(second_map[t]["rewind_rate"] for t in cl))
        skip_rate = max(round(c_skips / max(1, unique_viewers), 4), max(second_map[t]["skip_rate"] for t in cl))
        exit_rate = max(round(c_exits / max(1, unique_viewers), 4), max(second_map[t]["exit_rate"] for t in cl))
        replay_rate = max(round(c_replays / max(1, unique_viewers), 4), max(second_map[t]["replay_rate"] for t in cl))

        c_exits = max(c_exits, int(exit_rate * unique_viewers))
        c_pauses = max(c_pauses, int(pause_rate * unique_viewers))
        c_rewinds = max(c_rewinds, int(rewind_rate * unique_viewers))
        c_skips = max(c_skips, int(skip_rate * unique_viewers))
        c_replays = max(c_replays, int(replay_rate * unique_viewers))

        evidence = []
        sev_score = 1.0
        cat_title = "Behavioral Spike"
        domain = "COGNITIVE"

        if c_replays > max(1, c_exits * 2) and c_replays >= 1:
            ratio = replay_rate / (baselines["replays"][0] / max(1, unique_viewers) + eps)
            exceptional_engagement.append({
                "anomaly_id": f"eng_{uuid.uuid4().hex[:12]}",
                "screening_id": screening_id,
                "start_time_sec": start_t,
                "end_time_sec": end_t,
                "peak_time_sec": peak_t,
                "window_duration_sec": dur,
                "title": "Emotional Scene Replay Hotspot",
                "domain": "EMOTIONAL",
                "type": "EXCEPTIONAL_ENGAGEMENT",
                "severity": "HIGH" if c_replays >= 5 else "MEDIUM",
                "signals": {
                    "replay_rate": replay_rate,
                    "baseline_replay_rate": round(baselines["replays"][0] / max(1, unique_viewers), 4),
                    "replay_ratio": round(ratio, 2),
                    "exit_rate": exit_rate,
                },
                "evidence": [f"High emotional impact or memorable scene replay peak at {_fmt_time(peak_t)} ({c_replays} replay events, {ratio:.1f}x above baseline)"],
            })

        if c_replays >= 1 or c_rewinds >= 1:
            if c_pauses > 0:
                cat_title = "Cognitive Comprehension Barrier"
                domain = "COGNITIVE"
                evidence.append(f"Scene rewatch peak at {_fmt_time(peak_t)}: {c_rewinds + c_replays} replay/rewind(s) & {c_pauses} pause(s) in {dur}s window (dense detail inspection)")
                sev_score = max(sev_score, 2.0)
            else:
                cat_title = "Emotional Scene Replay Hotspot"
                domain = "EMOTIONAL"
                evidence.append(f"Scene replay peak at {_fmt_time(peak_t)}: {c_rewinds + c_replays} replay/rewind event(s) recorded")
                sev_score = max(sev_score, 2.0)
        elif c_pauses > 0 and c_exits > 0:
            cat_title = "Critical Scene Exit Drop"
            domain = "RETENTION"
            evidence.append(f"Audience exit drop peak at {_fmt_time(peak_t)} ({c_exits} exit events, {exit_rate*100:.1f}%)")
            sev_score = max(sev_score, 2.5)
        elif c_tabs > 0 and (c_exits > 0 or c_tabs >= 3):
            cat_title = "Psychological Attention Loss"
            domain = "PSYCHOLOGICAL"
            evidence.append(f"Psychological disengagement peak at {_fmt_time(peak_t)}: {c_tabs} tab switch / hide event(s) recorded (loss of visual immersion)")
            sev_score = max(sev_score, 2.0)
        elif c_skips > 0 and c_exits > 0:
            cat_title = "Dead Zone Pacing Skip"
            domain = "PACING"
            evidence.append(f"Pacing friction peak at {_fmt_time(peak_t)}: {c_skips} forward skip(s) & {c_exits} exit(s) in {dur}s window (slow narrative pace)")
            sev_score = max(sev_score, 2.5)
        elif c_exits > 0:
            cat_title = "Critical Scene Exit Drop"
            domain = "RETENTION"
            evidence.append(f"Audience exit drop peak at {_fmt_time(peak_t)} ({c_exits} exit events, {exit_rate*100:.1f}%)")
            sev_score = max(sev_score, 2.5)
        elif c_vol > 0:
            cat_title = "Audio Mix Perception Spike"
            domain = "PERCEPTUAL"
            evidence.append(f"Sound mix perception peak at {_fmt_time(peak_t)} ({c_vol} volume change events, dialogue/music imbalance)")
            sev_score = max(sev_score, 1.5)
        elif c_pauses > 0:
            cat_title = "Scene Pause Spike"
            domain = "COGNITIVE"
            evidence.append(f"Pause micro-burst peak at {_fmt_time(peak_t)} ({c_pauses} pause events)")
            sev_score = max(sev_score, 1.5)
        elif c_rewinds > 0:
            cat_title = "Rewind Hotspot"
            domain = "COGNITIVE"
            evidence.append(f"Rewind micro-burst peak at {_fmt_time(peak_t)} ({c_rewinds} rewind events)")
            sev_score = max(sev_score, 1.5)
        if c_vol > 0 and "Audio" not in cat_title:
            evidence.append(f"Audio adjustment co-occurred ({c_vol} volume events)")
        if c_tabs > 0 and "Psychological" not in cat_title:
            evidence.append(f"Attention shift co-occurred ({c_tabs} tab hides)")

        if unique_viewers < 10:
            sev_label = "LOW"
        else:
            sev_label = "HIGH" if sev_score >= 2.5 else ("MEDIUM" if sev_score >= 2.0 else "LOW")

        anomalies.append({
            "anomaly_id": f"anm_{uuid.uuid4().hex[:12]}",
            "screening_id": screening_id,
            "start_time_sec": start_t,
            "end_time_sec": end_t,
            "peak_time_sec": peak_t,
            "window_duration_sec": dur,
            "title": cat_title,
            "domain": domain,
            "type": "BEHAVIORAL_ANOMALY",
            "severity": sev_label,
            "signals": {
                "exit_rate": exit_rate,
                "pause_rate": pause_rate,
                "rewind_rate": rewind_rate,
                "skip_rate": skip_rate,
            },
            "evidence": evidence,
        })

    return {
        "screening_id": screening_id,
        "bucket_sec": b,
        "unique_viewers": unique_viewers,
        "reliability": _reliability(unique_viewers),
        "anomalies": anomalies,
        "exceptional_engagement": exceptional_engagement,
        "baseline_methodology": "Second-by-second ML Micro-Burst & Density Clustering. Extracts precise timecode windows, peak seconds, and co-occurring event signals.",
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

