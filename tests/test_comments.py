import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.screening.repository import screening_repo

client = TestClient(app)


import uuid

def test_comment_lifecycle():
    sid = f"sc_cmt_{uuid.uuid4().hex[:8]}"
    screening = screening_repo.create(
        screening_id=sid,
        media_id="med_test_123",
        title="Comment Test Screening",
        media_filename="test.mp4",
        media_duration=120.0,
        description="Testing audience comments"
    )
    try:
        pub_token = screening["public_token"]

        viewer_id = "test_viewer_482"
        display_name = "Anonymous Viewer #482"

        # 2. Add comment
        res = client.post(
            f"/api/v1/screenings/{pub_token}/comments",
            json={
                "viewer_id": viewer_id,
                "display_name": display_name,
                "video_timecode_sec": 14.5,
                "content": "The audio pacing feels a bit slow here."
            }
        )
        assert res.status_code == 200
        cmt = res.json()
        assert cmt["display_name"] == display_name
        assert cmt["video_timecode_sec"] == 14.5
        assert cmt["content"] == "The audio pacing feels a bit slow here."
        comment_id = cmt["comment_id"]

        # 3. Add comment by second viewer
        viewer_id_2 = "test_viewer_999"
        client.post(
            f"/api/v1/screenings/{pub_token}/comments",
            json={
                "viewer_id": viewer_id_2,
                "display_name": "Anonymous Viewer #999",
                "video_timecode_sec": 25.0,
                "content": "Great color grading!"
            }
        )

        # 4. List comments for Viewer 1 only (Privacy Mode)
        res = client.get(f"/api/v1/screenings/{pub_token}/comments?viewer_id={viewer_id}")
        assert res.status_code == 200
        v1_comments = res.json()
        assert len(v1_comments) == 1
        assert v1_comments[0]["comment_id"] == comment_id

        # 5. List all comments without viewer filter (Admin Mode)
        res = client.get(f"/api/v1/screenings/{pub_token}/comments")
        assert res.status_code == 200
        all_comments = res.json()
        assert len(all_comments) == 2

        # 4. Edit comment (by author)
        res = client.put(
            f"/api/v1/screenings/comments/{comment_id}",
            json={
                "viewer_id": viewer_id,
                "content": "Updated: The audio pacing and lighting feel slow."
            }
        )
        assert res.status_code == 200
        updated = res.json()
        assert updated["content"] == "Updated: The audio pacing and lighting feel slow."

        # 5. Unauthorized edit attempt by another viewer
        res = client.put(
            f"/api/v1/screenings/comments/{comment_id}",
            json={
                "viewer_id": "other_viewer_999",
                "content": "Malicious edit attempt"
            }
        )
        assert res.status_code == 403

        # 6. Admin delete
        res = client.delete(f"/api/v1/screenings/comments/{comment_id}?is_admin=true")
        assert res.status_code == 200
        assert res.json()["status"] == "success"

        # 7. Verify deletion (viewer 1 comment deleted, viewer 2 comment remains)
        res = client.get(f"/api/v1/screenings/{pub_token}/comments")
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["viewer_id"] == viewer_id_2
    finally:
        from app.database.clickhouse import delete_screening_events
        delete_screening_events(sid)
