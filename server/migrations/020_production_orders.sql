-- Production orders / prep sheets

CREATE TABLE IF NOT EXISTS production_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  name TEXT,
  tech_card_id INTEGER,
  planned_quantity REAL DEFAULT 0,
  produced_quantity REAL DEFAULT 0,
  status TEXT DEFAULT 'planned',
  note TEXT,
  planned_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_production_orders_tenant
  ON production_orders(tenant_id, status, planned_at);

CREATE TABLE IF NOT EXISTS production_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  required_quantity REAL DEFAULT 0,
  unit TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_production_order_items_order
  ON production_order_items(order_id, item_id);
