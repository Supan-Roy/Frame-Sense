import os
import sys

# Add apps/api to python path so tests can run from anywhere
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Force setting environment variables for tests
os.environ["GEMINI_API_KEY"] = "mock_key"
