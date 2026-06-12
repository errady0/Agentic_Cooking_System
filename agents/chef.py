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

Produce an authentic Moroccan recipe.
Include cultural context and Moroccan accompaniments.

Reply with a JSON object (no markdown) with these exact keys:
  "name"         : full dish name in user_language
  "style"        : "moroccan"
  "servings"     : integer (default 2)
  "ingredients"  : list of {{"item", "quantity", "notes"}}
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

Reply with a JSON object (no markdown) with these exact keys:
  "name"                 : dish name in user_language + " — Moroccan Twist"
  "style"                : "moroccan_twist"
  "servings"             : integer (default 2)
  "ingredients"          : list of {{"item", "quantity", "notes"}}
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

Reply with a JSON object (no markdown) with these exact keys:
  "name"         : full dish name in user_language
  "style"        : "classic"
  "origin"       : "{origin_cuisine}"
  "servings"     : integer (default 2)
  "ingredients"  : list of {{"item", "quantity", "notes"}}
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
        ingredients_list = recipe.get("ingredients", [])

        # Build a map: original_name → english_name for matching
        original_names = [
            ing.get("item", ing.get("name", ""))
            for ing in ingredients_list
            if isinstance(ing, dict)
        ]

        # Normalize non-English names to English for price table lookup
        english_names = original_names
        if original_names:
            try:
                norm_resp = _llm.invoke([
                    SystemMessage(content=(
                        "Translate each ingredient name to its simple English equivalent "
                        "(e.g. 'tomates mûres' → 'tomato', 'طماطم' → 'tomato', 'poulet' → 'chicken'). "
                        "Reply ONLY with a JSON array of strings in the same order as the input. "
                        "No markdown, no explanation."
                    )),
                    HumanMessage(content=json.dumps(original_names, ensure_ascii=False)),
                ])
                norm_text = norm_resp.content.strip()
                if norm_text.startswith("```"):
                    norm_text = norm_text.split("```")[1]
                    if norm_text.lower().startswith("json"):
                        norm_text = norm_text[4:]
                parsed_names = json.loads(norm_text.strip())
                if isinstance(parsed_names, list) and len(parsed_names) == len(original_names):
                    english_names = parsed_names
            except Exception:
                pass  # fall back to original names

        # Fetch prices using (possibly translated) English names
        raw_prices = get_ingredient_prices.invoke({"ingredients": english_names})
        prices = json.loads(raw_prices)["prices"]

        # Ask LLM to convert each recipe quantity to grams (or units for countable items)
        # so we can compute a proportional cost from the per-kg price.
        qty_list = [
            {"ingredient": original_names[i], "quantity": ing.get("quantity", "")}
            for i, ing in enumerate(ingredients_list)
            if isinstance(ing, dict)
        ]
        gram_weights = {}
        try:
            qty_resp = _llm.invoke([
                SystemMessage(content=(
                    "For each ingredient and its recipe quantity, return the amount in grams "
                    "(or whole units for countable items like eggs). "
                    "Rules:\n"
                    "- Countable items (eggs, onions, garlic cloves, lemons…): return the COUNT as a number, set unit='unit'\n"
                    "- Liquids (oil, water, milk…): 1 tablespoon=14g, 1 teaspoon=5g, 1 cup=240g\n"
                    "- Ground spices: 1 teaspoon≈3g, 1 tablespoon≈8g, 1 pinch≈0.5g\n"
                    "- Vegetables/meat: convert to grams (1 medium tomato≈150g, 1 medium onion≈120g)\n"
                    "Reply ONLY with a JSON array in the same order as the input, each item: "
                    "{\"ingredient\": \"...\", \"amount\": <number>, \"unit\": \"g\" or \"unit\"}. "
                    "No markdown, no explanation."
                )),
                HumanMessage(content=json.dumps(qty_list, ensure_ascii=False)),
            ])
            qty_text = qty_resp.content.strip()
            if qty_text.startswith("```"):
                qty_text = qty_text.split("```")[1]
                if qty_text.lower().startswith("json"):
                    qty_text = qty_text[4:]
            parsed_qty = json.loads(qty_text.strip())
            if isinstance(parsed_qty, list) and len(parsed_qty) == len(original_names):
                for item in parsed_qty:
                    gram_weights[item["ingredient"]] = {
                        "amount": item.get("amount", 0),
                        "unit": item.get("unit", "g"),
                    }
        except Exception:
            pass

        # Attach "calculated_price" as a proportional cost for the recipe quantity
        for i, ing in enumerate(ingredients_list):
            if not isinstance(ing, dict):
                continue
            orig_name   = original_names[i]
            lookup_name = english_names[i] if i < len(english_names) else orig_name
            price_entry = prices.get(lookup_name, {})
            price_mad   = price_entry.get("price_mad")   # price per kg (or per unit if unit=='unit')
            table_unit  = price_entry.get("unit", "kg")

            if price_mad is None:
                ing["calculated_price"] = None
                continue

            qty_info = gram_weights.get(orig_name)
            if not qty_info:
                # No quantity info — fall back to showing the catalogue unit price
                ing["calculated_price"] = f"~{price_mad:.0f} MAD/{table_unit}"
                continue

            amount = qty_info.get("amount", 0)
            unit   = qty_info.get("unit", "g")

            try:
                if unit == "unit" or table_unit == "unit":
                    # Countable items: price is per unit
                    cost = price_mad * amount
                else:
                    # Weight-based: price_mad is per kg, amount is in grams
                    cost = price_mad * (amount / 1000)

                if cost < 0.5:
                    ing["calculated_price"] = "< 1 MAD"
                else:
                    ing["calculated_price"] = f"~{cost:.1f} MAD"
            except Exception:
                ing["calculated_price"] = f"~{price_mad:.0f} MAD/{table_unit}"
    except Exception:
        pass

    return {
        **state,
        "current_recipe": recipe,
        "next_agent"    : "nutrition",
        "messages"      : [AIMessage(content=f"[Chef] Recipe ready: {recipe.get('name', dish)} ({style})")],
    }