-- =============================================================================
-- Migration 010: Recurring Payment Association Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS recurring_payment (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_item_id  UUID NOT NULL REFERENCES recurring_cycle_item(id) ON DELETE CASCADE,
    payment_id     UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    amount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_payment_pay ON recurring_payment(payment_id);
CREATE INDEX IF NOT EXISTS idx_rec_payment_item ON recurring_payment(cycle_item_id);

-- Backfill from any existing recurring_cycle_item that currently has payment_id
INSERT INTO recurring_payment (cycle_item_id, payment_id, amount_applied)
SELECT rci.id, rci.payment_id, rci.amount_due
FROM recurring_cycle_item rci
WHERE rci.payment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM recurring_payment rp
    WHERE rp.cycle_item_id = rci.id AND rp.payment_id = rci.payment_id
  );

-- Backfill known rejected payment 214e6cfe-c921-4d9b-9054-ea314be0cccd (Netflix 2026-06 and 2026-07)
INSERT INTO recurring_payment (cycle_item_id, payment_id, amount_applied)
SELECT 'cdb133e0-b8de-4926-8de0-16118944bba0', '214e6cfe-c921-4d9b-9054-ea314be0cccd', 15.00
WHERE EXISTS (SELECT 1 FROM payment WHERE id = '214e6cfe-c921-4d9b-9054-ea314be0cccd')
  AND EXISTS (SELECT 1 FROM recurring_cycle_item WHERE id = 'cdb133e0-b8de-4926-8de0-16118944bba0')
  AND NOT EXISTS (
    SELECT 1 FROM recurring_payment rp
    WHERE rp.payment_id = '214e6cfe-c921-4d9b-9054-ea314be0cccd' AND rp.cycle_item_id = 'cdb133e0-b8de-4926-8de0-16118944bba0'
  );

INSERT INTO recurring_payment (cycle_item_id, payment_id, amount_applied)
SELECT '8a73c5a1-7994-4b3d-a0c9-ddd94955ef52', '214e6cfe-c921-4d9b-9054-ea314be0cccd', 15.00
WHERE EXISTS (SELECT 1 FROM payment WHERE id = '214e6cfe-c921-4d9b-9054-ea314be0cccd')
  AND EXISTS (SELECT 1 FROM recurring_cycle_item WHERE id = '8a73c5a1-7994-4b3d-a0c9-ddd94955ef52')
  AND NOT EXISTS (
    SELECT 1 FROM recurring_payment rp
    WHERE rp.payment_id = '214e6cfe-c921-4d9b-9054-ea314be0cccd' AND rp.cycle_item_id = '8a73c5a1-7994-4b3d-a0c9-ddd94955ef52'
  );

-- Backfill payment 0d2c3b6f-ed4e-40fb-a13e-ca591b6c0bb7 (Netflix 2026-06)
INSERT INTO recurring_payment (cycle_item_id, payment_id, amount_applied)
SELECT 'cdb133e0-b8de-4926-8de0-16118944bba0', '0d2c3b6f-ed4e-40fb-a13e-ca591b6c0bb7', 15.00
WHERE EXISTS (SELECT 1 FROM payment WHERE id = '0d2c3b6f-ed4e-40fb-a13e-ca591b6c0bb7')
  AND EXISTS (SELECT 1 FROM recurring_cycle_item WHERE id = 'cdb133e0-b8de-4926-8de0-16118944bba0')
  AND NOT EXISTS (
    SELECT 1 FROM recurring_payment rp
    WHERE rp.payment_id = '0d2c3b6f-ed4e-40fb-a13e-ca591b6c0bb7' AND rp.cycle_item_id = 'cdb133e0-b8de-4926-8de0-16118944bba0'
  );
