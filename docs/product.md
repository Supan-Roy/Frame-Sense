# Frame Sense Product Specification

Frame Sense transforms large-scale test-screening viewer behavior into evidence-backed, scientifically defensible post-production intelligence.

---

## 1. Value Proposition

During film post-production, directors and studio executives rely on test screenings to evaluate pacing, emotional impact, and audience retention. However, traditional paper surveys are retrospective, subjective, and lack frame-by-frame precision.

Frame Sense captures real-time, second-by-second viewer telemetry, detects behavioral anomalies using sample-aware statistics, investigates underlying video frames with Gemini 3.5 Flash / Gemini 3.5 Flash-Lite, and outputs actionable edit recommendations directly into professional editing software (Premiere Pro, DaVinci Resolve, Final Cut Pro).

---

## 2. Key Capabilities

### 1. Screening Management & Telemetry Ingestion
- Ingest and track film cuts, short films, and test screenings.
- Capture granular playback events (`pauses`, `rewinds`, `exits`, `replays`, `skips`, `volume_changes`, `tab_hides`).
- Store millions of timecoded events efficiently in ClickHouse Cloud.

### 2. Sample-Aware Intelligence Engine
- **Statistical Joint Gating**: Prevents false anomalies caused by small audience sizes ($n < 5 \rightarrow \text{INSUFFICIENT DATA}$).
- **Laplace Smoothing & Wilson Lower Bounds**: Ensures small-sample rate calculations remain statistically sound.
- **Local Window Exclusion Baseline**: Calculates z-scores against baseline mean excluding the anomaly window ($\pm 15$s).

### 3. Multimodal Vision Frame Investigation
- Extract video keyframes at exact peak anomaly timecodes via FFmpeg.
- Pass keyframes + telemetry context into Gemini 3.5 Flash / Gemini 3.5 Flash-Lite.
- Formulate scientific editorial findings structured as **`OBSERVATION` $\rightarrow$ `INTERPRETATION` $\rightarrow$ `HYPOTHESIS` $\rightarrow$ `VALIDATION`**.

### 4. Interactive Sense AI Assistant
- Conversational chat assistant powered by Google ADK (`InMemoryRunner`) + ClickHouse MCP.
- Real-time Server-Sent Events (SSE) token streaming.
- Response cancellation control (Stop Button) and smooth typewriter markdown rendering.

### 5. Professional NLE Export (FCP XML & EDL)
- One-click export of Final Cut Pro XML (`.fcpxml`) and Edit Decision List (`.edl`).
- Import markers and editorial recommendations directly into Adobe Premiere Pro, DaVinci Resolve, or Final Cut Pro.
