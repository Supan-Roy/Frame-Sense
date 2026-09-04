# Frame Sense

**Autonomous Post-Production Telemetry, Broadcast Quality & Multimodal Vision Intelligence System**  
*Built for the **Agentic Cinema: The Blockbuster Hackathon***

---

## Executive Overview

**Frame Sense** is an autonomous post-production intelligence system that transforms second-by-second test-screening viewer behavior and technical compliance telemetry into scientifically defensible, frame-accurate editorial recommendations.

By combining high-throughput columnar telemetry ingestion (**ClickHouse Cloud**), sample-aware statistical joint gating, viewer sequence trajectory reasoning, broadcast quality auditing (**Dialogue Audio Masking**, **Pacing Lulls**), and multimodal keyframe reasoning (**Google ADK & Gemini 3.5 Flash / Gemini 3.5 Flash-Lite**), Frame Sense automatically detects audience retention drops, comprehension barriers, and audio/pacing friction — outputting industry-standard NLE timeline exports (**Final Cut Pro XML** and **CMX3600 EDL**) for Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro.

---

## Key Differentiators & Dual-Engine Architecture

Frame Sense operates a **Dual-Engine Technical & Behavioral Intelligence System**:

1. **Engine 1: Viewer Retention & Cognitive Telemetry Analytics**
   - Ingests raw second-by-second viewer telemetry (`PLAY`, `PAUSE`, `EXIT`, `REPLAY`, `SEEK`, `TAB_HIDDEN`).
   - Evaluates ClickHouse viewer sequence trajectories (`_get_window_trajectories`) to distinguish intentional scene rewatches ($R_{\text{continuation}}$) from permanent audience exits ($R_{\text{exit}}$).
   - Applies Laplace smoothing ($\hat{p}_{\text{smoothed}}$), Wilson score confidence bounds, and sample-aware gating ($n < 5 \rightarrow \text{INSUFFICIENT DATA}$) to eliminate false alarms.

2. **Engine 2: Broadcast Quality & Technical Safety Audit Engine**
   - **Dialogue Audio Masking Risk Audit**: Analyzes dynamic range compression, background score collision, and speech clarity to identify audio masking friction.
   - **Pacing Lulls & Narrative Dead Space Audit**: Identifies low-engagement visual dead zones and stagnant scene pacing prior to major retention drop-offs.

---

## System Architecture & Data Flow

```mermaid
graph TD
    UI["React 18 / Vite Web Workspace<br/>(Screening Room, Findings & Pipeline Simulator)"] -->|HTTP / SSE Stream| API["FastAPI Backend Engine (Port 8001)"]

    subgraph Core ["100% ClickHouse Unified Core Architecture"]
        API --> CH["ClickHouse Unified Storage Engine<br/>(Telemetry + Studio Metadata + AI Investigations + MCP Protocol)"]
        API --> TRAJ["Viewer Sequence Trajectory Engine<br/>(_get_window_trajectories)"]
        CH --> GATE["Statistical Joint Gating Engine<br/>(Laplace & Wilson LCB Engine)"]
        TRAJ --> GATE
        GATE --> DUAL["Dual-Engine Intelligence Framework<br/>(Behavioral Retention + Technical Safety Audit)"]
        DUAL --> VIS["Multimodal Vision Engine<br/>(FFmpeg Keyframes + Gemini 3.5 Flash / Gemini 3.5 Flash-Lite)"]
        DUAL --> CHAT["Sense AI Interactive Agent<br/>(Google ADK + ClickHouse MCP)"]
    end

    API --> INSP["ClickHouse Window SQL Inspector<br/>(Live OLAP Query Engine & Latency Profiler)"]
    VIS --> NLE["Professional NLE Timeline Export Engine<br/>(Final Cut Pro XML .fcpxml & CMX3600 EDL)"]
    CHAT --> NLE
```

---

## Core Technical Features & Interactive Tools

### 1. ClickHouse Analytical Window SQL Inspector Modal
- **Live OLAP Window Engine**: Inspect exact production ClickHouse SQL queries executed during real-time telemetry analysis, including windowed Z-score calculations (`stddevPop`, `avg() OVER (...)`).
- **Syntax Highlighting & Whitespace Preservation**: Custom React Portal modal with zero-blur backdrop, code block indentation preservation, and execution latency benchmarks ($< 9\text{ms}$).

### 2. End-to-End Intelligence Pipeline Simulator
- **4-Stage Interactive Animation**: Visualizes the complete telemetry journey from raw playback emission $\rightarrow$ statistical joint gating $\rightarrow$ multimodal keyframe laser scan $\rightarrow$ timecode-anchored Sense AI chat response.
- **User Interaction**: Clickable timeline pins, live playhead synchronization, and target anomaly locking.

### 3. Automatic Viewport Navigation Reset
- **Seamless Page Navigation**: Instant top-of-page scrolling (`scrollTop = 0`) on route changes to ensure editorial findings and analytical dashboards open cleanly at the header.

---

## Core Technical Approaches & Algorithms

### 1. Viewer Sequence Trajectory Reasoning

