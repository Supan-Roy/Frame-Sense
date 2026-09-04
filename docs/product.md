# Frame Sense Product Specification

Frame Sense transforms large-scale test-screening viewer behavior and broadcast technical safety telemetry into evidence-backed, scientifically defensible post-production intelligence.

---

## 1. Value Proposition

During film post-production, directors and studio executives rely on test screenings to evaluate pacing, emotional impact, audience retention, and broadcast technical compliance. However, traditional paper surveys are retrospective, subjective, and lack frame-by-frame precision.

Frame Sense captures real-time, second-by-second viewer telemetry, detects behavioral and technical safety anomalies using sample-aware statistics, investigates underlying video frames with Gemini 3.5 Flash / Gemini 3.5 Flash-Lite, and outputs actionable edit recommendations directly into professional editing software (Premiere Pro, DaVinci Resolve, Final Cut Pro).

---

## 2. Key Capabilities

### 1. Dual-Engine Intelligence Audit
- **Engine 1: Viewer Retention & Cognitive Telemetry Analytics**: Captures second-by-second playback behavior (`pauses`, `rewinds`, `exits`, `replays`, `skips`, `volume_changes`, `tab_hides`) and tracks viewer sequence trajectories to separate intentional scene rewatches from permanent exits.
- **Engine 2: Broadcast Quality & Technical Safety Audit Engine**: Evaluates **Dialogue Audio Masking Risks** and **Pacing Lulls**.

### 2. ClickHouse Analytical Window SQL Inspector
- Interactive React Portal modal allowing editors to view exact production ClickHouse SQL queries executed during real-time OLAP telemetry analysis.
- Live performance profiling ($< 9\text{ms}$ query latency), SQL syntax color-coding, and full whitespace preservation.

### 3. End-to-End Intelligence Pipeline Simulator
- 4-stage interactive animation visualising raw telemetry emission, statistical joint gating, keyframe laser scanning, and timecode-anchored AI Co-Pilot chat responses.

### 4. Sample-Aware Intelligence Engine
- **Statistical Joint Gating**: Prevents false anomalies caused by small audience sizes ($n < 5 \rightarrow \text{INSUFFICIENT DATA}$).
- **Laplace Smoothing & Wilson Lower Bounds**: Ensures small-sample rate calculations remain statistically sound.
- **Local Window Exclusion Baseline**: Calculates z-scores against baseline mean excluding the anomaly window ($\pm 15$s).

### 5. Multimodal Vision Frame Investigation
- Extract video keyframes at exact peak anomaly timecodes via FFmpeg.
- Pass keyframes + telemetry context into Gemini 3.5 Flash / Gemini 3.5 Flash-Lite.
- Formulate scientific editorial findings structured as **`OBSERVATION` $\rightarrow$ `INTERPRETATION` $\rightarrow$ `HYPOTHESIS` $\rightarrow$ `VALIDATION`**.

### 6. Interactive Sense AI Assistant
- Conversational chat assistant powered by Google ADK (`InMemoryRunner`) + ClickHouse MCP.
- Real-time Server-Sent Events (SSE) token streaming.
- Response cancellation control (Stop Button) and smooth typewriter markdown rendering.

### 7. Professional NLE Export (FCP XML & EDL)
- One-click export of Final Cut Pro XML (`.fcpxml`) and Edit Decision List (`.edl`).
- Import markers and editorial recommendations directly into Adobe Premiere Pro, DaVinci Resolve, or Final Cut Pro.

---

## 3. Storage Architecture

- **100% ClickHouse Unified Data Core**: All data (telemetry, screenings, comments, findings, chat history) is managed atomically in ClickHouse Cloud / ClickHouse Local with zero SQLite dependencies.

