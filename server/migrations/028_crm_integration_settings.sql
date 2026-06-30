CREATE TABLE IF NOT EXISTS crm_integration_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  provider TEXT NOT NULL,
  value TEXT DEFAULT '{}',
  UNIQUE(tenant_id, provider)
);
