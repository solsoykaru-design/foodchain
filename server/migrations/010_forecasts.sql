CREATE TABLE IF NOT EXISTS forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  forecast_date TEXT NOT NULL,
  forecast_quantity REAL DEFAULT 0,
  actual_quantity REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES inventory_items(id)
);
CREATE INDEX IF NOT EXISTS idx_forecasts_product ON forecasts(product_id, forecast_date);

ALTER TABLE inventory_items ADD COLUMN min_stock REAL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN default_contragent_id INTEGER;
