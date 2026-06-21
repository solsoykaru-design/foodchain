-- Migration 005: Online Payment Module
-- Adds support for online payments via Yookassa, CloudPayments, T-Bank

-- Payment transactions
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER DEFAULT 1,
  order_id INTEGER,
  subscription_id INTEGER,
  external_payment_id TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'RUB',
  status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'card',
  provider TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  description TEXT,
  return_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_external ON payments(external_payment_id);

-- Subscriptions for tenant portal
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  tariff_id INTEGER,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  auto_renew INTEGER DEFAULT 1,
  payment_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Available tariffs
CREATE TABLE IF NOT EXISTS tariffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  period TEXT DEFAULT 'month',
  description TEXT,
  features TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Payment provider settings
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 0,
  credentials TEXT DEFAULT '{}',
  test_mode INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default payment provider settings
INSERT OR IGNORE INTO payment_settings (provider, enabled, credentials, test_mode) VALUES ('yookassa', 0, '{}', 1);
INSERT OR IGNORE INTO payment_settings (provider, enabled, credentials, test_mode) VALUES ('cloudpayments', 0, '{}', 1);
INSERT OR IGNORE INTO payment_settings (provider, enabled, credentials, test_mode) VALUES ('tbank', 0, '{}', 1);

-- Orders table extensions for online payments
ALTER TABLE orders ADD COLUMN is_paid_online INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_id TEXT;

-- Seed default tariff
INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order)
VALUES (1, 'Базовый', 9990, 'month', 'Базовый тариф для одного ресторана', '["До 100 заказов/день","Базовая аналитика","Поддержка по email","1 пользователь"]', 1, 1);

INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order)
VALUES (2, 'Профессиональный', 24900, 'month', 'Для активно развивающихся ресторанов', '["До 500 заказов/день","Расширенная аналитика","Приоритетная поддержка","До 5 пользователей","Интеграция с агрегаторами"]', 1, 2);

INSERT OR IGNORE INTO tariffs (id, name, price, period, description, features, is_active, sort_order)
VALUES (3, 'Enterprise', 59900, 'month', 'Для сетей ресторанов', '["Безлимит заказов","Полная аналитика","Выделенный менеджер","Неограничено пользователей","Все интеграции","White label"]', 1, 3);
