import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
import clickhouse_connect
from clickhouse_connect.driver.client import Client
from app.core.config import settings

import urllib3
import clickhouse_connect.driver.httputil as httputil

_db_initialized = False
_client_instance: Client | None = None
_pool_mgr_instance = None

def _get_shared_pool_mgr():
    global _pool_mgr_instance
    if _pool_mgr_instance is None:
        retries = urllib3.util.Retry(
            total=5,
            connect=5,
            read=5,
            status=5,
            backoff_factor=0.2,
            raise_on_status=False
        )
        _pool_mgr_instance = httputil.get_pool_manager(retries=retries, maxsize=50)
    return _pool_mgr_instance

def _create_new_client() -> Client:
    return clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD,
        database=settings.CLICKHOUSE_DATABASE,
        secure=settings.CLICKHOUSE_SECURE,
        connect_timeout=5,
        send_receive_timeout=15,
        pool_mgr=_get_shared_pool_mgr()
    )

def reset_client():
    global _client_instance
    _client_instance = None

def get_client(auto_init: bool = True) -> Client:
    global _db_initialized
    client = _create_new_client()
    if auto_init and not _db_initialized:
        ensure_db_initialized(client)
    return client

def ensure_db_initialized(client: Client | None = None):
    global _db_initialized
    try:
        if client is None:
            client = get_client(auto_init=False)
        _run_schema_creation(client)
        _db_initialized = True
    except Exception as e:
        print(f"ClickHouse schema initialization notice: {e}")

def _run_schema_creation(client: Client):
    # Create tables for telemetry events and 100% ClickHouse metadata storage

    # Raw telemetry events
    client.command("""
    CREATE TABLE IF NOT EXISTS default.viewer_events (
        event_id UUID,
        screening_id String,
        session_id String,
        anonymous_viewer_id String,
        video_id String,
        event_type LowCardinality(String),
        video_timecode_sec Float32,
        client_timestamp DateTime64(3, 'UTC'),
        server_timestamp DateTime64(3, 'UTC')
    ) ENGINE = MergeTree()
    ORDER BY (screening_id, video_id, event_type, server_timestamp);
    """)

    # Screenings metadata table
    client.command("""
    CREATE TABLE IF NOT EXISTS default.screenings (
        screening_id String,
        media_id String,
        title String,
        description String,
        media_filename String,
        media_duration Float32,
        created_at DateTime64(3, 'UTC'),
        status String,
        public_token String
    ) ENGINE = ReplacingMergeTree(created_at)
    ORDER BY screening_id;
    """)

    # Editorial comments table
    client.command("""
    CREATE TABLE IF NOT EXISTS default.comments (
        comment_id String,
        screening_id String,
        viewer_id String,
        display_name String,
        video_timecode_sec Float32,
        content String,
        created_at DateTime64(3, 'UTC'),
        updated_at DateTime64(3, 'UTC')
    ) ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (screening_id, comment_id);
    """)

    # Saved AI vision investigations table
    client.command("""
    CREATE TABLE IF NOT EXISTS default.investigations (
        screening_id String,
        anomaly_id String,
        investigation_report String,
        mcp_queries_json String,
        extracted_frames_json String,
        elaborated_report String,
        updated_at DateTime64(3, 'UTC')
    ) ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (screening_id, anomaly_id);
    """)

    # Chat sessions table
    client.command("""
    CREATE TABLE IF NOT EXISTS default.chat_sessions (
        session_id String,
        screening_id String,
        title String,
        created_at DateTime64(3, 'UTC'),
        updated_at DateTime64(3, 'UTC')
    ) ENGINE = ReplacingMergeTree(updated_at)
    ORDER BY (screening_id, session_id);
    """)

    # Chat messages table
    client.command("""
    CREATE TABLE IF NOT EXISTS default.chat_messages (
        message_id String,
        session_id String,
        screening_id String,
        role String,
        content String,
        created_at DateTime64(3, 'UTC')
    ) ENGINE = MergeTree()
    ORDER BY (screening_id, session_id, created_at);
    """)

    # Seed persistent screenings from screenings.json backup if not already present
    try:
        json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "screenings.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                saved_screenings = json.load(f)
            for s in saved_screenings:
                exists_check = client.query(f"SELECT count() FROM default.screenings WHERE screening_id = '{s['screening_id']}'").result_rows[0][0]
                if exists_check == 0:
                    cr_dt = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00")) if "created_at" in s else datetime.now(timezone.utc)
                    client.insert("screenings", [[
                        s["screening_id"], s["media_id"], s["title"], s.get("description") or "",
                        s["media_filename"], float(s["media_duration"]), cr_dt, s.get("status") or "active", s["public_token"]
                    ]], column_names=[
                        "screening_id", "media_id", "title", "description",
                        "media_filename", "media_duration", "created_at", "status", "public_token"
                    ])
                    print(f"Ensured screening {s['screening_id']} ({s['title']}) is seeded in default.screenings.")
    except Exception as seed_err:
        print(f"Notice during screening seed: {seed_err}")

    # Seed demo telemetry events, comments, and AI investigations for sc_13c510b37cc8 if empty
    try:
        _seed_demo_telemetry_if_needed(client)
    except Exception as seed_ev_err:
        print(f"Notice during telemetry demo seed: {seed_ev_err}")

    print("ClickHouse database schema initialized successfully.")

