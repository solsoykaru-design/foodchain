-- Enterprise payroll tables

ALTER TABLE salary ADD COLUMN ndfl_amount REAL DEFAULT 0;
ALTER TABLE salary ADD COLUMN net_amount REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payroll_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1 UNIQUE,
  ndfl_rate REAL DEFAULT 0.13,
  night_rate_multiplier REAL DEFAULT 1.5,
  holiday_rate_multiplier REAL DEFAULT 2.0,
  overtime_rate_multiplier REAL DEFAULT 1.5,
  weekly_hours_norm REAL DEFAULT 40,
  daily_hours_norm REAL DEFAULT 8,
  kpi_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timesheet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  staff_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  break_minutes INTEGER DEFAULT 0,
  note TEXT,
  is_approved INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timesheet_staff ON timesheet(tenant_id, staff_id, date);

CREATE TABLE IF NOT EXISTS kpi_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'all',
  metric TEXT NOT NULL,
  threshold REAL DEFAULT 0,
  bonus_amount REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
