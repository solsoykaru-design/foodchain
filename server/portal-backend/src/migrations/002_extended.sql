-- Tickets (support system)
CREATE TABLE IF NOT EXISTS tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id),
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  attachment      TEXT,
  assigned_to     INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  message         TEXT NOT NULL,
  is_internal     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge base (FAQ articles)
CREATE TABLE IF NOT EXISTS articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  content         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  is_published    INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Onboarding templates
CREATE TABLE IF NOT EXISTS templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  description     TEXT,
  categories      TEXT NOT NULL DEFAULT '[]',
  menu_items      TEXT NOT NULL DEFAULT '[]',
  roles           TEXT NOT NULL DEFAULT '[]',
  delivery_config TEXT NOT NULL DEFAULT '{}',
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenant module settings
CREATE TABLE IF NOT EXISTS tenant_modules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_code     TEXT NOT NULL,
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, module_code)
);

-- Uptime monitoring
CREATE TABLE IF NOT EXISTS uptime_checks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  check_type      TEXT NOT NULL DEFAULT 'api'
                  CHECK (check_type IN ('api', 'admin', 'mobile')),
  status          TEXT NOT NULL DEFAULT 'ok'
                  CHECK (status IN ('ok', 'degraded', 'down')),
  response_time   INTEGER,
  error_message   TEXT,
  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Impersonation log
CREATE TABLE IF NOT EXISTS impersonation_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  superadmin_id   INTEGER NOT NULL REFERENCES users(id),
  target_user_id  INTEGER,
  target_tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  target_username TEXT,
  action          TEXT NOT NULL DEFAULT 'impersonate'
                  CHECK (action IN ('impersonate', 'stop')),
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- White-label / branding settings
CREATE TABLE IF NOT EXISTS branding_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#f97316',
  secondary_color TEXT DEFAULT '#ef4444',
  platform_name   TEXT DEFAULT 'FoodChain',
  allow_customization INTEGER NOT NULL DEFAULT 1,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO branding_settings (id, tenant_id, platform_name) VALUES (1, NULL, 'FoodChain');

-- Promotions / discounts on tariffs
CREATE TABLE IF NOT EXISTS tariff_promotions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tariff_id       INTEGER NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE,
  discount_percent REAL NOT NULL DEFAULT 0,
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  description     TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Module definitions (available modules) - inserted programmatically

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_uptime_tenant ON uptime_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_superadmin ON impersonation_log(superadmin_id);
