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
);

CREATE INDEX IF NOT EXISTS idx_memory_items_session ON memory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_created ON memory_items(created_at DESC);