def _seed_demo_telemetry_if_needed(client: Client):
    screening_id = "sc_13c510b37cc8"
    video_id = "med_9e56af862101"
    
    check_res = client.query(f"SELECT count() FROM default.viewer_events WHERE screening_id = '{screening_id}'")
    if check_res.result_rows and check_res.result_rows[0][0] > 0:
        return

    print(f"Seeding initial telemetry & AI investigations for {screening_id}...")
    base_dt = datetime.now(timezone.utc) - timedelta(hours=2)

    # 1. Generate core telemetry events for 2,500 viewers
    rows = []
    total_viewers = 2500
    for idx in range(total_viewers):
        v_id = f"synth_v_{idx:06d}"
        sess_id = f"sess_{v_id}"
        v_dt = base_dt + timedelta(seconds=(idx % 3600))

        rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "PLAY", 0.0, v_dt, v_dt])
        for s in range(1, 15):
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "PROGRESS", float(s), v_dt + timedelta(seconds=s), v_dt + timedelta(seconds=s)])
        
        # 14s-17s: Dark screen skip for 67%
        if idx % 3 != 0:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "SEEK_FORWARD", 15.0, v_dt + timedelta(seconds=14.5), v_dt + timedelta(seconds=14.5)])
        else:
            for s in [15, 16, 17]:
                rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "PROGRESS", float(s), v_dt + timedelta(seconds=s), v_dt + timedelta(seconds=s)])

        # 18s-25s: Slow screenplay pacing split
        if idx % 3 == 0:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "SEEK_FORWARD", 19.0, v_dt + timedelta(seconds=19), v_dt + timedelta(seconds=19)])
        else:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "PAUSE", 18.0, v_dt + timedelta(seconds=18), v_dt + timedelta(seconds=18)])
            for s in range(19, 25):
                rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "PROGRESS", float(s), v_dt + timedelta(seconds=s), v_dt + timedelta(seconds=s)])

        # 25s-29s: Dialogue scene replay hotspot
        if idx % 4 != 0:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "SEEK_BACKWARD", 25.0, v_dt + timedelta(seconds=27.5), v_dt + timedelta(seconds=27.5)])
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "REPLAY", 25.0, v_dt + timedelta(seconds=28.0), v_dt + timedelta(seconds=28.0)])

        # 29s-32s: Exit vs Complete
        if idx % 3 == 0:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "EXIT", 30.0, v_dt + timedelta(seconds=30), v_dt + timedelta(seconds=30)])
        else:
            rows.append([uuid.uuid4(), screening_id, sess_id, v_id, video_id, "COMPLETE", 32.0, v_dt + timedelta(seconds=32), v_dt + timedelta(seconds=32)])

    chunk_size = 10000
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        client.insert("viewer_events", chunk, column_names=[
            "event_id", "screening_id", "session_id", "anonymous_viewer_id",
            "video_id", "event_type", "video_timecode_sec", "client_timestamp", "server_timestamp"
        ])

    # 2. Seed Editorial Comments
    comments_data = [
        ["cmt_demo_01", screening_id, "dir_supan", "Director Supan", 15.0, "Dark Screen Transition: 'The Next Day' dark screen scene transition triggers 66.7% fast-forward skip rate. Cut dark screen transition by 1.5 seconds.", base_dt, base_dt],
        ["cmt_demo_02", screening_id, "ed_clara", "Lead Editor Clara", 18.0, "Slow Screenplay Pacing: Audience pauses and fast-forwards across 18s-25s due to slow screenplay pacing. Speed up scene pacing.", base_dt, base_dt],
        ["cmt_demo_03", screening_id, "dir_supan", "Director Supan", 28.5, "Tail Exit Drop: Viewers exit near scene resolution (28s-32s). Improve narrative hook to attract and hold viewer attention.", base_dt, base_dt],
    ]
    client.insert("comments", comments_data, column_names=[
        "comment_id", "screening_id", "viewer_id", "display_name", "video_timecode_sec", "content", "created_at", "updated_at"
    ])

    # 3. Seed AI Vision Investigations
    inv_rows = [
        [
            screening_id, "anm_dark_screen_15s",
            "### 1. OBSERVED AUDIENCE BEHAVIOR\nA major pacing transition anomaly occurred between 14.0s and 18.0s, where **84,216 viewers (66.7% skip rate)** fast-forwarded across the dark screen scene transition ('The Next Day').\n\n### 2. QUANTITATIVE EVIDENCE\n- **Fast-Forward Skip Rate**: 66.7%\n- **Transition Retention Dip**: 33.3% at 15.0s – 17.0s\n- **Z-Score Deviation**: +4.82σ above baseline\n\n### 3. VISUAL EVIDENCE\nVisual frame inspection at 14.5s - 17.0s reveals a static dark screen transition displaying text: *'The Next Day'*.\n\n### 4. TELEMETRY ↔ VISUAL CORRELATION\nThe length of the dark screen transition creates a visual pause causing viewers to actively skip forward to the next scene.\n\n### 5. PLAUSIBLE EXPLANATIONS\nStatic dark screen transitions create pacing friction that prompts audience fast-forwarding.\n\n### 6. CONFIDENCE\n**HIGH** (Statistical Power: 126,324 viewers).\n\n### 7. VALIDATION EVIDENCE\nCutting the dark screen transition between 14s – 18s will eliminate viewer skip friction and preserve narrative momentum.",
            json.dumps([{"query": f"SELECT count() FROM viewer_events WHERE screening_id='{screening_id}' AND video_timecode_sec BETWEEN 14 AND 18"}]),
            json.dumps([{"frame_timecode_sec": 15.0, "description": "Dark Screen Scene Transition ('The Next Day')"}]),
            "### Recommended AI Editorial Cut\n**Action**: Cut 1.5 seconds from the 14s – 18s dark screen scene transition.\n**Impact**: Eliminates viewer skip friction and preserves narrative momentum through Scene 2.",
            base_dt
        ],
        [
            screening_id, "anm_slow_pacing_18s",
            "### 1. OBSERVED AUDIENCE BEHAVIOR\nSlow screenplay pacing friction occurred between 18.0s and 25.0s, causing **48,000 viewers to pause** and **42,108 viewers to fast-forward**.\n\n### 2. QUANTITATIVE EVIDENCE\n- **Pause Rate**: 38.0%\n- **Fast-Forward Rate**: 33.3%\n- **Z-Score Deviation**: +3.65σ above baseline\n\n### 3. VISUAL EVIDENCE\nShot inspection at 18.0s – 25.0s shows a slow wide shot of the clockmaker workshop with extended silent pauses between action beats.\n\n### 4. TELEMETRY ↔ VISUAL CORRELATION\nExtended static beats in the screenplay create pacing lag, prompting viewers to seek ahead or pause.\n\n### 5. PLAUSIBLE EXPLANATIONS\nScreenplay execution in this window is overly slow relative to audience engagement expectations.\n\n### 6. CONFIDENCE\n**HIGH** (Statistical Power: 126,324 viewers).\n\n### 7. VALIDATION EVIDENCE\nSpeeding up screenplay pacing between 18s – 25s will maintain continuous audience momentum.",
            json.dumps([{"query": f"SELECT count() FROM viewer_events WHERE screening_id='{screening_id}' AND video_timecode_sec BETWEEN 18 AND 25"}]),
            json.dumps([{"frame_timecode_sec": 19.0, "description": "Workshop Shot Pacing Lag"}]),
            "### Recommended AI Editorial Cut\n**Action**: Speed up screenplay pacing between 18s – 25s by tightening shot transitions and dialogue beats.\n**Impact**: Maintains continuous audience momentum and heightens visual engagement.",
            base_dt
        ]
    ]
    client.insert("investigations", inv_rows, column_names=[
        "screening_id", "anomaly_id", "investigation_report", "mcp_queries_json", "extracted_frames_json", "elaborated_report", "updated_at"
    ])
    print(f"Seeded demo telemetry, comments, and AI investigations for {screening_id} successfully!")

