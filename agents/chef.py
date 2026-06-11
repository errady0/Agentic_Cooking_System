"""
agents/chef.py

The Chef agent produces a complete recipe with:
  - Ingredients (with relevant spice names for the cuisine style)
  - Step-by-step instructions
  - Tips on technique and presentation
  - Cultural context

Behaviour adapts based on state["user_style_choice"]:
  - "moroccan" (default) → authentic Moroccan recipe, Moroccan spices and technique
  - "moroccan_twist"     → non-Moroccan dish reimagined with Moroccan flavours/spices
  - "classic"            → faithful classic recipe of the dish's original cuisine,
                           NO Moroccan influence added
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm
from tools import web_search, web_scrape, get_ingredient_prices

_llm = get_llm(temperature=0.4)


# ── System prompts — one per style ────────────────────────────────────────────

_SYSTEM_MOROCCAN = """You are a master Moroccan chef with deep knowledge of
Moroccan culinary traditions.

Dish to prepare      : {dish}
Dietary constraints  : {dietary}
Critic feedback      : {critic_notes}
Web reference        : {web_ref}

Produce an authentic Moroccan recipe. Use traditional Moroccan spice names
(ras el hanout, chermoula, preserved lemon, argan oil, etc.) where appropriate.
Include cultural context and Moroccan accompaniments.

CRITICAL INSTRUCTION FOR INGREDIENTS:
You MUST output the "item" field of the ingredients array in English, regardless of the user's language. This is required for our internal pricing system to work. The rest of the JSON (name, steps, tips) should be in the user's language.

Reply with a JSON object (no markdown) with these exact keys:
  "name"         : full dish name in user_language
  "style"        : "moroccan"
  "servings"     : integer (default 2)
  "ingredients"  : list of {{"item", "quantity", "notes"}} (item MUST be English)
  "steps"        : list of {{"step_number", "title", "instruction", "duration_minutes"}}
  "tips"         : list of 2-3 chef tips
  "cultural_note": 1-2 sentences about the dish's Moroccan heritage
  "pairing"      : suggested Moroccan accompaniments (mint tea, khobz, etc.)
"""

_SYSTEM_MOROCCAN_TWIST = """You are a creative Moroccan fusion chef.

Dish to prepare      : {dish}
Dietary constraints  : {dietary}
Critic feedback      : {critic_notes}
Web reference        : {web_ref}

Your task: reimagine this dish with a Moroccan twist.
Keep the dish's original structure and cooking method, but replace or
supplement key flavours and spices with Moroccan equivalents:
  - Use ras el hanout, chermoula, harissa, preserved lemon, argan oil, cumin,
    coriander, saffron, and similar Moroccan pantry staples where they fit.
  - Add a "moroccan_adaptations" key that clearly lists every change you made
    from the classic version, so the user understands what makes it Moroccan.

CRITICAL INSTRUCTION FOR INGREDIENTS:
You MUST output the "item" field of the ingredients array in English, regardless of the user's language. This is required for our internal pricing system to work. The rest of the JSON (name, steps, tips) should be in the user's language.

Reply with a JSON object (no markdown) with these exact keys:
  "name"                 : dish name in user_language + " — Moroccan Twist"
  "style"                : "moroccan_twist"
  "servings"             : integer (default 2)
  "ingredients"          : list of {{"item", "quantity", "notes"}} (item MUST be English)
  "steps"                : list of {{"step_number", "title", "instruction", "duration_minutes"}}
  "tips"                 : list of 2-3 chef tips
  "cultural_note"        : 1-2 sentences explaining the Moroccan inspiration
  "moroccan_adaptations" : list of strings — each change vs the classic version
  "pairing"              : suggested Moroccan accompaniments
"""

_SYSTEM_CLASSIC = """You are an expert chef specialising in {origin_cuisine} cuisine.

Dish to prepare      : {dish}
Dietary constraints  : {dietary}
Critic feedback      : {critic_notes}
Web reference        : {web_ref}

