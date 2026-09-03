# Frame Sense System Architecture

This document details the production architecture of **Frame Sense**, detailing data flow, statistical gating, agent orchestration, multimodal vision investigation, and professional NLE export.

---

## 1. High-Level Architecture Overview

```
                          ┌──────────────────────────┐
                          │   React 18 / Vite Web    │
                          │   (Editorial Workspace)  │
                          └────────────┬─────────────┘
                                       │ HTTP / SSE Stream
                                       ▼
                          ┌──────────────────────────┐
                          │  FastAPI Backend Server  │
                          │      (Port 8001)         │
                          └─────┬──────────────┬─────┘
                                │              │
           ┌────────────────────┴──┐        ───┴──────────────────┐
           │                       │        │                     │
           ▼                       ▼        ▼                     ▼
┌────────────────────┐   ┌───────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│ ClickHouse Cloud   │   │ Statistical Engine│  │  FFmpeg Engine   │  │ NLE Export Engine │
│ Telemetry Storage  │   │  (Joint Gating)   │  │ (Frame Extract)  │  │ (FCP XML & EDL)   │
└──────────┬─────────┘   └─────────┬─────────┘  └────────┬─────────┘  └───────────────────┘
           │                       │                     │
           └───────────────────────┼─────────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Google ADK &     │
                         │ Gemini 2.5 Vision │
                         └───────────────────┘
```

---

## 2. Core Subsystems

### A. Audience Telemetry & Ingestion (ClickHouse)
- **High-Volume Telemetry Storage**: ClickHouse columnar database storing second-by-second viewer telemetry events (`PLAY`, `PAUSE`, `PROGRESS`, `EXIT`, `SEEK_FORWARD`, `SEEK_BACKWARD`, `REPLAY`, `VOLUME_CHANGE`, `TAB_HIDDEN`, `TAB_VISIBLE`).
- **ClickHouse Model Context Protocol (MCP)**: Implements `run_select_query` tool allowing AI agents to directly query `default.viewer_events` via SQL filters (`WHERE screening_id = '...'`).

### B. Core Intelligence Engine & Sequence Trajectory Reasoning
- **Viewer Sequence Trajectory Engine (`_get_window_trajectories`)**: Runs ClickHouse SQL trajectory window queries evaluating full viewer session lifecycles ($N_{\text{exposed}}$, $N_{\text{permanent\_exits}}$, $N_{\text{replayed\_and\_continued}}$, $N_{\text{continued}}$).
- **Multi-Signal Classification Tree**:
  - `Emotional Scene Replay Hotspot` / `Cognitive Comprehension Barrier`: Triggered when viewers rewound/replayed and continued playback past the scene window, protecting rewatch hotspots from false retention drop classification.
  - `Critical Scene Exit Drop`: Requires genuine viewer abandonment ($N_{\text{permanent\_exits}} \ge 1$, $N_{\text{permanent\_exits}} \ge N_{\text{continued}}$, and permanent exit rate $\ge 15\%$).
- **Sample Exposure Categorization**:
  - $n < 5$: `INSUFFICIENT_DATA` (Capped at `LOW` confidence $\le 0.35$ and `LOW` severity).
  - $5 \le n < 10$: `PRELIMINARY_SIGNAL` (Capped at `MEDIUM` confidence $\le 0.65$).
  - $10 \le n < 30$: `SUFFICIENT_SIGNAL`
  - $n \ge 30$: `STRONG_SIGNAL`
- **Laplace Smoothing & Wilson Lower Bounds**: Prevents pathological 0%/100% rate anomalies on small samples while retaining raw counts.
- **Local Baseline Exclusion Window**: Baseline calculations exclude a $\pm 15\text{s}$ local window around the anomaly candidate to prevent anomaly self-pollution.

### C. Multimodal Vision Investigation Engine
- **Keyframe Extraction**: Extracts keyframes at exact peak anomaly timecodes using FFmpeg.
- **Gemini 2.5 Vision Reasoning**: Sends extracted image frames to Gemini alongside raw telemetry evidence for visual cut analysis, scene pacing, and framing investigation.
- **Scientific Honesty Taxonomy**:
  - **`OBSERVATION`**: Pure empirical telemetry evidence (counts, rates, z-scores, trajectory metrics).
  - **`INTERPRETATION`**: Behavioral meaning of signals (e.g. cognitive comprehension vs. audience abandonment).
  - **`HYPOTHESIS`**: Multimodal visual/narrative rationale.
  - **`VALIDATION`**: Proposed editing action & evidence quality tier.

### D. Sense AI Interactive Assistant & Low-Latency Stream
- **Google ADK Orchestration**: Uses `InMemoryRunner` with `sense_ai_chat_agent` and ClickHouse MCP.
- **Pre-Loaded Summary Context**: Injects screening metadata, live telemetry overview, and top anomaly findings directly into context header to bypass redundant remote MCP SQL roundtrips for general user queries.
- **Zero-Latency Token SSE Stream**: Server-Sent Events endpoint streaming LLM tokens directly over HTTP (`media_type="text/event-stream"`) without artificial sleep delays.
- **Stream Controller**: Supports frontend response cancellation via circular `Stop` button / `AbortController`.

### E. Professional NLE Export (FCP XML & EDL)
- **Final Cut Pro XML (`.fcpxml`)**: Generates structured XML sequences with markers, duration metadata, and editorial notes compatible with **Adobe Premiere Pro**, **DaVinci Resolve**, and **Final Cut Pro**.
- **Edit Decision List (`.edl`)**: CMX3600-compliant EDL generator for legacy post-production suites.

---

## 3. Data Processing & Investigation Pipeline

```
1. Browser Player / Simulator -> Emits ViewerEvent batch -> FastAPI /telemetry/batch -> ClickHouse
2. GET /audience/anomalies -> Runs Joint Gating & Wilson Bounds -> Returns candidate anomalies
3. User clicks "Investigate Anomaly" -> FFmpeg extracts keyframe at timecode
4. Gemini 2.5 Vision -> Analyzes keyframe + telemetry -> Constructs 4-part taxonomy report
5. Report saved in SQLite -> Rendered in Editorial Findings Workspace
6. Click "Export XML/EDL" -> Generates FCP XML/EDL file for NLE timeline
```
