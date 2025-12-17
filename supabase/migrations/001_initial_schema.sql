-- Supabase Migration: Initial Schema
-- Art Print Inventory Management System
--
-- Run this in the Supabase SQL Editor to create all tables

-- ============================================
-- PRINTS TABLE
-- Master catalog of art print designs
-- ============================================
CREATE TABLE prints (
    id SERIAL PRIMARY KEY,
    airtable_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    total_editions INTEGER,
    web_link VARCHAR(500),
    notes TEXT,
    image_urls TEXT[],

    -- Sync metadata
    last_synced_at TIMESTAMPTZ,
    sync_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_prints_name ON prints(name);
CREATE INDEX idx_prints_airtable_id ON prints(airtable_id);

-- ============================================
-- DISTRIBUTORS TABLE
-- Galleries and locations that hold inventory
-- ============================================
CREATE TABLE distributors (
    id SERIAL PRIMARY KEY,
    airtable_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL UNIQUE,
    commission_percentage DECIMAL(5, 2),
    notes TEXT,
    contact_number VARCHAR(50),
    web_address VARCHAR(500),
    last_update_date DATE,

    -- Sync metadata
    last_synced_at TIMESTAMPTZ,
    sync_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_distributors_name ON distributors(name);
CREATE INDEX idx_distributors_airtable_id ON distributors(airtable_id);

-- ============================================
-- EDITIONS TABLE
-- Individual physical prints (main inventory)
-- ============================================
CREATE TABLE editions (
    id SERIAL PRIMARY KEY,
    airtable_id VARCHAR(20) UNIQUE NOT NULL,

    -- Foreign Keys
    print_id INTEGER NOT NULL REFERENCES prints(id) ON DELETE RESTRICT,
    distributor_id INTEGER REFERENCES distributors(id) ON DELETE SET NULL,

    -- Edition Identity
    edition_number INTEGER,
    edition_display_name VARCHAR(100) NOT NULL,

    -- Physical Attributes
    size VARCHAR(20),
    frame_type VARCHAR(20),
    variation VARCHAR(20),

    -- Status Flags
    is_printed BOOLEAN DEFAULT FALSE,
    is_sold BOOLEAN DEFAULT FALSE,
    is_settled BOOLEAN DEFAULT FALSE,
    is_stock_checked BOOLEAN DEFAULT FALSE,
    to_check_in_detail BOOLEAN DEFAULT FALSE,

    -- Sales Information
    retail_price DECIMAL(10, 2),
    date_sold DATE,
    commission_percentage DECIMAL(5, 2),

    -- Gallery Tracking
    date_in_gallery DATE,

    -- Additional Info
    notes TEXT,
    payment_note TEXT,

    -- Sync metadata
    last_synced_at TIMESTAMPTZ,
    sync_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_print_edition UNIQUE (print_id, edition_number),
    CONSTRAINT check_size CHECK (size IS NULL OR size IN ('Small', 'Large', 'Extra Large')),
    CONSTRAINT check_frame_type CHECK (frame_type IS NULL OR frame_type IN ('Framed', 'Tube only', 'Mounted'))
);

-- Indexes for common queries
CREATE INDEX idx_editions_print_id ON editions(print_id);
CREATE INDEX idx_editions_distributor_id ON editions(distributor_id);
CREATE INDEX idx_editions_airtable_id ON editions(airtable_id);
CREATE INDEX idx_editions_is_sold ON editions(is_sold);
CREATE INDEX idx_editions_is_printed ON editions(is_printed);
CREATE INDEX idx_editions_is_settled ON editions(is_settled);

-- ============================================
-- SYNC_LOGS TABLE
-- Track import operations for audit trail
-- ============================================
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    sync_id VARCHAR(50) NOT NULL,
    sync_type VARCHAR(20),
    table_name VARCHAR(50),

    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20),
    error_message TEXT,

    source_file VARCHAR(255),
    source_hash VARCHAR(64)
);

CREATE INDEX idx_sync_logs_sync_id ON sync_logs(sync_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

-- ============================================
-- AUTO-UPDATE TRIGGER FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prints_updated_at
    BEFORE UPDATE ON prints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributors_updated_at
    BEFORE UPDATE ON distributors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editions_updated_at
    BEFORE UPDATE ON editions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- For now: authenticated users have full access
-- Future: gallery users filtered by distributor_id
-- ============================================
ALTER TABLE prints ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (full access)
CREATE POLICY "Authenticated users can read prints"
    ON prints FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert prints"
    ON prints FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update prints"
    ON prints FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete prints"
    ON prints FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read distributors"
    ON distributors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert distributors"
    ON distributors FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update distributors"
    ON distributors FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete distributors"
    ON distributors FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read editions"
    ON editions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert editions"
    ON editions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update editions"
    ON editions FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete editions"
    ON editions FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read sync_logs"
    ON sync_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert sync_logs"
    ON sync_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE prints IS 'Master catalog of art print designs';
COMMENT ON TABLE distributors IS 'Galleries and locations that hold inventory';
COMMENT ON TABLE editions IS 'Individual physical prints - main inventory table';
COMMENT ON TABLE sync_logs IS 'Audit trail for CSV import operations';

COMMENT ON COLUMN editions.commission_percentage IS 'Snapshot of commission rate at time of sale';
COMMENT ON COLUMN distributors.commission_percentage IS 'Current commission rate (0% for Direct sales)';