Produce a faithful, authentic classic recipe for this dish exactly as it is
traditionally made in its country of origin.
Do NOT add Moroccan spices, ingredients, or techniques.
Use the traditional spices, methods, and accompaniments of {origin_cuisine} cuisine.

CRITICAL INSTRUCTION FOR INGREDIENTS:
You MUST output the "item" field of the ingredients array in English, regardless of the user's language. This is required for our internal pricing system to work. The rest of the JSON (name, steps, tips) should be in the user's language.

Reply with a JSON object (no markdown) with these exact keys:
  "name"         : full dish name in user_language
  "style"        : "classic"
  "origin"       : "{origin_cuisine}"
  "servings"     : integer (default 2)
  "ingredients"  : list of {{"item", "quantity", "notes"}} (item MUST be English)
  "steps"        : list of {{"step_number", "title", "instruction", "duration_minutes"}}
  "tips"         : list of 2-3 chef tips
  "cultural_note": 1-2 sentences about the dish's origin and tradition
  "pairing"      : traditional accompaniments from the original cuisine
"""


# ── Web search query — adapts to style ───────────────────────────────────────

def _build_search_query(dish: str, style: str, origin: str) -> str:
    if style == "classic":
        return f"authentic traditional {dish} recipe {origin}"
    elif style == "moroccan_twist":
        return f"moroccan fusion {dish} recipe spices"
    else:
        return f"authentic moroccan {dish} recipe"


# ── Main agent ────────────────────────────────────────────────────────────────

def chef_agent(state: KitchenState) -> KitchenState:
    prefs        = state.get("user_preferences", {})
    recommended  = state.get("recommended_recipes", [])
    critic       = state.get("critic_feedback", {})
    iteration    = state.get("iteration", 0)
    style        = state.get("user_style_choice", "moroccan") or "moroccan"
    dish_origin  = state.get("dish_origin", "") or ""

    # ── Pick the dish ─────────────────────────────────────────────────────────
    if recommended:
        dish = recommended[0].get("name", state["objective"])
    else:
        dish = state.get("dish_hint") or state.get("objective") or state["user_input"]

    # ── Critic notes (only on revision passes) ────────────────────────────────
    critic_notes = ""
    if iteration > 0 and critic:
        issues      = critic.get("issues", [])
        suggestions = critic.get("suggestions", [])
        critic_notes = f"Issues: {issues}. Suggestions: {suggestions}"

    # ── Web reference — search query is style-aware ───────────────────────────
    web_ref = ""
    try:
        query = _build_search_query(dish, style, dish_origin)
        search_result = web_search.invoke(query)
        items = json.loads(search_result)
        if items and items[0].get("url"):
            scraped = web_scrape.invoke(items[0]["url"])
            web_ref = scraped[:1000]
        elif items:
            web_ref = items[0].get("content", "")[:500]
    except Exception:
        web_ref = "Not available"

    # ── Build the right system prompt ─────────────────────────────────────────
    dietary = ", ".join(prefs.get("dietary", [])) or "none"

    if style == "classic":
        origin_cuisine = dish_origin or "international"
        system_prompt = _SYSTEM_CLASSIC.format(
            dish           = dish,
            dietary        = dietary,
            critic_notes   = critic_notes or "none",
            web_ref        = web_ref,
            origin_cuisine = origin_cuisine,
        )
    elif style == "moroccan_twist":
        system_prompt = _SYSTEM_MOROCCAN_TWIST.format(
            dish         = dish,
            dietary      = dietary,
            critic_notes = critic_notes or "none",
            web_ref      = web_ref,
        )
    else:   # "moroccan" — default for all Moroccan requests
        system_prompt = _SYSTEM_MOROCCAN.format(
            dish         = dish,
            dietary      = dietary,
            critic_notes = critic_notes or "none",
            web_ref      = web_ref,
        )

    # ── Invoke LLM ────────────────────────────────────────────────────────────
    resp = _llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Prepare the full recipe for: {dish}"),
    ])
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
            "name"    : dish,
            "style"   : style,
            "servings": 2,
            "ingredients": [],
            "steps"   : [{"step_number": 1, "title": "Prepare",
                          "instruction": text[:500], "duration_minutes": 60}],
            "tips"    : [],
            "cultural_note": "",
            "pairing" : "",
        }

    # ── Price lookup ──────────────────────────────────────────────────────────
    try:
        import re
        def calc_price(ing_dict, price_info):
            base_price = price_info.get("price_mad", 0)
            if not base_price: return 0
            
            qty_str = str(ing_dict.get("quantity", ing_dict.get("amount", "1")))
            p_unit = price_info.get("unit", "kg").lower()
            
            match = re.search(r'(\d+(?:\.\d+)?)', qty_str)
            if not match: return base_price * 0.1
            val = float(match.group(1))
            
            qty_lower = qty_str.lower()
            
            if p_unit == "kg":
                if 'mg' in qty_lower:
                    return base_price * (val / 1000000.0)
                elif 'g' in qty_lower and 'kg' not in qty_lower:
                    return base_price * (val / 1000.0)
                elif 'kg' in qty_lower or 'kilo' in qty_lower:
                    return base_price * val
                elif 'tbsp' in qty_lower or 'tablespoon' in qty_lower or 'c. à soupe' in qty_lower or 'cuillère à soupe' in qty_lower:
                    return base_price * (val * 0.015)
                elif 'tsp' in qty_lower or 'teaspoon' in qty_lower or 'c. à café' in qty_lower or 'cuillère à café' in qty_lower:
                    return base_price * (val * 0.005)
                elif 'cup' in qty_lower:
                    return base_price * (val * 0.25)
                elif 'pinch' in qty_lower or 'pincée' in qty_lower:
                    return base_price * 0.001
                else:
                    if val < 20 and not any(u in qty_lower for u in ['g', 'kg', 'l', 'ml']):
                        return base_price * (val * 0.1)
                    return base_price * val
            elif p_unit in ["litre", "liter", "l"]:
                if 'ml' in qty_lower:
                    return base_price * (val / 1000.0)
                elif 'l' in qty_lower.split() or 'liter' in qty_lower or 'litre' in qty_lower:
                    return base_price * val
                elif 'cup' in qty_lower:
                    return base_price * (val * 0.25)
                elif 'tbsp' in qty_lower or 'c. à soupe' in qty_lower or 'cuillère à soupe' in qty_lower:
                    return base_price * (val * 0.015)
                else:
                    return base_price * val
            else:
                return base_price * val

        ingredient_names = [
            ing.get("item", ing.get("name", ""))
            for ing in recipe.get("ingredients", [])
            if isinstance(ing, dict)
        ]
        if ingredient_names:
            raw_prices = get_ingredient_prices.invoke({"ingredients": ingredient_names})
            prices     = json.loads(raw_prices)["prices"]
            total      = 0.0
            for ing in recipe.get("ingredients", []):
                if isinstance(ing, dict):
                    # Strip out any hallucinated price properties
                    for k in ["price", "total_price", "cost", "price_mad"]:
                        if k in ing:
                            del ing[k]

                    name = ing.get("item", ing.get("name", ""))
                    if name in prices:
                        p_info = prices[name]
                        calculated = calc_price(ing, p_info)
                        ing["calculated_price"] = round(calculated, 2)
                        ing["price_info"] = p_info
                        total += calculated
            
            recipe["total_price"] = {"amount": round(total, 2), "currency": "MAD"}
            
    except Exception as e:
        print(f"Price calculation error: {e}")
        pass

    return {
        **state,
        "current_recipe": recipe,
        "next_agent"    : "nutrition",
        "messages"      : [AIMessage(content=f"[Chef] Recipe ready: {recipe.get('name', dish)} ({style})")],
    }