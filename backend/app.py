from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uuid, bcrypt

from orchestrator import KitchenOrchestrator
from memory.long_term import LongTermMemory, _get_connection, _bootstrap, _placeholder

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth models ──────────────────────────────────────────────────────
class AuthRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str

class PrefsRequest(BaseModel):
    user_id: str
    liked: list[str] = []
    disliked: list[str] = []
    dietary: list[str] = []
    flavor_notes: str = ""

class DeleteSessionRequest(BaseModel):
    user_id: str
    session_id: str

# ── Auth helpers ─────────────────────────────────────────────────────
def get_db():
    conn = _get_connection()
    _bootstrap(conn)
    return conn

@app.post("/api/auth/register")
def register(req: AuthRequest):
    conn = get_db()
    ph = _placeholder(conn)
    cur = conn.cursor()
    cur.execute(f"SELECT user_id FROM users WHERE username = {ph}", (req.username,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Username already exists")
    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    from datetime import datetime, timezone
    cur.execute(
        f"INSERT INTO users (user_id, username, password, created) VALUES ({ph},{ph},{ph},{ph})",
        (user_id, req.username, hashed, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    # Bootstrap preferences row
    mem = LongTermMemory(user_id)
    mem.close()
    return {"user_id": user_id, "username": req.username}

@app.post("/api/auth/login")
def login(req: AuthRequest):
    conn = get_db()
    ph = _placeholder(conn)
    cur = conn.cursor()
    cur.execute(f"SELECT user_id, password FROM users WHERE username = {ph}", (req.username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not bcrypt.checkpw(req.password.encode(), row[1].encode()):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"user_id": row[0], "username": req.username}


# ── Chat ─────────────────────────────────────────────────────────────
@app.post("/api/chat")
def chat(req: ChatRequest):
    cmd = req.message.strip()
    if cmd.startswith("/"):
        with KitchenOrchestrator(user_id=req.user_id, thread_id=req.session_id) as orch:
            parts = cmd.split(None, 1)
            verb = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""
            
            if verb == "/like" and arg:
                orch.update_preferences(liked=[arg])
                response = f"✓ Added '{arg}' to liked dishes"
            elif verb == "/dislike" and arg:
                orch.update_preferences(disliked=[arg])
                response = f"✓ Added '{arg}' to disliked dishes"
            elif verb == "/diet" and arg:
                orch.update_preferences(dietary=[arg])
                response = f"✓ Added dietary constraint: {arg}"
            elif verb == "/reset":
                orch.reset_preferences()
                response = "Preferences reset."
            elif verb == "/clear":
                orch.clear_history()
                response = "History cleared."
            elif verb in ("/preferences", "/pr"):
                prefs = orch.get_preferences()
                response = f"Liked: {prefs.get('liked')}\nDisliked: {prefs.get('disliked')}\nDietary: {prefs.get('dietary')}\nNotes: {prefs.get('flavor_notes')}"
            elif verb == "/history":
                response = orch.get_history() or "No history yet."
            elif verb == "/help":
                response = "Available commands: /preferences, /history, /like <dish>, /dislike <dish>, /diet <flag>, /reset, /clear"
            else:
                response = f"Unknown command: {verb}"
            
            return {
                "final_response": response,
                "recipe": None,
                "recommended_recipes": [],
                "nutrition": None,
                "critic_score": None,
                "session_summary": "",
                "intent": "system",
                "waiting": False,
                "style_choice": "",
                "iteration_count": 0,
            }

    # If not a command, process via orchestrator
    with KitchenOrchestrator(user_id=req.user_id, thread_id=req.session_id) as orch:
        result = orch.handle_message(req.message)

    # Prepare response
    ai_msg = {
        "final_response":     result.final_response,
        "recipe":             result.recipe,
        "recommended_recipes": result.recommended_recipes,
        "nutrition":          result.nutrition,
        "critic_score":       result.critic_score,
        "session_summary":    result.session_summary,
        "intent":             result.intent,
        "waiting":            result.waiting,
        "style_choice":       result.style_choice,
        "iteration_count":    result.iteration_count,
    }

    # Persist message history in DB
    mem = LongTermMemory(req.user_id)
    # create/update session title
    title = req.message.strip()[:40]
    mem.save_session(req.session_id, title)
    # save user msg
    mem.save_message(req.session_id, {"role": "user", "content": req.message, "id": str(uuid.uuid4())})
    # save assistant msg
    mem.save_message(req.session_id, {"role": "assistant", **ai_msg, "id": str(uuid.uuid4())})
    mem.close()

    return ai_msg

# ── Sessions ─────────────────────────────────────────────────────────
@app.get("/api/sessions/{user_id}")
def get_sessions(user_id: str):
    mem = LongTermMemory(user_id)
    sessions = mem.get_sessions()
    result = []
    for s in sessions:
        msgs = mem.get_session_messages(s["session_id"])
        result.append({**s, "messages": msgs})
    mem.close()
    return {"sessions": result}

@app.delete("/api/sessions/{user_id}/{session_id}")
def delete_session(user_id: str, session_id: str):
    mem = LongTermMemory(user_id)
    mem.delete_session(session_id)
    mem.close()
    return {"ok": True}

# ── Preferences ──────────────────────────────────────────────────────
@app.get("/api/preferences/{user_id}")
def get_preferences(user_id: str):
    mem = LongTermMemory(user_id)
    prefs = mem.get_preferences()
    mem.close()
    return prefs

@app.post("/api/preferences")
def update_preferences(req: PrefsRequest):
    mem = LongTermMemory(req.user_id)
    mem.update_preferences({
        "liked": req.liked,
        "disliked": req.disliked,
        "dietary": req.dietary,
        "flavor_notes": req.flavor_notes,
    }, merge=False)
    mem.close()
    return {"ok": True}

# ── Serve React in production (after npm run build) ──────────────────
import os
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")