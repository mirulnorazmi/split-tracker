-- =============================================================================
-- Migration 011: Placeholder Users & Participant Linking Support
-- =============================================================================

-- 1. Allow email and password to be NULL for placeholder/unregistered participants
ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL;
ALTER TABLE "user" ALTER COLUMN password DROP NOT NULL;

-- 2. Add is_placeholder flag and created_by reference to "user"
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES "user"(id) ON DELETE SET NULL;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_placeholder ON "user"(is_placeholder);
CREATE INDEX IF NOT EXISTS idx_user_created_by ON "user"(created_by);
