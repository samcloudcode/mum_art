-- Activity log for tracking user changes
-- Provides audit trail of who changed what and when

CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,

    -- Who made the change
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,

    -- What was changed
    action VARCHAR(50) NOT NULL,  -- 'update', 'create', 'delete', 'move', 'sell', 'settle'
    entity_type VARCHAR(50) NOT NULL,  -- 'edition', 'print', 'distributor'
    entity_id INTEGER,
    entity_name TEXT,  -- Human-readable name for search (e.g., "Blue Mountains 12/350")

    -- Change details
    field_name TEXT,  -- Which field was changed (null for multi-field updates)
    old_value TEXT,
    new_value TEXT,
    description TEXT,  -- Human-readable summary of the change

    -- Context
    related_entity_type VARCHAR(50),  -- e.g., 'distributor' when moving edition
    related_entity_id INTEGER,
    related_entity_name TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Full-text search index for searching descriptions and entity names
CREATE INDEX idx_activity_log_search ON activity_log
    USING gin(to_tsvector('english', coalesce(entity_name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(new_value, '')));

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read activity log
CREATE POLICY "Authenticated users can read activity_log"
    ON activity_log FOR SELECT
    TO authenticated
    USING (true);

-- All authenticated users can insert activity log entries
CREATE POLICY "Authenticated users can insert activity_log"
    ON activity_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

COMMENT ON TABLE activity_log IS 'Audit trail for user changes to editions, prints, and distributors';
