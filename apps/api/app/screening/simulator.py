"""
Synthetic Audience Generator
============================
DEVELOPER / DEMO TOOL ONLY.

NOT part of the normal screening workflow.
NOT exposed in the public Screening Room.

Architectural Modes:
  1. REAL_ANCHORED  (10+ real viewers) - Derives behavioral fingerprint from actual ClickHouse telemetry.
  2. HYBRID         (1-9 real viewers) - Blends real behavioral fingerprint with generic priors.
  3. COLD_START     (0 real viewers)   - Uses generic probabilistic profile distribution & ground-truth.

Core Product Principle:
  REAL VIEWER TELEMETRY IS THE PRODUCT.
  The simulator generates scale that statistically resembles actual observed audience behavior.
  Never clones individual viewers. Emits standard ViewerEvent contract to ClickHouse.
"""
import uuid
import random
import datetime
from typing import List, Dict, Any, Optional
from app.database.clickhouse import get_client, insert_events
from app.screening.analytics import build_behavioral_fingerprint, get_audience_overview

# Dynamic ground truth helper (scales anomaly windows to video duration)
def get_default_ground_truth(duration: float) -> List[Dict[str, Any]]:
    d = max(10.0, float(duration))
    return [
        {"label": "pacing",                "start": round(d * 0.22, 1), "end": round(d * 0.32, 1)},
        {"label": "exceptional_engagement", "start": round(d * 0.40, 1), "end": round(d * 0.48, 1)},
        {"label": "comprehension",          "start": round(d * 0.56, 1), "end": round(d * 0.64, 1)},
        {"label": "audio",                  "start": round(d * 0.74, 1), "end": round(d * 0.82, 1)},
    ]

# Viewer profile distribution weights for COLD_START mode
PROFILE_WEIGHTS = {
    "NORMAL":                 0.45,
    "ENGAGED":                0.20,
    "EARLY_ABANDONER":        0.10,
    "PACING_SENSITIVE":       0.10,
    "COMPREHENSION_SENSITIVE":0.10,
    "AUDIO_SENSITIVE":        0.05,
}

BATCH_SIZE = 50_000  # events per ClickHouse batch insert


def _make_event(
    screening_id: str,
    session_id: str,
    viewer_id: str,
    video_id: str,
    event_type: str,
    timecode: float,
    rng: random.Random,
    run_timestamp: Optional[datetime.datetime] = None,
) -> Dict[str, Any]:
    if not run_timestamp:
        run_timestamp = datetime.datetime.now(datetime.timezone.utc)
    return {
        "event_id": str(uuid.uuid4()),
        "screening_id": screening_id,
        "session_id": session_id,
        "anonymous_viewer_id": viewer_id,
        "video_id": video_id,
        "event_type": event_type,
        "video_timecode_sec": round(timecode, 2),
        "client_timestamp": run_timestamp,
        "server_timestamp": run_timestamp,
    }


def _in_window(t: float, windows: List[Dict]) -> Optional[Dict]:
    for w in windows:
        if w["start"] <= t <= w["end"]:
            return w
    return None


# ---------------------------------------------------------------------------
# Mode 1: REAL_ANCHORED / HYBRID Event Generator
# ---------------------------------------------------------------------------

