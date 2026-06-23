ALTER TABLE tenants ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'demo' CHECK (access_mode IN ('demo', 'production'));
ALTER TABLE tenants ADD COLUMN demo_data_created_at TEXT;
ALTER TABLE tenants ADD COLUMN demo_auto_cleanup_days INTEGER NOT NULL DEFAULT 30;
