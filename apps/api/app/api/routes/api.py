from fastapi import APIRouter

api_router = APIRouter()

# Placeholder for screening routes
# api_router.include_router(screenings.router, prefix="/screenings", tags=["screenings"])

# Placeholder for findings routes
# api_router.include_router(findings.router, prefix="/findings", tags=["findings"])

@api_router.get("/status")
def get_status():
    return {
        "status": "online",
        "message": "Frame Sense services are running",
        "modules": {
            "agent_orchestrator": "disabled",
            "clickhouse_mcp": "disabled",
            "telemetry_analytics": "disabled"
        }
    }
