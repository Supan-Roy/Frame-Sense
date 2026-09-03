import os
import json
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.database.clickhouse import get_client, init_db


class ScreeningRepository:
    def __init__(self, db_file: Optional[str] = None):
        # Trigger ClickHouse schema initialization (ensures all tables exist)
        try:
            init_db()
        except Exception as e:
            print(f"ClickHouse initialization notice: {e}")

    def get_all(self) -> List[Dict[str, Any]]:
        client = get_client()
        res = client.query("SELECT screening_id, media_id, title, description, media_filename, media_duration, created_at, status, public_token FROM default.screenings ORDER BY created_at DESC")
        if not res.result_rows:
            return []
        cols = ["screening_id", "media_id", "title", "description", "media_filename", "media_duration", "created_at", "status", "public_token"]
        out = []
        for r in res.result_rows:
            item = dict(zip(cols, r))
            if isinstance(item["created_at"], datetime):
                item["created_at"] = item["created_at"].isoformat()
            out.append(item)
        return out

    def get_by_id(self, screening_id: str) -> Dict[str, Any] | None:
        client = get_client()
        res = client.query(
            "SELECT screening_id, media_id, title, description, media_filename, media_duration, created_at, status, public_token FROM default.screenings WHERE screening_id = {sid:String}",
            parameters={"sid": screening_id}
        )
        if not res.result_rows:
            return None
        cols = ["screening_id", "media_id", "title", "description", "media_filename", "media_duration", "created_at", "status", "public_token"]
        item = dict(zip(cols, res.result_rows[0]))
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()
        return item

    def get_by_token(self, public_token: str) -> Dict[str, Any] | None:
        client = get_client()
        res = client.query(
            "SELECT screening_id, media_id, title, description, media_filename, media_duration, created_at, status, public_token FROM default.screenings WHERE public_token = {token:String}",
            parameters={"token": public_token}
        )
        if not res.result_rows:
            return None
        cols = ["screening_id", "media_id", "title", "description", "media_filename", "media_duration", "created_at", "status", "public_token"]
        item = dict(zip(cols, res.result_rows[0]))
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()
        return item

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
        public_token = secrets.token_urlsafe(24)
        created_at_dt = datetime.now(timezone.utc)
        created_at_iso = created_at_dt.isoformat()

        client = get_client()
        client.insert("screenings", [[
            screening_id, media_id, title, description or "",
            media_filename, float(media_duration), created_at_dt, status, public_token
        ]], column_names=[
            "screening_id", "media_id", "title", "description",
            "media_filename", "media_duration", "created_at", "status", "public_token"
        ])

        return {
            "screening_id": screening_id,
            "media_id": media_id,
            "title": title,
            "description": description,
            "media_filename": media_filename,
            "media_duration": media_duration,
            "created_at": created_at_iso,
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
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        client = get_client()
        client.insert("comments", [[
            comment_id, screening_id, viewer_id, display_name,
            round(float(video_timecode_sec), 2), content.strip(), now_dt, now_dt
        ]], column_names=[
            "comment_id", "screening_id", "viewer_id", "display_name",
            "video_timecode_sec", "content", "created_at", "updated_at"
        ])

        return {
            "comment_id": comment_id,
            "screening_id": screening_id,
            "viewer_id": viewer_id,
            "display_name": display_name,
            "video_timecode_sec": round(video_timecode_sec, 2),
            "content": content.strip(),
            "created_at": now_iso,
            "updated_at": now_iso
        }

    def get_comments(self, screening_id: str, viewer_id: str | None = None) -> List[Dict[str, Any]]:
        client = get_client()
        if viewer_id:
            res = client.query(
                """
                SELECT comment_id, screening_id, viewer_id, display_name, video_timecode_sec, content, created_at, updated_at
                FROM (
                    SELECT comment_id, screening_id, viewer_id, display_name, video_timecode_sec, content, created_at, updated_at,
                           ROW_NUMBER() OVER (PARTITION BY comment_id ORDER BY updated_at DESC) as rn
                    FROM default.comments
                    WHERE screening_id = {sid:String} AND viewer_id = {vid:String}
                )
                WHERE rn = 1
                ORDER BY video_timecode_sec ASC
                """,
                parameters={"sid": screening_id, "vid": viewer_id}
            )
        else:
            res = client.query(
                """
                SELECT comment_id, screening_id, viewer_id, display_name, video_timecode_sec, content, created_at, updated_at
                FROM (
                    SELECT comment_id, screening_id, viewer_id, display_name, video_timecode_sec, content, created_at, updated_at,
                           ROW_NUMBER() OVER (PARTITION BY comment_id ORDER BY updated_at DESC) as rn
                    FROM default.comments
                    WHERE screening_id = {sid:String}
                )
                WHERE rn = 1
                ORDER BY video_timecode_sec ASC
                """,
                parameters={"sid": screening_id}
            )
        if not res.result_rows:
            return []
        cols = ["comment_id", "screening_id", "viewer_id", "display_name", "video_timecode_sec", "content", "created_at", "updated_at"]
        out = []
        for r in res.result_rows:
            item = dict(zip(cols, r))
            if isinstance(item["created_at"], datetime):
                item["created_at"] = item["created_at"].isoformat()
            if isinstance(item["updated_at"], datetime):
                item["updated_at"] = item["updated_at"].isoformat()
            out.append(item)
        return out

    def get_comments_by_screening(self, screening_id: str) -> List[Dict[str, Any]]:
        return self.get_comments(screening_id)

    def get_comment_by_id(self, comment_id: str) -> Dict[str, Any] | None:
        client = get_client()
        res = client.query(
            "SELECT comment_id, screening_id, viewer_id, display_name, video_timecode_sec, content, created_at, updated_at FROM default.comments WHERE comment_id = {cid:String} ORDER BY updated_at DESC LIMIT 1",
            parameters={"cid": comment_id}
        )
        if not res.result_rows:
            return None
        cols = ["comment_id", "screening_id", "viewer_id", "display_name", "video_timecode_sec", "content", "created_at", "updated_at"]
        item = dict(zip(cols, res.result_rows[0]))
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()
        if isinstance(item["updated_at"], datetime):
            item["updated_at"] = item["updated_at"].isoformat()
        return item

    def update_comment(self, comment_id: str, viewer_id: str, content: str) -> Dict[str, Any] | None:
        comment = self.get_comment_by_id(comment_id)
        if not comment:
            return None
        if comment["viewer_id"] != viewer_id:
            raise PermissionError("Only the original author can edit this comment.")

        now_dt = datetime.now(timezone.utc)
        client = get_client()
        client.insert("comments", [[
            comment_id, comment["screening_id"], viewer_id, comment["display_name"],
            float(comment["video_timecode_sec"]), content.strip(),
            datetime.fromisoformat(comment["created_at"].replace('Z', '+00:00')), now_dt
        ]], column_names=[
            "comment_id", "screening_id", "viewer_id", "display_name",
            "video_timecode_sec", "content", "created_at", "updated_at"
        ])
        return self.get_comment_by_id(comment_id)

    def delete_comment(self, comment_id: str, viewer_id: Optional[str] = None, is_admin: bool = False) -> bool:
        comment = self.get_comment_by_id(comment_id)
        if not comment:
            return False
        if not is_admin and comment["viewer_id"] != viewer_id:
            raise PermissionError("Only the original author or admin can delete this comment.")

        client = get_client()
        client.command("DELETE FROM default.comments WHERE comment_id = {cid:String}", parameters={"cid": comment_id})
        return True

    def delete(self, screening_id: str) -> bool:
        client = get_client()
        params = {"sid": screening_id}
        client.command("DELETE FROM default.viewer_events WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM default.screenings WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM default.comments WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM default.investigations WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM default.chat_sessions WHERE screening_id = {sid:String}", parameters=params)
        client.command("DELETE FROM default.chat_messages WHERE screening_id = {sid:String}", parameters=params)
        return True

    # --- AI Investigation Persistence Methods ---

    def save_investigation(
        self,
        screening_id: str,
        anomaly_id: str,
        investigation_report: str,
        mcp_queries: List[Dict[str, Any]],
        extracted_frames: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        client = get_client()
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        mcp_json = json.dumps(mcp_queries or [])
        frames_json = json.dumps(extracted_frames or [])

        client.insert("investigations", [[
            screening_id, anomaly_id, investigation_report, mcp_json, frames_json, "", now_dt
        ]], column_names=[
            "screening_id", "anomaly_id", "investigation_report", "mcp_queries_json", "extracted_frames_json", "elaborated_report", "updated_at"
        ])

        return {
            "screening_id": screening_id,
            "anomaly_id": anomaly_id,
            "investigation_report": investigation_report,
            "mcp_queries_executed": mcp_queries,
            "extracted_frames": extracted_frames,
            "updated_at": now_iso
        }

    def get_investigation(self, screening_id: str, anomaly_id: str) -> Optional[Dict[str, Any]]:
        client = get_client()
        res = client.query(
            "SELECT screening_id, anomaly_id, investigation_report, mcp_queries_json, extracted_frames_json, elaborated_report, updated_at FROM default.investigations WHERE screening_id = {sid:String} AND anomaly_id = {aid:String}",
            parameters={"sid": screening_id, "aid": anomaly_id}
        )
        if not res.result_rows:
            return None
        r = res.result_rows[0]
        up_at = r[6].isoformat() if isinstance(r[6], datetime) else r[6]
        return {
            "screening_id": r[0],
            "anomaly_id": r[1],
            "investigation_report": r[2],
            "mcp_queries_executed": json.loads(r[3] or "[]"),
            "extracted_frames": json.loads(r[4] or "[]"),
            "elaborated_report": r[5] or None,
            "updated_at": up_at
        }

    def get_all_investigations(self, screening_id: str) -> Dict[str, Dict[str, Any]]:
        client = get_client()
        res = client.query(
            "SELECT screening_id, anomaly_id, investigation_report, mcp_queries_json, extracted_frames_json, elaborated_report, updated_at FROM default.investigations WHERE screening_id = {sid:String} ORDER BY updated_at DESC",
            parameters={"sid": screening_id}
        )
        if not res.result_rows:
            return {}
        results = {}
        for r in res.result_rows:
            aid = r[1]
            up_at = r[6].isoformat() if isinstance(r[6], datetime) else r[6]
            results[aid] = {
                "screening_id": r[0],
                "anomaly_id": aid,
                "investigation_report": r[2],
                "mcp_queries_executed": json.loads(r[3] or "[]"),
                "extracted_frames": json.loads(r[4] or "[]"),
                "elaborated_report": r[5] or None,
                "updated_at": up_at
            }
        return results

    def save_elaborated_report(
        self,
        screening_id: str,
        anomaly_id: str,
        elaborated_report: str
    ) -> Dict[str, Any]:
        existing = self.get_investigation(screening_id, anomaly_id)
        report_text = existing["investigation_report"] if existing else ""
        mcp_json = json.dumps(existing["mcp_queries_executed"]) if existing else "[]"
        frames_json = json.dumps(existing["extracted_frames"]) if existing else "[]"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        client = get_client()
        client.insert("investigations", [[
            screening_id, anomaly_id, report_text, mcp_json, frames_json, elaborated_report, now_dt
        ]], column_names=[
            "screening_id", "anomaly_id", "investigation_report", "mcp_queries_json", "extracted_frames_json", "elaborated_report", "updated_at"
        ])
        return self.get_investigation(screening_id, anomaly_id) or {
            "screening_id": screening_id,
            "anomaly_id": anomaly_id,
            "elaborated_report": elaborated_report,
            "updated_at": now_iso
        }

    def delete_investigation(self, screening_id: str, anomaly_id: str) -> bool:
        client = get_client()
        client.command("DELETE FROM default.investigations WHERE screening_id = {sid:String} AND anomaly_id = {aid:String}", parameters={"sid": screening_id, "aid": anomaly_id})
        return True

    def delete_all_investigations(self, screening_id: str) -> bool:
        client = get_client()
        client.command("DELETE FROM default.investigations WHERE screening_id = {sid:String}", parameters={"sid": screening_id})
        return True

    # --- Sense AI Chat Persistence Methods ---

    def create_chat_session(self, screening_id: str, title: str = "New Chat Session") -> Dict[str, Any]:
        client = get_client()
        # Check if there is already an empty session (0 messages) for this screening
        empty_res = client.query("""
        SELECT s.session_id, s.title, s.created_at, s.updated_at
        FROM default.chat_sessions s
        LEFT JOIN default.chat_messages m ON s.session_id = m.session_id
        WHERE s.screening_id = {sid:String}
        GROUP BY s.session_id, s.title, s.created_at, s.updated_at
        HAVING count(m.message_id) = 0
        ORDER BY s.created_at DESC
        LIMIT 1
        """, parameters={"sid": screening_id})
        if empty_res.result_rows:
            r = empty_res.result_rows[0]
            cr_at = r[2].isoformat() if isinstance(r[2], datetime) else r[2]
            up_at = r[3].isoformat() if isinstance(r[3], datetime) else r[3]
            return {
                "session_id": r[0],
                "screening_id": screening_id,
                "title": r[1],
                "created_at": cr_at,
                "updated_at": up_at
            }

        session_id = f"cs_{secrets.token_hex(8)}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()

        client.insert("chat_sessions", [[
            session_id, screening_id, title, now_dt, now_dt
        ]], column_names=[
            "session_id", "screening_id", "title", "created_at", "updated_at"
        ])

        return {
            "session_id": session_id,
            "screening_id": screening_id,
            "title": title,
            "created_at": now_iso,
            "updated_at": now_iso
        }

    def get_chat_sessions(self, screening_id: str) -> List[Dict[str, Any]]:
        client = get_client()
        res = client.query(
            "SELECT session_id, screening_id, title, created_at, updated_at FROM default.chat_sessions WHERE screening_id = {sid:String} ORDER BY updated_at DESC",
            parameters={"sid": screening_id}
        )
        if not res.result_rows:
            return []
        cols = ["session_id", "screening_id", "title", "created_at", "updated_at"]
        out = []
        for r in res.result_rows:
            item = dict(zip(cols, r))
            if isinstance(item["created_at"], datetime):
                item["created_at"] = item["created_at"].isoformat()
            if isinstance(item["updated_at"], datetime):
                item["updated_at"] = item["updated_at"].isoformat()
            out.append(item)
        return out

    def get_chat_session(self, session_id: str) -> Dict[str, Any] | None:
        client = get_client()
        res = client.query(
            "SELECT session_id, screening_id, title, created_at, updated_at FROM default.chat_sessions WHERE session_id = {sess_id:String}",
            parameters={"sess_id": session_id}
        )
        if not res.result_rows:
            return None
        cols = ["session_id", "screening_id", "title", "created_at", "updated_at"]
        item = dict(zip(cols, res.result_rows[0]))
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()
        if isinstance(item["updated_at"], datetime):
            item["updated_at"] = item["updated_at"].isoformat()
        return item

    def delete_chat_session(self, session_id: str) -> bool:
        client = get_client()
        client.command("DELETE FROM default.chat_messages WHERE session_id = {sess_id:String}", parameters={"sess_id": session_id})
        client.command("DELETE FROM default.chat_sessions WHERE session_id = {sess_id:String}", parameters={"sess_id": session_id})
        return True

    def save_chat_message(self, session_id: str, screening_id: str, role: str, content: str) -> Dict[str, Any]:
        message_id = f"cm_{secrets.token_hex(8)}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        client = get_client()

        client.insert("chat_messages", [[
            message_id, session_id, screening_id, role, content, now_dt
        ]], column_names=[
            "message_id", "session_id", "screening_id", "role", "content", "created_at"
        ])

        # Update session title/timestamp if user message
        if role == "user":
            cnt_res = client.command("SELECT count() FROM default.chat_messages WHERE session_id = {sess_id:String}", parameters={"sess_id": session_id})
            if cnt_res <= 1:
                title_snippet = content[:35] + ("..." if len(content) > 35 else "")
                sess = self.get_chat_session(session_id)
                cr_dt = datetime.fromisoformat(sess["created_at"].replace('Z', '+00:00')) if sess else now_dt
                client.insert("chat_sessions", [[
                    session_id, screening_id, title_snippet, cr_dt, now_dt
                ]], column_names=["session_id", "screening_id", "title", "created_at", "updated_at"])
            else:
                sess = self.get_chat_session(session_id)
                if sess:
                    cr_dt = datetime.fromisoformat(sess["created_at"].replace('Z', '+00:00'))
                    client.insert("chat_sessions", [[
                        session_id, screening_id, sess["title"], cr_dt, now_dt
                    ]], column_names=["session_id", "screening_id", "title", "created_at", "updated_at"])
        else:
            sess = self.get_chat_session(session_id)
            if sess:
                cr_dt = datetime.fromisoformat(sess["created_at"].replace('Z', '+00:00'))
                client.insert("chat_sessions", [[
                    session_id, screening_id, sess["title"], cr_dt, now_dt
                ]], column_names=["session_id", "screening_id", "title", "created_at", "updated_at"])

        return {
            "message_id": message_id,
            "session_id": session_id,
            "screening_id": screening_id,
            "role": role,
            "content": content,
            "created_at": now_iso
        }

    def get_chat_messages(self, session_id: str) -> List[Dict[str, Any]]:
        client = get_client()
        res = client.query(
            "SELECT message_id, session_id, screening_id, role, content, created_at FROM default.chat_messages WHERE session_id = {sess_id:String} ORDER BY created_at ASC",
            parameters={"sess_id": session_id}
        )
        if not res.result_rows:
            return []
        cols = ["message_id", "session_id", "screening_id", "role", "content", "created_at"]
        out = []
        for r in res.result_rows:
            item = dict(zip(cols, r))
            if isinstance(item["created_at"], datetime):
                item["created_at"] = item["created_at"].isoformat()
            out.append(item)
        return out


# Export single repository instance
screening_repo = ScreeningRepository()
