-- Migration 006: Webhook support for online payments
-- Adds webhook_logs table and notification_url column for T-Bank payment notifications

-- Webhook audit log
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  provider TEXT NOT NULL,
  payment_id TEXT,
  payload TEXT NOT NULL,
  signature TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  processed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed_at);

-- Add notification URL column to payment_settings
ALTER TABLE payment_settings ADD COLUMN notification_url TEXT DEFAULT '';

-- Add payment_error column to orders for failed payment messages
ALTER TABLE orders ADD COLUMN payment_error TEXT DEFAULT '';

-- Seed notification_url for existing providers (uses current server URL, override in admin panel)
UPDATE payment_settings SET notification_url = 'https://ваш-домен/api/webhooks/payment' WHERE notification_url IS NULL OR notification_url = '';
