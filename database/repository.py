import json
import os
from typing import Any

from sqlalchemy import create_engine, text

class PostgresMemoryRepository:
    def __init__(self, database_url: str | None = None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        self.engine = create_engine(self.database_url, pool_pre_ping=True) if self.database_url else None

    @property
    def configured(self) -> bool:
        return self.engine is not None

    def ensure_schema(self) -> None:
        if not self.engine:
            return
        with self.engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS memory_items (
                    id BIGSERIAL PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'episodic',
                    importance DOUBLE PRECISION NOT NULL DEFAULT 0.5,
                    topics JSONB NOT NULL DEFAULT '[]'::jsonb,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    accessed_at TIMESTAMPTZ,
                    access_count INTEGER NOT NULL DEFAULT 0
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_memory_items_session ON memory_items(session_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_memory_items_created ON memory_items(created_at DESC)"))

    def remember(self, session_id: str, content: str, importance: float, topics: list[str], metadata: dict[str, Any] | None = None) -> None:
        if not self.engine:
            return
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO memory_items(session_id, content, importance, topics, metadata)
                VALUES (:session_id, :content, :importance, CAST(:topics AS JSONB), CAST(:metadata AS JSONB))
            """), {"session_id": session_id, "content": content, "importance": importance, "topics": json.dumps(topics), "metadata": json.dumps(metadata or {})})

    def recall(self, session_id: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
        if not self.engine:
            return []
        terms = [w.lower() for w in query.split() if len(w) > 2][:12]
        if not terms:
            return self.recent(session_id, limit)
        clauses = " OR ".join([f"LOWER(content) LIKE :term{i}" for i in range(len(terms))])
        params = {"session_id": session_id, "limit": limit}
        params.update({f"term{i}": f"%{term}%" for i, term in enumerate(terms)})
        with self.engine.begin() as conn:
            rows = conn.execute(text(f"""
                SELECT content, importance, topics, metadata
                FROM memory_items
                WHERE session_id = :session_id AND ({clauses})
                ORDER BY importance DESC, created_at DESC
                LIMIT :limit
            """), params).mappings().all()
        return [dict(row) for row in rows]

    def recent(self, session_id: str, limit: int = 10) -> list[dict[str, Any]]:
        if not self.engine:
            return []
        with self.engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT content, importance, topics, metadata
                FROM memory_items
                WHERE session_id=:session_id
                ORDER BY created_at DESC
                LIMIT :limit
            """), {"session_id": session_id, "limit": limit}).mappings().all()
        return [dict(row) for row in rows]

    def count(self, session_id: str | None = None) -> int:
        if not self.engine:
            return 0
        with self.engine.connect() as conn:
            if session_id:
                return int(conn.execute(text("SELECT COUNT(*) FROM memory_items WHERE session_id=:session_id"), {"session_id": session_id}).scalar_one())
            return int(conn.execute(text("SELECT COUNT(*) FROM memory_items")).scalar_one())

    def health(self) -> bool:
        if not self.engine:
            return False
        with self.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