Events are **not** viewers. Counting raw event occurrences ($k$) without session tracking misidentifies intentional viewer rewatching as audience abandonment.

Frame Sense runs a ClickHouse SQL window trajectory query evaluating each viewer session's complete lifecycle across a candidate window $W = [t_{\text{start}}, t_{\text{end}}]$:

$$\text{Session Trajectory} = \langle (e_1, t_1), (e_2, t_2), \dots, (e_m, t_m) \rangle$$

#### Trajectory Metrics
- **Exposed Viewers ($N_{\text{exposed}}$)**: Unique viewers present in $[t_{\text{start}} - 5\text{s}, t_{\text{end}} + 10\text{s}]$.
- **Permanent Exits ($N_{\text{exit}}$)**: Viewers whose session terminated in $W$ and **never returned or emitted events** past $t_{\text{end}} + 3\text{s}$.
- **Replayed & Continued ($N_{\text{replayed-continued}}$)**: Viewers who rewound/replayed in $W$ and continued watching past $t_{\text{end}} + 3\text{s}$.
- **Permanent Exit Rate**:
  $$R_{\text{exit}} = \frac{N_{\text{exit}}}{\max(1, N_{\text{exposed}})}$$
- **Continuation Rate**:
  $$R_{\text{continuation}} = \frac{N_{\text{continued}}}{\max(1, N_{\text{exposed}})}$$

### 2. Sample-Aware Statistical Joint Gating

To protect filmmakers from acting on tiny viewer samples (e.g. 1 exit out of 1 viewer producing $100\%$ raw drop rate), Frame Sense enforces sample sufficiency gating:

| Sample Size ($n$) | Exposure Category | Anomaly Behavior | Confidence Cap | Severity Cap |
| :--- | :--- | :--- | :--- | :--- |
| **$n < 5$** | `INSUFFICIENT_DATA` | Insufficient audience size for statistical inference | $\text{Confidence} \le 0.35$ | `LOW` |
| **$5 \le n < 10$** | `PRELIMINARY_SIGNAL` | Preliminary directional hint | $\text{Confidence} \le 0.65$ | `MEDIUM` |
| **$10 \le n < 30$** | `SUFFICIENT_SIGNAL` | Standard screening sample | Dynamic $z$-score calculation | Dynamic calculation |
| **$n \ge 30$** | `STRONG_SIGNAL` | High-confidence statistical evidence | Full confidence calculation | Full severity calculation |

### 3. Laplace Rate Smoothing & Wilson Score Lower Bound

#### Laplace-Smoothed Event Rate
$$\hat{p}_{\text{smoothed}} = \frac{k + 1}{n + 2}$$
*where $k$ is the raw event count and $n$ is active exposed viewers.*

#### Wilson Score Lower Confidence Bound ($95\%$ Confidence, $z = 1.96$)
$$\hat{p}_{\text{lower}} = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

### 4. Unpolluted Local Baseline Exclusion Window

To calculate standardized score $z$ without self-pollution from the anomaly candidate window itself:
- Local mean $\mu_{\text{local}}$ and local standard deviation $\sigma_{\text{local}}$ are calculated across time buckets **excluding a $\pm 15\text{s}$ local window around $t$**:

$$z_t = \frac{x_t - \mu_{\text{local}}}{\sigma_{\text{local}} + \epsilon}$$

---

## Dual-Engine Behavioral & Safety Matrix

| Engine | Trajectory / Technical Signal | Taxonomy Title | Domain | Editorial Action |
| :--- | :--- | :--- | :--- | :--- |
| **Behavioral** | $N_{\text{replayed}} \ge 1 \land N_{\text{continued}} \ge N_{\text{exits}}$ | **`Emotional Scene Replay Hotspot`** | `EMOTIONAL` | Insert 1.2s B-Roll reaction shot at peak timecode to reward viewer curiosity. |
| **Behavioral** | $N_{\text{paused}} \ge 1 \land N_{\text{continued}} > N_{\text{exits}}$ | **`Cognitive Comprehension Barrier`** | `COGNITIVE` | Boost dialogue audio clarity (+3dB), duck score (-4dB), or hold shot +1.2s — do NOT trim video. |
| **Behavioral** | $N_{\text{exits}} \ge 1 \land N_{\text{exits}} \ge N_{\text{continued}} \land R_{\text{exit}} \ge 0.15$ | **`Critical Scene Exit Drop`** | `RETENTION` | Re-anchor visual perspective. Replace static wide shot with medium close-up. |
| **Behavioral** | $c_{\text{skips}} > 0 \land R_{\text{exit}} \ge 0.15$ | **`Dead Zone Pacing Skip`** | `PACING` | Execute razor cut prior to scene transition to eliminate visual dead space. |
| **Broadcast Safety** | High score loudness & dialogue spectral overlap | **`Dialogue Audio Masking Risk`** | `AUDIO` | Frequency notch filter ambient audio track (-4dB at 1-3kHz) to improve speech intelligibility. |

