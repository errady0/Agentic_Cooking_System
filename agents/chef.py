"""
agents/chef.py

The Chef agent produces a complete, authentic Moroccan recipe with:
  - Ingredients (with Moroccan spice names)
  - Step-by-step instructions
  - Tips on technique and presentation
  - Cultural context

It can optionally scrape a reference recipe from the web for authenticity.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm
from tools import web_search, web_scrape, get_ingredient_prices

_llm = get_llm(temperature=0.4)

_SYSTEM = """You are a master Moroccan chef with deep knowledge of Moroccan
culinary traditions.

Dish to prepare: {dish}
User dietary constraints: {dietary}
Critic feedback (apply if present): {critic_notes}
Reference from web (use as inspiration, not verbatim): {web_ref}

Reply with a JSON object (no markdown) with these keys:
  "name"         : full dish name (English + Arabic/Darija)
  "servings"     : number of servings (default 4)
  "ingredients"  : list of {{item, quantity, notes}} — include Moroccan spice names
  "steps"        : list of {{step_number, title, instruction, duration_minutes}}
  "tips"         : list of 2-3 chef tips
  "cultural_note": 1-2 sentence story about the dish
  "pairing"      : suggested Moroccan accompaniments (mint tea, bread, etc.)
"""


def chef_agent(state: KitchenState) -> KitchenState:
    prefs = state.get("user_preferences", {})
    recommended = state.get("recommended_recipes", [])
    critic = state.get("critic_feedback", {})
    iteration = state.get("iteration", 0)

    # Pick the dish: top recommendation, or extract from objective
    if recommended:
        dish = recommended[0].get("name", state["objective"])
    else:
        dish = state.get("objective", state["user_input"])

    # Get critic notes for revision iterations
    critic_notes = ""
    if iteration > 0 and critic:
        issues = critic.get("issues", [])
        suggestions = critic.get("suggestions", [])
        critic_notes = f"Issues: {issues}. Suggestions: {suggestions}"

    # Try to get a web reference for the selected dish
    web_ref = ""
    try:
        search_result = web_search.invoke(f"authentic moroccan {dish} recipe")
        items = json.loads(search_result)
        if items and items[0].get("url"):
            scraped = web_scrape.invoke(items[0]["url"])
            web_ref = scraped[:1000]
        elif items:
            web_ref = items[0].get("content", "")[:500]
    except Exception:
        web_ref = "Not available"

    messages = [
        SystemMessage(content=_SYSTEM.format(
            dish=dish,
            dietary=", ".join(prefs.get("dietary", [])) or "none",
            critic_notes=critic_notes or "none",
            web_ref=web_ref,
        )),
        HumanMessage(content=f"Prepare the full recipe for: {dish}"),
    ]

    resp = _llm.invoke(messages)
    text = resp.content.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        recipe = json.loads(text)
    except json.JSONDecodeError:
        recipe = {
            "name": dish,
            "servings": 4,
            "ingredients": [],
            "steps": [{"step_number": 1, "title": "Prepare", "instruction": text[:500], "duration_minutes": 60}],
            "tips": [],
            "cultural_note": "",
            "pairing": "Moroccan mint tea",
        }

    # ── Price lookup ──────────────────────────────────────────────────
    try:
        ingredient_names = [
            ing.get("item", ing.get("name", ""))
            for ing in recipe.get("ingredients", [])
            if isinstance(ing, dict)
        ]
        if ingredient_names:
            raw_prices = get_ingredient_prices.invoke({"ingredients": ingredient_names})
            prices = json.loads(raw_prices)["prices"] 
            total = 0.0
            for ing in recipe.get("ingredients", []):
                if isinstance(ing, dict):
                    name = ing.get("item", ing.get("name", ""))
                    if name in prices:
                        ing["price"] = prices[name]
                        total += prices[name].get("price_mad", 0)
            recipe["total_price"] = {"amount": round(total, 2), "currency": "MAD"}

    except Exception:
        pass

    return {
        **state,
        "current_recipe": recipe,
        "next_agent": "nutrition",
        "messages": [
            AIMessage(content=f"[Chef] Recipe ready: {recipe.get('name', dish)}")
        ],
    }
