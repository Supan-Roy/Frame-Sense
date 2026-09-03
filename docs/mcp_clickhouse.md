# Official ClickHouse MCP Server & ClickHouse Cloud Integration

This document describes the integration of **ClickHouse Cloud** and the **ClickHouse Model Context Protocol (MCP)** server within Frame Sense.

---

## 1. Overview

The ClickHouse MCP integration exposes ClickHouse database tools (schema introspection, table listing, SQL query execution) to AI agents (such as **Sense AI Assistant**) via Model Context Protocol (MCP).

---

## 2. Configuration & Driver Details

- **Database Engine**: ClickHouse Cloud / ClickHouse Local (100% Unified Data Engine)
- **Driver**: `clickhouse-connect` (Python async/sync client)
- **Tables Handled**:
  - `default.viewer_events`: Second-by-second audience telemetry stream
  - `default.screenings`: Film screening project metadata
  - `default.comments`: Editorial timeline notes & viewer comments
  - `default.investigations`: Saved AI vision investigation reports
  - `default.chat_sessions`: Sense AI interactive chat sessions
  - `default.chat_messages`: Multi-turn studio assistant message logs
- **MCP Tool**: `run_select_query`

---

## 3. Telemetry Schema (`viewer_events`)

```sql
CREATE TABLE IF NOT EXISTS default.viewer_events (
    event_id String,
    screening_id String,
    viewer_id String,
    session_id String,
    event_type Enum8(
        'PLAY' = 1,
        'PAUSE' = 2,
        'PROGRESS' = 3,
        'COMPLETE' = 4,
        'EXIT' = 5,
        'SEEK_FORWARD' = 6,
        'SEEK_BACKWARD' = 7,
        'REPLAY' = 8,
        'VOLUME_CHANGE' = 9,
        'TAB_HIDDEN' = 10,
        'TAB_VISIBLE' = 11
    ),
    timecode_sec Float64,
    playhead_sec Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (screening_id, event_type, created_at);
```

---

## 4. Agentic Querying Rules

AI Agents (Sense AI Assistant, Investigator) query ClickHouse MCP via SQL rules:
- **Scope Rule**: ALWAYS filter SQL queries using `WHERE screening_id = '...'`.
- **Query Tool**: `run_select_query(query="SELECT ... FROM default.viewer_events WHERE screening_id = '...'")`.
