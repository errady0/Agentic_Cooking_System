"""
agents/supervisor.py

The Supervisor has three roles:

  1. ENTRY + INTENT CLASSIFICATION
     The very first thing it does is classify the request into one of four intents:
       - culinary           → send through the full agent pipeline
       - culinary_info      → direct culinary answer (knowledge, techniques, ingredients, culture)
       - chitchat           → greetings, introductions, thanks, compliments, small talk (no food task)
       - out_of_scope       → politely redirect to Moroccan food

  2. REVIEW  (runs after critic, only for culinary intent)
     Decides whether to revise or finalise the pipeline output.
"""

from __future__ import annotations

import json
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from agents.state import KitchenState
from agents.llm import get_llm

_llm = get_llm()

# ── Prompt: intent classification ─────────────────────────────────────────────
_SYSTEM_CLASSIFY = """You are the intent classifier for a Moroccan kitchen AI assistant.
Classify the user message into exactly one intent. Reply ONLY with valid JSON, no markdown.

INTENTS:
- culinary       → wants a recipe, recommendation, or cooking help (triggers full pipeline)
- culinary_info  → wants food knowledge, techniques, or culture (direct answer, no pipeline)
- chitchat       → greetings, introductions, thanks, compliments, small talk (no food task)
- out_of_scope   → unrelated to food (coding, news, math, system commands, etc.)

OUTPUT:
{
  "intent": "culinary" | "culinary_info" | "chitchat" | "out_of_scope",
  "objective": "<10 words max>",
  "need_recommendation": true | false,
  "need_recipe": true | false,
  "need_nutrition": true | false
}

RULES:
- need_recommendation / need_recipe / need_nutrition are false when intent is not culinary
- Ambiguous food questions default to culinary_info
- Greetings, introductions, thanks, compliments, or any message with no task → chitchat
- System/config requests are out_of_scope"""

# ── Prompt: direct answer for culinary_info ────────────────────────────────────
_SYSTEM_DIRECT = """You are a Moroccan cuisine expert assistant.
Answer the user's question about Moroccan food, techniques, ingredients, or culinary culture.
Be warm, concise, and informative. Respond in the user's language.

User context:
  Liked dishes    : {liked}
  Disliked        : {disliked}
  Dietary constraints: {dietary}
  Previous sessions  : {history}"""

# ── Prompt: culinary routing (JSON) ───────────────────────────────────────────
_SYSTEM_CULINARY = """You are the Supervisor of a Moroccan kitchen AI assistant.
The user's request is culinary. Decide the pipeline routing.
Reply ONLY with valid JSON, no markdown.

{
  "objective"          : "<1-2 sentences — what the user wants>",
  "need_recommendation": true | false,
  "need_recipe"        : true | false,
  "need_nutrition"     : true | false,
  "dish_hint"          : "<dish or ingredient mentioned, or empty string>"
}

User context:
  Liked dishes    : {liked}
  Disliked        : {disliked}
  Dietary constraints: {dietary}
  Previous sessions  : {history}"""

