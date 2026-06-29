-- Extension webhooks and logging

-- Add hook secret to extensions
ALTER TABLE extensions ADD COLUMN hook_secret TEXT;

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS extension_webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  hook_id INTEGER,
  extension_id INTEGER,
  event TEXT,
  endpoint TEXT,
  status INTEGER,
  response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_extension_webhook_logs_tenant
  ON extension_webhook_logs(tenant_id, created_at);
