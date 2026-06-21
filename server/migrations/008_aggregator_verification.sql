-- Migration 008: Aggregator strict verification
-- Adds last_checked and checked_credentials_hash for the check-before-enable flow

ALTER TABLE aggregator_settings ADD COLUMN last_checked TEXT;
ALTER TABLE aggregator_settings ADD COLUMN checked_credentials_hash TEXT;
