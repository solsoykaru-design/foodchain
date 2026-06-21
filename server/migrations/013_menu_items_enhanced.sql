-- Add unit column for unit of measure (г, кг, л, мл, шт)
ALTER TABLE dishes ADD COLUMN unit TEXT DEFAULT 'г';

-- Add netto column as alias for weight (выход нетто)
ALTER TABLE dishes ADD COLUMN netto REAL DEFAULT 0;

-- Add is_active column (sync with is_available)
ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1;

-- Add tenant_id for multi-tenancy
ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 0;

-- Create index for faster menu-items queries
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_type ON dishes(type);
CREATE INDEX IF NOT EXISTS idx_dishes_barcode ON dishes(barcode);
CREATE INDEX IF NOT EXISTS idx_dishes_article ON dishes(article);
CREATE INDEX IF NOT EXISTS idx_dishes_tenant_id ON dishes(tenant_id);
