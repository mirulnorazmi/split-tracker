-- =============================================================================
-- SplitTrack: Initial Database Migration
-- Based on ERD: USER, CATEGORY, EXPENSE, EXPENSE_PARTICIPANT, PAYMENT, EXPENSE_PAYMENT
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. USER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    avatar      TEXT,
    initials    VARCHAR(10) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active')),
    role        VARCHAR(20) NOT NULL DEFAULT 'Standard User' CHECK (role IN ('Admin', 'Standard User')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. CATEGORY
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name    VARCHAR(100) NOT NULL UNIQUE,
    icon    VARCHAR(50) NOT NULL,
    color   VARCHAR(255) NOT NULL
);
ALTER TABLE category ALTER COLUMN color TYPE VARCHAR(255);

-- ---------------------------------------------------------------------------
-- 3. EXPENSE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(255) NOT NULL,
    total_amount  NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category_id   UUID NOT NULL REFERENCES category(id),
    creator_id    UUID NOT NULL REFERENCES "user"(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. EXPENSE_PARTICIPANT (bridge: USER <-> EXPENSE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_participant (
    expense_id    UUID NOT NULL REFERENCES expense(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    amount_owed   NUMERIC(12, 2) NOT NULL CHECK (amount_owed >= 0),
    PRIMARY KEY (expense_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 5. PAYMENT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_date  TIMESTAMPTZ,
    amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payer_id        UUID NOT NULL REFERENCES "user"(id),
    payee_id        UUID NOT NULL REFERENCES "user"(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. EXPENSE_PAYMENT (bridge: EXPENSE <-> PAYMENT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_payment (
    expense_id      UUID NOT NULL REFERENCES expense(id) ON DELETE CASCADE,
    payment_id      UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    amount_applied  NUMERIC(12, 2) NOT NULL CHECK (amount_applied > 0),
    PRIMARY KEY (expense_id, payment_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_expense_creator ON expense(creator_id);
CREATE INDEX IF NOT EXISTS idx_expense_status ON expense(status);
CREATE INDEX IF NOT EXISTS idx_expense_category ON expense(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_participant_user ON expense_participant(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_payer ON payment(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_payee ON payment(payee_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment(status);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_status ON "user"(status);

-- =============================================================================
-- Seed Data: Default Categories
-- =============================================================================
INSERT INTO category (id, name, icon, color) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Food & Dining', '🍽️', 'bg-amber-500/10 text-amber-500 border-amber-500/20'),
    ('00000000-0000-0000-0000-000000000002', 'Transport', '🚗', 'bg-blue-500/10 text-blue-500 border-blue-500/20'),
    ('00000000-0000-0000-0000-000000000003', 'Groceries', '🛒', 'bg-green-500/10 text-green-500 border-green-500/20'),
    ('00000000-0000-0000-0000-000000000004', 'Entertainment', '🎬', 'bg-purple-500/10 text-purple-500 border-purple-500/20'),
    ('00000000-0000-0000-0000-000000000005', 'Utilities', '💡', 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'),
    ('00000000-0000-0000-0000-000000000006', 'Travel', '✈️', 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'),
    ('00000000-0000-0000-0000-000000000007', 'Shopping', '🛍️', 'bg-pink-500/10 text-pink-500 border-pink-500/20'),
    ('00000000-0000-0000-0000-000000000008', 'Others', '📦', 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color;