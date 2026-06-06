"""
agents/critic.py

The Critic evaluates the chef's recipe output and sends structured feedback
to the supervisor who decides whether a revision cycle is needed.

The Critic does NOT talk to the user — it only communicates with the supervisor.

Evaluation criteria adapt based on recipe style:
  - "moroccan"       → full authenticity check (spices, technique, culture)
  - "moroccan_twist" → check fusion coherence, skip pure-Moroccan authenticity
  - "classic"        → skip all Moroccan criteria entirely; judge on faithfulness
                       to the dish's original cuisine
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm

_llm = get_llm()


# ── Evaluation prompts — one per style ────────────────────────────────────────

_SYSTEM_MOROCCAN = """You are a strict quality-control critic for a Moroccan kitchen AI.

User objective   : {objective}
Recipe provided  : {recipe}
Nutrition analysis: {nutrition}
Iteration        : {iteration}

Evaluate on these criteria:
1. Moroccan authenticity — Are spices, techniques, and ingredients genuinely Moroccan?
   (ras el hanout, chermoula, preserved lemon, proper tagine technique, etc.)
2. Completeness — Are steps clear and detailed enough to follow at home?
3. Nutrition accuracy — Does the nutritional analysis look reasonable for this dish?
4. Relevance — Does the result match the user's objective?
5. Safety — Any dietary conflicts with stated constraints?

Reply with a JSON object (no markdown):
  "score"          : 1-10 overall quality score
  "needs_revision" : true | false  (false if score >= 7 or iteration >= 2)
  "issues"         : list of specific problems (empty list if none)
  "suggestions"    : list of specific improvements for the chef
  "positive_notes" : list of what was done well
  "verdict"        : one-sentence summary
"""

_SYSTEM_MOROCCAN_TWIST = """You are a quality-control critic for a Moroccan fusion kitchen AI.

User objective   : {objective}
Recipe provided  : {recipe}
Nutrition analysis: {nutrition}
Iteration        : {iteration}

The user chose a "Moroccan Twist" — the dish should keep its original structure
but incorporate genuine Moroccan flavours and spices.

Evaluate on these criteria:
1. Fusion coherence — Do the Moroccan spices/ingredients complement the dish naturally,
   or do they clash? Is the result a believable fusion?
2. Moroccan identity — Are the Moroccan adaptations clearly listed and genuinely Moroccan
   (ras el hanout, harissa, preserved lemon, chermoula, argan oil, etc.)?
3. Original dish integrity — Is the base dish still recognisable?
4. Completeness — Are steps clear and detailed enough to follow at home?
5. Safety — Any dietary conflicts?

Do NOT penalise the recipe for not being a "pure" Moroccan dish —
that is intentional. Only flag issues with the fusion quality itself.

Reply with a JSON object (no markdown):
  "score"          : 1-10 overall quality score
  "needs_revision" : true | false  (false if score >= 7 or iteration >= 2)
  "issues"         : list of specific problems (empty list if none)
  "suggestions"    : list of specific improvements for the chef
  "positive_notes" : list of what was done well
  "verdict"        : one-sentence summary
"""

_SYSTEM_CLASSIC = """You are a quality-control critic for a culinary AI assistant.

User objective   : {objective}
Recipe provided  : {recipe}
Nutrition analysis: {nutrition}
Origin cuisine   : {origin}
Iteration        : {iteration}

The user chose the CLASSIC version of this dish — it should be a faithful,
authentic recipe from its original cuisine ({origin}).

Evaluate on these criteria:
1. Faithfulness — Is the recipe true to the dish's original {origin} tradition?
   Are the correct spices, techniques, and ingredients used?
2. Completeness — Are steps clear and detailed enough to follow at home?
3. Correctness — No unwanted Moroccan ingredients or techniques crept in?
4. Safety — Any dietary conflicts?

Do NOT evaluate Moroccan authenticity at all — it is irrelevant here.

Reply with a JSON object (no markdown):
  "score"          : 1-10 overall quality score
  "needs_revision" : true | false  (false if score >= 7 or iteration >= 2)
  "issues"         : list of specific problems (empty list if none)
  "suggestions"    : list of specific improvements for the chef
  "positive_notes" : list of what was done well
  "verdict"        : one-sentence summary
"""


# ── Main agent ────────────────────────────────────────────────────────────────

def critic_agent(state: KitchenState) -> KitchenState:
    recipe    = state.get("current_recipe") or {}
    nutrition = state.get("nutrition_analysis")
    iteration = state.get("iteration", 0)

    # Style comes from the recipe itself (most reliable) with state as fallback
    style  = recipe.get("style") or state.get("user_style_choice") or "moroccan"
    origin = recipe.get("origin") or state.get("dish_origin") or "international"

    shared = dict(
        objective  = state.get("objective", state["user_input"]),
        recipe     = json.dumps(recipe,     ensure_ascii=False) if recipe    else "none",
        nutrition  = json.dumps(nutrition,  ensure_ascii=False) if nutrition else "none",
        iteration  = iteration,
    )

    if style == "classic":
        prompt = _SYSTEM_CLASSIC.format(**shared, origin=origin)
    elif style == "moroccan_twist":
        prompt = _SYSTEM_MOROCCAN_TWIST.format(**shared)
    else:
        prompt = _SYSTEM_MOROCCAN.format(**shared)

    resp = _llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Evaluate the recipe output."),
    ])
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
            "score"         : 7,
            "needs_revision": False,
            "issues"        : [],
            "suggestions"   : [],
            "positive_notes": ["Recipe generated"],
            "verdict"       : "Acceptable output",
        }

    # Hard guard: never force revision if score is good or iterations exhausted
    score = feedback.get("score", 7)
    if score >= 7 or iteration >= state.get("max_iterations", 3) - 1:
        feedback["needs_revision"] = False

    return {
        **state,
        "critic_feedback": feedback,
        "next_agent"     : "supervisor_review",
        "messages"       : [AIMessage(
            content=(
                f"[Critic/{style}] Score {feedback.get('score', '?')}/10 — "
                f"{'revision needed' if feedback.get('needs_revision') else 'approved'}"
            )
        )],
    }