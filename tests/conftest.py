import os
import sys
from dotenv import load_dotenv

# Add apps/api to python path so root tests can import backend app
api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/api"))
sys.path.insert(0, api_dir)

# Set mock key for Gemini so pytest unit tests NEVER consume live API calls/rate limits
os.environ["GEMINI_API_KEY"] = "mock_key"
