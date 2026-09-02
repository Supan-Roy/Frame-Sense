import os
import httpx
from typing import Dict, Any, Optional
from functools import cached_property
from dotenv import load_dotenv

# Load environment variables from apps/api/.env or current working directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
load_dotenv()

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
from google.adk.tools.mcp_tool import (
    McpToolset,
    StreamableHTTPConnectionParams,
    SseConnectionParams,
)


class GlobalGemini(Gemini):
  """Pins the Vertex AI client to the `global` location or GEMINI_API_KEY."""

  @cached_property
  def api_client(self) -> Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        return Client(api_key=api_key)
    return Client(vertexai=True, location="global")


def get_clickhouse_cloud_access_token() -> Optional[str]:
    """
    Obtains the authentication header token for ClickHouse Cloud MCP.
    - Returns CLICKHOUSE_CLOUD_ACCESS_TOKEN / CLICKHOUSE_MCP_TOKEN if set.
    - Formats Basic auth (base64 encoded service_id:refresh_token) for hosted ClickHouse Cloud MCP.
    - Formats Basic auth (base64 encoded user:password) as direct DB fallback.
    """
    token = os.getenv("CLICKHOUSE_CLOUD_ACCESS_TOKEN") or os.getenv("CLICKHOUSE_MCP_TOKEN")
    if token:
        if token.startswith("Bearer ") or token.startswith("Basic "):
            return token
        return f"Bearer {token}"
        
    refresh_token = os.getenv("CLICKHOUSE_CLOUD_REFRESH_TOKEN")
    service_id = os.getenv("CLICKHOUSE_CLOUD_SERVICE_ID")
    
    if refresh_token and service_id:
        import base64
        creds = base64.b64encode(f"{service_id}:{refresh_token}".encode()).decode()
        return f"Basic {creds}"

    user = os.getenv("CLICKHOUSE_USER", "default")
    password = os.getenv("CLICKHOUSE_PASSWORD", "")
    if password:
        import base64
        creds = base64.b64encode(f"{user}:{password}".encode()).decode()
        return f"Basic {creds}"

    return None


def create_clickhouse_mcp_toolset() -> McpToolset:
    """
    Constructs the official ClickHouse MCP toolset using ADK's McpToolset & StreamableHTTPConnectionParams.
    Defaults to hosted ClickHouse Cloud MCP (https://mcp.clickhouse.cloud/mcp) with automatic fallback
    to local Docker ClickHouse MCP (http://localhost:8000/sse) when no cloud credentials are configured.
    Exposes analytical read-only tools: list_databases, list_tables, run_select_query.
    """
    endpoint = os.getenv("CLICKHOUSE_MCP_ENDPOINT", "https://mcp.clickhouse.cloud/mcp")
    read_only_tools = ["list_databases", "list_tables", "run_select_query", "run_query"]
    token = get_clickhouse_cloud_access_token()

    # Automatic fallback to local Docker MCP when no cloud credentials are in .env
    if endpoint == "https://mcp.clickhouse.cloud/mcp" and not token:
        endpoint = os.getenv("LOCAL_CLICKHOUSE_MCP_ENDPOINT", "http://localhost:8000/sse")

    def header_provider(context: Any) -> Dict[str, str]:
        headers = {}
        curr_token = get_clickhouse_cloud_access_token()
        if curr_token:
            if curr_token.startswith("Bearer ") or curr_token.startswith("Basic "):
                headers["Authorization"] = curr_token
            else:
                headers["Authorization"] = f"Bearer {curr_token}"
        return headers

    if "sse" in endpoint.lower() or "localhost" in endpoint or "127.0.0.1" in endpoint:
        connection_params = SseConnectionParams(url=endpoint)
    else:
        headers = {}
        if token:
            headers["Authorization"] = token if token.startswith(("Bearer ", "Basic ")) else f"Bearer {token}"

        connection_params = StreamableHTTPConnectionParams(
            url=endpoint,
            headers=headers if headers else None,
            timeout=10.0,
            sse_read_timeout=300.0,
        )

    return McpToolset(
        connection_params=connection_params,
        tool_filter=read_only_tools,
        header_provider=header_provider,
    )


DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

clickhouse_mcp_toolset = create_clickhouse_mcp_toolset()

frame_sense_investigator_google_search_agent = LlmAgent(
  name='Frame_Sense_Investigator_google_search_agent',
  model=GlobalGemini(model=DEFAULT_MODEL),
  description=(
      'Agent specialized in performing Google searches.'
  ),
  sub_agents=[],
  instruction='Use the GoogleSearchTool to find information on the web.',
  tools=[
    GoogleSearchTool()
  ],
)
frame_sense_investigator_url_context_agent = LlmAgent(
  name='Frame_Sense_Investigator_url_context_agent',
  model=GlobalGemini(model=DEFAULT_MODEL),
  description=(
      'Agent specialized in fetching content from URLs.'
  ),
  sub_agents=[],
  instruction='Use the UrlContextTool to retrieve content from provided URLs.',
  tools=[
    url_context
  ],
)

