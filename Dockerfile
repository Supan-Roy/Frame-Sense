# ==========================================
# STAGE 1: Build Web Frontend (Node.js)
# ==========================================
FROM node:22-alpine AS web-builder
WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy root monorepo files & packages workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY packages /app/packages
COPY apps/web/package.json /app/apps/web/

RUN pnpm install --frozen-lockfile || pnpm install

COPY apps/web /app/apps/web
WORKDIR /app/apps/web
RUN pnpm run build

# ==========================================
# STAGE 2: Python FastAPI Production Server
# ==========================================
FROM python:3.11-slim AS runner

# Install system dependencies (ffmpeg for video keyframe extraction)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy API python requirements and install
COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt

# Copy API backend application code
COPY apps/api /app/apps/api

# Copy static frontend dist from Stage 1 into apps/web/dist
COPY --from=web-builder /app/apps/web/dist /app/apps/web/dist

# Expose default HTTP port
EXPOSE 8000

WORKDIR /app/apps/api

# Run uvicorn server listening on 0.0.0.0 and PORT environment variable
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
