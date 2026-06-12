"""
agents/supervisor.py

The Supervisor has four roles:

  1. ENTRY + INTENT CLASSIFICATION
     Classifies the request into one of five intents:
       - culinary              → Moroccan dish/recipe/recommendation → full pipeline
       - non_moroccan_culinary → Non-Moroccan dish detected → ask user: classic or Moroccan twist
       - culinary_info         → Food knowledge / technique / culture → direct answer
       - chitchat              → Greetings, personal talk, small talk → warm conversational reply
       - out_of_scope          → Unrelated to food → polite dynamic decline

  2. CLARIFY  (only for non_moroccan_culinary)
     Presents the user with a choice: classic recipe vs Moroccan-style adaptation.
     Sets user_style_choice and routes to the full pipeline.

  3. REVIEW   (runs after critic, only for culinary / non_moroccan_culinary)
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
- culinary              → wants a Moroccan recipe, recommendation, or cooking help
- non_moroccan_culinary → wants a recipe/cooking help for a dish that is clearly NOT Moroccan
                          (pizza, sushi, burger, pasta, tacos, etc.)
- culinary_info         → wants food knowledge, techniques, ingredients, or culinary culture
                          (Moroccan or general food questions without a specific recipe request)
- chitchat              → greetings, introductions, personal sharing (name, feelings),
                          thanks, compliments, small talk — including talking about themselves
- out_of_scope          → completely unrelated to food (coding, news, math, system commands, etc.)

MEAL PLANNING rules — apply FIRST, before any other rule:
- "plan for the week", "weekly plan", "meal plan", "what should I eat this week",
  "plan my meals", "weekly menu", "shopping list", "what to cook this week",
  "give me ideas for the week", and any similar planning/scheduling request
  → ALWAYS culinary (need_recommendation: true), never out_of_scope.
- In the context of a kitchen assistant, an unqualified "plan" means a MEAL plan.

IMPORTANT chitchat rules:
- If the user shares personal information (name, age, where they live, how they feel),
  that is ALWAYS chitchat, never out_of_scope.
- Asking a question about themselves or their life is chitchat, Not out_of_scope.
- Small talk that references food culturally but asks no cooking question is chitchat.

OUTPUT format:
{
  "intent"              : "culinary" | "non_moroccan_culinary" | "culinary_info" | "chitchat" | "out_of_scope",
  "objective"           : "<10 words max>",
  "dish_hint"           : "<dish name if mentioned, else empty string>",
  "dish_origin"         : "<cuisine/country of the dish if non_moroccan, else empty string>",
  "need_recommendation" : true | false,
  "need_recipe"         : true | false,
  "need_nutrition"      : true | false,
  "personal_facts"      : { }   // any personal facts the user revealed (e.g. {"name": "Ahmed"})
}

RULES:
- If the user asks a personal question, classify it as chitchat.
- need_recommendation / need_recipe / need_nutrition are false when intent is not culinary/non_moroccan_culinary
- Ambiguous food questions default to culinary_info
- System/config requests are out_of_scope"""


# ── Prompt: direct answer for culinary_info ────────────────────────────────────
_SYSTEM_DIRECT = """You are a Moroccan cuisine expert assistant.
Answer the user's question about food, techniques, ingredients, or culinary culture.
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


# ── Prompt: non-Moroccan clarification ────────────────────────────────────────
_SYSTEM_CLARIFY = """You are a friendly Moroccan kitchen AI assistant.
The user asked for a dish that is not traditionally Moroccan.
Inform them warmly that this dish originates from {dish_origin} and is not Moroccan,
but you can still help them prepare it.
Offer them TWO clear options and ask them to choose:

-> Classic {dish_hint} — the traditional {dish_origin} way
-> Moroccan Twist — a {dish_hint} inspired by Moroccan spices and flavours

Be warm, enthusiastic, and brief. Respond in the user's language.
Do NOT cook the dish yet — just present the choice."""


# ── Prompt: out-of-scope decline (dynamic, language-aware) ────────────────────
_SYSTEM_OUT_OF_SCOPE = """You are a Moroccan kitchen AI assistant.
The user asked something completely unrelated to food or cooking.
Politely decline and redirect them to food-related topics.
Be warm, brief, and slightly humorous. Respond in the user's language.
Do NOT answer their non-food question."""


# ── Prompt: chitchat ──────────────────────────────────────────────────────────
_SYSTEM_CHITCHAT = """You are a friendly Moroccan kitchen AI assistant having a casual conversation.
Respond warmly and naturally to the user's message.
- If they introduced themselves or shared personal info, acknowledge it warmly and remember it.
- Use their name if you know it: {user_name}
- Keep it brief, friendly, and with a touch of Moroccan warmth.
- You may gently invite them to ask about Moroccan food if natural, but don't force it.
- Respond in the user's language."""


