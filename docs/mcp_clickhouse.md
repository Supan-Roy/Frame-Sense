# Official ClickHouse MCP Server & ClickHouse Cloud Integration

This document describes the integration of **ClickHouse Cloud**, the **ClickHouse Model Context Protocol (MCP)** server, and the **ClickHouse Analytical Window SQL Inspector** within Frame Sense.

---

## 1. Overview

The ClickHouse integration acts as Frame Sense's **100% Unified Data Engine** — storing telemetry events, project metadata, editorial notes, AI vision findings, and chat session histories.

The ClickHouse MCP integration exposes schema introspection and SQL query tools (`run_select_query`) directly to Google ADK agents (**Sense AI Assistant**). Furthermore, editors can inspect live OLAP query mechanics using the interactive **ClickHouse Analytical Window SQL Inspector Modal**.

---

## 2. Configuration & Driver Details

- **Database Engine**: ClickHouse Cloud / ClickHouse Local (100% Unified Engine, zero SQLite)
- **Driver**: `clickhouse-connect` (Python async/sync client)
- **Interactive UI Inspector**: React Portal modal (`ClickHouseSqlInspector.tsx`) featuring custom syntax highlighting and query latency profiling ($< 9\text{ms}$).
- **Tables Handled**:
  1. `default.viewer_events`: Second-by-second audience telemetry stream.
  2. `default.screenings`: Film screening project metadata.
  3. `default.comments`: Editorial timeline notes & viewer comments.
  4. `default.investigations`: Saved AI vision investigation reports.
  5. `default.chat_sessions`: Sense AI interactive chat sessions.
  6. `default.chat_messages`: Multi-turn studio assistant message logs.
- **MCP Tool**: `run_select_query`

---

## 3. Production Database Schemas

### Telemetry Schema (`viewer_events`)
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

### Saved AI Investigations Schema (`investigations`)
```sql
CREATE TABLE IF NOT EXISTS default.investigations (
    investigation_id String,
    screening_id String,
    timecode_sec Float64,
    taxonomy_title String,
    domain String,
    observation String,
    interpretation String,
    hypothesis String,
    validation String,
    confidence_score Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (screening_id, created_at);
```

---

## 4. Analytical Window SQL Queries (Inspected via Modal)

### Window Trajectory & Continuation Rate Query
```sql
SELECT
    viewer_id,
    session_id,
    min(timecode_sec) AS min_tc,
    max(timecode_sec) AS max_tc,
    countIf(event_type = 'EXIT') AS exit_count,
    countIf(event_type = 'REPLAY') AS replay_count
FROM default.viewer_events
WHERE screening_id = 'scr_demo_01'
  AND timecode_sec BETWEEN 120 AND 140
GROUP BY viewer_id, session_id;
```

---

## 5. Agentic Querying Rules

AI Agents (Sense AI Assistant, Investigator) query ClickHouse MCP via strict rules:
- **Scope Rule**: ALWAYS filter SQL queries using `WHERE screening_id = '...'`.
- **Query Tool**: `run_select_query(query="SELECT ... FROM default.viewer_events WHERE screening_id = '...'")`.

