import os
import sqlite3
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS comments (
                    comment_id TEXT PRIMARY KEY,
                    screening_id TEXT NOT NULL,
                    viewer_id TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    video_timecode_sec REAL NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (screening_id) REFERENCES screenings(screening_id) ON DELETE CASCADE
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

    def add_comment(
        self,
        screening_id: str,
        viewer_id: str,
        display_name: str,
        video_timecode_sec: float,
        content: str
    ) -> Dict[str, Any]:
        comment_id = f"cmt_{secrets.token_hex(10)}"
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_connection()
        try:
            conn.execute(
                """
                INSERT INTO comments (
                    comment_id, screening_id, viewer_id, display_name,
                    video_timecode_sec, content, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comment_id, screening_id, viewer_id, display_name,
                    round(video_timecode_sec, 2), content.strip(), now, now
                )
            )
            conn.commit()
        finally:
            conn.close()

        return {
            "comment_id": comment_id,
            "screening_id": screening_id,
            "viewer_id": viewer_id,
            "display_name": display_name,
            "video_timecode_sec": round(video_timecode_sec, 2),
            "content": content.strip(),
            "created_at": now,
            "updated_at": now
        }

    def get_comments_by_screening(self, screening_id: str) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM comments WHERE screening_id = ? ORDER BY video_timecode_sec ASC, created_at ASC",
                (screening_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_comment_by_id(self, comment_id: str) -> Dict[str, Any] | None:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM comments WHERE comment_id = ?", (comment_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def update_comment(self, comment_id: str, viewer_id: str, content: str) -> Dict[str, Any] | None:
        conn = self._get_connection()
        try:
            comment = self.get_comment_by_id(comment_id)
            if not comment:
                return None
            if comment["viewer_id"] != viewer_id:
                raise PermissionError("Only the original author can edit this comment.")

            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "UPDATE comments SET content = ?, updated_at = ? WHERE comment_id = ?",
                (content.strip(), now, comment_id)
            )
            conn.commit()
            return self.get_comment_by_id(comment_id)
        finally:
            conn.close()

    def delete_comment(self, comment_id: str, viewer_id: Optional[str] = None, is_admin: bool = False) -> bool:
        conn = self._get_connection()
        try:
            comment = self.get_comment_by_id(comment_id)
            if not comment:
                return False
            if not is_admin and comment["viewer_id"] != viewer_id:
                raise PermissionError("Only the original author or admin can delete this comment.")

            cursor = conn.execute("DELETE FROM comments WHERE comment_id = ?", (comment_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete(self, screening_id: str) -> bool:
        conn = self._get_connection()
        try:
            cursor = conn.execute("DELETE FROM screenings WHERE screening_id = ?", (screening_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

# Export single repository instance
screening_repo = ScreeningRepository()