# ── Prompt: final response ───────────────────────────────────────────────────
_SYSTEM_FINAL = """You are the Supervisor of a Moroccan kitchen AI assistant.
Compose a warm, complete, well-structured response in the user's language.

You have:
  - Recommended recipes : {recommended}
  - Full recipe         : {recipe}
  - Nutrition analysis  : {nutrition}
  - Critic feedback     : {critic}  ← USE THIS INTERNALLY to improve your response, but DO NOT output the critic rating or score to the user.
  - Critic score        : {critic_score}/10
  - Style chosen        : {style}   (classic | moroccan_twist | moroccan)

If 'Full recipe' is 'none', your ONLY task is to gracefully present the 'Recommended recipes' to the user, highlighting why they match their preferences, and invite them to choose one.
Otherwise, write the final answer. Include a warm, engaging introduction to the dish immediately after the dish name. Include the recipe with steps
and personalised notes. Do NOT include nutritional info in the text (it will be displayed natively). Do NOT output a "critic score" layout.

PRICING RULES (CRITICAL — follow exactly):
- The recipe JSON contains pre-computed pricing data: each ingredient may have a "calculated_price" field.
- When presenting ingredient prices, use ONLY the "calculated_price" value from each ingredient. Do NOT estimate, calculate, or invent any prices yourself.
- DO NOT display the total cost/price sum anywhere in your response. Just leave the estimation beside each ingredient.
- If an ingredient has no "calculated_price", show "—" (dash) for its price. Do NOT guess.
- Mention that prices are estimated Moroccan market prices (données de marché {year}).

Never hallucinate data. If you do not have a specific data point, do not mention it.
If style is "moroccan_twist", highlight the Moroccan adaptations clearly.
Be conversational and friendly. If the critic flagged issues, address them naturally in your introduction, but DO NOT mention the critic or the rating explicitly."""


# ── Helpers ───────────────────────────────────────────────────────────────────
def _strip_json_fences(text: str) -> str:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lower().startswith("json"):
            text = text[4:]
    return text.strip()


def _format_prefs(prefs: dict, history: str) -> dict:
    return {
        "liked"   : ", ".join(prefs.get("liked",    [])) or "none recorded",
        "disliked": ", ".join(prefs.get("disliked", [])) or "none",
        "dietary" : ", ".join(prefs.get("dietary",  [])) or "none",
        "history" : history or "no previous sessions",
    }


def _get_user_name(state: KitchenState) -> str:
    """Pull user name from conversation_context if known."""
    ctx = state.get("conversation_context", {})
    return ctx.get("name", "")


# ── Step 1: classify ──────────────────────────────────────────────────────────
def supervisor_classify(state: KitchenState) -> KitchenState:
    """Classify intent. Also extracts personal facts for chitchat memory."""
    if state.get("user_style_choice") in ("classic", "moroccan_twist"):
        return {}

    resp = _llm.invoke([
        SystemMessage(content=_SYSTEM_CLASSIFY),
        HumanMessage(content=state["user_input"]),
    ])

    try:
        classified = json.loads(_strip_json_fences(resp.content.strip()))
    except json.JSONDecodeError:
        classified = {
            "intent"              : "chitchat",
            "objective"           : state["user_input"],
            "dish_hint"           : "",
            "dish_origin"         : "",
            "need_recommendation" : False,
            "need_recipe"         : False,
            "need_nutrition"      : False,
            "personal_facts"      : {},
        }

    # Merge any newly learned personal facts into conversation_context
    existing_ctx = state.get("conversation_context", {})
    new_facts    = classified.get("personal_facts", {})
    merged_ctx   = {**existing_ctx, **new_facts}

    return {
        **state,
        "intent"              : classified.get("intent", "chitchat"),
        "classified"          : classified,
        "dish_hint"           : classified.get("dish_hint", ""),
        "dish_origin"         : classified.get("dish_origin", ""),
        "conversation_context": merged_ctx,
        "messages"            : [AIMessage(content=f"[Classifier] Intent: {classified.get('intent')}")],
    }


