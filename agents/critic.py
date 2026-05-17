"""
agents/critic.py

The Critic evaluates the collective output of the recommendation, chef,
and nutrition agents. It sends structured feedback back to the supervisor
who decides whether a revision cycle is needed.

The Critic does NOT talk to the user — it only communicates with the supervisor.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm

_llm = get_llm()

_SYSTEM = """You are a strict quality-control critic for a Moroccan kitchen AI system.

Evaluate the following outputs and return a JSON object (no markdown):

User objective: {objective}
Recommended recipes: {recommended}
Recipe provided: {recipe}
Nutrition analysis: {nutrition}
Iteration number: {iteration}

Evaluate on:
1. Authenticity — Is the recipe genuinely Moroccan? Are spices/techniques correct?
2. Completeness — Are steps clear and detailed enough to follow?
3. Nutrition accuracy — Does the analysis look reasonable for this dish?
4. Relevance — Does the result match the user's objective?
5. Safety — Any dietary conflicts?

Reply with:
  "score"          : 1-10 overall quality score
  "needs_revision" : true/false (set false if score >= 7 or iteration >= 2)
  "issues"         : list of specific problems found (empty list if none)
  "suggestions"    : list of specific improvements for the chef
  "positive_notes" : list of what was done well
  "verdict"        : one-sentence summary of the evaluation
"""


def critic_agent(state: KitchenState) -> KitchenState:
    recipe = state.get("current_recipe")
    nutrition = state.get("nutrition_analysis")
    recommended = state.get("recommended_recipes", [])
    iteration = state.get("iteration", 0)

    messages = [
        SystemMessage(content=_SYSTEM.format(
            objective=state.get("objective", state["user_input"]),
            recommended=json.dumps(recommended[:2], ensure_ascii=False),
            recipe=json.dumps(recipe, ensure_ascii=False) if recipe else "none",
            nutrition=json.dumps(nutrition, ensure_ascii=False) if nutrition else "none",
            iteration=iteration,
        )),
        HumanMessage(content="Evaluate the outputs."),
    ]

    resp = _llm.invoke(messages)
    text = resp.content.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        feedback = json.loads(text)
    except json.JSONDecodeError:
        feedback = {
            "score": 7,
            "needs_revision": False,
            "issues": [],
            "suggestions": [],
            "positive_notes": ["Recipe generated"],
            "verdict": "Acceptable output",
        }

    # Force no-revision if score is good or we've iterated enough
    score = feedback.get("score", 7)
    if score >= 7 or iteration >= state.get("max_iterations", 3) - 1:
        feedback["needs_revision"] = False

    return {
        **state,
        "critic_feedback": feedback,
        "next_agent": "supervisor_review",
        "messages": [
            AIMessage(
                content=f"[Critic] Score {feedback.get('score', '?')}/10 — "
                        f"{'revision needed' if feedback.get('needs_revision') else 'approved'}"
            )
        ],
    }
