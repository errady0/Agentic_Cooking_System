"""
agents/state.py

The single shared state TypedDict that flows through the LangGraph.
Every agent reads from and writes to this state.

Designed to be serialisable so LangGraph checkpointing works out-of-the-box.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional
from typing_extensions import TypedDict
# pyrefly: ignore [missing-import]
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class KitchenState(TypedDict):
    # ── Conversation (short-term) ───────────────────────────────────
    # LangGraph manages this list via the add_messages reducer:
    # new messages are appended, never replaced.
    messages: Annotated[list[BaseMessage], add_messages]

    # ── User context ────────────────────────────────────────────────
    user_id: str
    user_name: str
    user_input: str                          # raw latest message from user

    # ── Long-term memory snapshot (injected at session start) ────────
    user_preferences: dict[str, Any]         # liked, disliked, dietary, flavor_notes
    history_summary: str                     # last N session summaries

    # ── Intent classification (set first, drives all routing) ────────
    intent: str                              # culinary | culinary_info | out_of_scope | non_moroccan_culinary | chitchat
    classified: dict                         # carry need_recommendation, need_recipe etc forward

    # ── Supervisor control ──────────────────────────────────────────
    objective: str                           # parsed goal from supervisor
    next_agent: str                          # which agent runs next
    iteration: int                           # loop counter (prevent infinite loops)
    max_iterations: int                      # hard limit

    # ── Non-Moroccan dish handling ───────────────────────────────────
    dish_origin: str                         # detected cuisine origin (e.g. "Italian")
    dish_hint: str                           # dish name extracted from user input
    user_style_choice: str                   # "classic" | "moroccan_twist" | "" (set after clarify)

    # ── Chitchat / session context ───────────────────────────────────
    conversation_context: dict               # facts learned during chitchat (name, preferences mentioned, etc.)

    # ── Agent outputs (filled as agents run) ────────────────────────
    recommended_recipes: list[dict]          # from recommendation agent
    current_recipe: Optional[dict]           # from chef agent
    nutrition_analysis: Optional[dict]       # from nutrition agent
    critic_feedback: Optional[dict]          # from critic agent

    # ── Final result ─────────────────────────────────────────────────
    final_response: str                      # ready to display to user
    session_summary: str                     # written at end for long-term memory
    done: bool                               # graph exit flag