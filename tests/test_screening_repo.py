import os
import pytest
from app.screening.repository import ScreeningRepository

@pytest.fixture
def temp_repo():
    repo = ScreeningRepository()
    yield repo
    repo.delete("sc_test123")
    repo.delete("sc_to_delete")

def test_create_and_get_screening(temp_repo):
    record = temp_repo.create(
        screening_id="sc_test123",
        media_id="med_test123",
        title="Test Screening Title",
        media_filename="test_file.mp4",
        media_duration=120.5,
        description="Test description"
    )
    assert record["screening_id"] == "sc_test123"
    assert record["title"] == "Test Screening Title"
    assert record["media_duration"] == 120.5
    assert record["public_token"] is not None

    by_id = temp_repo.get_by_id("sc_test123")
    assert by_id is not None
    assert by_id["title"] == "Test Screening Title"

    by_token = temp_repo.get_by_token(record["public_token"])
    assert by_token is not None
    assert by_token["screening_id"] == "sc_test123"

def test_delete_screening(temp_repo):
    temp_repo.create(
        screening_id="sc_to_delete",
        media_id="med_to_delete",
        title="To Delete",
        media_filename="file.mp4",
        media_duration=60.0
    )
    assert temp_repo.get_by_id("sc_to_delete") is not None
    deleted = temp_repo.delete("sc_to_delete")
    assert deleted is True
    assert temp_repo.get_by_id("sc_to_delete") is None
