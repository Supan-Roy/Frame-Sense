"""
Synthetic Audience Simulator
=============================
DEVELOPER / DEMO TOOL ONLY.

NOT part of the normal screening workflow.
NOT exposed in the public Screening Room.

Purpose:
- Development and integration testing
- Stress testing ClickHouse at scale (10,000 viewers, 1M+ events)
- Reproducible experiments with known behavioral patterns
- Hackathon demonstration without real audience

Usage:
    python -m app.screening.simulator --screening_id sc_xxx --video_id med_xxx
                                      --duration 300 --viewers 1000 --seed 42

The simulator uses the EXACT same ViewerEvent schema as real browser telemetry.
No parallel schema is created. All events enter viewer_events directly via batch insert.

Behavioral profiles (exist only inside this file, never written to ClickHouse):
    NORMAL               - Standard watch behaviour
    ENGAGED              - High retention and replay
    EARLY_ABANDONER      - Exits in first 10-30% of video
    PACING_SENSITIVE     - Seek-forward and exit spikes in pacing windows
    COMPREHENSION_SENSITIVE - Pause and rewind spikes in comprehension windows
    AUDIO_SENSITIVE      - Volume change and rewind spikes in audio windows

Hidden ground truth (demo default, 300s video):
    72-84s   pacing window        (seek-forward + exit spike)
    96-104s  exceptional_engagement (replay + completion spike)
    151-163s comprehension window  (pause + rewind spike)
    221-230s audio window          (volume_change + rewind spike)

Ground truth is NEVER returned by Audience Intelligence API endpoints.
"""
import uuid
import random
import datetime
from typing import List, Dict, Any, Optional
from app.database.clickhouse import get_client, insert_events

# ---------------------------------------------------------------------------
# Default ground truth configuration (demo / stress test)
# ---------------------------------------------------------------------------

DEFAULT_GROUND_TRUTH = [
    {"label": "pacing",               "start": 72,  "end": 84},
    {"label": "exceptional_engagement","start": 96,  "end": 104},
    {"label": "comprehension",         "start": 151, "end": 163},
    {"label": "audio",                 "start": 221, "end": 230},
]

# Viewer profile distribution weights (must sum to 1.0)
PROFILE_WEIGHTS = {
    "NORMAL":                 0.45,
    "ENGAGED":                0.20,
    "EARLY_ABANDONER":        0.10,
    "PACING_SENSITIVE":       0.10,
    "COMPREHENSION_SENSITIVE":0.10,
    "AUDIO_SENSITIVE":        0.05,
}

BATCH_SIZE = 50_000  # events per ClickHouse batch insert


# ---------------------------------------------------------------------------
# Event helpers
# ---------------------------------------------------------------------------

def _make_event(
    screening_id: str,
    session_id: str,
    viewer_id: str,
    video_id: str,
    event_type: str,
    timecode: float,
    rng: random.Random,
) -> Dict[str, Any]:
    base_ts = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
    # Slight jitter on timestamps for realism
    ts_offset = datetime.timedelta(seconds=rng.uniform(0, 3600))
    ts = (base_ts + ts_offset).isoformat()
    return {
        "event_id": str(uuid.uuid4()),
        "screening_id": screening_id,
        "session_id": session_id,
        "anonymous_viewer_id": viewer_id,
        "video_id": video_id,
        "event_type": event_type,
        "video_timecode_sec": round(timecode, 2),
        "client_timestamp": ts,
        "server_timestamp": ts,
    }


def _in_window(t: float, windows: List[Dict]) -> Optional[Dict]:
    for w in windows:
        if w["start"] <= t <= w["end"]:
            return w
    return None


# ---------------------------------------------------------------------------
# Per-viewer event generation
# ---------------------------------------------------------------------------

