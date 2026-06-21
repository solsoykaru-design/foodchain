-- Migration 011: 1C Integration Module
-- Adds tables for 1C integration settings and sync log

CREATE TABLE IF NOT EXISTS integration_1c_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  enabled INTEGER DEFAULT 0,
  api_url TEXT DEFAULT '',
  api_key TEXT DEFAULT '',
  sync_interval TEXT DEFAULT 'manual',
  export_orders INTEGER DEFAULT 1,
  import_goods INTEGER DEFAULT 1,
  import_contragents INTEGER DEFAULT 1,
  last_sync_at TEXT,
  last_sync_status TEXT DEFAULT 'never',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integration_1c_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  operation TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_body TEXT,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE suppliers ADD COLUMN id_1c TEXT;
ALTER TABLE suppliers ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