def init_db(client: Client | None = None):
    ensure_db_initialized(client)

def insert_events(events: List[Dict[str, Any]]):
    client = get_client()
    data = []
    for e in events:
        # Convert event_id string to a Python UUID object for ClickHouse UUID serializer
        raw_event_id = e["event_id"]
        clickhouse_uuid = uuid.UUID(raw_event_id) if isinstance(raw_event_id, str) else raw_event_id
        
        c_ts = e["client_timestamp"]
        if isinstance(c_ts, str):
            c_ts = datetime.fromisoformat(c_ts.replace('Z', '+00:00'))
            
        s_ts = e.get("server_timestamp") or c_ts
        if isinstance(s_ts, str):
            s_ts = datetime.fromisoformat(s_ts.replace('Z', '+00:00'))
            
        data.append([
            clickhouse_uuid,
            e["screening_id"],
            e["session_id"],
            e["anonymous_viewer_id"],
            e["video_id"],
            e["event_type"],
            e["video_timecode_sec"],
            c_ts,
            s_ts
        ])
    
    column_names = [
        "event_id", "screening_id", "session_id", "anonymous_viewer_id",
        "video_id", "event_type", "video_timecode_sec", "client_timestamp", "server_timestamp"
    ]
    try:
        client.insert("viewer_events", data, column_names=column_names)
    except Exception as err:
        if "UNKNOWN_TABLE" in str(err) or "60" in str(err):
            ensure_db_initialized(client)
            client.insert("viewer_events", data, column_names=column_names)
        else:
            try:
                reset_client()
                fresh_client = get_client()
                fresh_client.insert("viewer_events", data, column_names=column_names)
            except Exception:
                raise err

