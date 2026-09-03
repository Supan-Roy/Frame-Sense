import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
import clickhouse_connect
from clickhouse_connect.driver.client import Client
from app.core.config import settings

def get_client() -> Client:
    return clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD,
        database=settings.CLICKHOUSE_DATABASE,
        secure=settings.CLICKHOUSE_SECURE
    )

def init_db():
    client = get_client()
    # Create the default table for storing raw telemetry events
    # We use MergeTree and ORDER BY screening_id to group screening events contiguously.
    create_table_query = """
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
    """
    client.command(create_table_query)
    print("ClickHouse database initialized successfully.")

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
    client.insert("viewer_events", data, column_names=column_names)

def get_screening_stats(screening_id: str) -> Dict[str, Any]:
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
    event_breakdown = {row[0]: row[1] for row in breakdown_res.result_rows}
    
    return {
        "total_sessions": total_sessions,
        "unique_viewers": total_viewers,
        "total_events": total_events,
        "completed_sessions": completed_sessions,
        "event_breakdown": event_breakdown
    }

def get_global_stats() -> Dict[str, Any]:
    client = get_client()
    try:
        total_sessions = client.command("SELECT count(DISTINCT session_id) FROM viewer_events")
        total_viewers = client.command("SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events")
        total_events = client.command("SELECT count() FROM viewer_events")
        return {
            "total_sessions": int(total_sessions),
            "total_viewers": int(total_viewers),
            "total_events": int(total_events)
        }
    except Exception as e:
        print(f"Error querying global stats from ClickHouse: {e}")
        return {
            "total_sessions": 0,
            "total_viewers": 0,
            "total_events": 0
        }

def delete_screening_events(screening_id: str):
    client = get_client()
    try:
        client.command("DELETE FROM viewer_events WHERE screening_id = {sid:String}", parameters={"sid": screening_id})
    except Exception as e:
        print(f"Error executing ClickHouse delete events for {screening_id}: {e}")


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