INVESTIGATOR_INSTRUCTION = (
    "You are the Frame Sense Investigator, an autonomous post-production intelligence agent for film and television screenings.\n\n"
    "Your job is to investigate audience behavior anomalies detected by Frame Sense by correlating quantitative telemetry evidence with visual video frame evidence.\n\n"
    "CRITICAL PRESENTATION RULES (STUDIO EXECUTIVE FORMATTING):\n"
    "- NEVER output internal developer system IDs (e.g. sc_..., med_..., anm_...). Refer to the film by its title.\n"
    "- NEVER output raw code variable syntax (e.g. exit_rate = 1.0, pause_rate = 1.0, rewind_rate = 0.0).\n"
    "- Express all rates and metrics in clear percentage terms (e.g. '100% Exit Drop Rate', '100% Pause Rate', '0% Rewind Rate').\n"
    "- Write concise, polished executive summaries suitable for film directors and studio producers.\n\n"
    "When investigating an audience anomaly:\n"
    "1. Use ClickHouse MCP to retrieve quantitative evidence from default.viewer_events.\n"
    "2. Inspect the available table schema before constructing analytical queries.\n"
    "3. Prefer bounded aggregate queries rather than retrieving large numbers of raw events.\n"
    "4. Inspect attached visual video frames extracted around the anomaly timecode window.\n"
    "5. Treat quantitative telemetry as evidence of WHERE audience behavior occurred, and visual frames as evidence of WHAT was occurring on screen.\n"
    "6. Never claim that visual content proved or caused the audience behavior. Identify plausible correlations and clearly distinguish observed facts from hypotheses.\n\n"
    "Return your investigation structured strictly with these sections:\n\n"
    "### 1. OBSERVED AUDIENCE BEHAVIOR\n"
    "### 2. QUANTITATIVE EVIDENCE\n"
    "### 3. VISUAL EVIDENCE\n"
    "### 4. TELEMETRY ↔ VISUAL CORRELATION\n"
    "### 5. PLAUSIBLE EXPLANATIONS\n"
    "### 6. CONFIDENCE\n"
    "### 7. VALIDATION EVIDENCE\n"
)

root_agent = LlmAgent(
  name='Frame_Sense_Investigator',
  model=GlobalGemini(model=DEFAULT_MODEL),
  description=(
      'Investigates audience behavior anomalies detected during film screenings by correlating viewer telemetry with media and narrative evidence.'
  ),
  sub_agents=[],
  instruction=INVESTIGATOR_INSTRUCTION,
  tools=[
    clickhouse_mcp_toolset,
    agent_tool.AgentTool(agent=frame_sense_investigator_google_search_agent),
    agent_tool.AgentTool(agent=frame_sense_investigator_url_context_agent)
  ],
)

SENSE_AI_CHAT_INSTRUCTION = (
    "You are Sense AI, an intelligent, conversational film analytics assistant for Frame Sense.\n"
    "You assist film studio executives, directors, and editors by answering questions about screening telemetry, audience retention, and viewer engagement.\n\n"
    "CRITICAL TOOL CALLING & DATA RETRIEVAL RULES:\n"
    "1. When answering telemetry or viewer questions, ALWAYS execute SQL queries via ClickHouse MCP (`run_select_query`).\n"
    "2. In your SQL queries, ALWAYS filter using the exact screening_id provided in the context (e.g. `WHERE screening_id = 'sc_...'`). Do NOT change or omit the screening_id in SQL tool calls!\n"
    "3. Example telemetry queries:\n"
    "   - Total Viewers & Events: `SELECT count(DISTINCT anonymous_viewer_id) as viewers, count() as total_events FROM default.viewer_events WHERE screening_id = 'sc_...'`\n"
    "   - Peak Timecodes: `SELECT toUInt32(video_timecode_sec) as second, count() as active_events FROM default.viewer_events WHERE screening_id = 'sc_...' GROUP BY second ORDER BY active_events DESC LIMIT 5`\n"
    "   - Completions: `SELECT count(DISTINCT session_id) FROM default.viewer_events WHERE screening_id = 'sc_...' AND event_type = 'COMPLETE'`\n"
    "4. In your FINAL text response back to the user, present the numbers clearly in natural English without displaying raw developer IDs like sc_... or med_....\n\n"
    "RESPONSE STYLE & BEHAVIOR:\n"
    "- Answer the user's specific question directly, naturally, and concisely.\n"
    "- DO NOT use rigid 7-part investigation structures (such as '1. OBSERVED AUDIENCE BEHAVIOR') for general chat questions.\n"
    "- Format text using clean markdown (**bold** key numbers and titles, simple lists, concise paragraphs).\n"
    "- Be professional, engaging, direct, and helpful."
)

sense_ai_chat_agent = LlmAgent(
  name='Sense_AI_Chat_Assistant',
  model=GlobalGemini(model=DEFAULT_MODEL),
  description='Conversational studio intelligence assistant for answering user queries about screening telemetry and film metrics.',
  sub_agents=[],
  instruction=SENSE_AI_CHAT_INSTRUCTION,
  tools=[
    clickhouse_mcp_toolset,
    agent_tool.AgentTool(agent=frame_sense_investigator_google_search_agent),
    agent_tool.AgentTool(agent=frame_sense_investigator_url_context_agent)
  ],
)