def _generate_real_anchored_events(
    screening_id: str,
    video_id: str,
    duration: float,
    fingerprint: Dict[str, Any],
    rng: random.Random,
    variation_strength: str = "MEDIUM",
    viewer_id: Optional[str] = None,
    ground_truth: Optional[List[Dict]] = None,
    weight_real: float = 1.0,
    run_timestamp: Optional[datetime.datetime] = None,
) -> List[Dict[str, Any]]:
    if not viewer_id:
        viewer_id = f"synth_v_{uuid.uuid4().hex[:16]}"
    session_id = f"synth_s_{uuid.uuid4().hex[:16]}"
    events: List[Dict[str, Any]] = []

    def emit(event_type: str, t: float):
        # Apply organic micro-jitter (±1.5s) to prevent rigid 10s step alignment
        jittered_t = max(0.0, min(duration, round(t + rng.uniform(-1.5, 1.5), 2)))
        events.append(_make_event(screening_id, session_id, viewer_id, video_id, event_type, jittered_t, rng, run_timestamp=run_timestamp))

    emit("TAB_VISIBLE", 0)
    emit("PLAY", 0)

    # Jitter scale: LOW=5%, MEDIUM=15%, HIGH=25%
    j_scale = {"LOW": 0.05, "MEDIUM": 0.15, "HIGH": 0.25}.get(variation_strength.upper(), 0.15)
    
    # Generic baseline probabilities for HYBRID fallback blending
    generic_p = {"pause": 0.03, "rewind": 0.02, "skip": 0.02, "replay": 0.02, "exit": 0.04}

    completion_rate = fingerprint.get("completion_rate", 0.70)
    # Controlled variation on completion decision
    will_complete = (rng.random() < max(0.1, min(0.95, completion_rate + rng.uniform(-j_scale, j_scale))))

    time_buckets = fingerprint.get("time_buckets", [])
    bucket_sec = fingerprint.get("bucket_sec", 10)
    bucket_map = {b["time_sec"]: b for b in time_buckets}

    t = 0.0
    step = rng.uniform(3.0, 7.0)

    while t < duration:
        t = min(t + step, duration)
        curr_b_time = (int(t) // bucket_sec) * bucket_sec
        b_info = bucket_map.get(curr_b_time)

        if rng.random() < 0.4:
            emit("PROGRESS", t)

        window = _in_window(t, ground_truth) if ground_truth else None

        if b_info:
            if not will_complete:
                exit_p_real = b_info.get("exit_prob", 0.05)
                exit_p = (weight_real * exit_p_real + (1 - weight_real) * generic_p["exit"]) * (1.0 + rng.uniform(-j_scale, j_scale))
                if rng.random() < exit_p:
                    emit("EXIT", t)
                    return events

            # Time-local probability sampling with controlled variation
            def get_prob(m_key: str, p_key: str) -> float:
                p_real = b_info.get(f"{m_key}_prob", generic_p[m_key])
                blended = weight_real * p_real + (1 - weight_real) * generic_p[m_key]
                return blended * (1.0 + rng.uniform(-j_scale, j_scale))

            r_p = get_prob("rewind", "rewind_prob")
            p_p = get_prob("pause", "pause_prob")
            s_p = get_prob("skip", "skip_prob")
            rp_p = get_prob("replay", "replay_prob")

            if rng.random() < r_p:
                seek_t = max(0.0, t - rng.uniform(3, 12))
                emit("SEEK_BACKWARD", seek_t)
                emit("PLAY", seek_t)

            if rng.random() < p_p:
                emit("PAUSE", t)
                if rng.random() < 0.6:
                    emit("PLAY", t)

            if rng.random() < s_p:
                seek_t = min(duration, t + rng.uniform(5, 15))
                emit("SEEK_FORWARD", seek_t)
                t = seek_t

            if rng.random() < rp_p:
                seek_t = max(0.0, t - rng.uniform(5, 20))
                emit("REPLAY", seek_t)
                emit("PLAY", seek_t)

        # Amplification if injected ground truth is present for demo
        if window:
            if window["label"] == "pacing" and rng.random() < 0.5:
                emit("SEEK_FORWARD", min(duration, t + 10))
            elif window["label"] == "comprehension" and rng.random() < 0.5:
                emit("PAUSE", t)
                emit("SEEK_BACKWARD", max(0, t - 10))
            elif window["label"] == "exceptional_engagement" and rng.random() < 0.5:
                emit("REPLAY", max(0, t - 10))

        step = rng.uniform(3.0, 7.0)

    if will_complete:
        emit("COMPLETE", duration)
    else:
        emit("EXIT", duration)

    return events


# ---------------------------------------------------------------------------
# Mode 3: COLD_START Event Generator
# ---------------------------------------------------------------------------

def _generate_cold_start_events(
    screening_id: str,
    video_id: str,
    duration: float,
    profile: str,
    ground_truth: List[Dict],
    rng: random.Random,
    viewer_id: Optional[str] = None,
    run_timestamp: Optional[datetime.datetime] = None,
) -> List[Dict[str, Any]]:
    if not viewer_id:
        viewer_id = f"synth_v_{uuid.uuid4().hex[:16]}"
    session_id = f"synth_s_{uuid.uuid4().hex[:16]}"
    events: List[Dict[str, Any]] = []

    def emit(event_type: str, t: float):
        jittered_t = max(0.0, min(duration, round(t + rng.uniform(-1.5, 1.5), 2)))
        events.append(_make_event(screening_id, session_id, viewer_id, video_id, event_type, jittered_t, rng, run_timestamp=run_timestamp))

    emit("TAB_VISIBLE", 0)
    emit("PLAY", 0)

    if profile == "EARLY_ABANDONER":
        abandon_at = rng.uniform(0.05, 0.30) * duration
    elif profile == "NORMAL":
        abandon_at = rng.uniform(0.60, 1.10) * duration
    else:
        abandon_at = rng.uniform(0.75, 1.10) * duration

    t = 0.0
    step = rng.uniform(3.0, 8.0)

    while t < duration:
        t = min(t + step, duration)
        window = _in_window(t, ground_truth)

        if rng.random() < 0.4:
            emit("PROGRESS", t)

        if t >= abandon_at:
            emit("EXIT", t)
            return events

        if window:
            label = window["label"]
            if label == "pacing":
                if profile in ("PACING_SENSITIVE", "NORMAL") and rng.random() < 0.55:
                    emit("SEEK_FORWARD", t)
                    t = min(t + rng.uniform(5, 20), duration)
                if rng.random() < (0.35 if profile == "PACING_SENSITIVE" else 0.10):
                    emit("EXIT", t)
                    return events

            elif label == "comprehension":
                if profile in ("COMPREHENSION_SENSITIVE", "NORMAL") and rng.random() < 0.60:
                    emit("PAUSE", t)
                    if rng.random() < 0.70:
                        emit("SEEK_BACKWARD", max(0, t - rng.uniform(5, 20)))
                        emit("PLAY", max(0, t - rng.uniform(5, 20)))
                if rng.random() < (0.25 if profile == "COMPREHENSION_SENSITIVE" else 0.05):
                    emit("EXIT", t)
                    return events

            elif label == "audio":
                if profile in ("AUDIO_SENSITIVE", "NORMAL") and rng.random() < 0.55:
                    emit("VOLUME_CHANGE", t)
                    if rng.random() < 0.40:
                        emit("SEEK_BACKWARD", max(0, t - rng.uniform(3, 10)))
                        emit("PLAY", max(0, t - rng.uniform(3, 10)))
                if rng.random() < (0.20 if profile == "AUDIO_SENSITIVE" else 0.05):
                    emit("EXIT", t)
                    return events

            elif label == "exceptional_engagement":
                if profile in ("ENGAGED", "NORMAL") and rng.random() < 0.65:
                    replay_target = max(0, t - rng.uniform(3, 15))
                    emit("REPLAY", replay_target)
                    emit("PLAY", replay_target)
        else:
            if rng.random() < 0.04: emit("PAUSE", t)
            if rng.random() < 0.02: emit("VOLUME_CHANGE", t)
            if rng.random() < 0.015:
                emit("SEEK_BACKWARD", max(0, t - rng.uniform(2, 8)))
                emit("PLAY", max(0, t - rng.uniform(2, 8)))
            if profile == "ENGAGED" and rng.random() < 0.03:
                emit("REPLAY", max(0, t - rng.uniform(5, 20)))

        step = rng.uniform(3.0, 8.0)

    emit("COMPLETE", duration)
    return events


# ---------------------------------------------------------------------------
# Main Entry Point: run_simulation
# ---------------------------------------------------------------------------

def fetch_real_viewer_sessions(screening_id: str) -> List[List[Dict[str, Any]]]:
    """Fetches real viewer event sequences from ClickHouse grouped by anonymous_viewer_id."""
    client = get_client()
    sid = screening_id.replace("'", "")
    query = f"""
    SELECT
        anonymous_viewer_id,
        event_type,
        video_timecode_sec
    FROM viewer_events
    WHERE screening_id = '{sid}' AND anonymous_viewer_id NOT LIKE 'synth_v_%'
    ORDER BY anonymous_viewer_id, client_timestamp ASC
    """
    rows = client.query(query).result_rows
    if not rows:
        return []

    sessions_map: Dict[str, List[Dict[str, Any]]] = {}
    for vid, etype, tc in rows:
        if vid not in sessions_map:
            sessions_map[vid] = []
        sessions_map[vid].append({"event_type": etype, "video_timecode_sec": float(tc)})

    return list(sessions_map.values())


def run_simulation(
    screening_id: str,
    video_id: str,
    duration: float,
    num_viewers: int,
    mode: str = "AUTO",
    variation_strength: str = "MEDIUM",
    inject_ground_truth: bool = False,
    seed: Optional[int] = None,
    batch_size: int = BATCH_SIZE,
) -> Dict[str, Any]:
    """
    Real-Anchored Synthetic Audience Generator.
    """
    rng = random.Random(seed)
    run_ts = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Fetch real viewer count to determine AUTO mode
    overview = get_audience_overview(screening_id)
    real_viewers_count = overview.get("real_viewers", overview["unique_viewers"])

    req_mode = (mode or "AUTO").upper()
    if req_mode == "AUTO":
        if real_viewers_count == 0:
            effective_mode = "COLD_START"
        elif real_viewers_count < 10:
            effective_mode = "HYBRID"
        else:
            effective_mode = "REAL_ANCHORED"
    else:
        effective_mode = req_mode

    total_events = 0
    batch: List[Dict[str, Any]] = []

    # Handle EXACT_REPLAY mode: replicate exact real viewer event streams with zero jitter
    if effective_mode in ("EXACT_REPLAY", "EXACT_CLONE"):
        client = get_client()
        sid = screening_id.replace("'", "")
        vid = video_id.replace("'", "")

        real_count = int(client.command(f"SELECT count() FROM viewer_events WHERE screening_id = '{sid}' AND anonymous_viewer_id NOT LIKE 'synth_v_%'"))
        if real_count == 0:
            raise ValueError("No original real viewer telemetry found for this screening. Original real viewer data is required for Exact Replay mode.")

        num_real_viewers = int(client.command(f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{sid}' AND anonymous_viewer_id NOT LIKE 'synth_v_%'"))

        # Execute safe chunked vector insert in ClickHouse (50,000 viewers per chunk) to prevent Docker OOM
        chunk_size = 50_000
        for offset in range(0, num_viewers, chunk_size):
            cur_chunk = min(chunk_size, num_viewers - offset)
            insert_sql = f"""
            INSERT INTO viewer_events (
                event_id, screening_id, session_id, anonymous_viewer_id,
                video_id, event_type, video_timecode_sec, client_timestamp, server_timestamp
            )
            SELECT
                generateUUIDv4() AS event_id,
                '{sid}' AS screening_id,
                concat('synth_s_', substring(hex(MD5(concat(toString({offset} + v.idx), '_s'))), 1, 16)) AS session_id,
                concat('synth_v_', substring(hex(MD5(concat(toString({offset} + v.idx), '_v'))), 1, 16)) AS anonymous_viewer_id,
                '{vid}' AS video_id,
                r.event_type AS event_type,
                r.video_timecode_sec AS video_timecode_sec,
                now64(3, 'UTC') AS client_timestamp,
                now64(3, 'UTC') AS server_timestamp
            FROM (
                SELECT event_type, video_timecode_sec
                FROM viewer_events
                WHERE screening_id = '{sid}' AND anonymous_viewer_id NOT LIKE 'synth_v_%'
            ) AS r
            CROSS JOIN (
                SELECT number AS idx FROM numbers({cur_chunk})
            ) AS v
            """
            client.command(insert_sql)

        total_events = real_count * num_viewers

        return {
            "screening_id": screening_id,
            "video_id": video_id,
            "num_viewers": num_viewers,
            "total_events_generated": total_events,
            "simulation_mode": "EXACT_REPLAY",
            "requested_mode": mode,
            "real_viewers_analyzed": num_real_viewers,
            "variation_strength": "NONE (0% Jitter - Accelerated)",
            "ground_truth_injected": False,
            "seed": seed,
        }

    # 2. Extract real behavioral fingerprint if REAL_ANCHORED or HYBRID
    fingerprint = None
    if effective_mode in ("REAL_ANCHORED", "HYBRID"):
        fingerprint = build_behavioral_fingerprint(screening_id)

    # 3. Ground truth setup
    ground_truth = get_default_ground_truth(duration) if (effective_mode == "COLD_START" or inject_ground_truth) else None

    profiles = list(PROFILE_WEIGHTS.keys())
    weights = list(PROFILE_WEIGHTS.values())

    viewer_pool: List[str] = []

    for _ in range(num_viewers):
        # 15% chance of a returning viewer opening a repeat session
        if viewer_pool and rng.random() < 0.15:
            current_viewer_id = rng.choice(viewer_pool)
        else:
            current_viewer_id = f"synth_v_{uuid.uuid4().hex[:16]}"
            viewer_pool.append(current_viewer_id)

        if effective_mode == "REAL_ANCHORED" and fingerprint and fingerprint["time_buckets"]:
            v_events = _generate_real_anchored_events(
                screening_id=screening_id, video_id=video_id, duration=duration,
                fingerprint=fingerprint, rng=rng, variation_strength=variation_strength,
                viewer_id=current_viewer_id, ground_truth=ground_truth, weight_real=1.0,
                run_timestamp=run_ts,
            )
        elif effective_mode == "HYBRID" and fingerprint and fingerprint["time_buckets"]:
            w_real = min(1.0, max(0.1, real_viewers_count / 10.0))
            v_events = _generate_real_anchored_events(
                screening_id=screening_id, video_id=video_id, duration=duration,
                fingerprint=fingerprint, rng=rng, variation_strength=variation_strength,
                viewer_id=current_viewer_id, ground_truth=ground_truth, weight_real=w_real,
                run_timestamp=run_ts,
            )
        else:
            profile = rng.choices(profiles, weights=weights, k=1)[0]
            v_events = _generate_cold_start_events(
                screening_id=screening_id, video_id=video_id, duration=duration,
                profile=profile, ground_truth=ground_truth or get_default_ground_truth(duration),
                rng=rng, viewer_id=current_viewer_id, run_timestamp=run_ts,
            )

        batch.extend(v_events)
        total_events += len(v_events)

        if len(batch) >= batch_size:
            insert_events(batch)
            batch = []

    if batch:
        insert_events(batch)

    return {
        "screening_id": screening_id,
        "video_id": video_id,
        "num_viewers": num_viewers,
        "total_events_generated": total_events,
        "simulation_mode": effective_mode,
        "requested_mode": mode,
        "real_viewers_analyzed": real_viewers_count,
        "variation_strength": variation_strength,
        "ground_truth_injected": bool(ground_truth),
        "seed": seed,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

    parser = argparse.ArgumentParser(description="Frame Sense – Real-Anchored Synthetic Audience Generator (DEV ONLY)")
    parser.add_argument("--screening_id", required=True)
    parser.add_argument("--video_id",     required=True)
    parser.add_argument("--duration",     type=float, default=300.0)
    parser.add_argument("--viewers",      type=int,   default=100)
    parser.add_argument("--mode",         type=str,   default="AUTO")
    parser.add_argument("--variation",    type=str,   default="MEDIUM")
    parser.add_argument("--seed",         type=int,   default=None)
    args = parser.parse_args()

    print(f"[SIMULATOR] Generating {args.viewers} viewers for screening {args.screening_id} (Mode: {args.mode}) ...")
    result = run_simulation(
        screening_id=args.screening_id,
        video_id=args.video_id,
        duration=args.duration,
        num_viewers=args.viewers,
        mode=args.mode,
        variation_strength=args.variation,
        seed=args.seed,
    )
    print(f"[SIMULATOR] Done. Effective Mode: {result['simulation_mode']}. Total events: {result['total_events_generated']}")
