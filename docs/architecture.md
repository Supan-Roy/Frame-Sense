# Architecture Document (Planned)

> [!IMPORTANT]
> This document details the planned, long-term architecture of the Frame Sense system. Most of the AI, database orchestration, and agent modules are NOT yet implemented in the initial code setup.

## High-Level System Flow

```
Frontend (React App)
    ↓
Backend/API (FastAPI)
    ↓
Agent Orchestration
    ↓
ClickHouse MCP
    ↓
Audience Telemetry Analysis (High-volume ingestion & anomaly detection)
```

### Component Details
1. **Frontend (React)**: High-fidelity user dashboard for review of film projects, screenings telemetry, automatically flag-anomalies, AI findings, and edit proposals.
2. **Backend/API (FastAPI)**: Coordinates state management, serves web clients, and dispatches analysis requests to the Agent Orchestrator.
3. **Agent Orchestrator**: Coordinates tasks among specialized AI sub-agents to inspect media context corresponding to viewer telemetry spikes.
4. **ClickHouse MCP**: Multi-model database storing high-volume, timestamped viewer events (attention levels, pause clicks) optimized for analytical queries.

---

## Agentic Investigation Pipeline

When an audience engagement anomaly is detected (e.g., a massive attention drop-off at minute 12 of a cut), the Agent Orchestration layer initiates the following workflow:

```
Agent (Orchestrator)
    ↓
Media Retrieval (Retrieves film clip and script slice corresponding to the timestamp)
    ↓
Video / Audio / Script Context (Aggregates multimodal file components)
    ↓
Gemini Multimodal Reasoning (Gemini model analyzes pacing, dialogue, and audio levels)
    ↓
Finding (Generates explanation of the anomaly, e.g., "Dialogue is drowned out by ambient noise")
    ↓
Edit Recommendation (Generates editor commands, e.g., "Increase vocal track by +3db or trim 5 seconds")
```

### Details
- **Media Retrieval Service**: Extracts specific video chunks, audio channels, and screenplay lines using timestamp intervals.
- **Gemini Multimodal Reasoning**: Interacts with Gemini API/SDK to perform reasoning over video frames, audio tracks, and textual script context.
- **Actionable Outcomes**: Results are written back to Postgres/ClickHouse and loaded in the Frontend editor dashboard.
