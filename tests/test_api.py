import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_api_status():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["modules"]["telemetry_analytics"] == "active"

def test_get_screenings():
    response = client.get("/api/v1/screenings")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
