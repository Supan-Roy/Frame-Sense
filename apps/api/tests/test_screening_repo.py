import os
import pytest
from app.screening.repository import ScreeningRepository

TEST_JSON = os.path.abspath("data/test_screenings.json")

@pytest.fixture
def temp_repo():
    # Ensure clean start
    if os.path.exists(TEST_JSON):
        os.remove(TEST_JSON)
    repo = ScreeningRepository(data_file=TEST_JSON)
    yield repo
    # Clean up
    if os.path.exists(TEST_JSON):
        os.remove(TEST_JSON)

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

    # Test retrieve by ID
    by_id = temp_repo.get_by_id("sc_test123")
    assert by_id is not None
    assert by_id["title"] == "Test Screening Title"

    # Test retrieve by Token
    by_token = temp_repo.get_by_token(record["public_token"])
    assert by_token is not None
    assert by_token["screening_id"] == "sc_test123"
