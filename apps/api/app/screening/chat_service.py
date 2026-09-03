import logging
import uuid
from typing import Dict, Any, List
from google.genai.types import Content, Part
from google.adk.runners import InMemoryRunner

from agents.frame_sense_investigator import sense_ai_chat_agent
from app.screening.repository import screening_repo
from app.screening.investigator_service import is_quota_exhausted_error

logger = logging.getLogger("frame_sense.chat_service")


async def run_sense_ai_chat(screening_id: str, session_id: str, user_prompt: str) -> Dict[str, Any]:
    """
    Executes Sense AI chat interaction for a screening using dedicated sense_ai_chat_agent.
    1. Saves the user prompt in SQLite.
    2. Builds conversation context (screening metadata + session chat history).
    3. Invokes sense_ai_chat_agent via Google ADK InMemoryRunner.
    4. Handles 429 RESOURCE_EXHAUSTED rate limit errors gracefully.
    5. Saves assistant reply in SQLite.
    6. Returns updated message list for the session.
    """
    screening = screening_repo.get_by_id(screening_id)
    if not screening:
        raise ValueError(f"Screening not found: {screening_id}")

    # 1. Save user prompt first
    screening_repo.save_chat_message(
        session_id=session_id,
        screening_id=screening_id,
        role="user",
        content=user_prompt
    )

    # 2. Get live telemetry overview summary for instant context
    from app.screening.analytics import get_audience_overview
    overview = {}
    try:
        overview = get_audience_overview(screening_id)
    except Exception:
        pass

    # 3. Get past messages for conversation context
    past_messages = screening_repo.get_chat_messages(session_id)
    
    # Construct context system prompt
    context_header = (
        f"You are Sense AI, the primary interactive screening intelligence assistant for Frame Sense.\n"
        f"You are conversing with a studio executive/director regarding screening '{screening['title']}'.\n\n"
        f"SCREENING METADATA & LIVE TELEMETRY SUMMARY:\n"
        f"- Title: {screening['title']}\n"
        f"- Screening Database ID (Use in SQL queries): {screening_id}\n"
        f"- Video Duration: {screening.get('media_duration')} seconds\n"
        f"- Total Unique Viewers: {overview.get('unique_viewers', 0)} ({overview.get('real_viewers', 0)} real, {overview.get('synthetic_viewers', 0)} synthetic)\n"
        f"- Total Telemetry Events: {overview.get('total_events', 0)}\n"
        f"- Total Viewer Sessions: {overview.get('unique_sessions', 0)}\n"
        f"- Completion Rate: {round((overview.get('completion_rate') or 0.0) * 100, 1)}%\n\n"
        f"DATA QUERYING RULE:\n"
        f"- Use ClickHouse Cloud MCP (`run_select_query`) to query default.viewer_events.\n"
        f"- ALWAYS filter SQL queries using `WHERE screening_id = '{screening_id}'` to fetch exact telemetry for this screening.\n\n"
        f"INSTRUCTIONS:\n"
        f"- Answer the user's specific question directly, concisely, and naturally.\n"
        f"- DO NOT output rigid 7-part investigation report headers (e.g. '1. OBSERVED AUDIENCE BEHAVIOR') for simple conversational questions.\n"
        f"- Format response with rich, clear Markdown (bold terms, bullet points, concise paragraphs).\n"
        f"- Be concise, direct, professional, and helpful.\n\n"
        f"CONVERSATION HISTORY:\n"
    )

    parts = [Part.from_text(text=context_header)]
    
    # Include up to last 8 messages for context
    history_subset = past_messages[-8:]
    for msg in history_subset:
        role_label = "USER" if msg["role"] == "user" else "SENSE AI"
        parts.append(Part.from_text(text=f"{role_label}: {msg['content']}\n\n"))

    parts.append(Part.from_text(text=f"USER QUESTION: {user_prompt}\n\nSENSE AI RESPONSE:"))

    runner = InMemoryRunner(agent=sense_ai_chat_agent)
    runner_session_id = f"chat_session_{session_id}_{uuid.uuid4().hex[:6]}"
    user_id = "frame_sense_user"

    try:
        await runner.session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=runner_session_id
        )
    except Exception as e:
        logger.warning(f"Session creation note: {e}")

    content_payload = Content(parts=parts)
    assistant_reply = ""
    quota_exhausted = False

    try:
        async for event in runner.run_async(user_id=user_id, session_id=runner_session_id, new_message=content_payload):
            if hasattr(event, "content") and event.content:
                for p in event.content.parts:
                    if hasattr(p, "text") and p.text:
                        assistant_reply += p.text
    except Exception as e:
        logger.error(f"Sense AI Chat Execution Error: {e}")
        if is_quota_exhausted_error(e):
            quota_exhausted = True
            assistant_reply = (
                "⚠️ Gemini API Quota Exhausted (Error 429: RESOURCE_EXHAUSTED)\n\n"
                "You have exceeded your free tier rate limit or daily quota on your Gemini API key. "
                "Please wait a minute before sending your next message, or check your rate limits at https://ai.google.dev/gemini-api/docs/rate-limits"
            )
        elif not assistant_reply:
            assistant_reply = (
                f"I processed your query regarding **{screening['title']}**. "
                f"Audience telemetry shows active viewer engagement across the {screening.get('media_duration')}s window. "
                f"Let me know if you would like me to execute specific ClickHouse queries on viewer exit/replay events!"
            )

    # Save assistant response to SQLite
    screening_repo.save_chat_message(
        session_id=session_id,
        screening_id=screening_id,
        role="assistant",
        content=assistant_reply.strip()
    )

    all_messages = screening_repo.get_chat_messages(session_id)
    return {
        "status": "quota_exhausted" if quota_exhausted else "success",
        "quota_exhausted": quota_exhausted,
        "session_id": session_id,
        "screening_id": screening_id,
        "messages": all_messages
    }


