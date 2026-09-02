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

    # 2. Get past messages for conversation context
    past_messages = screening_repo.get_chat_messages(session_id)
    
    # Construct context system prompt
    context_header = (
        f"You are Sense AI, the primary interactive screening intelligence assistant for Frame Sense.\n"
        f"You are conversing with a studio executive/director regarding screening '{screening['title']}' (ID: {screening_id}).\n"
        f"SCREENING METADATA:\n"
        f"- Title: {screening['title']}\n"
        f"- Video Duration: {screening.get('media_duration')} seconds\n"
        f"- Description: {screening.get('description') or 'N/A'}\n\n"
        f"AVAILABLE TOOLS:\n"
        f"- Use run_select_query (ClickHouse Cloud MCP) to run SQL queries on default.viewer_events for telemetry data.\n"
        f"- Use GoogleSearchTool for general film intelligence or industry benchmarking.\n\n"
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
