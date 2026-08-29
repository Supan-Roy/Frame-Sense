# Frame Sense

Frame Sense is an autonomous post-production intelligence system for filmmakers and studios, developed for the **Agentic Cinema: The Blockbuster Hackathon**.

## Overview
Frame Sense transforms large-scale test-screening viewer behavior into evidence-backed post-production intelligence. By capturing telemetry at scale and performing agentic video, audio, and script analysis, it helps directors and editors identify pacing issues, emotional mismatches, and narrative confusion to suggest precise edit recommendations.

## The Problem
During test screenings, studios collect viewer feedback via surveys and questionnaires. However, this feedback is retrospective, highly subjective, and lacks frame-by-frame behavioral telemetry (such as facial expressions, attention shifts, and real-time response). Manually correlating physical reactions with script timing and video cues is too labor-intensive to perform at scale.

## The Vision
Frame Sense aims to automate this pipeline by ingest-analyzing audience reaction telemetry, detecting anomalies (e.g., sudden drops in attention during a climax), and deploying autonomous AI agents to analyze the corresponding film/audio frames and script pages. It provides clear, actionable edit recommendations directly to editors.

---

## Planned Workflow
```
Test Screening
    ↓
Viewer Telemetry
    ↓
High-volume Analytics
    ↓
Audience Anomaly Detection
    ↓
Autonomous Investigation
    ↓
Video + Audio + Script Analysis
    ↓
Editorial Finding
    ↓
Edit Recommendation
    ↓
Editor / Director Review
```

---

## Planned Architecture

### System Flow
```
Frontend (React/Vite)
    ↓
Backend/API (FastAPI)
    ↓
Agent Orchestration
    ↓
ClickHouse MCP (Viewer telemetry data store)
```

### Agentic Pipeline
```
Agent
    ↓
Media Retrieval (Clip & script extraction)
    ↓
Video/Audio/Script Context (Multimodal input)
    ↓
Gemini Multimodal Reasoning
    ↓
Finding (Pacing/emotion mismatch explanation)
    ↓
Edit Recommendation (e.g., "Cut frames 240-300; swap with B-roll")
```

*Note: The AI agent, Gemini, and ClickHouse components are planned features and are not yet implemented in this initial repository boilerplate.*

---

## Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, shadcn/ui, Lucide React
- **Backend**: Python, FastAPI, Pydantic
- **Package Management**: `pnpm` (Frontend & Monorepo Workspaces), `pip`/`venv` (Python API)

---

## Repository Structure

```
frame-sense/
├── apps/
│   ├── web/                     # React + Vite + TS Frontend
│   └── api/                     # Python + FastAPI Backend
├── packages/
│   ├── types/                   # Shared TypeScript type definitions
│   ├── ui/                      # Shared UI components UI framework
│   └── config/                  # Shared styling & build configs
├── docs/                        # Project documentation (product, architecture, dev)
├── assets/                      # Shared static assets
├── scripts/                     # Operational scripts
├── package.json                 # Monorepo root configuration
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## Development Setup

### Prerequisites
- Node.js (v18+)
- `pnpm` (v8+)
- Python (3.10+)

### Quick Start
1. Clone the repository.
2. Initialize environment and dependencies by running:
   ```bash
   pnpm run setup
   ```
   *This command runs `pnpm install` and creates/installs Python dependencies in the backend virtual environment.*
3. Run the applications concurrently in development mode:
   ```bash
   pnpm run dev
   ```
   - Frontend will run at: `http://localhost:5173`
   - Backend API will run at: `http://localhost:8000`

---

## Current Project Status & Roadmap

- [x] Initial Monorepo Setup & Workspace Architecture
- [x] API Healthcheck & Router Boilerplate
- [x] Web Client Application Shell & Page Placeholders
- [x] Shared TypeScript Data Contracts
- [ ] Synthetic Telemetry Generator Script
- [ ] ClickHouse Integration & Schema Setup
- [ ] Multimodal Gemini Agent Orchestration
- [ ] Actionable Edit Recommendation Dashboard
