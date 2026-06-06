"""
graph.py

Node layout:
  supervisor_classify
       ↓ (conditional)
  ┌────────────────────────────────────────────────┐
  │  culinary_info / chitchat / out_of_scope → END │
  └────────────────────────────────────────────────┘
       ↓  culinary | non_moroccan_culinary
  supervisor_entry
       ↓ (conditional)
  ┌─────────────────────────────────────────────────────┐
  │  non_moroccan_culinary → supervisor_clarify          │
  │    ├─ first pass  → WAIT_FOR_USER (surfaces to app) │
  │    └─ second pass → recommendation | chef           │
  │  culinary → recommendation | chef | nutrition       │
  └─────────────────────────────────────────────────────┘
       ↓
  recommendation  (optional)
       ↓
     chef         ←── (revision loop from supervisor_review)
       ↓
   nutrition
       ↓
    critic
       ↓
  supervisor_review ──→ chef (revision) | END


WAIT_FOR_USER contract
──────────────────────
When supervisor_clarify sets next_agent = "WAIT_FOR_USER" the graph returns
final_response to the application layer (orchestrator). The orchestrator
surfaces the clarification question to the user, receives the answer, then
re-invokes the graph with:
  - user_input       = the user's choice message (e.g. "classic" / "moroccan twist")
  - user_style_choice = "classic" | "moroccan_twist"   (set by orchestrator)
The graph re-enters at supervisor_classify → supervisor_entry → supervisor_clarify
(second pass), which then routes into the pipeline.
"""

from __future__ import annotations

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agents.state import KitchenState
from agents.supervisor import (
    supervisor_classify,
    supervisor_entry,
    supervisor_clarify,
    supervisor_review,
)
from agents.recommendation import recommendation_agent
from agents.chef import chef_agent
from agents.nutrition import nutrition_agent
from agents.critic import critic_agent


# ── Routing functions ─────────────────────────────────────────────────────────

def route_after_classify(state: KitchenState) -> str:
    """
    After classification:
    - culinary / non_moroccan_culinary → supervisor_entry (needs pipeline routing)
    - culinary_info / chitchat / out_of_scope → supervisor_entry (handles inline, then END)

    We always pass through supervisor_entry so it can build the response and
    set done=True / next_agent=END for the non-pipeline intents.
    """
    return "supervisor_entry"


def route_after_entry(state: KitchenState) -> str:
    """Route from supervisor_entry to the right first pipeline node or END."""
    # Non-Moroccan dish needs clarification before pipeline
    if state.get("intent") == "non_moroccan_culinary" and not state.get("done"):
        return "supervisor_clarify"

    next_agent = state.get("next_agent", "END")
    valid = {"recommendation", "chef", "nutrition", "END"}
    return next_agent if next_agent in valid else "END"


def route_after_clarify(state: KitchenState) -> str:
    """
    After supervisor_clarify:
    - WAIT_FOR_USER → END (graph pauses; orchestrator re-invokes after user reply)
    - recommendation / chef / nutrition → continue pipeline
    """
    next_agent = state.get("next_agent", "END")
    if next_agent == "WAIT_FOR_USER":
        return END   # graph exits; orchestrator surfaces clarification to user
    valid = {"recommendation", "chef", "nutrition"}
    return next_agent if next_agent in valid else "END"


def route_after_review(state: KitchenState) -> str:
    next_agent = state.get("next_agent", "END")
    valid = {"chef", "END"}
    return next_agent if next_agent in valid else "END"


# ── Build the graph ───────────────────────────────────────────────────────────

def build_graph(use_checkpointing: bool = True) -> StateGraph:
    builder = StateGraph(KitchenState)

    # ── Nodes ─────────────────────────────────────────────────────────────────
    builder.add_node("supervisor_classify", supervisor_classify)
    builder.add_node("supervisor_entry",    supervisor_entry)
    builder.add_node("supervisor_clarify",  supervisor_clarify)
    builder.add_node("recommendation",      recommendation_agent)
    builder.add_node("chef",                chef_agent)
    builder.add_node("nutrition",           nutrition_agent)
    builder.add_node("critic",              critic_agent)
    builder.add_node("supervisor_review",   supervisor_review)

    # ── Entry point ───────────────────────────────────────────────────────────
    builder.set_entry_point("supervisor_classify")

    # ── classify → entry (always) ─────────────────────────────────────────────
    # supervisor_entry handles ALL intents:
    #   culinary_info / chitchat / out_of_scope → sets done=True, next_agent=END
    #   culinary / non_moroccan_culinary        → sets next_agent for pipeline
    builder.add_edge("supervisor_classify", "supervisor_entry")

    # ── entry → clarify | pipeline | END ─────────────────────────────────────
    builder.add_conditional_edges(
        "supervisor_entry",
        route_after_entry,
        {
            "supervisor_clarify": "supervisor_clarify",
            "recommendation"    : "recommendation",
            "chef"              : "chef",
            "nutrition"         : "nutrition",
            "END"               : END,
        },
    )

    # ── clarify → pipeline | END (WAIT_FOR_USER) ──────────────────────────────
    builder.add_conditional_edges(
        "supervisor_clarify",
        route_after_clarify,
        {
            "recommendation": "recommendation",
            "chef"          : "chef",
            "nutrition"     : "nutrition",
            END             : END,
        },
    )

    # ── Linear pipeline ───────────────────────────────────────────────────────
    builder.add_edge("recommendation", "chef")
    builder.add_edge("chef",           "nutrition")
    builder.add_edge("nutrition",      "critic")
    builder.add_edge("critic",         "supervisor_review")

    # ── review → revision loop | END ──────────────────────────────────────────
    builder.add_conditional_edges(
        "supervisor_review",
        route_after_review,
        {
            "chef": "chef",
            "END" : END,
        },
    )

    if use_checkpointing:
        memory = MemorySaver()
        return builder.compile(checkpointer=memory)
    return builder.compile()


# ── Singleton ─────────────────────────────────────────────────────────────────

_graph = None

def get_graph(use_checkpointing: bool = True):
    global _graph
    if _graph is None:
        _graph = build_graph(use_checkpointing)
    return _graph