const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const TEST_DB_PATH = path.join(__dirname, '..', 'test-foodchain.db');

function createTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS foodchain_portal_tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      is_active INTEGER DEFAULT 1,
      photo_url TEXT,
      app_settings TEXT
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      role TEXT,
      tenant_id INTEGER,
      name TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      password TEXT,
      role TEXT DEFAULT 'guest',
      tenant_id INTEGER,
      total_spent REAL DEFAULT 0,
      visits_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS couriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      password TEXT,
      is_available INTEGER DEFAULT 1,
      lat REAL,
      lng REAL
    );
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      is_visible INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      description TEXT,
      photo_url TEXT,
      is_available INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      description TEXT,
      photo_url TEXT,
      is_available INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      status TEXT DEFAULT 'new',
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivery_address TEXT,
      comment TEXT,
      order_type TEXT DEFAULT 'delivery',
      payment_method TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      dish_id INTEGER,
      name TEXT,
      quantity INTEGER DEFAULT 1,
      price REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      rating INTEGER,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT,
      body TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_2fa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      secret TEXT,
      enabled INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1,
      type TEXT DEFAULT 'inventory'
    );
    CREATE TABLE IF NOT EXISTS tech_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      dish_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      output_weight REAL,
      selling_price REAL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      unit TEXT DEFAULT 'шт',
      quantity REAL DEFAULT 0,
      min_quantity REAL DEFAULT 0,
      price REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      type TEXT,
      quantity REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS contragents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tenant_id INTEGER DEFAULT 1,
      table_id INTEGER,
      guests_count INTEGER,
      booking_time DATETIME,
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS booking_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      capacity INTEGER DEFAULT 4,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pickup_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS tech_card_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tech_card_id INTEGER,
      inventory_item_id INTEGER,
      quantity REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS client_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS review_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS warehouse_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      branch_id INTEGER,
      quantity REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stock_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_id INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER,
      quantity REAL DEFAULT 0,
      expiry_date TEXT
    );
    CREATE TABLE IF NOT EXISTS packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER,
      name TEXT,
      quantity REAL DEFAULT 0
    );
  `);

  return db;
}

function seedTestData(db) {
  db.prepare(`INSERT INTO foodchain_portal_tenants (id, name, nickname, is_active) VALUES (1, 'Test Restaurant', 'test', 1)`).run();
  db.prepare(`INSERT INTO staff (id, username, password, role, tenant_id, name, is_active) VALUES (1, 'admin', '$2b$10$dummyhash', 'admin', 1, 'Admin', 1)`).run();
  db.prepare(`INSERT INTO users (id, name, phone, role, tenant_id) VALUES (1, 'Test User', '+70000000001', 'guest', 1)`).run();
  db.prepare(`INSERT INTO couriers (id, name, phone) VALUES (1, 'Test Courier', '+70000000002')`).run();
  db.prepare(`INSERT INTO menu_categories (id, name, tenant_id) VALUES (1, 'Main Course', 1)`).run();
  db.prepare(`INSERT INTO dishes (id, name, category_id, tenant_id, price, description) VALUES (1, 'Burger', 1, 1, 500, 'Delicious burger')`).run();
  db.prepare(`INSERT INTO categories (id, name, tenant_id, type) VALUES (1, 'Meat', 1, 'inventory')`).run();
  db.prepare(`INSERT INTO inventory_items (id, name, category_id, tenant_id, unit, quantity, min_quantity, price) VALUES (1, 'Meat', 1, 1, 'kg', 100, 10, 300)`).run();
}

function cleanupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch (e) {}
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch (e) {}
  }
}

module.exports = { createTestDb, seedTestData, cleanupTestDb, TEST_DB_PATH };
