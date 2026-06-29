-- Purchase orders to suppliers

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  supplier_id INTEGER,
  status TEXT DEFAULT 'draft',
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'RUB',
  note TEXT,
  expected_delivery TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant
  ON purchase_orders(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity REAL DEFAULT 0,
  price_per_unit REAL DEFAULT 0,
  total REAL DEFAULT 0,
  received_quantity REAL DEFAULT 0,
  unit TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
  ON purchase_order_items(order_id, item_id);
