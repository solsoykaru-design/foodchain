const Database = require('better-sqlite3');
const db = new Database('database.db');
try {
  db.exec(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT,
    value REAL,
    min_order REAL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1
  )`);
  console.log('promo_codes table OK');
  const count = db.prepare('SELECT COUNT(*) as c FROM promo_codes').get();
  console.log('count:', count.c);
  db.prepare("INSERT OR IGNORE INTO promo_codes (code, type, value, min_order, is_active) VALUES ('FIRST100', 'fixed', 100, 0, 1)").run();
  db.prepare("INSERT OR IGNORE INTO promo_codes (code, type, value, min_order, is_active) VALUES ('PIZZA20', 'percent', 20, 500, 1)").run();
  console.log('sample promos inserted');
} catch(e) {
  console.error('Error:', e.message);
}
db.close();
