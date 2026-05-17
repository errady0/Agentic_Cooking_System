"""
agents/supervisor.py

The Supervisor has two roles:
  1. ENTRY: Parse the user's intent and decide which agents to call.
  2. REVIEW: After critic feedback, decide whether to refine or finalise.

Routing logic is kept in pure Python (not LLM) for speed and reliability.
The LLM is used only to formulate the objective and the final user-facing response.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm

_llm = get_llm()

_SYSTEM_ENTRY = """You are the Supervisor of a Moroccan kitchen AI assistant.

Your task: read the user's message and extract a clear cooking objective.
Reply with a JSON object (no markdown) with these keys:
  "objective"   : short description of what the user wants (1-2 sentences)
  "need_recommendation" : true/false — does the user want recipe suggestions?
  "need_recipe"         : true/false — do we need a full recipe with instructions?
  "need_nutrition"      : true/false — does the user want nutritional info?
  "dish_hint"           : the dish or ingredient mentioned (or "" if none)

User context:
  Liked dishes: {liked}
  Disliked: {disliked}
  Dietary constraints: {dietary}
  History: {history}
"""

_SYSTEM_FINAL = """You are the Supervisor of a Moroccan kitchen AI assistant.
Compose a warm, complete, well-structured response in the user's language.

You have:
  - Recommended recipes: {recommended}
  - Full recipe: {recipe}
  - Nutrition analysis: {nutrition}
  - Critic feedback: {critic}

Write the final answer to give the user. Include the recipe with steps,
nutritional info, and any personalised notes. Be conversational and friendly.
If the critic flagged issues, address them naturally in your response.
"""


def supervisor_entry(state: KitchenState) -> KitchenState:
    """
    First supervisor pass: parse intent and decide routing.
    Runs before any specialist agents.
    """
    prefs = state.get("user_preferences", {})
    history = state.get("history_summary", "")

    prompt = _SYSTEM_ENTRY.format(
        liked=", ".join(prefs.get("liked", [])) or "none recorded",
        disliked=", ".join(prefs.get("disliked", [])) or "none",
        dietary=", ".join(prefs.get("dietary", [])) or "none",
        history=history or "no previous sessions",
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_input"]),
    ]

    resp = _llm.invoke(messages)
    text = resp.content.strip()

    # Strip ```json fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Fallback: assume full request
        parsed = {
            "objective": state["user_input"],
            "need_recommendation": True,
            "need_recipe": True,
            "need_nutrition": True,
            "dish_hint": "",
        }

    # Decide first agent to call
    if parsed.get("need_recommendation"):
        next_agent = "recommendation"
    elif parsed.get("need_recipe"):
        next_agent = "chef"
    else:
        next_agent = "nutrition"

    return {
        **state,
        "objective": parsed.get("objective", state["user_input"]),
        "next_agent": next_agent,
        "iteration": state.get("iteration", 0),
        "max_iterations": state.get("max_iterations", 3),
        "messages": [AIMessage(content=f"[Supervisor] Objective set: {parsed.get('objective', '')}")],
    }


def supervisor_review(state: KitchenState) -> KitchenState:
    """
    Second supervisor pass: after critic feedback, decide to refine or finalise.
    """
    critic = state.get("critic_feedback", {})
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 2)

    # Force exit if we've hit the iteration limit
    if iteration >= max_iter:
        needs_revision = False
    else:
        needs_revision = critic.get("needs_revision", False) if critic else False

    if needs_revision:
        # Route back for refinement — go to chef with updated context
        return {
            **state,
            "next_agent": "chef",
            "iteration": iteration + 1,
            "messages": [AIMessage(content=f"[Supervisor] Requesting revision (iteration {iteration + 1})")],
        }

    # Build the final response
    recipe = state.get("current_recipe")
    nutrition = state.get("nutrition_analysis")
    recommended = state.get("recommended_recipes", [])

    messages = [
        SystemMessage(content=_SYSTEM_FINAL.format(
            recommended=json.dumps(recommended[:3], ensure_ascii=False),
            recipe=json.dumps(recipe, ensure_ascii=False) if recipe else "none",
            nutrition=json.dumps(nutrition, ensure_ascii=False) if nutrition else "none",
            critic=json.dumps(critic, ensure_ascii=False) if critic else "none",
        )),
        HumanMessage(content=f"User asked: {state['user_input']}"),
    ]

    resp = _llm.invoke(messages)
    final = resp.content.strip()

    # Generate a short session summary for long-term memory
    summary_prompt = [
        SystemMessage(content="Summarise this kitchen session in 1-2 sentences (dish discussed, user preferences noted)."),
        HumanMessage(content=f"User asked: {state['user_input']}\nRecipe: {recipe.get('name', '') if recipe else 'none'}"),
    ]
    summary_resp = _llm.invoke(summary_prompt)
    summary = summary_resp.content.strip()
    
    return {
        **state,
        "final_response": final,
        "session_summary": summary,
        "next_agent": "END",
        "done": True,
        "messages": [AIMessage(content=final)],
    }
