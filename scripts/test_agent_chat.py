import asyncio
import os
import sys
from dotenv import load_dotenv

# Add apps/api to path
API_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "apps", "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

load_dotenv(os.path.join(API_DIR, ".env"))

from agent.frame_sense_investigator import root_agent
from google.adk.runners import InMemoryRunner
from google.genai import types


async def run_agent_test():
    print("=" * 60)
    print("FRAME SENSE INVESTIGATOR — GEMINI 3.5 FLASH TALK TEST")
    print("=" * 60)

    runner = InMemoryRunner(agent=root_agent)
    session = await runner.session_service.create_session(user_id="dev_user", app_name=runner.app_name)
    print(f"Created ADK Session ID: {session.id}\n")

    user_prompt = "Hello Frame Sense Investigator! State your primary identity and list the ClickHouse MCP tools available to you for investigating screening anomalies."
    print(f"USER: {user_prompt}\n")

    msg = types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])

    print("AGENT RESPONDING...")
    print("-" * 60)

    async for event in runner.run_async(user_id="dev_user", session_id=session.id, new_message=msg):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    print(part.text, end="", flush=True)

    print("\n" + "-" * 60)
    print("COMMUNICATION TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_agent_test())
