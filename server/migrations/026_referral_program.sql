-- Referral program tables

CREATE TABLE IF NOT EXISTS referral_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1 UNIQUE,
  enabled INTEGER DEFAULT 0,
  referrer_bonus REAL DEFAULT 100,
  referee_bonus REAL DEFAULT 100,
  min_order_amount REAL DEFAULT 500,
  bonus_type TEXT DEFAULT 'points',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  used_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  referrer_id INTEGER NOT NULL,
  referee_id INTEGER NOT NULL,
  code TEXT,
  status TEXT DEFAULT 'pending',
  order_amount REAL,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(tenant_id, referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(tenant_id, referee_id);
