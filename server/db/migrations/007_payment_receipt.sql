-- Migration 007: Add receipt_url to payment table for payment proof attachment

ALTER TABLE payment
    ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_receipt_url ON payment(receipt_url) WHERE receipt_url IS NOT NULL;
