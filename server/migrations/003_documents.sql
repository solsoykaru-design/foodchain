CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  number TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  counterparty TEXT DEFAULT '',
  sum REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  items TEXT DEFAULT '[]',
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
