"""
graph.py

Node layout:
  supervisor_classify
       ↓
  supervisor_entry ──→ END (out_of_scope / culinary_info / chitchat)
       ↓
  recommendation  (if needed)
       ↓
     chef         ←── (revision loop from supervisor_review)
       ↓
   nutrition
       ↓
    critic
       ↓
  supervisor_review ──→ chef (revision) | END
"""

from __future__ import annotations

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agents.state import KitchenState
from agents.supervisor import supervisor_classify, supervisor_entry, supervisor_review
from agents.recommendation import recommendation_agent
from agents.chef import chef_agent
from agents.nutrition import nutrition_agent
from agents.critic import critic_agent


# ── Routing functions ─────────────────────────────────────────────────────────

def route_after_classify(state: KitchenState) -> str:
    """Route based on intent — classify step sets this."""
    return state.get("intent", "culinary")
    # returns: "culinary" | "culinary_info" | "chitchat" | "out_of_scope"


def route_after_entry(state: KitchenState) -> str:
    next_agent = state.get("next_agent", "recommendation")
    valid = {"recommendation", "chef", "nutrition", "END"}
    if next_agent not in valid:
        return "recommendation"  # safe fallback
    return next_agent


def route_after_review(state: KitchenState) -> str:
    next_agent = state.get("next_agent", "END")
    valid = {"chef", "END"}
    if next_agent not in valid:
        return "END"
    return next_agent


# ── Build the graph ───────────────────────────────────────────────────────────

def build_graph(use_checkpointing: bool = True) -> StateGraph:
    builder = StateGraph(KitchenState)

    # ── Nodes ─────────────────────────────────────────────────────────────────
    builder.add_node("supervisor_classify", supervisor_classify)
    builder.add_node("supervisor_entry",    supervisor_entry)
    builder.add_node("recommendation",      recommendation_agent)
    builder.add_node("chef",                chef_agent)
    builder.add_node("nutrition",           nutrition_agent)
    builder.add_node("critic",              critic_agent)
    builder.add_node("supervisor_review",   supervisor_review)

    # ── Entry point ───────────────────────────────────────────────────────────
    builder.set_entry_point("supervisor_classify")

    # ── Edges ─────────────────────────────────────────────────────────────────

    # classify → entry (culinary) | END (culinary_info / out_of_scope)
    builder.add_conditional_edges(
        "supervisor_classify",
        route_after_classify,
        {
            "culinary"     : "supervisor_entry",  # needs pipeline routing
            "culinary_info": END,                 # supervisor_entry handles direct answer inline
            "chitchat"     : END,                 # supervisor_entry handles friendly answer
            "out_of_scope" : END,                 # supervisor_entry handles decline inline
        },
    )

    # classify always passes to entry — entry decides what happens next
    builder.add_edge("supervisor_classify", "supervisor_entry")

    # entry → pipeline agents | END
    builder.add_conditional_edges(
        "supervisor_entry",
        route_after_entry,
        {
            "recommendation": "recommendation",
            "chef"          : "chef",
            "nutrition"     : "nutrition",
            "END"             : END,              # out_of_scope or culinary_info or chitchat
        },
    )

    # Linear pipeline edges
    builder.add_edge("recommendation", "chef")
    builder.add_edge("chef",           "nutrition")
    builder.add_edge("nutrition",      "critic")
    builder.add_edge("critic",         "supervisor_review")

    # review → revision loop | END
    builder.add_conditional_edges(
        "supervisor_review",
        route_after_review,
        {
            "chef": "chef",
            "END"   : END,
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