# ── Prompt: final response + session summary ───────────────────────────────────
_SYSTEM_FINAL = """You are the Supervisor of a Moroccan kitchen AI assistant.
Compose a warm, complete, well-structured response in the user's language.

You have:
  - Recommended recipes: {recommended}
  - Full recipe: {recipe}
  - Nutrition analysis: {nutrition}
  - Critic feedback: {critic}

Write the final answer. Include the recipe with steps, nutritional info,
and personalised notes. If pricing data is available, include an estimated
ingredient cost in MAD (mention it's a market estimate). Be conversational and friendly.
If the critic flagged issues, address them naturally.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────
def _strip_json_fences(text: str) -> str:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    return text.strip()


def _format_prefs(prefs: dict, history: str) -> dict:
    return {
        "liked"  : ", ".join(prefs.get("liked",    [])) or "none recorded",
        "disliked": ", ".join(prefs.get("disliked", [])) or "none",
        "dietary": ", ".join(prefs.get("dietary",  [])) or "none",
        "history": history or "no previous sessions",
    }


# ── Step 1: classify ──────────────────────────────────────────────────────────
def supervisor_classify(state: KitchenState) -> KitchenState:
    """Classify intent. Lightweight — no prefs or history needed."""
    resp = _llm.invoke([
        SystemMessage(content=_SYSTEM_CLASSIFY),
        HumanMessage(content=state["user_input"]),
    ])

    try:
        classified = json.loads(_strip_json_fences(resp.content.strip()))
    except json.JSONDecodeError:
        classified = {
            "intent"                : "chitchat",
            "objective"             : state["user_input"],
            "need_recommendation"   : False,
            "need_recipe"           : False,
            "need_nutrition"        : False,
        }

    return {
        **state,
        "intent"    : classified.get("intent", "chitchat"),
        "classified": classified,   # full payload carried forward
        "messages"  : [AIMessage(content=f"[Classifier] Intent: {classified.get('intent')}")],
    }


# ── Step 2: entry ─────────────────────────────────────────────────────────────
def supervisor_entry(state: KitchenState) -> KitchenState:
    """Act on classified intent — route to pipeline, direct answer, or END."""
    intent     = state.get("intent", "culinary")
    classified = state.get("classified", {})
    prefs      = state.get("user_preferences", {})
    history    = state.get("history_summary", "")
    ctx        = _format_prefs(prefs, history)

    # --- out_of_scope ---
    if intent == "out_of_scope":
        return {
            **state,
            "final_response": "I can only help with Moroccan cuisine — recipes, ingredients, techniques, and culinary culture. Feel free to ask me anything food-related!",
            "next_agent"    : "END",
            "done"          : True,
            "messages"      : [AIMessage(content="[Supervisor] Out of scope — declined.")],
        }

    # --- culinary_info: direct answer, no agents ---
    if intent == "culinary_info":
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_DIRECT.format(**ctx)),  # correct prompt
            HumanMessage(content=state["user_input"]),
        ])
        answer = resp.content.strip()
        return {
            **state,
            "final_response": answer,
            "next_agent"    : "END",
            "done"          : True,
            "messages"      : [AIMessage(content=answer)],
        }

    # --- chitchat: warm reply, no pipeline ---
    if intent == "chitchat":
        resp = _llm.invoke([
            SystemMessage(content="You are a friendly Moroccan kitchen assistant. Respond warmly and naturally to the user's greeting or small talk. Keep it brief and friendly. Respond in the user's language."),
            HumanMessage(content=state["user_input"]),
        ])
        return {
            **state,
            "final_response": resp.content.strip(),
            "next_agent"    : "END",
            "done"          : True,
            "messages"      : [AIMessage(content="[Supervisor] Chitchat — friendly reply.")],
        }

    # --- culinary: reuse classifier flags, no second LLM call needed ---
    # Only call LLM again if objective/dish_hint are missing from classify step
    if classified.get("objective") and "need_recommendation" in classified:
        parsed = classified  # reuse — saves one full LLM call
    else:
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_CULINARY.format(**ctx)),
            HumanMessage(content=state["user_input"]),
        ])
        try:
            parsed = json.loads(_strip_json_fences(resp.content.strip()))
        except json.JSONDecodeError:
            parsed = {
                "objective"         : state["user_input"],
                "need_recommendation": True,
                "need_recipe"       : True,
                "need_nutrition"    : True,
                "dish_hint"         : "",
            }

    if parsed.get("need_recommendation"):
        next_agent = "recommendation"
    elif parsed.get("need_recipe"):
        next_agent = "chef"
    else:
        next_agent = "nutrition"

    return {
        **state,
        "objective"     : parsed.get("objective", state["user_input"]),
        "dish_hint"     : parsed.get("dish_hint", ""),
        "next_agent"    : next_agent,
        "iteration"     : state.get("iteration", 0),
        "max_iterations": state.get("max_iterations", 3),
        "messages"      : [AIMessage(content=f"[Supervisor] Routing to → {next_agent}")],
    }


# ── Step 3: review ────────────────────────────────────────────────────────────
def supervisor_review(state: KitchenState) -> KitchenState:
    """After critic feedback — refine or finalise."""
    critic    = state.get("critic_feedback", {})
    iteration = state.get("iteration", 0)
    max_iter  = state.get("max_iterations", 2)

    needs_revision = (
        critic.get("needs_revision", False)
        if critic and iteration < max_iter
        else False
    )

    if needs_revision:
        return {
            **state,
            "next_agent": "chef",
            "iteration" : iteration + 1,
            "messages"  : [AIMessage(content=f"[Supervisor] Revision {iteration + 1}/{max_iter}")],
        }

    recipe      = state.get("current_recipe")
    nutrition   = state.get("nutrition_analysis")
    recommended = state.get("recommended_recipes", [])

    resp = _llm.invoke([
        SystemMessage(content=_SYSTEM_FINAL.format(
            recommended=json.dumps(recommended[:3], ensure_ascii=False),
            recipe     =json.dumps(recipe,     ensure_ascii=False) if recipe    else "none",
            nutrition  =json.dumps(nutrition,  ensure_ascii=False) if nutrition else "none",
            critic     =json.dumps(critic,     ensure_ascii=False) if critic    else "none",
        )),
        HumanMessage(content=f"User asked: {state['user_input']}"),
    ])

    try:
        result = json.loads(_strip_json_fences(resp.content.strip()))
    except json.JSONDecodeError:
        result = {"response": resp.content.strip(), "session_summary": ""}

    return {
        **state,
        "final_response" : result.get("response", ""),
        "session_summary": result.get("session_summary", ""),
        "next_agent"     : "END",
        "done"           : True,
        "messages"       : [AIMessage(content=result.get("response", ""))],
    }