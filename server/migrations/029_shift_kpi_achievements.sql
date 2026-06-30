CREATE TABLE IF NOT EXISTS shift_kpi_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  timesheet_id INTEGER NOT NULL,
  staff_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold REAL DEFAULT 0,
  value REAL DEFAULT 0,
  bonus_amount REAL DEFAULT 0,
  achieved INTEGER DEFAULT 0,
  calculated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, timesheet_id, kpi_name)
);

CREATE INDEX IF NOT EXISTS idx_shift_kpi_staff_date ON shift_kpi_achievements(tenant_id, staff_id, date);
