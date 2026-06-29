-- Dynamic pricing rules

CREATE TABLE IF NOT EXISTS dynamic_pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_rules_tenant ON dynamic_pricing_rules(tenant_id, is_active, priority);
