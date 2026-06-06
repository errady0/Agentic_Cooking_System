"""
agents/nutrition.py

Analyses the nutritional content of the prepared recipe.
Uses the nutrition_lookup tool.
Also flags health considerations relevant to the user's dietary constraints.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm
from tools import nutrition_lookup

_llm = get_llm()

_SYSTEM = """You are a clinical nutritionist specialising in Moroccan and Mediterranean diets.

Recipe: {recipe_name}
Raw nutritional data (per serving): {raw_data}
User dietary constraints: {dietary}

Analyse the nutrition data and reply with a JSON object (no markdown):
  "per_serving"        : {{calories, carbs_g, protein_g, fat_g, sugar_g, fibre_g}}
  "health_notes"       : list of 2-3 brief health observations
  "dietary_flags"      : list of any conflicts with user's constraints
  "mediterranean_score": 1-10 rating of how well this fits a Mediterranean diet
  "suggestions"        : optional substitutions to improve nutritional profile
  "data_source"        : where the numbers came from
"""


def nutrition_agent(state: KitchenState) -> KitchenState:
    recipe = state.get("current_recipe")
    prefs = state.get("user_preferences", {})

    if not recipe:
        return {
            **state,
            "nutrition_analysis": None,
            "next_agent": "critic",
            "messages": [AIMessage(content="[Nutrition] No recipe found, skipping.")],
        }

    dish_name = recipe.get("name", "Unknown dish")
    servings = recipe.get("servings", 4)

    # Call the nutrition tool
    try:
        raw = nutrition_lookup.invoke({"dish_name": dish_name, "servings": servings})
        raw_data = json.loads(raw)
        per_serving = raw_data.get("per_serving")
        data_source = raw_data.get("source", "estimated")
    except Exception as e:
        per_serving = {}
        data_source = f"lookup failed: {e}"

    messages = [
        SystemMessage(content=_SYSTEM.format(
            recipe_name=dish_name,
            raw_data=json.dumps(per_serving, ensure_ascii=False),
            dietary=", ".join(prefs.get("dietary", [])) or "none",
        )),
        HumanMessage(content=f"Analyse nutritional content for {dish_name}"),
    ]

    resp = _llm.invoke(messages)
    text = resp.content.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        analysis = json.loads(text)
        # Pin the trusted raw lookup values into per_serving when available.
        # The LLM is used for health notes, flags, score and suggestions only —
        # NOT for generating alternative calorie/macro numbers.
        if per_serving:
            analysis["per_serving"] = per_serving
        # Only set data_source if the LLM didn't already provide one
        if not analysis.get("data_source"):
            analysis["data_source"] = data_source
    except json.JSONDecodeError:
        analysis = {
            "per_serving": per_serving,
            "health_notes": [text[:200]],
            "dietary_flags": [],
            "mediterranean_score": 7,
            "suggestions": [],
            "data_source": data_source,
        }

    return {
        **state,
        "nutrition_analysis": analysis,
        "next_agent": "critic",
        "messages": [
            AIMessage(content=f"[Nutrition] Analysis complete for {dish_name}")
        ],
    }
