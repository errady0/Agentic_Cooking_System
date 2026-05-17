"""
config/settings.py
Central configuration. All env vars are read here.
The rest of the app imports from this module — never from os.environ directly.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (works from any working directory)
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=False)

# ── LLM ─────────────────────────────────────────────────────────────
# ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", ""), MODEL = "claude-sonnet-4-20250514"
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
LLM_MODEL: str = "openai/gpt-oss-120b"            
LLM_TEMPERATURE: float = 0.3

# ── API-Tool ────────────────────────────────────────────────────────────
TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

# ── Database ─────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
USE_SQLITE_FALLBACK: bool = os.getenv("USE_SQLITE_FALLBACK", "true").lower() == "true"
SQLITE_PATH: str = str(_ROOT / "moroccan_kitchen.db")

# ── App ──────────────────────────────────────────────────────────────
DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

def validate() -> list[str]:
    """Return a list of missing required keys (warnings, not hard errors)."""
    warnings = []
    models = ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"]
    if not models[1]:
        warnings.append(f"{models[1]} is not set")
    if not TAVILY_API_KEY:
        warnings.append("TAVILY_API_KEY not set — web search will be disabled")
    return warnings