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
        return sqlite3.connect(settings.SQLITE_PATH, check_same_thread=False)
    try:
        import psycopg2
        return psycopg2.connect(settings.DATABASE_URL)
    except Exception:
        # Graceful fallback if Postgres is unavailable
        return sqlite3.connect(settings.SQLITE_PATH, check_same_thread=False)


def _is_sqlite(conn) -> bool:
    return isinstance(conn, sqlite3.Connection)


def _placeholder(conn) -> str:
    """Postgres uses %s, SQLite uses ?"""
    return "?" if _is_sqlite(conn) else "%s"


# ── Schema bootstrap ─────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         TEXT PRIMARY KEY,
    liked_dishes    TEXT NOT NULL DEFAULT '[]',
    disliked_dishes TEXT NOT NULL DEFAULT '[]',
    dietary         TEXT NOT NULL DEFAULT '[]',
    flavor_notes    TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id          INTEGER PRIMARY KEY {autoincrement},
    user_id     TEXT NOT NULL,
    summary     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"""

def _bootstrap(conn):
    ph = _placeholder(conn)
    cur = conn.cursor()
    if _is_sqlite(conn):
        schema = _SCHEMA.format(autoincrement="")
        for stmt in schema.strip().split(";"):
            s = stmt.strip()
            if s:
                cur.execute(s)
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
        ph = self._ph()
        cur = self._conn.cursor()
        cur.execute(
            f"SELECT user_id FROM user_preferences WHERE user_id = {ph}",
            (self.user_id,),
        )
        if not cur.fetchone():
            cur.execute(
                f"""INSERT INTO user_preferences
                    (user_id, liked_dishes, disliked_dishes, dietary, flavor_notes, updated_at)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph})""",
                (self.user_id, "[]", "[]", "[]", "", self._now()),
            )
            self._conn.commit()
        cur.close()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

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

    def update_preferences(self, data: dict[str, Any]):
        """
        Merge incoming preference data with existing.
        data keys: liked, disliked, dietary, flavor_notes  (all optional)
        """
        current = self.get_preferences()

        def _merge_list(key: str) -> list:
            existing = set(current.get(key, []))
            new_items = data.get(key, [])
            existing.update(new_items)
            return list(existing)

        liked = _merge_list("liked")
        disliked = _merge_list("disliked")
        dietary = _merge_list("dietary")
        flavor_notes = data.get("flavor_notes", current["flavor_notes"])

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