from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Frame Sense API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Gemini API Key configuration
    GEMINI_API_KEY: str = ""
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # default Vite port
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