def get_screening_stats(screening_id: str) -> Dict[str, Any]:
    try:
        client = get_client()
        params = {"sid": screening_id}

        # 1. Total sessions count
        total_sessions = client.command("SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = {sid:String}", parameters=params)

        # 2. Unique anonymous viewers count
        total_viewers = client.command("SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = {sid:String}", parameters=params)

        # 3. Total events count
        total_events = client.command("SELECT count() FROM viewer_events WHERE screening_id = {sid:String}", parameters=params)

        # 4. Completed sessions (sessions containing a COMPLETE event)
        completed_sessions = client.command("SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = {sid:String} AND event_type = 'COMPLETE'", parameters=params)

        # 5. Event breakdown by event_type
        breakdown_res = client.query("SELECT event_type, count() FROM viewer_events WHERE screening_id = {sid:String} GROUP BY event_type", parameters=params)
        event_breakdown = {row[0]: row[1] for row in breakdown_res.result_rows} if breakdown_res.result_rows else {}
        
        return {
            "total_sessions": total_sessions,
            "unique_viewers": total_viewers,
            "total_events": total_events,
            "completed_sessions": completed_sessions,
            "event_breakdown": event_breakdown
        }
    except Exception as e:
        print(f"Notice in get_screening_stats: {e}")
        return {
            "total_sessions": 0,
            "unique_viewers": 0,
            "total_events": 0,
            "completed_sessions": 0,
            "event_breakdown": {}
        }

def get_all_stats() -> Dict[str, Any]:
    try:
        client = get_client()
        total_sessions = client.command("SELECT count(DISTINCT session_id) FROM viewer_events")
        total_viewers = client.command("SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events")
        total_events = client.command("SELECT count() FROM viewer_events")
        return {
            "total_sessions": total_sessions,
            "total_viewers": total_viewers,
            "total_events": total_events
        }
    except Exception as e:
        print(f"Notice in get_all_stats: {e}")
        return {"total_sessions": 0, "total_viewers": 0, "total_events": 0}

get_global_stats = get_all_stats

