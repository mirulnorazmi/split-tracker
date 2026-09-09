-- =============================================================================
-- Migration 003: Recurring Expenses, Cycles, and Participant Ledger
-- =============================================================================

CREATE TABLE IF NOT EXISTS recurring_expense (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(255) NOT NULL,
    category_id   UUID NOT NULL REFERENCES category(id),
    creator_id    UUID NOT NULL REFERENCES "user"(id),
    total_amount  NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    billing_day   INT NOT NULL DEFAULT 1 CHECK (billing_day >= 1 AND billing_day <= 31),
    split_type    VARCHAR(20) NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom')),
    status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_participant (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_expense_id  UUID NOT NULL REFERENCES recurring_expense(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    amount                NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    joined_date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discontinued_date     TIMESTAMPTZ,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (recurring_expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS recurring_cycle (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_expense_id  UUID NOT NULL REFERENCES recurring_expense(id) ON DELETE CASCADE,
    period_key            VARCHAR(10) NOT NULL,
    due_date              DATE NOT NULL,
    total_amount          NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    status                VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Settled')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recurring_expense_id, period_key)
);

CREATE TABLE IF NOT EXISTS recurring_cycle_item (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id      UUID NOT NULL REFERENCES recurring_cycle(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    amount_due    NUMERIC(12, 2) NOT NULL CHECK (amount_due >= 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Pending', 'Paid', 'Waived')),
    paid_at       TIMESTAMPTZ,
    payment_id    UUID REFERENCES payment(id) ON DELETE SET NULL,
    UNIQUE (cycle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_exp_creator ON recurring_expense(creator_id);
CREATE INDEX IF NOT EXISTS idx_rec_part_user ON recurring_participant(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_cycle_exp ON recurring_cycle(recurring_expense_id, period_key);
CREATE INDEX IF NOT EXISTS idx_rec_cycle_item_user ON recurring_cycle_item(user_id, status);
