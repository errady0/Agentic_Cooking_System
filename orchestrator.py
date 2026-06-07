"""
orchestrator.py

KitchenOrchestrator is the single public interface for the application layer.

It handles:
  - Loading/saving long-term memory (user preferences, history)
  - Building the initial state before the graph runs
  - Persisting results after the graph finishes
  - The WAIT_FOR_USER two-pass flow for non-Moroccan dish clarification
  - Providing a clean API for both the terminal app AND future web/REST backend

Non-Moroccan dish flow
──────────────────────
Pass 1 — user asks for pizza:
  graph returns KitchenResult with waiting=True and a clarification question
  in final_response. The app displays it and waits for the user's choice.

Pass 2 — user replies "classic" or "moroccan twist":
  orchestrator.answer_style_choice("classic") is called.
  It re-invokes the graph with user_style_choice set; the graph proceeds
  through supervisor_clarify (second pass) → full pipeline → final response.

Usage:
    orch = KitchenOrchestrator(user_id="ahmed")

    result = orch.run("I want to make a pizza")
    if result.waiting:
        print(result.final_response)          # clarification question
        user_answer = input("Your choice: ")
        result = orch.answer_style_choice(user_answer)

    print(result.final_response)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from langchain_core.messages import HumanMessage

from agents.state import KitchenState
from graph import get_graph
from memory import LongTermMemory


# ── Style-choice normaliser ───────────────────────────────────────────────────

def _parse_style_choice(user_text: str) -> str:
    """
    Map free-form user reply to 'classic' or 'moroccan_twist'.
    Handles English, French, Arabic, and Darija variations.
    """
    t = user_text.strip().lower()
    moroccan_keywords = {
        "moroccan", "maroc", "marocain", "twist", "moroccan twist",
        "moroccan style", "style marocain", "2", "deux", "two",
        "مغربي", "بالطريقة المغربية", "الطريقة المغربية",
    }
    classic_keywords = {
        "classic", "classique", "traditional", "traditionnel", "original",
        "1", "un", "one", "واحد", "الكلاسيكي", "تقليدي",
    }
    for kw in moroccan_keywords:
        if kw in t:
            return "moroccan_twist"
    for kw in classic_keywords:
        if kw in t:
            return "classic"
    # Default: if unclear, return None so the orchestrator can break out
    return None


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class KitchenResult:
    """Structured result returned by orchestrator.run() and answer_style_choice()."""
    final_response: str
    recipe: Optional[dict] = None
    recommended_recipes: list[dict] = field(default_factory=list)
    nutrition: Optional[dict] = None
    critic_score: Optional[int] = None
    session_summary: str = ""
    iteration_count: int = 0
    intent: str = "culinary"
    waiting: bool = False           # True when graph is paused for user input (WAIT_FOR_USER)
    style_choice: str = ""          # "classic" | "moroccan_twist" | "" — what was chosen


# ── Orchestrator ──────────────────────────────────────────────────────────────

class KitchenOrchestrator:
    """
    Manages a conversation session for a single user.
    Single entry point for both terminal and future FastAPI web backend.
    """

    def __init__(self, user_id: str = "default", thread_id: Optional[str] = None):
        self.user_id   = user_id
        self.thread_id = thread_id or str(uuid.uuid4())
        self.memory    = LongTermMemory(user_id)
        self.graph     = get_graph(use_checkpointing=True)

        # Held between pass-1 and pass-2 of the non-Moroccan clarify flow
        self._pending_state: Optional[KitchenState] = None

    # ── Public API ────────────────────────────────────────────────────────────

    def handle_message(self, user_input: str, max_iterations: int = 3) -> KitchenResult:
        """Entry point that correctly resumes from checkpointer if waiting."""
        config = {"configurable": {"thread_id": self.thread_id}}
        current_state = self.graph.get_state(config)
        
        # If the graph was paused waiting for a style choice:
        if current_state and current_state.values and current_state.values.get("next_agent") == "WAIT_FOR_USER":
            self._pending_state = current_state.values
            return self.answer_style_choice(user_input)
            
        return self.run(user_input, max_iterations)

    def run(self, user_input: str, max_iterations: int = 3) -> KitchenResult:
        """Run the full agent pipeline for a user message."""
        prefs   = self.memory.get_preferences()
        history = self.memory.get_history_summary(last_n=5)

        initial_state: KitchenState = {
            "messages"            : [HumanMessage(content=user_input)],
            "user_id"             : self.user_id,
            "user_input"          : user_input,
            "user_name"           : self.get_user_profile(),
            "user_preferences"    : prefs,
            "history_summary"     : history,
            # Intent — filled by supervisor_classify
            "intent"              : "",
            "classified"          : {},
            # Supervisor control
            "objective"           : "",
            "dish_hint"           : "",
            "dish_origin"         : "",
            "next_agent"          : "",
            "iteration"           : 0,
            "max_iterations"      : max_iterations,
            # Non-Moroccan dish clarification
            "user_style_choice"   : "",
            # Chitchat / session memory
            "conversation_context": {},
            # Agent outputs
            "recommended_recipes" : [],
            "current_recipe"      : None,
            "ingredient_prices"   : None,
            "nutrition_analysis"  : None,
            "critic_feedback"     : None,
            # Result
            "final_response"      : "",
            "session_summary"     : "",
            "done"                : False,
        }

        config      = {"configurable": {"thread_id": self.thread_id}}
        final_state = self.graph.invoke(initial_state, config=config)

        return self._build_result(final_state)

    def answer_style_choice(self, user_reply: str) -> KitchenResult:
        """
        Called after the graph returned waiting=True (non-Moroccan clarification).
        Re-invokes the graph with the user's style preference.

        user_reply: free-form text like "classic", "moroccan twist", "2", etc.
        """
        if self._pending_state is None:
            # No pending state — treat as a normal new message
            return self.run(user_reply)

        style = _parse_style_choice(user_reply)
        if style is None:
            # Not a style choice — break out of the clarification loop
            self._pending_state = None
            return self.run(user_reply)

        pending = self._pending_state

        # Build continuation state
        continuation: KitchenState = {
            **pending,
            "user_input"       : f"{pending.get('user_input', '')} (Style chosen: {user_reply})",
            "user_style_choice": style,
            "messages"         : [HumanMessage(content=user_reply)],
            "final_response"   : "",      # clear the clarification question
            "done"             : False,
        }

        config      = {"configurable": {"thread_id": self.thread_id}}
        final_state = self.graph.invoke(continuation, config=config)

        self._pending_state = None   # clear held state
        return self._build_result(final_state)

    # ── Preference helpers ────────────────────────────────────────────────────

    def update_preferences(
        self,
        liked: list[str] = None,
        disliked: list[str] = None,
        dietary: list[str] = None,
        flavor_notes: str = None,
    ):
        data = {}
        if liked                    : data["liked"]        = liked
        if disliked                 : data["disliked"]     = disliked
        if dietary                  : data["dietary"]      = dietary
        if flavor_notes is not None : data["flavor_notes"] = flavor_notes
        self.memory.update_preferences(data)

    def get_preferences(self) -> dict[str, Any]:
        return self.memory.get_preferences()

    def get_user_profile(self) -> dict[str, Any]:
        """Return stored profile info (username, etc.) for display purposes."""
        return self.memory.get_user_profile()

    def get_history(self) -> str:
        return self.memory.get_history_summary()

    def reset_preferences(self):
        self.memory.reset_all_preferences()

    def clear_history(self):
        self.memory.clear_history()

    def close(self):
        self.memory.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _build_result(self, final_state: KitchenState) -> KitchenResult:
        """Convert final graph state to KitchenResult. Handles WAIT_FOR_USER."""
        is_waiting = final_state.get("next_agent") == "WAIT_FOR_USER"

        if is_waiting:
            # Hold state so answer_style_choice() can continue
            self._pending_state = final_state

        elif final_state.get("intent") in ("culinary", "non_moroccan_culinary"):
            # Persist to long-term memory only for completed culinary sessions
            self._persist_culinary_session(final_state)

        return KitchenResult(
            final_response     = final_state.get("final_response", ""),
            recipe             = final_state.get("current_recipe"),
            recommended_recipes= final_state.get("recommended_recipes", []),
            nutrition          = final_state.get("nutrition_analysis"),
            critic_score       = (
                final_state.get("critic_feedback", {}).get("score")
                if final_state.get("critic_feedback") else None
            ),
            session_summary    = final_state.get("session_summary", ""),
            iteration_count    = final_state.get("iteration", 0),
            intent             = final_state.get("intent", "culinary"),
            waiting            = is_waiting,
            style_choice       = final_state.get("user_style_choice", ""),
        )

    def _persist_culinary_session(self, state: KitchenState):
        """Persist session summary to long-term memory."""
        summary = state.get("session_summary", "")
        if summary:
            self.memory.add_conversation_summary(summary)