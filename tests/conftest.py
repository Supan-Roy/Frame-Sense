import os
import sys
from dotenv import load_dotenv

# Add apps/api to python path so root tests can import backend app
api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/api"))
sys.path.insert(0, api_dir)

import tempfile

# Set mock key for Gemini so pytest unit tests NEVER consume live API calls/rate limits
os.environ["GEMINI_API_KEY"] = "mock_key"

# Use isolated test database for pytest suite so development metadata.db is NEVER modified by tests
test_db = os.path.join(tempfile.gettempdir(), "frame_sense_pytest.db")
if os.path.exists(test_db):
    try:
        os.remove(test_db)
    except Exception:
        pass
os.environ["FRAME_SENSE_DB_PATH"] = test_db
