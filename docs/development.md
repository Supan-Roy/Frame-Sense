# Local Development Guide

This guide details the setup and development workflows for the **Frame Sense** monorepo.

## Prerequisites
Ensure the following tools are installed on your machine:
- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher)
- **Python** (3.10 or higher)

---

## Workspace Layout
```
frame-sense/
├── apps/
│   ├── web/                     # React + Vite + TypeScript (Tailwind & shadcn/ui)
│   └── api/                     # Python + FastAPI (Pydantic)
├── packages/
│   ├── types/                   # Shared TypeScript models
│   ├── ui/                      # Placeholder for shared UI library components
│   └── config/                  # Placeholder for workspace configurations
```

---

## Setup Instructions

### 1. Initial Setup
Run the helper script from the root to install both JavaScript dependencies and set up the Python backend virtual environment:
```bash
pnpm run setup
```
This executes:
- Node packages installation (`pnpm install`)
- Creation of a Python virtual environment in `apps/api/.venv`
- Installation of python backend packages from `apps/api/requirements.txt`

### 2. Running the Development Servers
To run both the frontend and backend servers concurrently, execute:
```bash
pnpm run dev
```
- **Web Client**: Runs at [http://localhost:5173](http://localhost:5173) (Vite server)
- **Backend API**: Runs at [http://localhost:8000](http://localhost:8000) (Uvicorn server)

### 3. Individual Commands
If you want to run applications individually:

#### Web Client Only
```bash
pnpm --filter web dev
```

#### Backend API Only
Activate the virtual environment first, then run uvicorn:
```bash
cd apps/api
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
Or use the workspace script wrapper:
```bash
pnpm --filter api dev
```

---

## Development Principles
- **Separation**: Keep UI styling and rendering isolated in `apps/web/`. All API integrations should route through `apps/web/src/services/`.
- **Shared Contracts**: Any model or data schema change shared by both systems should update `packages/types/src/index.ts`.
- **Modularity**: Place FastAPI models under `app/models/` and routers in `app/api/routes/`. Keep agentic logic decoupled from data ingestion.
