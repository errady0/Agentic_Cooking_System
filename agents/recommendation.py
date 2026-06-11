"""
agents/recommendation.py

Recommends Moroccan recipes based on:
  - User's stated preferences (from long-term memory)
  - Current request
  - Optional web search for inspiration

Output: updates state["recommended_recipes"] and routes to chef.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage
from langchain_anthropic import ChatAnthropic

from agents.state import KitchenState
from agents.llm import get_llm
from tools import web_search

_llm = get_llm()

_SYSTEM = """You are a master Moroccan cuisine recommendation specialist.

Your role: suggest 2-3 Moroccan recipes that match the user's objective. Only suggest real Moroccan recipes.
Use the user preferences as a background lens — not a rulebook.

It should quietly shape and color your recommendations, not dominate them. Concretely:
  Liked dishes: {liked}
  Disliked dishes: {disliked}
  Dietary constraints: {dietary}
  Flavor notes: {flavor_notes}

Additional context from web search: {web_context}

Reply with a JSON array (no markdown) where each item has:
  "name"        : dish name in user_language (Darija if known)
  "description" : 2-sentence description
  "why"         : why this matches the user's preferences
  "difficulty"  : easy / medium / hard
  "time_minutes": approximate total cooking time
  "region"      : Moroccan region (e.g. Marrakech, Fes, coastal, nationwide)
"""


def recommendation_agent(state: KitchenState) -> KitchenState:
    prefs = state.get("user_preferences", {})
    objective = state.get("objective", state["user_input"])

    # Use web search for extra inspiration if Tavily is configured
    web_context = ""
    try:
        result = web_search.invoke(f"Moroccan recipe {objective}")
        items = json.loads(result)
        web_context = " | ".join(i.get("content", "")[:200] for i in items[:3])
    except Exception:
        web_context = "Not available"

    messages = [
        SystemMessage(content=_SYSTEM.format(
            liked=", ".join(prefs.get("liked", [])) or "none",
            disliked=", ".join(prefs.get("disliked", [])) or "none",
            dietary=", ".join(prefs.get("dietary", [])) or "none",
            flavor_notes=prefs.get("flavor_notes", "no notes"),
            web_context=web_context[:800],
        )),
        HumanMessage(content=f"Objective: {objective}"),
    ]

    resp = _llm.invoke(messages)
    text = resp.content.strip()

    # Strip markdown fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        recipes = json.loads(text)
        if not isinstance(recipes, list):
            recipes = [recipes]
    except json.JSONDecodeError:
        recipes = [{"name": "Chicken Tagine", "description": text[:200], "why": "Default fallback",
                    "difficulty": "medium", "time_minutes": 90, "region": "nationwide"}]

    return {
        **state,
        "recommended_recipes": recipes,
        "next_agent": "supervisor_review",
        "messages": [
            AIMessage(content=f"[Recommendation] Suggested: {', '.join(r.get('name','') for r in recipes)}")
        ],
    }
