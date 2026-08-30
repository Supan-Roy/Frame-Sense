import os
import json
import secrets
from typing import List, Dict, Any
from pydantic import BaseModel

# We store screenings in data/screenings.json
DATA_FILE = os.path.abspath("data/screenings.json")

class ScreeningRecord(BaseModel):
    screening_id: str
    media_id: str
    title: str
    description: str | None = None
    media_filename: str
    media_duration: float  # in seconds
    created_at: str        # ISO-8601 string
    status: str            # 'active', 'inactive'
    public_token: str      # Secure unguessable token

class ScreeningRepository:
    def __init__(self, data_file: str = DATA_FILE):
        self.data_file = data_file
        # Ensure data folder exists
        os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
        # Initialize JSON file if it doesn't exist
        if not os.path.exists(self.data_file):
            self._save_all([])

    def _load_all(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_all(self, records: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

    def get_all(self) -> List[Dict[str, Any]]:
        return self._load_all()

    def get_by_id(self, screening_id: str) -> Dict[str, Any] | None:
        records = self._load_all()
        for r in records:
            if r["screening_id"] == screening_id:
                return r
        return None

    def get_by_token(self, public_token: str) -> Dict[str, Any] | None:
        records = self._load_all()
        for r in records:
            if r["public_token"] == public_token:
                return r
        return None

    def create(
        self,
        screening_id: str,
        media_id: str,
        title: str,
        media_filename: str,
        media_duration: float,
        description: str | None = None,
        status: str = "active"
    ) -> Dict[str, Any]:
        # Generate a cryptographically secure, unguessable public token
        # URL-safe token with 24 bytes of entropy (32-character string)
        public_token = secrets.token_urlsafe(24)

        # Import datetime inline to get current UTC timestamp
        from datetime import datetime, timezone
        created_at = datetime.now(timezone.utc).isoformat()

        record = ScreeningRecord(
            screening_id=screening_id,
            media_id=media_id,
            title=title,
            description=description,
            media_filename=media_filename,
            media_duration=media_duration,
            created_at=created_at,
            status=status,
            public_token=public_token
        )

        records = self._load_all()
        records.append(record.model_dump())
        self._save_all(records)
        return record.model_dump()

# Export single repository instance
screening_repo = ScreeningRepository()