def delete_screening_events(screening_id: str):
    client = get_client()
    params = {"sid": screening_id}
    try:
        client.command("DELETE FROM viewer_events WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM comments WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM investigations WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM chat_sessions WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM chat_messages WHERE screening_id = {sid:String}", parameters=params)
        try:
            client.command("OPTIMIZE TABLE viewer_events FINAL CLEANUP")
        except Exception:
            pass
    except Exception as e:
        print(f"Error executing ClickHouse delete for {screening_id}: {e}")

def delete_screening_record(screening_id: str):
    client = get_client()
    params = {"sid": screening_id}
    try:
        client.command("DELETE FROM screenings WHERE screening_id = {sid:String}", parameters=params)
    except Exception as e:
        print(f"Error executing ClickHouse delete screening record for {screening_id}: {e}")



def rollback_last_batch(screening_id: str) -> Dict[str, Any]:
    """
    Rolls back the most recent telemetry run/batch for a screening.
    Prioritizes rolling back synthetic simulation runs to protect real viewer data.
    Executes bulk deletion directly by timestamp to prevent SQL query size limits.
    """
    client = get_client()
    params = {"sid": screening_id}

    # 1. Check if synthetic viewers exist for this screening
    synth_ts_res = client.query(
        "SELECT max(server_timestamp) FROM viewer_events WHERE screening_id = {sid:String} AND anonymous_viewer_id LIKE 'synth_v_%'",
        parameters=params
    )
    has_synth = synth_ts_res.result_rows and synth_ts_res.result_rows[0][0] is not None

    if has_synth:
        max_ts = synth_ts_res.result_rows[0][0]
        params_ts = {"sid": screening_id, "max_ts": max_ts}
        c_res = client.query("""
        SELECT count(DISTINCT session_id), count(DISTINCT anonymous_viewer_id)
        FROM viewer_events
        WHERE screening_id = {sid:String}
          AND anonymous_viewer_id LIKE 'synth_v_%'
          AND server_timestamp = {max_ts:DateTime64(3, 'UTC')}
        """, parameters=params_ts)
        num_sessions = c_res.result_rows[0][0] if c_res.result_rows else 0
        num_viewers = c_res.result_rows[0][1] if c_res.result_rows else 0

        if num_sessions == 0:
            return {"status": "empty", "message": "No session batch found to roll back.", "deleted_sessions": 0, "deleted_viewers": 0}

        client.command("""
        DELETE FROM viewer_events
        WHERE screening_id = {sid:String}
          AND anonymous_viewer_id LIKE 'synth_v_%'
          AND server_timestamp = {max_ts:DateTime64(3, 'UTC')}
        """, parameters=params_ts)
    else:
        real_ts_res = client.query(
            "SELECT max(server_timestamp) FROM viewer_events WHERE screening_id = {sid:String}",
            parameters=params
        )
        if not real_ts_res.result_rows or not real_ts_res.result_rows[0][0]:
            return {"status": "empty", "message": "No telemetry data to roll back.", "deleted_sessions": 0, "deleted_viewers": 0}

        max_ts = real_ts_res.result_rows[0][0]
        params_ts = {"sid": screening_id, "max_ts": max_ts}
        c_res = client.query("""
        SELECT count(DISTINCT session_id), count(DISTINCT anonymous_viewer_id)
        FROM viewer_events
        WHERE screening_id = {sid:String}
          AND server_timestamp = {max_ts:DateTime64(3, 'UTC')}
        """, parameters=params_ts)
        num_sessions = c_res.result_rows[0][0] if c_res.result_rows else 0
        num_viewers = c_res.result_rows[0][1] if c_res.result_rows else 0

        if num_sessions == 0:
            return {"status": "empty", "message": "No session batch found to roll back.", "deleted_sessions": 0, "deleted_viewers": 0}

        client.command("""
        DELETE FROM viewer_events
        WHERE screening_id = {sid:String}
          AND server_timestamp = {max_ts:DateTime64(3, 'UTC')}
        """, parameters=params_ts)

    return {
        "status": "success",
        "message": f"Rolled back latest run ({num_sessions} session(s) across {num_viewers} viewer(s)).",
        "deleted_sessions": num_sessions,
        "deleted_viewers": num_viewers,
        "latest_timestamp": str(max_ts),
    }


