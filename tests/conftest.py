import os
import sys

# Add apps/api to python path so root tests can import backend app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/api")))

# Set mock key for Gemini
os.environ["GEMINI_API_KEY"] = "mock_key"
