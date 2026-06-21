-- =============================================================
-- Migration 014: Documentation of the menu_items (dishes) schema
-- =============================================================
-- The system uses the `dishes` table for menu items.
-- Below is the full schema reference.
-- =============================================================

CREATE TABLE IF NOT EXISTS dishes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    compound        TEXT,
    price           REAL NOT NULL DEFAULT 0,
    old_price       REAL,
    image_url       TEXT,
    category_id     INTEGER REFERENCES menu_categories(id),
    weight          REAL DEFAULT 0,
    netto           REAL DEFAULT 0,          -- Выход нетто (вес блюда)
    unit            TEXT DEFAULT 'г',         -- Ед. изм.: г, кг, мл, л, шт
    calories        REAL,
    proteins        REAL,
    fats            REAL,
    carbs           REAL,
    kbju            TEXT,
    is_available    INTEGER DEFAULT 1,       -- Активный (1 = да, 0 = нет)
    is_active       INTEGER DEFAULT 1,       -- Синхронизация с is_available
    is_popular      INTEGER DEFAULT 0,
    is_new          INTEGER DEFAULT 0,
    tags            TEXT DEFAULT '[]',
    allergens       TEXT DEFAULT '[]',
    barcode         TEXT,                     -- Штрихкод (до 14 символов)
    article         TEXT,                     -- Внутренний артикул
    type            TEXT DEFAULT 'goods',     -- Тип: goods (Товар), service (Услуга)
    cost            REAL DEFAULT 0,          -- Себестоимость
    markup          REAL DEFAULT 0,          -- Наценка (авторасчёт)
    tech_card_id    INTEGER REFERENCES tech_cards(id),
    branch_id       INTEGER DEFAULT 0,       -- Филиал/магазин
    display_order   INTEGER DEFAULT 0,
    tenant_id       INTEGER DEFAULT 0,       -- Мультитенантность
    rating          REAL DEFAULT 0,
    review_count    INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast filtering & search
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_type ON dishes(type);
CREATE INDEX IF NOT EXISTS idx_dishes_barcode ON dishes(barcode);
CREATE INDEX IF NOT EXISTS idx_dishes_article ON dishes(article);
CREATE INDEX IF NOT EXISTS idx_dishes_tenant_id ON dishes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_branch_id ON dishes(branch_id);
CREATE INDEX IF NOT EXISTS idx_dishes_is_available ON dishes(is_available);
