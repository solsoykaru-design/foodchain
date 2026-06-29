-- Honest Sign / EGAIS integration tables

ALTER TABLE honest_sign_settings ADD COLUMN fsrar_id TEXT DEFAULT '';
ALTER TABLE honest_sign_settings ADD COLUMN gost_key_path TEXT DEFAULT '';
ALTER TABLE honest_sign_settings ADD COLUMN test_mode INTEGER DEFAULT 1;
ALTER TABLE honest_sign_settings ADD COLUMN api_url TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS marking_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  product_id INTEGER,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  document_id INTEGER,
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marking_codes_tenant ON marking_codes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marking_codes_code ON marking_codes(tenant_id, code);

CREATE TABLE IF NOT EXISTS honest_sign_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  type TEXT NOT NULL,
  doc_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  xml_payload TEXT,
  reason TEXT,
  total_quantity REAL DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  sent_at TEXT,
  response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_honest_sign_documents_tenant ON honest_sign_documents(tenant_id, created_at);