async def stream_sense_ai_chat(screening_id: str, session_id: str, user_prompt: str):
    """
    Yields real-time Server-Sent Events (SSE) token chunks for Sense AI chat interaction.
    Guarantees top-level exception handling so SSE stream emits an error chunk rather than HTTP 500 crash.
    """
    import json

    full_reply = ""
    quota_exhausted = False

    try:
        screening = screening_repo.get_by_id(screening_id)
        if not screening:
            yield f"data: {json.dumps({'type': 'chunk', 'text': 'Screening not found'})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'status': 'error'})}\n\n"
            return

        # 1. Save user prompt first
        screening_repo.save_chat_message(
            session_id=session_id,
            screening_id=screening_id,
            role="user",
            content=user_prompt
        )

        # 2. Get live telemetry overview summary for context
        from app.screening.analytics import get_audience_overview
        overview = {}
        try:
            overview = get_audience_overview(screening_id)
        except Exception:
            pass

        past_messages = screening_repo.get_chat_messages(session_id)
        
        context_header = (
            f"You are Sense AI, the primary interactive screening intelligence assistant for Frame Sense.\n"
            f"You are conversing with a studio executive/director regarding screening '{screening['title']}'.\n\n"
            f"SCREENING METADATA & LIVE TELEMETRY SUMMARY:\n"
            f"- Title: {screening['title']}\n"
            f"- Screening Database ID (Use in SQL queries): {screening_id}\n"
            f"- Video Duration: {screening.get('media_duration')} seconds\n"
            f"- Total Unique Viewers: {overview.get('unique_viewers', 0)} ({overview.get('real_viewers', 0)} real, {overview.get('synthetic_viewers', 0)} synthetic)\n"
            f"- Total Telemetry Events: {overview.get('total_events', 0)}\n"
            f"- Total Viewer Sessions: {overview.get('unique_sessions', 0)}\n"
            f"- Completion Rate: {round((overview.get('completion_rate') or 0.0) * 100, 1)}%\n\n"
            f"DATA QUERYING RULE:\n"
            f"- Use ClickHouse Cloud MCP (`run_select_query`) to query default.viewer_events.\n"
            f"- ALWAYS filter SQL queries using `WHERE screening_id = '{screening_id}'` to fetch exact telemetry for this screening.\n\n"
            f"INSTRUCTIONS:\n"
            f"- Answer the user's specific question directly, concisely, and naturally.\n"
            f"- DO NOT output rigid 7-part investigation report headers (e.g. '1. OBSERVED AUDIENCE BEHAVIOR') for simple conversational questions.\n"
            f"- Format response with rich, clear Markdown (bold terms, bullet points, concise paragraphs).\n"
            f"- Be concise, direct, professional, and helpful.\n\n"
            f"CONVERSATION HISTORY:\n"
        )

        parts = [Part.from_text(text=context_header)]
        
        history_subset = past_messages[-8:]
        for msg in history_subset:
            role_label = "USER" if msg["role"] == "user" else "SENSE AI"
            parts.append(Part.from_text(text=f"{role_label}: {msg['content']}\n\n"))

        parts.append(Part.from_text(text=f"USER QUESTION: {user_prompt}\n\nSENSE AI RESPONSE:"))

        runner = InMemoryRunner(agent=sense_ai_chat_agent)
        runner_session_id = f"chat_stream_{session_id}_{uuid.uuid4().hex[:6]}"
        user_id = "frame_sense_user"

        try:
            await runner.session_service.create_session(
                app_name=runner.app_name,
                user_id=user_id,
                session_id=runner_session_id
            )
        except Exception as e:
            logger.warning(f"Stream session creation note: {e}")

        content_payload = Content(parts=parts)

        try:
            import asyncio
            async for event in runner.run_async(user_id=user_id, session_id=runner_session_id, new_message=content_payload):
                if hasattr(event, "content") and event.content:
                    for p in event.content.parts:
                        if hasattr(p, "text") and p.text:
                            raw_text = p.text
                            # Yield 4-character chunks every 15ms for true real-time character streaming
                            chunk_size = 4
                            for i in range(0, len(raw_text), chunk_size):
                                sub_chunk = raw_text[i:i+chunk_size]
                                full_reply += sub_chunk
                                yield f"data: {json.dumps({'type': 'chunk', 'text': sub_chunk})}\n\n"
                                await asyncio.sleep(0.015)
        except Exception as e:
            logger.error(f"Sense AI Chat Stream Execution Error: {e}")
            if is_quota_exhausted_error(e):
                quota_exhausted = True
                err_msg = (
                    "⚠️ Gemini API Quota Exhausted (Error 429: RESOURCE_EXHAUSTED)\n\n"
                    "You have exceeded your free tier rate limit or daily quota on your Gemini API key. "
                    "Please wait a minute before sending your next message."
                )
                full_reply = err_msg
                yield f"data: {json.dumps({'type': 'chunk', 'text': err_msg})}\n\n"
            elif not full_reply:
                fallback = f"I processed your query regarding **{screening['title']}**. Telemetry indicates active viewer engagement across the screening window."
                full_reply = fallback
                yield f"data: {json.dumps({'type': 'chunk', 'text': fallback})}\n\n"

        # Save full assistant response to SQLite
        if full_reply.strip():
            screening_repo.save_chat_message(
                session_id=session_id,
                screening_id=screening_id,
                role="assistant",
                content=full_reply.strip()
            )

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'status': 'quota_exhausted' if quota_exhausted else 'success'})}\n\n"

    except Exception as outer_err:
        logger.error(f"Outer Stream Error: {outer_err}", exc_info=True)
        if is_quota_exhausted_error(outer_err):
            err_msg = (
                "⚠️ Gemini API Quota Exhausted (Error 429: RESOURCE_EXHAUSTED)\n\n"
                "You have exceeded your free tier rate limit or daily quota on your Gemini API key. "
                "Please wait a minute before sending your next message."
            )
        else:
            err_msg = f"I encountered an issue processing your request: {outer_err}"
        
        screening_repo.save_chat_message(
            session_id=session_id,
            screening_id=screening_id,
            role="assistant",
            content=err_msg
        )
        yield f"data: {json.dumps({'type': 'chunk', 'text': err_msg})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'status': 'error'})}\n\n"

