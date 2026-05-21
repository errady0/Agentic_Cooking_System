"""
tools/kitchen_tools.py

Three tools available to any agent in the graph:

1. web_search(query)      — Tavily search, falls back to a stub if no key.
2. web_scrape(url)        — BeautifulSoup scraper for recipe sites.
3. nutrition_lookup(dish) — LLM-estimated, LLM based knowledge response.

Each tool is a plain Python function AND a LangChain @tool-decorated version
so agents can call them via the standard LangChain tool interface.
"""

from __future__ import annotations

import json
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup
from langchain_core.tools import tool

from config import settings


# ── 1. Web Search ────────────────────────────────────────────────────

@tool
def web_search(query: str) -> str:
    """
    Search the web for information about Moroccan recipes, ingredients,
    cooking techniques, or culinary history.
    Returns a JSON string with a list of {title, url, content} results.
    """
    if not settings.TAVILY_API_KEY:
        return json.dumps(
            [{"title": "Search unavailable", "url": "", "content":
              f"Tavily API key not configured. Query was: {query}"}]
        )
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(
            query=query,
            max_results=5,
            search_depth="basic",
            include_answer=True,
        )
        results = []
        if response.get("answer"):
            results.append({"title": "Direct answer", "url": "", "content": response["answer"]})
        for r in response.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:600],
            })
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return json.dumps([{"title": "Search error", "url": "", "content": str(e)}])


# ── 2. Web Scraper ───────────────────────────────────────────────────

@tool
def web_scrape(url: str) -> str:
    """
    Fetch and extract readable text from a recipe web page.
    Use this to get the full details of a recipe found via web_search.
    Returns the cleaned text content (max 3000 chars).
    """
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            )
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove noise
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()

        # Try to find recipe-specific containers first
        for selector in [
            "article", ".recipe", ".recipe-content",
            "[itemtype*='Recipe']", "main", ".entry-content",
        ]:
            container = soup.select_one(selector)
            if container:
                text = container.get_text(separator="\n", strip=True)
                break
        else:
            text = soup.get_text(separator="\n", strip=True)

        # Clean and limit
        lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 20]
        cleaned = "\n".join(lines)
        return cleaned[:3000] if len(cleaned) > 3000 else cleaned

    except Exception as e:
        return f"Scraping failed: {e}"


# ── 3. Nutrition ─────────────────────────────────────────────────

@tool
def nutrition_lookup(dish_name: str, servings: int = 4) -> str:
    """
    Look up nutritional information for a Moroccan dish.
    Returns calories, carbohydrates, protein, fat, sugar and fibre per serving.
    Uses LLM-estimated response.
    """
    return _llm_estimated_nutrition(dish_name, servings)

from memory import nutritions_tab
def _llm_estimated_nutrition(dish_name: str, servings: int) -> str:
    """
    Fallback: return a realistic but approximate estimate using known values
    for common Moroccan dishes.
    """
    known: dict[str, dict] = nutritions_tab
    key = next((k for k in known if k in dish_name.lower()), None)
    values = known.get(key, {})
    result = {
        "dish": dish_name,
        "servings": servings,
        "per_serving": values,
    }
    return json.dumps(result, ensure_ascii=False)


# ── 4. Ingredients Price ─────────────────────────────────────────────────

from memory import ingredients_price
_PRICE_TABLE_MAD: dict[str, dict] = ingredients_price

def _search_price(ingredient: str) -> Optional[dict]:
    """
    Try to get a live Moroccan price via Tavily web search.
    Returns {price_mad, unit, source} or None if search unavailable/failed.
    """
    if not settings.TAVILY_API_KEY:
        return None
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        query = f"prix {ingredient} maroc marché 2026 dirham kg"
        response = client.search(query=query, max_results=3, search_depth="basic")

        # Try to extract a price from the answer or first result
        text = response.get("answer", "")
        if not text and response.get("results"):
            text = response["results"][0].get("content", "")

        # Look for patterns like "15 MAD", "15 DH", "15 dirhams"
        patterns = [
            r"(\d+(?:\.\d+)?)\s*(?:MAD|DH|dirham|درهم)",
            r"(\d+(?:\.\d+)?)\s*(?:MAD|DH)",
            r"prix[^\d]*(\d+(?:\.\d+)?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                price = float(match.group(1))
                if 0.5 < price < 1000:  # sanity check
                    return {
                        "price_mad": price,
                        "unit": "kg",
                        "source": "web search (Tavily)",
                        "raw_snippet": text[:200],
                    }
    except Exception:
        pass
    return None


def _fallback_price(ingredient: str) -> dict:
    """Match ingredient against price table (substring match, best effort)."""
    ing_lower = ingredient.lower().strip()

    # Exact match first
    if ing_lower in _PRICE_TABLE_MAD:
        entry = _PRICE_TABLE_MAD[ing_lower]
        return {**entry, "source": "price table"}

    # Substring match
    for key, entry in _PRICE_TABLE_MAD.items():
        if key in ing_lower or ing_lower in key:
            return {**entry, "source": "price table"}

    # Unknown ingredient
    return {
        "price_mad": None,
        "unit": "kg",
        "notes": "price not available for this ingredient",
        "source": "not found",
    }


@tool
def get_ingredient_prices(ingredients: list[str]) -> str:
    """
    Get current Moroccan market prices (in MAD — Moroccan Dirham) for a list
    of ingredient names.

    Strategy:
      1. Web search via Tavily for live prices (if API key is configured)
      2. Fall back to a maintained price table of common Moroccan ingredients

    Returns a JSON string with per-ingredient prices and a total estimated
    recipe cost.

    Example input: ["chicken", "onion", "cumin", "olive oil"]
    """
    results = {}
    total_found = 0
    found_count = 0

    for ingredient in ingredients:
        # Try live search first
        live = _search_price(ingredient)
        if live:
            results[ingredient] = live
        else:
            results[ingredient] = _fallback_price(ingredient)

        price = results[ingredient].get("price_mad")
        if price is not None:
            total_found += price
            found_count += 1

    return json.dumps({
        "prices": results,
        "currency": "MAD (Moroccan Dirham)",
        "note": (
            "Prices are per-unit (usually kg). "
            "Souk prices may be 10-20% lower than supermarket. "
            "Seasonal vegetables vary significantly."
        ),
    }, ensure_ascii=False)



# ── Tool registry ─────────────────────────────────────────────────────
ALL_TOOLS = [web_search, web_scrape, nutrition_lookup, get_ingredient_prices]
