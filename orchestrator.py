"""
orchestrator.py

KitchenOrchestrator is the single public interface for the application layer.

It handles:
  - Loading/saving long-term memory (user preferences, history)
  - Building the initial state before the graph runs
  - Persisting results after the graph finishes
  - Providing a clean API for both the terminal app AND future web/REST backend

Usage:
    orchestrator = KitchenOrchestrator(user_id="alice")
    result = orchestrator.run("I want to make a Moroccan lamb tagine for 6 people")
    print(result.final_response)
    print(result.recipe)
    print(result.nutrition)

For the web app, the orchestrator will be instantiated per request/session
and the same .run() method will be called from a FastAPI route.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from langchain_core.messages import HumanMessage

from agents.state import KitchenState
from graph import get_graph
from memory import LongTermMemory


@dataclass
class KitchenResult:
    """Structured result returned by orchestrator.run()."""
    final_response: str
    recipe: Optional[dict] = None
    recommended_recipes: list[dict] = field(default_factory=list)
    nutrition: Optional[dict] = None
    critic_score: Optional[int] = None
    session_summary: str = ""
    iteration_count: int = 0


class KitchenOrchestrator:
    """
    Manages a conversation session for a single user.

    The same instance can be reused for multiple turns within a session
    (multi-turn is handled by LangGraph checkpoints via thread_id).

    For the web app:
      - Create one orchestrator per authenticated user session.
      - Pass `thread_id` from the frontend (e.g. chat session UUID).
      - The orchestrator's long-term memory is keyed by user_id from the DB.
    """

    def __init__(self, user_id: str = "default", thread_id: Optional[str] = None):
        self.user_id = user_id
        self.thread_id = thread_id or str(uuid.uuid4())
        self.memory = LongTermMemory(user_id)
        self.graph = get_graph(use_checkpointing=True)

    def run(self, user_input: str, max_iterations: int = 3) -> KitchenResult:
        """
        Run the full agent pipeline for a user message.
        Returns a KitchenResult with all outputs.
        """
        # Load long-term memory into state
        prefs = self.memory.get_preferences()
        history = self.memory.get_history_summary(last_n=5)

        initial_state: KitchenState = {
            "messages": [HumanMessage(content=user_input)],
            "user_id": self.user_id,
            "user_input": user_input,
            "user_preferences": prefs,
            "history_summary": history,
            "objective": "",
            "next_agent": "recommendation",
            "iteration": 0,
            "max_iterations": max_iterations,
            "recommended_recipes": [],
            "current_recipe": None,
            "ingredient_prices": None,
            "nutrition_analysis": None,
            "critic_feedback": None,
            "final_response": "",
            "session_summary": "",
            "done": False,
        }

        # LangGraph config — thread_id enables checkpointing (short-term memory)
        config = {"configurable": {"thread_id": self.thread_id}}

        # Run the graph
        final_state = self.graph.invoke(initial_state, config=config)

        # Persist to long-term memory
        self._update_long_term_memory(final_state)

        return KitchenResult(
            final_response=final_state.get("final_response", ""),
            recipe=final_state.get("current_recipe"),
            recommended_recipes=final_state.get("recommended_recipes", []),
            nutrition=final_state.get("nutrition_analysis"),
            critic_score=final_state.get("critic_feedback", {}).get("score") if final_state.get("critic_feedback") else None,
            session_summary=final_state.get("session_summary", ""),
            iteration_count=final_state.get("iteration", 0),
        )

    def update_preferences(self, liked: list[str] = None, disliked: list[str] = None,
                           dietary: list[str] = None, flavor_notes: str = None):
        """Allow the terminal UI or web app to update preferences explicitly."""
        data = {}
        if liked:
            data["liked"] = liked
        if disliked:
            data["disliked"] = disliked
        if dietary:
            data["dietary"] = dietary
        if flavor_notes is not None:
            data["flavor_notes"] = flavor_notes
        self.memory.update_preferences(data)

    def get_preferences(self) -> dict[str, Any]:
        time.sleep(1)
        return self.memory.get_preferences()

    def get_history(self) -> str:
        time.sleep(1)
        return self.memory.get_history_summary()

    def reset_preferences(self):
        time.sleep(1)
        self.memory.reset_all_preferences()

    def clear_history(self):
        time.sleep(1)
        self.memory.clear_history()

    def _update_long_term_memory(self, state: KitchenState):
        """Extract preference signals from the session and persist."""
        # Save session summary
        summary = state.get("session_summary", "")
        if summary:
            self.memory.add_conversation_summary(summary)

    def close(self):
        self.memory.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
