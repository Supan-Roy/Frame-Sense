import os
import json
import sqlite3
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# We store metadata inside apps/api/data/metadata.db
DEFAULT_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/metadata.db"))


class ScreeningRepository:
    def __init__(self, db_file: Optional[str] = None):
        self._custom_db_file = db_file
        # Ensure data folder exists
        os.makedirs(os.path.dirname(self.db_file), exist_ok=True)
        # Initialize schema
        self._init_db()

    @property
    def db_file(self) -> str:
        return self._custom_db_file or os.environ.get("FRAME_SENSE_DB_PATH", DEFAULT_DB_FILE)

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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS investigations (
                    screening_id TEXT NOT NULL,
                    anomaly_id TEXT NOT NULL,
                    investigation_report TEXT NOT NULL,
                    mcp_queries_json TEXT NOT NULL,
                    extracted_frames_json TEXT NOT NULL,
                    elaborated_report TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (screening_id, anomaly_id),
                    FOREIGN KEY (screening_id) REFERENCES screenings(screening_id) ON DELETE CASCADE
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    session_id TEXT PRIMARY KEY,
                    screening_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (screening_id) REFERENCES screenings(screening_id) ON DELETE CASCADE
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    message_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    screening_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
                )
            """)
            try:
                conn.execute("ALTER TABLE investigations ADD COLUMN elaborated_report TEXT")
            except Exception:
                pass
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

    # --- AI Investigation Persistence Methods ---

    def save_investigation(
        self,
        screening_id: str,
        anomaly_id: str,
        investigation_report: str,
        mcp_queries: List[Dict[str, Any]],
        extracted_frames: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Upserts an AI investigation report for a screening anomaly into SQLite."""
        conn = self._get_connection()
        now = datetime.now(timezone.utc).isoformat()
        mcp_json = json.dumps(mcp_queries or [])
        frames_json = json.dumps(extracted_frames or [])
        try:
            conn.execute("""
                INSERT INTO investigations (
                    screening_id, anomaly_id, investigation_report, mcp_queries_json, extracted_frames_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(screening_id, anomaly_id) DO UPDATE SET
                    investigation_report = excluded.investigation_report,
                    mcp_queries_json = excluded.mcp_queries_json,
                    extracted_frames_json = excluded.extracted_frames_json,
                    updated_at = excluded.updated_at
            """, (screening_id, anomaly_id, investigation_report, mcp_json, frames_json, now))
            conn.commit()
            return {
                "screening_id": screening_id,
                "anomaly_id": anomaly_id,
                "investigation_report": investigation_report,
                "mcp_queries_executed": mcp_queries,
                "extracted_frames": extracted_frames,
                "updated_at": now
            }
        finally:
            conn.close()

    def get_investigation(self, screening_id: str, anomaly_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves saved AI investigation for a specific anomaly."""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM investigations WHERE screening_id = ? AND anomaly_id = ?",
                (screening_id, anomaly_id)
            )
            row = cursor.fetchone()
            if not row:
                return None
            r = dict(row)
            return {
                "screening_id": r["screening_id"],
                "anomaly_id": r["anomaly_id"],
                "investigation_report": r["investigation_report"],
                "mcp_queries_executed": json.loads(r["mcp_queries_json"] or "[]"),
                "extracted_frames": json.loads(r["extracted_frames_json"] or "[]"),
                "elaborated_report": r.get("elaborated_report"),
                "updated_at": r["updated_at"]
            }
        finally:
            conn.close()

    def get_all_investigations(self, screening_id: str) -> Dict[str, Dict[str, Any]]:
        """Returns a dictionary mapping anomaly_id -> saved investigation record for a screening."""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM investigations WHERE screening_id = ? ORDER BY updated_at DESC",
                (screening_id,)
            )
            results = {}
            for row in cursor.fetchall():
                r = dict(row)
                results[r["anomaly_id"]] = {
                    "screening_id": r["screening_id"],
                    "anomaly_id": r["anomaly_id"],
                    "investigation_report": r["investigation_report"],
                    "mcp_queries_executed": json.loads(r["mcp_queries_json"] or "[]"),
                    "extracted_frames": json.loads(r["extracted_frames_json"] or "[]"),
                    "elaborated_report": r.get("elaborated_report"),
                    "updated_at": r["updated_at"]
                }
            return results
        finally:
            conn.close()

    def save_elaborated_report(
        self,
        screening_id: str,
        anomaly_id: str,
        elaborated_report: str
    ) -> Dict[str, Any]:
        """Saves or updates the elaborated creative edit recommendations report for an anomaly."""
        conn = self._get_connection()
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn.execute("""
                UPDATE investigations
                SET elaborated_report = ?, updated_at = ?
                WHERE screening_id = ? AND anomaly_id = ?
            """, (elaborated_report, now, screening_id, anomaly_id))
            conn.commit()
            return self.get_investigation(screening_id, anomaly_id) or {
                "screening_id": screening_id,
                "anomaly_id": anomaly_id,
                "elaborated_report": elaborated_report,
                "updated_at": now
            }
        finally:
            conn.close()

    def delete_investigation(self, screening_id: str, anomaly_id: str) -> bool:
        """Deletes a saved AI investigation for a screening anomaly."""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "DELETE FROM investigations WHERE screening_id = ? AND anomaly_id = ?",
                (screening_id, anomaly_id)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # --- Sense AI Chat Persistence Methods ---

    def create_chat_session(self, screening_id: str, title: str = "New Chat Session") -> Dict[str, Any]:
        """Creates a new Sense AI chat session for a screening."""
        conn = self._get_connection()
        session_id = f"cs_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn.execute("""
                INSERT INTO chat_sessions (session_id, screening_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, screening_id, title, now, now))
            conn.commit()
            return {
                "session_id": session_id,
                "screening_id": screening_id,
                "title": title,
                "created_at": now,
                "updated_at": now
            }
        finally:
            conn.close()

    def get_chat_sessions(self, screening_id: str) -> List[Dict[str, Any]]:
        """Returns all chat sessions for a screening ordered by most recent."""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM chat_sessions WHERE screening_id = ? ORDER BY updated_at DESC",
                (screening_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_chat_session(self, session_id: str) -> Dict[str, Any] | None:
        """Retrieves a chat session by ID."""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM chat_sessions WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_chat_session(self, session_id: str) -> bool:
        """Deletes a chat session and all its messages."""
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            cursor = conn.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def save_chat_message(self, session_id: str, screening_id: str, role: str, content: str) -> Dict[str, Any]:
        """Saves a user or assistant chat message and updates session timestamp."""
        conn = self._get_connection()
        message_id = f"cm_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn.execute("""
                INSERT INTO chat_messages (message_id, session_id, screening_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (message_id, session_id, screening_id, role, content, now))

            if role == "user":
                cursor = conn.execute("SELECT COUNT(*) as cnt FROM chat_messages WHERE session_id = ?", (session_id,))
                cnt = cursor.fetchone()["cnt"]
                if cnt <= 1:
                    title_snippet = content[:35] + ("..." if len(content) > 35 else "")
                    conn.execute("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE session_id = ?", (title_snippet, now, session_id))
                else:
                    conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?", (now, session_id))
            else:
                conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?", (now, session_id))

            conn.commit()
            return {
                "message_id": message_id,
                "session_id": session_id,
                "screening_id": screening_id,
                "role": role,
                "content": content,
                "created_at": now
            }
        finally:
            conn.close()

    def get_chat_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """Returns all messages in a chat session chronologically."""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()


# Export single repository instance
screening_repo = ScreeningRepository()