# ── Step 2: entry ─────────────────────────────────────────────────────────────
def supervisor_entry(state: KitchenState) -> KitchenState:
    """Act on classified intent — route to pipeline, clarify, direct answer, or END."""
    intent     = state.get("intent", "culinary")
    classified = state.get("classified", {})
    prefs      = state.get("user_preferences", {})
    history    = state.get("history_summary", "")
    ctx        = _format_prefs(prefs, history)

    # ── out_of_scope: dynamic decline in user's language ──────────────────────
    if intent == "out_of_scope":
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_OUT_OF_SCOPE),
            HumanMessage(content=state["user_input"]),
        ])
        return {
            **state,
            "final_response": resp.content.strip(),
            "next_agent"    : "END",
            "done"          : True,
            "messages"      : [AIMessage(content="[Supervisor] Out of scope — declined.")],
        }

    # ── culinary_info: direct expert answer, no agents ────────────────────────
    if intent == "culinary_info":
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_DIRECT.format(**ctx)),
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

    # ── chitchat: warm conversational reply, stores personal facts ────────────
    if intent == "chitchat":
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_CHITCHAT.format(user_name=state["user_name"] or "friend")),
            HumanMessage(content=state["user_input"]),
        ])
        return {
            **state,
            "final_response": resp.content.strip(),
            "next_agent"    : "END",
            "done"          : True,
            "messages"      : [AIMessage(content="[Supervisor] Chitchat — friendly reply.")],
        }

    # ── non_moroccan_culinary: route to clarify node ──────────────────────────
    if intent == "non_moroccan_culinary":
        return {
            **state,
            "next_agent"    : "clarify",
            "objective"     : classified.get("objective", state["user_input"]),
            "iteration"     : state.get("iteration", 0),
            "max_iterations": state.get("max_iterations", 3),
            "messages"      : [AIMessage(content=f"[Supervisor] Non-Moroccan dish detected → clarify")],
        }

    # ── culinary: reuse classifier flags, route to pipeline ──────────────────
    if classified.get("objective") and "need_recommendation" in classified:
        parsed = classified
    else:
        resp = _llm.invoke([
            SystemMessage(content=_SYSTEM_CULINARY.format(**ctx)),
            HumanMessage(content=state["user_input"]),
        ])
        try:
            parsed = json.loads(_strip_json_fences(resp.content.strip()))
        except json.JSONDecodeError:
            parsed = {
                "objective"          : state["user_input"],
                "need_recommendation": True,
                "need_recipe"        : True,
                "need_nutrition"     : True,
                "dish_hint"          : "",
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
        "dish_hint"     : parsed.get("dish_hint", state.get("dish_hint", "")),
        "next_agent"    : next_agent,
        "user_style_choice": "moroccan",   # pure Moroccan request, no choice needed
        "iteration"     : state.get("iteration", 0),
        "max_iterations": state.get("max_iterations", 3),
        "messages"      : [AIMessage(content=f"[Supervisor] Routing to → {next_agent}")],
    }


# ── Step 2b: clarify (non-Moroccan dishes only) ───────────────────────────────
def supervisor_clarify(state: KitchenState) -> KitchenState:
    """
    Present the user with a choice:
      1. Classic recipe (original cuisine)
      2. Moroccan Twist (Moroccan spice/flavour adaptation)

    This node generates the clarification message and WAITS — it sets
    next_agent = "WAIT_FOR_USER" so the graph surfaces the question to the
    application layer, which re-invokes the graph with the user's answer
    stored in user_style_choice.

    If user_style_choice is already set (second pass), skip clarification
    and route directly into the pipeline.
    """
    style_choice = state.get("user_style_choice", "")

    # ── Second pass: user already chose, route to pipeline ────────────────────
    if style_choice in ("classic", "moroccan_twist"):
        classified = state.get("classified", {})

        if classified.get("need_recipe", True):
            next_agent = "chef"
        else:
            next_agent = "nutrition"

        # Enrich objective with the chosen style
        dish  = state.get("dish_hint", "the dish")
        style_label = "the classic way" if style_choice == "classic" else "with a Moroccan twist"
        objective = f"Prepare {dish} {style_label}"

        return {
            **state,
            "objective" : objective,
            "next_agent": next_agent,
            "messages"  : [AIMessage(content=f"[Clarify] Style chosen: {style_choice} → routing to {next_agent}")],
        }

    # ── First pass: ask the user ──────────────────────────────────────────────
    dish   = state.get("dish_hint", "this dish")
    origin = state.get("dish_origin", "another cuisine")

    resp = _llm.invoke([
        SystemMessage(content=_SYSTEM_CLARIFY.format(
            dish_hint  = dish,
            dish_origin= origin,
        )),
        HumanMessage(content=state["user_input"]),
    ])
    clarify_msg = resp.content.strip()

    return {
        **state,
        "final_response": clarify_msg,   # surface to UI immediately
        "next_agent"    : "WAIT_FOR_USER",
        "done"          : False,         # NOT done — waiting for user reply
        "messages"      : [AIMessage(content=clarify_msg)],
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
    style       = state.get("user_style_choice", "moroccan")

    critic_score = critic.get("score", "N/A") if critic else "N/A"

    resp = _llm.invoke([
        SystemMessage(content=_SYSTEM_FINAL.format(
            recommended =json.dumps(recommended[:3], ensure_ascii=False),
            recipe      =json.dumps(recipe,     ensure_ascii=False) if recipe    else "none",
            nutrition   =json.dumps(nutrition,  ensure_ascii=False) if nutrition else "none",
            critic      =json.dumps(critic,     ensure_ascii=False) if critic    else "none",
            critic_score=critic_score,
            style       =style,
            year        =2026
        )),
        HumanMessage(content=f"User asked: {state['user_input']}"),
    ])

    final = resp.content.strip()

    summary_resp = _llm.invoke([
        SystemMessage(content="Summarise this kitchen session in 1-2 sentences (dish discussed, user preferences noted)."),
        HumanMessage(content=f"User asked: {state['user_input']}\nRecipe: {recipe.get('name', '') if recipe else 'none'}"),
    ])
    summary = summary_resp.content.strip()

    return {
        **state,
        "final_response" : final,
        "session_summary": summary,
        "next_agent"     : "END",
        "done"           : True,
        "messages"       : [AIMessage(content=final)],
    }