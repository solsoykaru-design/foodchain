CREATE TABLE IF NOT EXISTS subscriptions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id              INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tariff_id              INTEGER NOT NULL REFERENCES tariffs(id),
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','paused','expired','canceled')),
  start_date             TEXT,
  end_date               TEXT,
  auto_renew             INTEGER NOT NULL DEFAULT 1,
  payme_subscription_id  TEXT,
  cancel_reason          TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payme_transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id   INTEGER REFERENCES subscriptions(id),
  payme_id          TEXT NOT NULL,
  amount            REAL NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'UZS',
  state             INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','canceled')),
  perform_time      TEXT,
  cancel_time       TEXT,
  reason            INTEGER,
  payme_response    TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payme ON subscriptions(payme_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payme_transactions_tenant ON payme_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payme_transactions_payme ON payme_transactions(payme_id);
