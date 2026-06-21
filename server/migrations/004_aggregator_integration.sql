-- Migration 004: Aggregator Integration Module
-- Adds support for delivery aggregators (Yandex EDA, Delivery Club, SberMarket)

-- Aggregator settings per provider
CREATE TABLE IF NOT EXISTS aggregator_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  provider TEXT NOT NULL,
  enabled INTEGER DEFAULT 0,
  credentials TEXT DEFAULT '{}',
  last_sync_at TEXT,
  last_menu_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_settings_provider
  ON aggregator_settings(tenant_id, provider);

-- Sync operation log
CREATE TABLE IF NOT EXISTS aggregator_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  request TEXT,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agg_log_provider
  ON aggregator_sync_log(provider, created_at);

-- Orders table extensions
ALTER TABLE orders ADD COLUMN external_order_id TEXT;
ALTER TABLE orders ADD COLUMN external_provider TEXT;
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'internal';
ALTER TABLE order_item_statuses ADD COLUMN external_item_id TEXT;

-- Seed default settings for each provider (idempotent)
INSERT OR IGNORE INTO aggregator_settings (tenant_id, provider, enabled, credentials)
VALUES (1, 'yandex', 0, '{}');

INSERT OR IGNORE INTO aggregator_settings (tenant_id, provider, enabled, credentials)
VALUES (1, 'delivery_club', 0, '{}');

INSERT OR IGNORE INTO aggregator_settings (tenant_id, provider, enabled, credentials)
VALUES (1, 'sbermarket', 0, '{}');
