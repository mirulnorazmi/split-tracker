-- =============================================================================
-- Migration 006: Performance Indexes for /payments and /expenses Queries
-- =============================================================================

-- Critical index for correlated subquery WHERE epm.payment_id = p.id
CREATE INDEX IF NOT EXISTS idx_expense_payment_payment ON expense_payment(payment_id);

-- Critical index for correlated subquery WHERE rci.payment_id = p.id
CREATE INDEX IF NOT EXISTS idx_rec_cycle_item_payment ON recurring_cycle_item(payment_id);

-- Composite sorting indexes for fast ordered pagination
CREATE INDEX IF NOT EXISTS idx_payment_date_created ON payment(date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_date_created ON expense(date DESC, created_at DESC);
