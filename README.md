# 🫕 Moroccan Kitchen AI — Multi-Agent System

A production-quality multi-agent AI system for Moroccan kitchen, built with **LangGraph**, **LangChain**. Runs fully in the terminal; wired for a **FastAPI** + **React** web app in the future. Still actively in development — new features and architectural upgrades are continuously being explored and shipped

---

## Architecture

```
User
  │
  ▼
Supervisor (entry) ──→ Recommendation ──→ Chef ──→ Nutrition ──→ Critic
                                                                    │
                                                                    ▼
                                               Supervisor (review) ──→ [revise? → Chef]
                                                                    │
                                                                    ▼
                                                               Final Response → User
```

| Agent | Role |
|---|---|
| **Supervisor** | Parses intent, orchestrates flow, makes final revision decision, writes the user-facing response |
| **Recommendation** | Suggests 2-3 personalised Moroccan recipes based on preferences + web search |
| **Chef** | Produces a full recipe with ingredients, step-by-step instructions, tips, and cultural notes |
| **Nutrition** | Calculates macros (calories, carbs, protein, fat, fibre) llm based knowledge and smart fallback |
| **Critic** | Scores the collective output (1-10) and flags issues; supervisor decides whether to revise |

### Memory

| Layer | Technology | What it stores |
|---|---|---|
| Short-term (session) | LangGraph `MemorySaver` checkpoint | Full message history within a session |
| Long-term (persistent) | Postgres (or SQLite fallback) | User liked/disliked dishes, dietary constraints, session summaries |

### Tools

| Tool | Source | Fallback |
|---|---|---|
| `web_search` | Tavily API | Disabled (logged warning) |
| `web_scrape` | BeautifulSoup | Error message returned |

---

## Setup

### 1. Clone and install

```bash
cd moroccan_kitchen
python -m venv venv               # create virtual environment
source venv/bin/activate          # (Linux / macOS) 
# .\venv\Scripts\activate.bat     # (Windows cmd)
pip install -r requirements.txt   # or see dependencies below
```

### 2. Configure environment

Rename `.env.example`:
```bash
mv .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY   # one of them required (GROQ: current_use)
TAVILY_API_KEY=tvly-...                           # optional — enables web search
DATABASE_URL=postgresql://...                     # optional — defaults to SQLite
USE_SQLITE_FALLBACK=true                          # set false to require Postgres
DEBUG=false
```

### 3. Run

```bash
python main.py
python main.py --user-id ahmed        # named user (persists preferences)
python main.py --debug                # shows agent traces
```

---

## Chat commands

| Command | Effect |
|---|---|
| `/preferences` | Show your stored preferences |
| `/history` | Show past session summaries |
| `/like Couscous` | Mark a dish as liked |
| `/dislike Pastilla` | Mark a dish as disliked |
| `/diet vegetarian` | Add a dietary constraint |
| `/reset` | Clear preferences |
| `/clear` | Clear conversation history |
| `/help` | Show help |
| `exit` | Quit |

---

## Project structure

```
moroccan_kitchen/
├── main.py                  # Terminal app entry point
├── orchestrator.py          # Main session manager (bridges graph ↔ memory ↔ UI)
├── graph.py                 # LangGraph StateGraph definition
│
├── agents/
│   ├── state.py             # KitchenState TypedDict
│   ├── llm.py               # LLM factory
│   ├── supervisor.py        # Entry + review passes
│   ├── recommendation.py    # Recipe recommendations
│   ├── chef.py              # Full recipe generation
│   ├── nutrition.py         # Macro analysis
│   └── critic.py            # Quality evaluation
│
├── memory/
│   └── long_term.py         # Postgres/SQLite long-term memory
│
├── tools/
│   └── kitchen_tools.py     # web_search, web_scrape, nutrition_lookup
│
├── config/
│   └── settings.py          # Typed env-var config
│
├── api/
│   └── app.py               # FastAPI stub 
│
└── .env
```

---

## Adding the web app

The `orchestrator.py` is the seam between terminal and web. When you're ready:

1. Install: `pip install fastapi uvicorn python-jose passlib`
2. Uncomment `api/app.py`
3. Each API request creates a `KitchenOrchestrator(user_id=..., thread_id=...)` and calls `.run(message)`
4. The `thread_id` (from the frontend chatbot session) drives LangGraph checkpointing automatically
5. Auth tokens map to `user_id` which drives Postgres long-term memory

No changes needed to any agent, the graph, or the memory layer.

---

## API keys

| Service | Free tier | Get key |
|---|---|---|

| Groq | free_use (limited) | https://groq.com/ |
| OpenAI | Pay-per-use | https://platform.openai.com |
| Anthropic | Pay-per-use | https://console.anthropic.com |
| Tavily | 1000 req/month free | https://app.tavily.com |

---

## Dependencies

```
langgraph
langchain
langchain-anthropic
langchain-community
psycopg2-binary
sqlalchemy
alembic
beautifulsoup4
requests
python-dotenv
rich
tavily-python
```
