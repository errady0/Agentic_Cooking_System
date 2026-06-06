# 🫕 Moroccan Kitchen AI — Multi-Agent System

A production-quality multi-agent AI system for Moroccan cuisine, built with **LangGraph** and **LangChain**. Available as both a **rich terminal application** and a full **FastAPI + React web app** with authentication, session management, and long-term user memory.

---

## Features

- 🧑‍🍳 **Multi-agent pipeline** — Supervisor → Recommendation → Chef → Nutrition → Critic, with a revision loop
- 🌍 **World Kitchen mode** — non-Moroccan dishes handled with a "Classic vs Moroccan Twist" style choice
- 🧠 **Long-term memory** — per-user preferences (liked dishes, dietary constraints) and session history, persisted in SQLite or PostgreSQL
- 🔄 **Revision loop** — the Critic scores each recipe 1–10; the Supervisor can send the Chef back for up to N revisions
- 💰 **Ingredient pricing** — live Moroccan market prices via Tavily web search, falling back to a curated local price table
- 🥗 **Nutrition analysis** — calorie/macro breakdown per serving from a local database of 100+ Moroccan dishes
- 🌐 **Web search** — Tavily-powered recipe research used by the Chef agent
- 🖥️ **Dual interface** — identical logic powers both the terminal CLI and the web chat app

---

## Architecture

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  supervisor_classify  — Intent classification                   │
│    → culinary_info    — direct expert answer              → END │
│    → chitchat         — warm conversational reply         → END │
│    → out_of_scope     — polite decline                    → END │
│    → non_moroccan_culinary → supervisor_clarify                 │
│    → culinary              → pipeline                          │
└─────────────────────────────────────────────────────────────────┘
    │ culinary / non_moroccan_culinary (after style choice)
    ▼
 [recommendation]  ← optional, when need_recommendation=true
    │
    ▼
  [chef]           ← generates full recipe (Moroccan / Classic / Moroccan Twist)
    │
    ▼
 [nutrition]       ← macros per serving, health notes, dietary flags
    │
    ▼
  [critic]         ← quality score 1-10, revision decision
    │
    ▼
[supervisor_review] ──→ [chef] (revision loop, max 3 iterations)
    │
    ▼
 Final Response → User
```

### Agents

| Agent | File | Role |
|---|---|---|
| **Supervisor** | `agents/supervisor.py` | Intent classification, pipeline routing, non-Moroccan clarification, final response composition |
| **Recommendation** | `agents/recommendation.py` | Suggests 2–3 personalised Moroccan recipes using preferences + Tavily web search |
| **Chef** | `agents/chef.py` | Generates a full recipe (ingredients, steps, tips, cultural note, pairing) + ingredient price lookup |
| **Nutrition** | `agents/nutrition.py` | Analyses macros (calories, carbs, protein, fat, fibre, sugar) and flags dietary conflicts |
| **Critic** | `agents/critic.py` | Scores the recipe 1–10 with style-aware criteria; requests revision if score < 7 |

### Intent Types

| Intent | Description | Route |
|---|---|---|
| `culinary` | Moroccan recipe / recommendation request | Full pipeline |
| `non_moroccan_culinary` | Non-Moroccan dish detected | Clarify → Classic or Moroccan Twist → Full pipeline |
| `culinary_info` | Food knowledge, technique, culture | Direct LLM answer |
| `chitchat` | Greetings, personal info, small talk | Warm conversational reply |
| `out_of_scope` | Completely unrelated to food | Polite decline |

### Memory Layers

| Layer | Technology | What it stores |
|---|---|---|
| Short-term (session) | LangGraph `MemorySaver` checkpointer | Full message history within a session; enables the revision loop |
| Long-term (persistent) | SQLite (default) / PostgreSQL | Liked dishes, disliked dishes, dietary constraints, flavor notes, session summaries |

### Tools

| Tool | Source | Fallback |
|---|---|---|
| `web_search` | Tavily API | Stub response (graceful — search simply disabled) |
| `web_scrape` | BeautifulSoup (requests) | Error string returned; agent continues without web ref |
| `nutrition_lookup` | Local DB (`memory/nutrition_base.py`, 100+ dishes) | Empty dict → LLM generates estimates |
| `get_ingredient_prices` | Tavily live search → regex price extraction | Local curated price table (`memory/price_base.py`) |

---

## Project Structure

```
Cooking_System/
│
├── main.py                  # Terminal app entry point (Rich CLI)
├── orchestrator.py          # Session manager — bridges graph ↔ memory ↔ UI layer
├── graph.py                 # LangGraph StateGraph (nodes, edges, routing functions)
│
├── agents/
│   ├── state.py             # KitchenState TypedDict (shared by all agents)
│   ├── llm.py               # LLM factory (Groq / Anthropic / OpenAI)
│   ├── supervisor.py        # classify → entry → clarify → review passes
│   ├── recommendation.py    # Recipe recommendation agent
│   ├── chef.py              # Recipe generation agent (Moroccan / Classic / Twist)
│   ├── nutrition.py         # Nutritional analysis agent
│   └── critic.py            # Quality evaluation agent (style-aware)
│
├── memory/
│   ├── long_term.py         # SQLite/PostgreSQL user memory (preferences + history)
│   ├── nutrition_base.py    # Local nutrition table (100+ Moroccan dishes)
│   └── price_base.py        # Local ingredient price table (MAD)
│
├── tools/
│   └── kitchen_tools.py     # web_search, web_scrape, nutrition_lookup, get_ingredient_prices
│
├── config/
│   └── settings.py          # Typed env-var config (Pydantic Settings)
│
├── backend/
│   └── app.py               # FastAPI app — auth, chat, preferences REST API
│
├── frontend/
│   └── src/
│       ├── KitchenApp.jsx   # React single-page app (auth, chat, recipe card, nutrition pills)
│       ├── index.css        # Base CSS reset
│       └── main.jsx         # React entry point
│
├── requirements.txt         # Python dependencies
└── .env                     # Environment variables (copy from .env.example)
```

---

## Setup

### 1. Clone and create the virtual environment

```bash
git clone <repo-url> Cooking_System
cd Cooking_System

