from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.core.config import settings
from app.api.routes.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Root API router inclusion
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def on_startup():
    from app.database.clickhouse import init_db
    try:
        init_db()
    except Exception as e:
        print(f"Warning: ClickHouse connection failed during startup: {e}. Real-time analytics insertion will fail until ClickHouse is online.")


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

# Mount static web frontend assets if built (for unified production deployment)
SERVE_STATIC_WEB = os.environ.get("SERVE_STATIC_WEB", "false").lower() == "true" or os.environ.get("RAILWAY_ENVIRONMENT") is not None or os.path.exists("/.dockerenv")

possible_dist_paths = [
    os.path.abspath("/app/apps/web/dist"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "web", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "apps", "web", "dist")),
    os.path.abspath("apps/web/dist"),
]

WEB_DIST_DIR = next((p for p in possible_dist_paths if os.path.exists(p)), None) if SERVE_STATIC_WEB else None

if WEB_DIST_DIR:
    assets_dir = os.path.join(WEB_DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("health") or full_path == "docs" or full_path == "redoc":
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        candidate = os.path.join(WEB_DIST_DIR, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        index_html = os.path.join(WEB_DIST_DIR, "index.html")
        if os.path.exists(index_html):
            return FileResponse(index_html)
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


