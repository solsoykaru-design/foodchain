-- Inventory count (acts of inventory / пересчёт) tables

CREATE TABLE IF NOT EXISTS inventory_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  warehouse_id INTEGER,
  status TEXT DEFAULT 'draft',
  note TEXT,
  counted_by TEXT,
  counted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_tenant
  ON inventory_counts(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS inventory_count_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  count_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  expected_quantity REAL DEFAULT 0,
  actual_quantity REAL,
  difference REAL DEFAULT 0,
  unit TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_count_items_count
  ON inventory_count_items(count_id, item_id);