### 4-Part Scientific Honesty Taxonomy
1. **`OBSERVATION`**: Pure empirical telemetry measurement (event counts, unique viewers, $z$-scores, Wilson bounds).
2. **`INTERPRETATION`**: Behavioral meaning of viewer sequence trajectories (comprehension friction vs. abandonment).
3. **`HYPOTHESIS`**: Multimodal visual/narrative rationale derived from Gemini 3.5 Flash / Gemini 3.5 Flash-Lite keyframe analysis.
4. **`VALIDATION`**: Proposed editing action, estimated retention recovery percentage, and sample exposure category.

---

## Feature Matrix

- **Dual-Engine Technical & Behavioral Audit**: Full coverage over audience behavioral telemetry AND broadcast technical safety standards.
- **Second-by-Second Telemetry Ingestion**: Captures `PLAY`, `PAUSE`, `PROGRESS`, `EXIT`, `SEEK_FORWARD`, `SEEK_BACKWARD`, `REPLAY`, `VOLUME_CHANGE`, `TAB_HIDDEN`, `TAB_VISIBLE`, `COMPLETE`.
- **ClickHouse Analytical Window SQL Inspector**: Real-time modal inspecting ClickHouse window SQL execution (`lagInFrame`, `stddevPop`, Z-scores) with $<9\text{ms}$ query latency.
- **End-to-End Pipeline Simulator**: Interactive 4-stage playback animation showcasing real-time telemetry processing, joint gating, multimodal scanning, and AI chat response.
- **Viewer Trajectory Engine**: Evaluates viewer journeys to prevent false retention drop alerts during scene replays.
- **Multimodal Vision Investigation**: FFmpeg keyframe extraction at peak timecodes + Gemini 3.5 Flash / Gemini 3.5 Flash-Lite frame analysis.
- **Zero-Latency Sense AI Chatbot**: Google ADK agent with ClickHouse MCP, pre-loaded context headers, and SSE token streaming.
- **Professional NLE Export**: Export Final Cut Pro XML (`.fcpxml`) and Edit Decision List (`.edl`) files for Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro.
- **100% ClickHouse Unified Engine**: Zero SQLite dependencies; atomic storage of telemetry, screenings, comments, findings, and chat sessions.

---

## Tech Stack & Dependencies

| Layer | Technology | Key Libraries / Modules |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 5, TypeScript 5 | Tailwind CSS, Lucide React, React Router 6, React Portal |
| **Backend API** | Python 3.11+, FastAPI, Uvicorn | Pydantic v2, `asyncio`, `httpx` |
| **AI / Agent Framework** | Google ADK (Agent Development Kit) | `google-adk`, `google-genai`, Gemini 3.5 Flash / Gemini 3.5 Flash-Lite |
| **Database & Analytics** | ClickHouse Cloud / Local Columnar DB | `clickhouse-connect`, ClickHouse MCP Server |
| **Media & Vision** | FFmpeg | Video keyframe extraction engine |
| **Monorepo Workspaces** | `pnpm` workspaces | `@frame-sense/types`, `@frame-sense/config`, `@frame-sense/ui` |

---

## Repository Layout

```
Frame-Sense/
├── apps/
│   ├── web/                         # React 18 + Vite + TypeScript Editorial Workspace
│   │   ├── src/
│   │   │   ├── pages/               # Findings, Screenings, ScreeningRoom, Dashboard
│   │   │   ├── components/          # ClickHouse SQL Inspector, Pipeline Simulator, Media Player, Overlays, EDL export
│   │   │   └── services/            # API client & SSE streaming controllers
│   └── api/                         # FastAPI + Google ADK Backend API
│       ├── agents/                  # ADK agent definitions (Sense AI, Investigator)
│       ├── app/
│       │   ├── api/routes/          # REST & SSE endpoints
│       │   ├── database/            # ClickHouse client & schema initializers
│       │   ├── screening/           # Trajectory analytics, simulator, chat, investigator
│       │   └── media/               # FFmpeg frame extraction & Gemini Vision service
│       └── main.py                  # Server entry point
├── packages/
│   ├── types/                       # Shared TypeScript domain contracts (@frame-sense/types)
│   ├── config/                      # Shared workspace configuration
│   └── ui/                          # Shared UI primitives
├── docs/                            # Deep technical architecture & specifications
├── tests/                           # Complete Pytest integration test suite (76 tests)
├── package.json                     # Monorepo root configuration
└── pnpm-workspace.yaml              # pnpm workspace definition
```

---

## Development & Test Execution

### Prerequisites
- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Python** (3.10 or higher)
- **FFmpeg** (installed and added to System PATH)

### Quick Start
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Supan-Roy/Frame-Sense.git
   cd Frame-Sense
   ```

2. **Initialize Monorepo Environment**:
   ```bash
   pnpm run setup
   ```

3. **Launch Applications Concurrently**:
   ```bash
   pnpm run dev
   ```
   - **Web App**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:8001](http://localhost:8001)

### Running Automated Test Suites

```bash
# Run complete backend integration suite (76 passed)
apps/api/.venv/Scripts/pytest tests/ -v

# Run viewer behavioral sequence trajectory suite specifically (12 passed)
apps/api/.venv/Scripts/pytest tests/test_behavioral_semantics.py -v

# Run frontend production build verification
pnpm run build
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

