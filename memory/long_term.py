"""
memory/long_term.py

Long-term memory backed by Postgres (or SQLite if USE_SQLITE_FALLBACK=true).
Stores:
  - user preferences  : liked/disliked dishes, dietary constraints, flavour notes
  - conversation summaries : rolling summary of past sessions (not raw messages)

The schema is intentionally minimal so it integrates cleanly with a future
REST API or ORM layer when the web app is built.

Public API
----------
LongTermMemory(user_id)          → context manager / plain object
  .get_preferences()             → dict
  .update_preferences(data)      → None
  .add_conversation_summary(txt) → None
  .get_history_summary()         → str
  .clear_history()               → None
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import settings

# ── DB driver abstraction ─────────────────────────────────────────────

def _get_connection():
    """Return a DB-API 2 connection (Postgres or SQLite)."""
    if settings.USE_SQLITE_FALLBACK or not settings.DATABASE_URL:
        conn = sqlite3.connect(settings.SQLITE_PATH, check_same_thread=False)
        # Must be set per-connection — SQLite resets it on each new connection.
        conn.execute("PRAGMA foreign_keys = ON")
        return conn
    try:
        import psycopg2
        return psycopg2.connect(settings.DATABASE_URL)
    except Exception:
        conn = sqlite3.connect(settings.SQLITE_PATH, check_same_thread=False)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


def _is_sqlite(conn) -> bool:
    return isinstance(conn, sqlite3.Connection)


def _placeholder(conn) -> str:
    """Postgres uses %s, SQLite uses ?"""
    return "?" if _is_sqlite(conn) else "%s"


# ── Schema bootstrap ─────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id   TEXT PRIMARY KEY,
    username  TEXT NOT NULL UNIQUE,
    password  TEXT NOT NULL,
    created   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         TEXT PRIMARY KEY,
    liked_dishes    TEXT NOT NULL DEFAULT '[]',
    disliked_dishes TEXT NOT NULL DEFAULT '[]',
    dietary         TEXT NOT NULL DEFAULT '[]',
    flavor_notes    TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id          INTEGER PRIMARY KEY {autoincrement},
    user_id     TEXT NOT NULL,
    summary     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_messages (
    id          INTEGER PRIMARY KEY {autoincrement},
    session_id  TEXT NOT NULL,
    message_json TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
"""

def _bootstrap(conn):
    cur = conn.cursor()
    if _is_sqlite(conn):
        # SQLite silently ignores FK constraints unless this pragma is set.
        # Enable it before creating tables so ON DELETE CASCADE works correctly.
        cur.execute("PRAGMA foreign_keys = ON")
        schema = _SCHEMA.format(autoincrement="")
    else:
        schema = _SCHEMA.format(autoincrement="GENERATED ALWAYS AS IDENTITY")

    for stmt in schema.strip().split(";"):
        s = stmt.strip()
        if s:
            cur.execute(s)

    conn.commit()
    cur.close()


# ── Main class ───────────────────────────────────────────────────────

