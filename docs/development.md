# Local Development & Testing Guide

This guide details setup, local execution, and testing procedures for the **Frame Sense** codebase.

---

## 1. Prerequisites

Ensure the following tools are installed:
- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Python** (3.10 or higher)
- **FFmpeg** (installed and added to System PATH for video keyframe extraction)

---

## 2. Environment Setup & Development Servers

### Installation
Run setup script from the workspace root:
```bash
pnpm run setup
```

### Running Applications Concurrently
To launch both the web frontend and Python backend API:
```bash
pnpm run dev
```
- **Web App**: [http://localhost:5173](http://localhost:5173) (Vite server)
- **Backend API**: [http://localhost:8001](http://localhost:8001) (FastAPI / Uvicorn server)

---

## 3. Running Pytest Integration Tests

The backend includes a comprehensive pytest integration suite testing statistical joint gating, ClickHouse MCP integration, agent orchestration, and vision frame extraction:

```bash
apps/api/.venv/Scripts/pytest tests/ -v
```

---

## 4. Running Frontend Build Verification

To verify TypeScript contracts and Vite production bundling:
```bash
pnpm run build
```
