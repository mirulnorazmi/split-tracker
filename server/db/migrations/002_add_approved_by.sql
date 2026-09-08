-- Migration 002: Add approved_by and confirmed_by tracking

ALTER TABLE expense
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE payment
    ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES "user"(id) ON DELETE SET NULL;
