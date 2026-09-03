# Frame Sense

Frame Sense is an autonomous post-production intelligence system for filmmakers and studios, developed for the **Agentic Cinema: The Blockbuster Hackathon**.

---

## Overview

Frame Sense transforms large-scale test-screening viewer behavior into evidence-backed, scientifically defensible post-production intelligence. By capturing second-by-second playback telemetry (pauses, rewinds, exits, replays, skips, tab hides) in ClickHouse and executing agentic multimodal video analysis via Google ADK & Gemini 2.5 Vision, Frame Sense helps directors and editors identify pacing issues, emotional drop-offs, and visual narrative friction to generate precise edit recommendations and industry-standard NLE exports (FCP XML & EDL).

---

## The Problem

During post-production test screenings, studios traditionally rely on retrospective paper surveys and focus groups. This feedback is highly subjective, vague, and lacks frame-by-frame behavioral telemetry. Manually correlating audience drop-offs or rewinds with visual scene timing, script context, and audio tracks is too labor-intensive to perform manually.

---

## The Solution & System Architecture

Frame Sense automates the entire screening intelligence pipeline:

```
Viewer Playback Telemetry
         ↓
ClickHouse Columnar Storage
         ↓
Sample-Aware Statistical Intelligence Engine
  (Joint Gating, Laplace Smoothing, Wilson Bounds, Baseline Window)
         ↓
Multimodal Vision Investigation Agent
  (FFmpeg Keyframe Extraction + Gemini 2.5 Vision Reasoning)
         ↓
Scientific Editorial Findings & Recommendations
  (OBSERVATION → INTERPRETATION → HYPOTHESIS → VALIDATION)
         ↓
Interactive Sense AI Assistant (Real-Time SSE Streaming)
         ↓
Professional NLE Export (FCP XML & EDL for Premiere Pro / DaVinci Resolve)
```

---

## Key Features

1. **Second-by-Second Telemetry Ingestion & Analytics**: ClickHouse Cloud columnar ingestion of viewer engagement signals (`exits`, `rewinds`, `pauses`, `replays`, `skips`, `tab_hides`).
2. **Sample-Aware Statistical Joint Gating**: Scientific anomaly gating enforcing viewer sample sufficiency ($n < 5 \rightarrow \text{INSUFFICIENT DATA}$, $5 \le n < 10 \rightarrow \text{PRELIMINARY}$, $n \ge 10 \rightarrow \text{SUFFICIENT}$). Employs Laplace smoothing ($\alpha = 1$) and Wilson confidence lower bounds.
3. **Multimodal Vision Investigation Engine**: Extracts keyframes at exact peak anomaly timecodes via FFmpeg and runs Gemini 2.5 Vision analysis over scene framing, lighting, cut pacing, and visual distraction causes.
4. **Scientific Honesty Taxonomy**: Structured editorial findings categorized strictly into **`OBSERVATION` $\rightarrow$ `INTERPRETATION` $\rightarrow$ `HYPOTHESIS` $\rightarrow$ `VALIDATION`**.
5. **Interactive Sense AI Assistant**: Real-time conversational screening assistant powered by Google ADK (`InMemoryRunner`) + ClickHouse MCP, featuring SSE token streaming and response cancellation controls.
6. **Professional NLE Export**: One-click generation of Final Cut Pro XML (`.fcpxml`) and Edit Decision List (`.edl`) files compatible with Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro.

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React
- **Backend**: Python 3.10+, FastAPI, Pydantic, Uvicorn
- **AI Agent Framework**: Google ADK (Agent Development Kit), Gemini 2.5 Flash / Flash-Lite / Vision
- **Database & MCP**: ClickHouse Cloud / Local, ClickHouse Model Context Protocol (MCP) Server, `clickhouse-connect`
- **Media Processing**: FFmpeg frame extraction engine
- **Package Management**: `pnpm` (Frontend & Monorepo Workspaces), Python `venv`

---

## Repository Structure

```
frame-sense/
├── apps/
│   ├── web/                     # React + Vite + TypeScript Frontend
│   └── api/                     # Python + FastAPI Backend (ADK Agents, Analytics, MCP)
│       ├── agents/              # Google ADK agent definitions (Sense AI, Investigator)
│       ├── app/                 # FastAPI routes, repositories, analytics, services
│       └── main.py              # Backend entry point
├── docs/                        # Comprehensive documentation (architecture, analytics, dev, MCP)
├── tests/                       # Pytest integration suite (63+ test cases)
├── package.json                 # Monorepo root configuration
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## Development Setup

### Prerequisites
- Node.js (v18+)
- `pnpm` (v8+)
- Python (3.10+)
- FFmpeg (added to System PATH for vision frame extraction)

### Quick Start
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Supan-Roy/Frame-Sense.git
   cd Frame-Sense
   ```

2. **Initialize Environment**:
   ```bash
   pnpm run setup
   ```

3. **Run Development Mode**:
   ```bash
   pnpm run dev
   ```
   - **Frontend**: `http://localhost:5173`
   - **Backend API**: `http://localhost:8001`

4. **Run Integration Tests**:
   ```bash
   apps/api/.venv/Scripts/pytest tests/ -v
   ```

---

## Current Project Status

- [x] Initial Monorepo Setup & Workspace Architecture
- [x] ClickHouse Ingestion Schema & Real-Time Telemetry Queries
- [x] Real-Anchored & Synthetic Telemetry Generator Engine
- [x] Sample-Aware Statistical Joint Gating Engine (Laplace + Wilson Bounds)
- [x] Multimodal Vision Investigation Engine (FFmpeg + Gemini 2.5 Vision)
- [x] Interactive Sense AI Chat Assistant with Google ADK + ClickHouse MCP
- [x] Real-Time SSE Token Streaming & Response Cancellation Controls
- [x] Scientific Editorial Findings Dashboard (`OBSERVATION` → `VALIDATION`)
- [x] FCP XML & EDL Export Engine for Premiere Pro / DaVinci Resolve
