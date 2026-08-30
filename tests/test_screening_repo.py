import os
import pytest
from app.screening.repository import ScreeningRepository

# Place test data file inside apps/api/data to avoid root clutter
TEST_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/api/data/test_metadata.db"))

@pytest.fixture
def temp_repo():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    repo = ScreeningRepository(db_file=TEST_DB)
    yield repo
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

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
