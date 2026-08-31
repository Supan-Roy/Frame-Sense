import os
import sys
from dotenv import load_dotenv

# Add apps/api to python path so root tests can import backend app
api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/api"))
sys.path.insert(0, api_dir)

# Load environment variables from apps/api/.env if available
env_path = os.path.join(api_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

# Set fallback mock key for Gemini in CI/CD if no key is configured
if not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = "mock_key"