def _generate_viewer_events(
    screening_id: str,
    video_id: str,
    duration: float,
    profile: str,
    ground_truth: List[Dict],
    rng: random.Random,
) -> List[Dict[str, Any]]:
    viewer_id = f"synth_v_{uuid.uuid4().hex[:16]}"
    session_id = f"synth_s_{uuid.uuid4().hex[:16]}"
    events: List[Dict[str, Any]] = []

    def emit(event_type: str, t: float):
        events.append(_make_event(screening_id, session_id, viewer_id, video_id, event_type, t, rng))

    # --- TAB_VISIBLE and PLAY ---
    emit("TAB_VISIBLE", 0)
    emit("PLAY", 0)

    # Determine abandon probability
    if profile == "EARLY_ABANDONER":
        abandon_at = rng.uniform(0.05, 0.30) * duration
    elif profile == "NORMAL":
        abandon_at = rng.uniform(0.60, 1.10) * duration  # may complete
    else:
        abandon_at = rng.uniform(0.75, 1.10) * duration

    # Walk through video in small steps emitting PROGRESS + behavioural events
    t = 0.0
    step = rng.uniform(3.0, 8.0)

    while t < duration:
        t = min(t + step, duration)
        window = _in_window(t, ground_truth)

        # ---- PROGRESS heartbeat
        if rng.random() < 0.4:
            emit("PROGRESS", t)

        # ---- Abandon check
        if t >= abandon_at:
            emit("EXIT", t)
            return events

        # ---- Profile-specific + window-amplified behaviour
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
            # Outside anomaly windows - sparse normal behaviour
            if rng.random() < 0.04:
                emit("PAUSE", t)
            if rng.random() < 0.02:
                emit("VOLUME_CHANGE", t)
            if rng.random() < 0.015:
                emit("SEEK_BACKWARD", max(0, t - rng.uniform(2, 8)))
                emit("PLAY", max(0, t - rng.uniform(2, 8)))
            if profile == "ENGAGED" and rng.random() < 0.03:
                replay_t = max(0, t - rng.uniform(5, 20))
                emit("REPLAY", replay_t)

        step = rng.uniform(3.0, 8.0)

    # Reached the end → COMPLETE
    emit("COMPLETE", duration)
    return events


# ---------------------------------------------------------------------------
# Public API: run simulation
# ---------------------------------------------------------------------------

def run_simulation(
    screening_id: str,
    video_id: str,
    duration: float,
    num_viewers: int,
    ground_truth: Optional[List[Dict]] = None,
    seed: Optional[int] = None,
    batch_size: int = BATCH_SIZE,
) -> Dict[str, Any]:
    """
    Generate synthetic viewer events and bulk-insert into ClickHouse.

    Parameters
    ----------
    screening_id  : Target screening (must already exist in SQLite metadata)
    video_id      : The media_id for this screening
    duration      : Video duration in seconds
    num_viewers   : Number of synthetic viewers to simulate
    ground_truth  : Behavioral anomaly windows; defaults to DEFAULT_GROUND_TRUTH
    seed          : Random seed for reproducibility
    batch_size    : Events per ClickHouse batch insert call

    Returns summary dict with generated stats.
    """
    if ground_truth is None:
        ground_truth = DEFAULT_GROUND_TRUTH

    rng = random.Random(seed)
    profiles = list(PROFILE_WEIGHTS.keys())
    weights = list(PROFILE_WEIGHTS.values())

    total_events = 0
    batch: List[Dict[str, Any]] = []

    for _ in range(num_viewers):
        profile = rng.choices(profiles, weights=weights, k=1)[0]
        viewer_events = _generate_viewer_events(
            screening_id=screening_id,
            video_id=video_id,
            duration=duration,
            profile=profile,
            ground_truth=ground_truth,
            rng=rng,
        )
        batch.extend(viewer_events)
        total_events += len(viewer_events)

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
        "ground_truth_windows": ground_truth,
        "seed": seed,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

    parser = argparse.ArgumentParser(description="Frame Sense – Synthetic Audience Simulator (DEV ONLY)")
    parser.add_argument("--screening_id", required=True)
    parser.add_argument("--video_id",     required=True)
    parser.add_argument("--duration",     type=float, default=300.0)
    parser.add_argument("--viewers",      type=int,   default=100)
    parser.add_argument("--seed",         type=int,   default=None)
    args = parser.parse_args()

    print(f"[SIMULATOR] Generating {args.viewers} viewers for screening {args.screening_id} ...")
    result = run_simulation(
        screening_id=args.screening_id,
        video_id=args.video_id,
        duration=args.duration,
        num_viewers=args.viewers,
        seed=args.seed,
    )
    print(f"[SIMULATOR] Done. Total events: {result['total_events_generated']}")
