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

### Environment Configuration
Ensure `apps/api/.env` contains your ClickHouse and Google Gemini API credentials:
```env
CLICKHOUSE_HOST=your-clickhouse-host
CLICKHOUSE_PORT=8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
CLICKHOUSE_SECURE=true
GEMINI_API_KEY=your-gemini-key
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

The backend includes a comprehensive pytest integration suite testing statistical joint gating, viewer sequence trajectory semantics, ClickHouse MCP integration, agent orchestration, and vision frame extraction:

```bash
# Run full backend test suite (76 tests)
apps/api/.venv/Scripts/pytest tests/ -v

# Run viewer behavioral semantics regression suite specifically (12 adversarial scenarios)
apps/api/.venv/Scripts/pytest tests/test_behavioral_semantics.py -v
```

---

## 4. Running Frontend Build Verification

To verify TypeScript contracts, React component builds, and Vite production bundling:
```bash
pnpm run build
```
Or for the web workspace specifically:
```bash
pnpm --filter web build
```

