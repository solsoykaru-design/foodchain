CREATE TABLE IF NOT EXISTS payment_providers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 0,
  config        TEXT NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE subscriptions ADD COLUMN provider TEXT DEFAULT 'payme';
ALTER TABLE payme_transactions ADD COLUMN provider TEXT DEFAULT 'payme';
ALTER TABLE payme_transactions ADD COLUMN provider_transaction_id TEXT;
ALTER TABLE payme_transactions ADD COLUMN card_info TEXT;
ALTER TABLE payme_transactions ADD COLUMN payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider);
CREATE INDEX IF NOT EXISTS idx_payme_transactions_provider ON payme_transactions(provider);

INSERT OR IGNORE INTO payment_providers (code, name, description, is_active, sort_order) VALUES
  ('payme',        'Payme Uzbekistan',   'Платёжная система для Узбекистана', 1, 1),
  ('yookassa',     'ЮKassa',             'Приём платежей в России (карты, СБП, T-Pay)', 0, 2),
  ('cloudpayments','CloudPayments',      'Подписки для России с автосписанием', 0, 3),
  ('tbank',        'Т-Банк (Т-Касса)',   'Приём платежей через Т-Банк', 0, 4);
