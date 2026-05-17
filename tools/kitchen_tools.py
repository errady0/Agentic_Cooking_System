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


# ── 3. Nutrition API ─────────────────────────────────────────────────

@tool
def nutrition_lookup(dish_name: str, servings: int = 4) -> str:
    """
    Look up nutritional information for a Moroccan dish.
    Returns calories, carbohydrates, protein, fat, and fibre per serving.
    Uses LLM-estimated response, or your based knowledge.
    """
    return _llm_estimated_nutrition(dish_name, servings)


def _llm_estimated_nutrition(dish_name: str, servings: int) -> str:
    """
    Fallback: return a realistic but approximate estimate using known values
    for common Moroccan dishes.
    """
    known: dict[str, dict] = {
        "tajine": {"calories": 420, "carbs_g": 22, "protein_g": 31, "fat_g": 18, "fibre_g": 5},
        "couscous": {"calories": 380, "carbs_g": 58, "protein_g": 14, "fat_g": 9, "fibre_g": 6},
        "harira": {"calories": 210, "carbs_g": 28, "protein_g": 11, "fat_g": 5, "fibre_g": 7},
        "bastilla": {"calories": 510, "carbs_g": 42, "protein_g": 26, "fat_g": 22, "fibre_g": 2},
        "msemen": {"calories": 290, "carbs_g": 44, "protein_g": 7, "fat_g": 9, "fibre_g": 1},
        "chebakia": {"calories": 240, "carbs_g": 31, "protein_g": 3, "fat_g": 12, "fibre_g": 1},
        "rfissa": {"calories": 470, "carbs_g": 48, "protein_g": 28, "fat_g": 16, "fibre_g": 5},
    }
    key = next((k for k in known if k in dish_name.lower()), None)
    values = known.get(key, {})
    result = {
        "dish": dish_name,
        "servings": servings,
        "per_serving": values,
    }
    return json.dumps(result, ensure_ascii=False)


# ── Tool registry ─────────────────────────────────────────────────────
ALL_TOOLS = [web_search, web_scrape, nutrition_lookup]
