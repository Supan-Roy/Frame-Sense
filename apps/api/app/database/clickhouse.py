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
        database=settings.CLICKHOUSE_DATABASE
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
        data.append([
            e["event_id"],
            e["screening_id"],
            e["session_id"],
            e["anonymous_viewer_id"],
            e["video_id"],
            e["event_type"],
            e["video_timecode_sec"],
            e["client_timestamp"],
            e["server_timestamp"]
        ])
    
    column_names = [
        "event_id", "screening_id", "session_id", "anonymous_viewer_id",
        "video_id", "event_type", "video_timecode_sec", "client_timestamp", "server_timestamp"
    ]
    client.insert("viewer_events", data, column_names=column_names)

def get_screening_stats(screening_id: str) -> Dict[str, Any]:
    client = get_client()
    
    # 1. Total sessions count
    total_sessions_query = f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{screening_id}'"
    total_sessions = client.command(total_sessions_query)
    
    # 2. Unique anonymous viewers count
    total_viewers_query = f"SELECT count(DISTINCT anonymous_viewer_id) FROM viewer_events WHERE screening_id = '{screening_id}'"
    total_viewers = client.command(total_viewers_query)
    
    # 3. Total events count
    total_events_query = f"SELECT count() FROM viewer_events WHERE screening_id = '{screening_id}'"
    total_events = client.command(total_events_query)
    
    # 4. Completed sessions (sessions containing a COMPLETE event)
    completed_sessions_query = f"SELECT count(DISTINCT session_id) FROM viewer_events WHERE screening_id = '{screening_id}' AND event_type = 'COMPLETE'"
    completed_sessions = client.command(completed_sessions_query)
    
    # 5. Event breakdown by event_type
    breakdown_query = f"SELECT event_type, count() FROM viewer_events WHERE screening_id = '{screening_id}' GROUP BY event_type"
    breakdown_res = client.query(breakdown_query)
    event_breakdown = {row[0]: row[1] for row in breakdown_res.result_rows}
    
    return {
        "total_sessions": total_sessions,
        "unique_viewers": total_viewers,
        "total_events": total_events,
        "completed_sessions": completed_sessions,
        "event_breakdown": event_breakdown
    }
