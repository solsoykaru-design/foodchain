CREATE TABLE IF NOT EXISTS courier_shift_payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  timesheet_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  orders_count INTEGER DEFAULT 0,
  km REAL DEFAULT 0,
  per_order_amount REAL DEFAULT 0,
  per_km_amount REAL DEFAULT 0,
  hourly_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  details TEXT DEFAULT '{}',
  calculated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, timesheet_id)
);

CREATE INDEX IF NOT EXISTS idx_courier_shift_payroll_staff_date ON courier_shift_payroll(tenant_id, staff_id, date);
CREATE INDEX IF NOT EXISTS idx_courier_shift_payroll_timesheet ON courier_shift_payroll(tenant_id, timesheet_id);
