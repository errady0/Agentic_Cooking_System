"""
graph.py

Defines the LangGraph StateGraph for the Moroccan Kitchen multi-agent system.

Node layout:
  supervisor_entry
       ↓
  recommendation  ←── (if needed)
       ↓
     chef         ←── (revision loop from supervisor_review)
       ↓
   nutrition
       ↓
    critic
       ↓
  supervisor_review ──→ chef (revision) | END
       ↓
      END

Short-term memory (session): LangGraph MemorySaver checkpoint
Long-term memory: handled outside the graph in KitchenOrchestrator
"""

from __future__ import annotations

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agents.state import KitchenState
from agents.supervisor import supervisor_entry, supervisor_review
from agents.recommendation import recommendation_agent
from agents.chef import chef_agent
from agents.nutrition import nutrition_agent
from agents.critic import critic_agent


# ── Routing functions ────────────────────────────────────────────────

def route_after_entry(state: KitchenState) -> str:
    """Route to first specialist agent after supervisor parses the intent."""
    return state.get("next_agent", "recommendation")


def route_after_recommendation(state: KitchenState) -> str:
    return state.get("next_agent", "chef")


def route_after_chef(state: KitchenState) -> str:
    return state.get("next_agent", "nutrition")


def route_after_nutrition(state: KitchenState) -> str:
    return state.get("next_agent", "critic")


def route_after_critic(state: KitchenState) -> str:
    return state.get("next_agent", "supervisor_review")


def route_after_review(state: KitchenState) -> str:
    """Either end the conversation or loop back to chef for revision."""
    if state.get("done"):
        return END
    return state.get("next_agent", END)


# ── Build the graph ──────────────────────────────────────────────────

def build_graph(use_checkpointing: bool = True) -> StateGraph:
    builder = StateGraph(KitchenState)

    # Add nodes
    builder.add_node("supervisor_entry", supervisor_entry)
    builder.add_node("recommendation", recommendation_agent)
    builder.add_node("chef", chef_agent)
    builder.add_node("nutrition", nutrition_agent)
    builder.add_node("critic", critic_agent)
    builder.add_node("supervisor_review", supervisor_review)

    # Entry point
    builder.set_entry_point("supervisor_entry")

    # Edges
    builder.add_conditional_edges(
        "supervisor_entry",
        route_after_entry,
        {
            "recommendation": "recommendation",
            "chef": "chef",
            "nutrition": "nutrition",
        },
    )
    builder.add_conditional_edges(
        "recommendation",
        route_after_recommendation,
        {"chef": "chef"},
    )
    builder.add_conditional_edges(
        "chef",
        route_after_chef,
        {"nutrition": "nutrition"},
    )
    builder.add_conditional_edges(
        "nutrition",
        route_after_nutrition,
        {"critic": "critic"},
    )
    builder.add_conditional_edges(
        "critic",
        route_after_critic,
        {"supervisor_review": "supervisor_review"},
    )
    builder.add_conditional_edges(
        "supervisor_review",
        route_after_review,
        {
            "chef": "chef",       # revision loop
            END: END,
        },
    )

    # Compile with or without checkpointing
    if use_checkpointing:
        memory = MemorySaver()
        return builder.compile(checkpointer=memory)
    return builder.compile()


# Singleton graph instance
_graph = None

def get_graph(use_checkpointing: bool = True):
    global _graph
    if _graph is None:
        _graph = build_graph(use_checkpointing)
    return _graph