class LongTermMemory:
    """
    Per-user long-term memory.
    Thread-safe for sequential use (not concurrent writes).
    """

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._conn = _get_connection()
        _bootstrap(self._conn)
        self._ensure_user_row()

    # ── internals ────────────────────────────────────────────────────

    def _ph(self) -> str:
        return _placeholder(self._conn)

    def _ensure_user_row(self):
        """
        Guarantee that both a users row and a user_preferences row exist
        for self.user_id. Called at init so every subsequent query is safe.

        Terminal sessions pass a plain string (e.g. "ahmed") as user_id.
        We try the plain string as username first; on collision we fall back
        to "term_{user_id}" so we don't collide with web-registered accounts.
        """
        ph  = self._ph()
        cur = self._conn.cursor()

        # ── Ensure users row ──────────────────────────────────────────
        cur.execute(f"SELECT user_id FROM users WHERE user_id = {ph}", (self.user_id,))
        if not cur.fetchone():
            # Try plain username first, then a "term_" prefixed fallback
            for candidate_username in (self.user_id, f"term_{self.user_id}"):
                try:
                    cur.execute(
                        f"INSERT INTO users (user_id, username, password, created) "
                        f"VALUES ({ph},{ph},{ph},{ph})",
                        (self.user_id, candidate_username, "terminal_dummy", self._now()),
                    )
                    self._conn.commit()
                    break   # success
                except sqlite3.IntegrityError:
                    self._conn.rollback()
                    # username taken — try next candidate
                    continue

        # ── Ensure user_preferences row ───────────────────────────────
        cur.execute(
            f"SELECT user_id FROM user_preferences WHERE user_id = {ph}",
            (self.user_id,),
        )
        if not cur.fetchone():
            try:
                cur.execute(
                    f"INSERT INTO user_preferences "
                    f"(user_id, liked_dishes, disliked_dishes, dietary, flavor_notes, updated_at) "
                    f"VALUES ({ph},{ph},{ph},{ph},{ph},{ph})",
                    (self.user_id, "[]", "[]", "[]", "", self._now()),
                )
                self._conn.commit()
            except sqlite3.IntegrityError:
                self._conn.rollback()   # row was inserted by a concurrent call — safe to ignore

        cur.close()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    # ── User Profile ──────────────────────────────────────────────────

    def get_user_profile(self) -> dict[str, Any]:
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(f"SELECT username FROM users WHERE user_id = {ph}", (self.user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"username": "Guest"}
        return {"username": row[0]}
        
    # ── Preferences ──────────────────────────────────────────────────

    def get_preferences(self) -> dict[str, Any]:
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"""SELECT liked_dishes, disliked_dishes, dietary, flavor_notes
                FROM user_preferences WHERE user_id = {ph}""",
            (self.user_id,),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return {"liked": [], "disliked": [], "dietary": [], "flavor_notes": ""}
        return {
            "liked": json.loads(row[0]),
            "disliked": json.loads(row[1]),
            "dietary": json.loads(row[2]),
            "flavor_notes": row[3],
        }

    def update_preferences(self, data: dict[str, Any], merge: bool = True):
        """
        Merge incoming preference data with existing, or replace if merge=False.
        data keys: liked, disliked, dietary, flavor_notes  (all optional)
        """
        current = self.get_preferences()

        def _get_list(key: str) -> list:
            if merge:
                existing = set(current.get(key, []))
                new_items = data.get(key, [])
                existing.update(new_items)
                return list(existing)
            else:
                return data.get(key, [])

        liked = _get_list("liked")
        disliked = _get_list("disliked")
        dietary = _get_list("dietary")
        if merge:
            flavor_notes = data.get("flavor_notes", current["flavor_notes"])
        else:
            flavor_notes = data.get("flavor_notes", "")

        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"""UPDATE user_preferences
                SET liked_dishes={ph}, disliked_dishes={ph}, dietary={ph},
                    flavor_notes={ph}, updated_at={ph}
                WHERE user_id={ph}""",
            (
                json.dumps(liked, ensure_ascii=False),
                json.dumps(disliked, ensure_ascii=False),
                json.dumps(dietary, ensure_ascii=False),
                flavor_notes,
                self._now(),
                self.user_id,
            ),
        )
        self._conn.commit()
        cur.close()

    # ── Sessions ──────────────────────────────────────────────────────────────

    def get_sessions(self) -> list[dict]:
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"SELECT session_id, title, created_at FROM sessions WHERE user_id = {ph} ORDER BY created_at DESC",
            (self.user_id,)
        )
        rows = cur.fetchall()
        cur.close()
        return [{"session_id": r[0], "title": r[1], "created_at": r[2]} for r in rows]

    def get_session_messages(self, session_id: str) -> list[dict]:
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"SELECT message_json FROM session_messages WHERE session_id = {ph} ORDER BY id ASC",
            (session_id,)
        )
        rows = cur.fetchall()
        cur.close()
        return [json.loads(r[0]) for r in rows]

    def save_session(self, session_id: str, title: str):
        ph = self._ph()
        cur = self._conn.cursor()
        try:
            cur.execute(
                f"INSERT INTO sessions (session_id, user_id, title, created_at) VALUES ({ph},{ph},{ph},{ph})",
                (session_id, self.user_id, title, self._now())
            )
            self._conn.commit()
        except Exception:
            # Session already exists — just update the title if it's a new/better title
            self._conn.rollback()
            cur.execute(
                f"UPDATE sessions SET title = {ph} WHERE session_id = {ph} AND user_id = {ph}",
                (title, session_id, self.user_id)
            )
            self._conn.commit()
        cur.close()

    def save_message(self, session_id: str, msg: dict):
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"INSERT INTO session_messages (session_id, message_json, created_at) VALUES ({ph},{ph},{ph})",
            (session_id, json.dumps(msg, ensure_ascii=False), self._now())
        )
        self._conn.commit()
        cur.close()

    def delete_session(self, session_id: str):
        ph = self._ph()
        cur = self._conn.cursor()
        # Explicitly delete messages first (CASCADE may not fire in SQLite without PRAGMA)
        cur.execute(
            f"DELETE FROM session_messages WHERE session_id = {ph}",
            (session_id,)
        )
        cur.execute(
            f"DELETE FROM sessions WHERE session_id = {ph} AND user_id = {ph}",
            (session_id, self.user_id)
        )
        self._conn.commit()
        cur.close()

    # ── Conversation history ──────────────────────────────────────────

    def add_conversation_summary(self, summary: str):
        """Append a short summary of the just-finished conversation."""
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"""INSERT INTO conversation_summaries (user_id, summary, created_at)
                VALUES ({ph},{ph},{ph})""",
            (self.user_id, summary, self._now()),
        )
        self._conn.commit()
        cur.close()

    def get_history_summary(self, last_n: int = 5) -> str:
        """Return the last N session summaries as a single readable string."""
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"""SELECT summary, created_at
                FROM conversation_summaries
                WHERE user_id = {ph}
                ORDER BY created_at DESC
                LIMIT {ph}""",
            (self.user_id, last_n),
        )
        rows = cur.fetchall()
        cur.close()
        if not rows:
            return "No previous sessions."
        parts = []
        for summary, ts in reversed(rows):
            date = ts[:10]
            parts.append(f"[{date}] {summary}")
        return "\n".join(parts)

    
    def reset_all_preferences(self):
        """Wipe all preferences — liked, disliked, dietary, flavor notes."""
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"""UPDATE user_preferences
                SET liked_dishes='[]', disliked_dishes='[]', dietary='[]',
                    flavor_notes='', updated_at={ph}
                WHERE user_id={ph}""",
            (self._now(), self.user_id),
        )
        self._conn.commit()
        cur.close()


    def clear_history(self):
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"DELETE FROM conversation_summaries WHERE user_id = {ph}",
            (self.user_id,),
        )
        self._conn.commit()
        cur.close()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()