python -m venv venv
source venv/bin/activate          # Linux / macOS
# .\venv\Scripts\activate.bat     # Windows cmd
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ── LLM — provide at least one ────────────────────────
GROQ_API_KEY=gsk_...          # Recommended (fast, free tier)
ANTHROPIC_API_KEY=sk-ant-...  # Optional
OPENAI_API_KEY=sk-...         # Optional

# ── Optional tools ─────────────────────────────────────
TAVILY_API_KEY=tvly-...       # Enables web search + live ingredient prices

# ── Database ───────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/db   # Optional — defaults to SQLite
USE_SQLITE_FALLBACK=true                       # Set false to require Postgres

# ── Debug ──────────────────────────────────────────────
DEBUG=false
```

### 4a. Run the terminal app

```bash
python main.py                    # interactive session as "Guest"
python main.py --user-id <user_id>    # named user (persists preferences across sessions)
python main.py --debug            # verbose agent traces (scores, summaries, intent)
```

### 4b. Run the web app

**Backend (FastAPI):**
```bash
uvicorn backend.app:app --reload --port 8000
```

**Frontend (React + Vite):**
```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:5173
```

The React app proxies API calls to `http://localhost:8000`. Both must be running simultaneously.

---

## Terminal Commands

Once inside the terminal chat, the following slash commands are available:

| Command | Effect |
|---|---|
| `/preferences` or `/pr` | Show your stored preferences (liked, disliked, dietary, notes) |
| `/history` | Show session summaries from previous sessions |
| `/like <dish>` | Mark a dish as liked (e.g. `/like Chicken Tagine`) |
| `/dislike <dish>` | Mark a dish as disliked (e.g. `/dislike Tripe`) |
| `/diet <flag>` | Add a dietary constraint (e.g. `/diet vegetarian`) |
| `/reset` | Clear all preferences |
| `/clear` | Clear conversation history |
| `/help` | Show the command reference |
| `exit` / `quit` | Exit the app |

---

## Web API Reference

The FastAPI backend exposes the following REST endpoints (all JSON):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user `{username, password}` → `{user_id, username}` |
| `POST` | `/api/auth/login` | Login `{username, password}` → `{user_id, username}` |
| `POST` | `/api/chat` | Send a message `{user_id, session_id, message}` → full pipeline result |
| `GET` | `/api/preferences/{user_id}` | Fetch stored preferences |
| `POST` | `/api/preferences` | Update preferences `{user_id, liked, disliked, dietary, flavor_notes}` |

### Chat response shape

