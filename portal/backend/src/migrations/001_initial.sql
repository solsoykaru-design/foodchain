CREATE TABLE IF NOT EXISTS tariffs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  price_monthly REAL NOT NULL DEFAULT 0,
  max_orders    INTEGER NOT NULL DEFAULT 0,
  max_staff     INTEGER NOT NULL DEFAULT 0,
  max_branches  INTEGER NOT NULL DEFAULT 1,
  features      TEXT NOT NULL DEFAULT '[]',
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  inn                 TEXT NOT NULL,
  phone               TEXT NOT NULL,
  address             TEXT,
  email               TEXT NOT NULL UNIQUE,
  tariff_id           INTEGER REFERENCES tariffs(id),
  subscription_start  TEXT,
  subscription_end    TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended','cancelled')),
  setup_complete      INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'partner'
                  CHECK (role IN ('partner','superadmin')),
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  is_active       INTEGER NOT NULL DEFAULT 1,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  verify_token    TEXT,
  last_login      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'manager'
                  CHECK (role IN ('superadmin','owner','manager','chef','waiter','courier','accountant','analyst')),
  first_name      TEXT,
  last_name       TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, username)
);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount          REAL NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'RUB',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','succeeded','failed','refunded')),
  description     TEXT,
  transaction_id  TEXT,
  payment_method  TEXT,
  paid_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number          TEXT NOT NULL UNIQUE,
  amount          REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','overdue','cancelled')),
  due_date        TEXT NOT NULL,
  description     TEXT,
  payment_id      INTEGER REFERENCES payments(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  details         TEXT,
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info'
                  CHECK (type IN ('info','warning','billing','maintenance')),
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_tariff ON tenants(tariff_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notification_logs(tenant_id);

INSERT OR IGNORE INTO tariffs (name, code, price_monthly, max_orders, max_staff, max_branches, features, sort_order) VALUES
  ('Базовый',     'basic',       9900,   500,   5,   1, '[" до 500 заказов/мес"," 5 сотрудников"," 1 филиал","Базовая аналитика"]', 1),
  ('Профессиональный', 'pro',    19900,  2000,  20,  3, '[" до 2 000 заказов/мес"," 20 сотрудников"," до 3 филиалов","Продвинутая аналитика","Маркетинг-инструменты"]', 2),
  ('Корпоративный',    'enterprise', 49900, 99999, 999, 999, '[" Безлимитные заказы"," Неограниченно сотрудников"," Неограниченно филиалов","Полная аналитика","Приоритетная поддержка","Индивидуальная настройка"]', 3);
