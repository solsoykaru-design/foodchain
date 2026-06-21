const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'foodchain.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  INSERT OR IGNORE INTO couriers (id, name, phone, password, is_available) VALUES (1, 'Алексей Петров', '+79001112233', '123', 1);
  INSERT OR IGNORE INTO couriers (id, name, phone, password, is_available) VALUES (2, 'Дмитрий Соколов', '+79004445566', '123', 1);
  INSERT OR IGNORE INTO couriers (id, name, phone, password, is_available) VALUES (3, 'Иван Иванов', '+79007778899', '123', 1);
  INSERT OR IGNORE INTO users (id, name, phone, role) VALUES (1, 'Гость Тестовый', '+79990001122', 'guest');
  INSERT OR IGNORE INTO users (id, name, phone, role) VALUES (2, 'Админ', '+79991112233', 'admin');
`);

console.log('Seed data inserted');
