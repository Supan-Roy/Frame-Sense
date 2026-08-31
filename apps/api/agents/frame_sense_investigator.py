import os
import httpx
from typing import Dict, Any, Optional
from functools import cached_property

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
  """Pins the Vertex AI client to the `global` location.

  gemini-3 series models are only served from `global`; the default ADK
  `Gemini` integration constructs a `google.genai.Client` whose location
  defaults to the AgentEngine instance's region (e.g. `us-central1`) and
  fails with model-not-found for these models. Subclassing per the override
  pattern documented on `google.adk.models.google_llm.Gemini` lets the agent
  keep running in its regional AgentEngine instance while routing the model
  request to the global endpoint.
  """

  @cached_property
  def api_client(self) -> Client:
    return Client(vertexai=True, location="global")


def get_clickhouse_cloud_access_token() -> Optional[str]:
    """
    Obtains a short-lived access token for ClickHouse Cloud MCP using service credentials / refresh token
    configured in environment variables, or returns direct CLICKHOUSE_CLOUD_ACCESS_TOKEN / CLICKHOUSE_MCP_TOKEN.
    """
    token = os.getenv("CLICKHOUSE_CLOUD_ACCESS_TOKEN") or os.getenv("CLICKHOUSE_MCP_TOKEN")
    if token:
        return token
        
    refresh_token = os.getenv("CLICKHOUSE_CLOUD_REFRESH_TOKEN")
    service_id = os.getenv("CLICKHOUSE_CLOUD_SERVICE_ID")
    
    if refresh_token and service_id:
        try:
            auth_url = os.getenv("CLICKHOUSE_CLOUD_AUTH_URL", "https://api.clickhouse.cloud/v1/auth/token")
            resp = httpx.post(
                auth_url,
                json={"refresh_token": refresh_token, "service_id": service_id},
                timeout=10.0
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("access_token") or data.get("token")
        except Exception as e:
            print(f"ClickHouse Cloud token refresh warning: {e}")

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


clickhouse_mcp_toolset = create_clickhouse_mcp_toolset()


frame_sense_investigator_google_search_agent = LlmAgent(
  name='Frame_Sense_Investigator_google_search_agent',
  model=GlobalGemini(model='gemini-3.5-flash'),
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
  model=GlobalGemini(model='gemini-3.5-flash'),
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
    "Your job is to investigate audience behavior anomalies detected by Frame Sense.\n\n"
    "When investigating an audience anomaly, use ClickHouse MCP to retrieve quantitative evidence from default.viewer_events.\n\n"
    "Inspect the available table schema before constructing analytical queries.\n\n"
    "Prefer bounded aggregate queries rather than retrieving large numbers of raw events.\n\n"
    "Treat quantitative audience telemetry as evidence, not as a definitive psychological diagnosis.\n\n"
    "When given an anomaly, determine what happened, gather relevant evidence, identify plausible explanations, and clearly distinguish observed facts from hypotheses.\n\n"
    "Clearly distinguish:\n"
    "- observed telemetry\n"
    "- quantitative evidence\n"
    "- plausible explanations\n"
    "- confidence\n"
    "- evidence needed for validation.\n\n"
    "Never claim that viewer behavior proves a specific emotional or psychological state.\n\n"
    "Return structured findings with:\n\n"
    "1. Observed audience behavior\n"
    "2. Quantitative evidence\n"
    "3. Plausible explanations\n"
    "4. Confidence\n"
    "5. Evidence that would help validate the explanation\n\n"
    "You are an investigative agent, not a generic chatbot."
)

root_agent = LlmAgent(
  name='Frame_Sense_Investigator',
  model=GlobalGemini(model='gemini-3.5-flash'),
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

