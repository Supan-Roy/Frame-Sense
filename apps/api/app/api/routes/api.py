from fastapi import APIRouter
from app.api.routes import screenings, public_screening, telemetry

api_router = APIRouter()

# Register core studio screening routes
api_router.include_router(screenings.router, prefix="/screenings", tags=["screenings"])

# Register public viewing routes
api_router.include_router(public_screening.router, prefix="/screening", tags=["public_screening"])

# Register telemetry events pipelines
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])

@api_router.get("/status")
def get_status():
    return {
        "status": "online",
        "message": "Frame Sense services are running",
        "modules": {
            "agent_orchestrator": "disabled",
            "clickhouse_mcp": "active",
            "telemetry_analytics": "active"
        }
    }
