-- Tenant extended fields
ALTER TABLE tenants ADD COLUMN logo_url TEXT;
ALTER TABLE tenants ADD COLUMN contact_phone TEXT;
ALTER TABLE tenants ADD COLUMN contact_email TEXT;
ALTER TABLE tenants ADD COLUMN legal_address TEXT;
ALTER TABLE tenants ADD COLUMN working_hours TEXT;
ALTER TABLE tenants ADD COLUMN allow_create_branches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';

-- Branches (tenant branches/points)
CREATE TABLE IF NOT EXISTS branches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

-- Superadmin action logs
CREATE TABLE IF NOT EXISTS superadmin_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  superadmin_id   INTEGER NOT NULL REFERENCES users(id),
  tenant_id       INTEGER REFERENCES tenants(id),
  action          TEXT NOT NULL,
  details         TEXT,
  ip_address      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_superadmin_logs_admin ON superadmin_logs(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_logs_tenant ON superadmin_logs(tenant_id);

-- Password reset tokens for tenant admins
CREATE TABLE IF NOT EXISTS password_resets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES staff_accounts(id),
  temp_password   TEXT NOT NULL,
  is_used         INTEGER NOT NULL DEFAULT 0,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  used_at         TEXT
);
