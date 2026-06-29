-- RFM and marketing campaigns

-- Precomputed RFM scores per user
CREATE TABLE IF NOT EXISTS user_rfm (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tenant_id INTEGER DEFAULT 1,
  recency_days INTEGER,
  frequency INTEGER,
  monetary REAL,
  r_score INTEGER,
  f_score INTEGER,
  m_score INTEGER,
  segment TEXT,
  calculated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rfm_segment
  ON user_rfm(tenant_id, segment);

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  trigger_type TEXT DEFAULT 'manual',
  trigger_config TEXT DEFAULT '{}',
  segment_filter TEXT DEFAULT '{}',
  channel TEXT DEFAULT 'push',
  message_title TEXT,
  message_body TEXT,
  discount_percent REAL,
  discount_amount REAL,
  bonus_amount REAL,
  ab_enabled INTEGER DEFAULT 0,
  ab_config TEXT DEFAULT '{}',
  scheduled_at TEXT,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant
  ON campaigns(tenant_id, status, created_at);

-- Campaign variants for A/B testing
CREATE TABLE IF NOT EXISTS campaign_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  name TEXT,
  message_title TEXT,
  message_body TEXT,
  discount_percent REAL,
  discount_amount REAL,
  bonus_amount REAL,
  weight INTEGER DEFAULT 50,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0
);

-- Campaign execution log
CREATE TABLE IF NOT EXISTS campaign_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  variant_id INTEGER,
  user_id INTEGER NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TEXT DEFAULT (datetime('now')),
  opened_at TEXT,
  converted_at TEXT,
  order_id INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign
  ON campaign_logs(campaign_id, status);
