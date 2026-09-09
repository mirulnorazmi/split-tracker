-- Migration 009: Allow 'Rejected' status for payment and expense tables

ALTER TABLE payment DROP CONSTRAINT IF EXISTS payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check CHECK (status IN ('Pending', 'Confirmed', 'Rejected'));

ALTER TABLE expense DROP CONSTRAINT IF EXISTS expense_status_check;
ALTER TABLE expense ADD CONSTRAINT expense_status_check CHECK (status IN ('Pending', 'Confirmed', 'Rejected'));
