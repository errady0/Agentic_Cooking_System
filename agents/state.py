"""
agents/state.py

The single shared state TypedDict that flows through the LangGraph.
Every agent reads from and writes to this state.

Designed to be serialisable so LangGraph checkpointing works out-of-the-box.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class KitchenState(TypedDict):
    # ── Conversation (short-term) ───────────────────────────────────
    # LangGraph manages this list via the add_messages reducer:
    # new messages are appended, never replaced.
    messages: Annotated[list[BaseMessage], add_messages]

    # ── User context ────────────────────────────────────────────────
    user_id: str
    user_input: str                          # raw latest message from user

    # ── Long-term memory snapshot (injected at session start) ────────
    user_preferences: dict[str, Any]         # liked, disliked, dietary, flavor_notes
    history_summary: str                     # last N session summaries

    # ── Supervisor control ──────────────────────────────────────────
    objective: str                           # parsed goal from supervisor
    next_agent: str                          # which agent runs next
    iteration: int                           # loop counter (prevent infinite loops)
    max_iterations: int                      # hard limit

    # ── Agent outputs (filled as agents run) ────────────────────────
    recommended_recipes: list[dict]          # from recommendation agent
    current_recipe: Optional[dict]           # from chef agent
    nutrition_analysis: Optional[dict]       # from nutrition agent
    critic_feedback: Optional[dict]          # from critic agent

    # ── Final result ─────────────────────────────────────────────────
    final_response: str                      # ready to display to user
    session_summary: str                     # written at end for long-term memory
    done: bool                               # graph exit flag
