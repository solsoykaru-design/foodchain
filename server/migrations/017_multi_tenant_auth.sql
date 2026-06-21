ALTER TABLE foodchain_portal_tenants ADD COLUMN nickname TEXT;
ALTER TABLE foodchain_portal_tenants ADD COLUMN lat REAL DEFAULT 0;
ALTER TABLE foodchain_portal_tenants ADD COLUMN lng REAL DEFAULT 0;
ALTER TABLE foodchain_portal_tenants ADD COLUMN address TEXT;
ALTER TABLE foodchain_portal_tenants ADD COLUMN photo_url TEXT;
ALTER TABLE foodchain_portal_tenants ADD COLUMN is_active INTEGER DEFAULT 1;
