-- =============================================================================
-- SplitTrack Migration: Expense Groups / Folders
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. FOLDER TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folder (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100) DEFAULT 'General',
    color       VARCHAR(50) DEFAULT '#C9FF55',
    created_by  UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. EXPENSE FOLDER ASSOCIATION
-- ---------------------------------------------------------------------------
ALTER TABLE expense ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folder(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_folder_created_by ON folder(created_by);
CREATE INDEX IF NOT EXISTS idx_expense_folder_id ON expense(folder_id);
