import os
import sqlite3
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any

# We store metadata inside apps/api/data/metadata.db
DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/metadata.db"))


class ScreeningRepository:
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        # Ensure data folder exists
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)
        # Initialize schema
        self._init_db()

    def _get_connection(self):
        # Use sqlite3 connection with dict-factory to easily return rows as dicts
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS screenings (
                    screening_id TEXT PRIMARY KEY,
                    media_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    media_filename TEXT NOT NULL,
                    media_duration REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    public_token TEXT UNIQUE NOT NULL
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def get_all(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM screenings ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_by_id(self, screening_id: str) -> Dict[str, Any] | None:
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM screenings WHERE screening_id = ?", 
                (screening_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_by_token(self, public_token: str) -> Dict[str, Any] | None:
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM screenings WHERE public_token = ?", 
                (public_token,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

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
        # Generate cryptographically secure token
        public_token = secrets.token_urlsafe(24)
        created_at = datetime.now(timezone.utc).isoformat()

        conn = self._get_connection()
        try:
            conn.execute(
                """
                INSERT INTO screenings (
                    screening_id, media_id, title, description, 
                    media_filename, media_duration, created_at, status, public_token
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    screening_id, media_id, title, description,
                    media_filename, media_duration, created_at, status, public_token
                )
            )
            conn.commit()
        finally:
            conn.close()

        return {
            "screening_id": screening_id,
            "media_id": media_id,
            "title": title,
            "description": description,
            "media_filename": media_filename,
            "media_duration": media_duration,
            "created_at": created_at,
            "status": status,
            "public_token": public_token
        }

# Export single repository instance
screening_repo = ScreeningRepository()
