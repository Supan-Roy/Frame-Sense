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
# Run full backend test suite (78 tests)
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

---

## 5. Gemini API Error Handling, Caching & Request Cancellation

### A. Caching & `force_refresh=true` Cache Bypass
- **Fast ClickHouse Database Cache Check**: When viewing an anomaly investigation, the backend first checks stored database records (`screening_repo.get_investigation`). If a report exists and does not contain a quota error, it returns in **$< 70\text{ms}$** without calling Gemini.
- **Force Regeneration Endpoint**: Calling `POST /api/v1/screenings/{screening_id}/audience/anomalies/{anomaly_id}/investigate?force_refresh=true` explicitly bypasses the database cache, forcing fresh FFmpeg frame extraction, ClickHouse MCP query execution, and live Gemini Vision reasoning.

### B. Interactive Request Cancellation (`AbortController`)
- **React Signal Binding**: The web workspace maintains `useRef<AbortController | null>(null)` references for investigation and creative elaboration requests.
- **Dynamic Stop Button**: While an investigation or regeneration is running (`investigating === true`), the UI transforms the generation/regeneration button into a **Stop** button.
- **Abort Error Handling**: Clicking **Stop** calls `abortControllerRef.current.abort()`. The browser aborts the HTTP request (`AbortError`), and the backend socket disconnect cancels the running task without corrupting database state.

### C. Quota & Rate Limit Fault Tolerance (HTTP 429)
- **640px JPEG Optimization**: Extracted keyframes are downscaled to 640px JPEGs (`-vf "scale='min(640,iw)':-1" -q:v 5`), cutting image token payload from ~500KB to ~25KB per frame.
- **Exponential Backoff**: Transient `429` / `RESOURCE_EXHAUSTED` errors trigger automated retries (1.5s, 3.0s, 4.5s backoff delays).
- **Graceful Error UI**: If quota is permanently exhausted, the application displays a styled amber warning banner highlighting the exact file location called (`apps/api/agents/frame_sense_investigator.py`).

---

## 6. ClickHouse Connection Pooling & Query Performance Benchmarks

### A. Connection Singleton & Keep-Alive Pooling
- **Persistent Client Singleton**: `get_client()` in `apps/api/app/database/clickhouse.py` reuses a thread-safe `_client_instance` backed by `urllib3.PoolManager(maxsize=50)`.
- **Latency Impact**: Eliminates repeated TLS handshakes to ClickHouse Cloud on every parallel API call. Parallel Audience Intelligence modal loads drop from **2–3s to $< 150\text{ms}$**.

### B. $O(\log N)$ Retention Curve Binary Search Algorithm
- **Single-Pass Timecode Query**: `get_retention_data` in `apps/api/app/screening/analytics.py` executes a single fast query (`SELECT max(video_timecode_sec) ... GROUP BY anonymous_viewer_id`).
- **Binary Search Bucket Counting**: Sorts maximum watched timecodes and uses `bisect.bisect_left` to count active viewers per bucket in $O(\log N)$ operations per bucket. Retention curve generation runs in **$\sim 5\text{ms}$**.