```json
{
  "final_response":      "string — the assistant's full markdown response",
  "recipe":              { "name", "style", "servings", "ingredients", "steps", "tips", "cultural_note", "pairing", "total_price" },
  "recommended_recipes": [{ "name", "description", "why", "difficulty", "time_minutes", "region" }],
  "nutrition":           { "per_serving": { "calories", "carbs_g", "protein_g", "fat_g", "fibre_g", "sugar_g" }, "mediterranean_score", "health_notes", "dietary_flags" },
  "critic_score":        8,
  "session_summary":     "string",
  "intent":              "culinary | culinary_info | chitchat | out_of_scope | non_moroccan_culinary",
  "waiting":             false,
  "style_choice":        "moroccan | classic | moroccan_twist",
  "iteration_count":     0
}
```

When `waiting: true`, the assistant is asking the user to choose between Classic and Moroccan Twist. The frontend renders choice buttons; the user's reply is sent as the next `/api/chat` message and the pipeline resumes automatically.

---

## Web App Features

The React frontend (`frontend/src/KitchenApp.jsx`) includes:

- **Authentication** — register / login with hashed passwords, session-scoped chat
- **Multi-session sidebar** — create, switch, and delete chat sessions
- **Glassmorphism dark UI** — warm Moroccan amber palette, DM Serif Display + Outfit fonts
- **Markdown rendering** — full GFM support (tables, lists, code, blockquotes)
- **Recipe card** (collapsible) — cultural note, Moroccan adaptations, ingredients with live MAD prices, total estimated cost, numbered cooking steps with timers, chef tips, suggested pairing
- **Nutrition pill badges** — calories, carbs, protein, fat, fibre, Mediterranean diet score
- **Quality score badge** — critic score (1–10) with colour coding (green ≥ 7, amber 5–6, red < 5)
- **Suggested recipe chips** — clickable recommendation cards
- **Style choice buttons** — Classic vs Moroccan Twist inline in the chat bubble
- **Dietary profile panel** — toggle dietary tags, set liked/disliked dishes and flavor notes

---

## API Keys

| Service | Free Tier | Link |
|---|---|---|
| **Groq** | Generous free tier (recommended for speed) | https://groq.com |
| **Anthropic** | Pay-per-use (Claude Sonnet/Haiku) | https://console.anthropic.com |
| **OpenAI** | Pay-per-use (GPT-4o / GPT-4o-mini) | https://platform.openai.com |
| **Tavily** | 1,000 requests / month free | https://app.tavily.com |

The system works without Tavily — web search and live prices are simply disabled. The system works without PostgreSQL — it falls back to a local `cma.db` SQLite file automatically.

---

## Dependencies

**Python (backend + agents):**
```
langgraph>=1.2.0
langchain>=1.3.0
langchain-anthropic>=1.4.0
langchain-openai>=0.1.0
langchain_groq>=1.1.2
langchain-community>=0.4.0
beautifulsoup4>=4.12
requests>=2.31
python-dotenv>=1.0
rich>=13.0
tavily-python>=0.3
fastapi>=0.136.3
uvicorn>=0.48.0
bcrypt>=5.0.0
psycopg2-binary>=2.9   # optional — only needed for PostgreSQL
```

**JavaScript (frontend):**
```
react, react-dom
react-markdown, remark-gfm
vite
```

---

## How the Non-Moroccan Flow Works

When the user asks for a non-Moroccan dish (pizza, sushi, tacos…):

1. **Pass 1** — The graph detects `non_moroccan_culinary` intent, `supervisor_clarify` generates a friendly question offering Classic vs Moroccan Twist. The graph pauses (`WAIT_FOR_USER`).
2. **User replies** — "Classic" / "1" / "Moroccan twist" / "2" (or any language variant including French and Arabic). The orchestrator normalises this to `"classic"` or `"moroccan_twist"`.
3. **Pass 2** — The graph resumes, the Chef receives the `user_style_choice` and picks the appropriate recipe style and system prompt. The Critic and Supervisor also adapt their evaluation criteria accordingly.

---

## How the Revision Loop Works

After the Chef produces a recipe:

```
Chef → Nutrition → Critic
                     │
              score < 7 AND iteration < max_iterations?
                     │ yes                      │ no
                     ▼                          ▼
                  Chef (revision)        supervisor_review
                     │                  (composes final response)
                   (loop)
```

The Critic feeds `issues` and `suggestions` back to the Chef's system prompt on the next pass. Default `max_iterations = 3`. The Critic hard-caps `needs_revision = False` once `score ≥ 7` or the iteration limit is reached.
