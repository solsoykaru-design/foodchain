const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const posService = require('../services/pos.service');
const posInventory = require('../services/pos-inventory.service');

function dbPath(name) { return path.join(__dirname, `${name}-test.db`); }
function cleanup(name) {
  [dbPath(name), dbPath(name) + '-shm', dbPath(name) + '-wal'].forEach(p => {
    try { fs.unlinkSync(p); } catch {}
  });
}
function createDb(name) {
  cleanup(name);
  const db = new Database(dbPath(name));
  db.pragma('journal_mode = WAL');
  return db;
}

describe('POS Service', () => {
  let db;

  before(() => {
    db = createDb('pos-service');
    db.exec('CREATE TABLE orders (id INTEGER PRIMARY KEY, tenant_id INTEGER DEFAULT 1, status TEXT DEFAULT \'new\', total REAL DEFAULT 0, created_at TEXT DEFAULT (datetime(\'now\')))');
    posService.initTables(db);
  });

  beforeEach(() => {
    db.prepare('DELETE FROM pos_shifts').run();
  });

  after(() => {
    if (db) db.close();
    cleanup('pos-service');
  });

  it('should open and close a shift', () => {
    const open = posService.openShift(db, 1, { staffId: 1, staffName: 'Admin', openingBalance: 1000 });
    assert.ok(open.id);
    assert.strictEqual(open.status, 'open');

    const closed = posService.closeShift(db, 1, open.id, { closedBy: 1, closedByName: 'Admin', closingBalance: 1500 });
    assert.strictEqual(closed.status, 'closed');
    assert.strictEqual(closed.closing_balance, 1500);
  });

  it('should create a receipt and list receipts', () => {
    const shift = posService.openShift(db, 1, { openedBy: 1, openedByName: 'Admin', openingBalance: 500 });
    const receipt = posService.createReceipt(db, 1, { orderId: 1, shiftId: shift.id, total: 1200, paymentMethod: 'cash', paymentAmount: 1200, changeAmount: 0, createdBy: 1, createdByName: 'Admin' });
    assert.ok(receipt.id);
    assert.strictEqual(receipt.total, 1200);

    const list = posService.getReceipts(db, 1, { shiftId: shift.id });
    assert.strictEqual(list.length, 1);
  });

  it('should log and retrieve action logs', () => {
    posService.logAction(db, 1, { shiftId: 1, action: 'test_action', details: 'test', createdBy: 1, createdByName: 'Admin' });
    const logs = posService.getActionLogs(db, 1, 10);
    assert.ok(logs.length >= 1);
    assert.strictEqual(logs[0].action, 'test_action');
  });
});

describe('POS Inventory Write-off', () => {
  let db;

  before(() => {
    db = createDb('pos-inventory');
    db.exec(`
      CREATE TABLE dishes (id INTEGER PRIMARY KEY, name TEXT, tech_card_id INTEGER, tenant_id INTEGER DEFAULT 1);
      CREATE TABLE tech_card_ingredients (id INTEGER PRIMARY KEY, tech_card_id INTEGER, item_id INTEGER, quantity REAL, unit TEXT, loss_percent REAL DEFAULT 0, cold_loss_percent REAL DEFAULT 0, heat_loss_percent REAL DEFAULT 0);
      CREATE TABLE inventory_items (id INTEGER PRIMARY KEY, name TEXT, current_stock REAL DEFAULT 0, current_balance REAL DEFAULT 0, price_per_unit REAL DEFAULT 0, tenant_id INTEGER DEFAULT 1);
      CREATE TABLE inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, type TEXT, quantity REAL, price_per_unit REAL, total REAL, supplier_name TEXT, note TEXT, document_number TEXT, tenant_id INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, dish_id INTEGER, quantity INTEGER DEFAULT 1, name TEXT);
    `);
    db.prepare('INSERT INTO dishes (id, name, tech_card_id) VALUES (?, ?, ?)').run(1, 'Burger', 1);
    db.prepare('INSERT INTO inventory_items (id, name, current_stock, current_balance, price_per_unit) VALUES (?, ?, ?, ?, ?)').run(1, 'Meat', 10, 10, 300);
    db.prepare('INSERT INTO tech_card_ingredients (id, tech_card_id, item_id, quantity, unit) VALUES (?, ?, ?, ?, ?)').run(1, 1, 1, 200, 'г');
    db.prepare('INSERT INTO order_items (order_id, dish_id, quantity) VALUES (?, ?, ?)').run(100, 1, 2);
  });

  after(() => {
    if (db) db.close();
    cleanup('pos-inventory');
  });

  it('should deduct ingredients when order is paid', () => {
    const res = posInventory.writeOffOrder(db, 100);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.deductionsCount, 1);

    const item = db.prepare('SELECT * FROM inventory_items WHERE id = 1').get();
    // 200g * 2 qty / 1000 = 0.4 kg
    assert.strictEqual(item.current_stock, 9.6);
    assert.strictEqual(item.current_balance, 9.6);

    const txs = db.prepare('SELECT * FROM inventory_transactions WHERE item_id = 1').all();
    assert.strictEqual(txs.length, 1);
    assert.strictEqual(txs[0].type, 'write_off');
  });
});
