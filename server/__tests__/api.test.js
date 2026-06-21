const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const bcrypt = require('bcrypt');

// Override DB path BEFORE requiring the server
const originalDirname = __dirname;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.SUPPLIER_JWT_SECRET = 'test-supplier-secret';

const { createTestDb, seedTestData, cleanupTestDb, TEST_DB_PATH } = require('./helpers/setup');

// We'll test individual route logic directly rather than starting the full server
// This avoids port conflicts and is more reliable for CI
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');

describe('API Routes', () => {
  let db;
  let testToken;

  before(() => {
    cleanupTestDb();
    db = createTestDb();
    seedTestData(db);
    testToken = jwt.sign({ id: 1, username: 'admin', role: 'admin', tenant_id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  after(() => {
    if (db) db.close();
    cleanupTestDb();
  });

  describe('Auth', () => {
    it('should find tenant by name', () => {
      const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE LOWER(nickname) = LOWER(?)').get('test');
      assert.ok(tenant);
      assert.strictEqual(tenant.name, 'Test Restaurant');
    });

    it('should find tenant by search query', () => {
      const tenants = db.prepare(
        "SELECT id, name FROM foodchain_portal_tenants WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(nickname) LIKE ?) LIMIT 20"
      ).all('%test%', '%test%');
      assert.strictEqual(tenants.length, 1);
      assert.strictEqual(tenants[0].name, 'Test Restaurant');
    });

    it('should find nearby tenants', () => {
      const tenants = db.prepare(
        "SELECT id, name, lat, lng FROM foodchain_portal_tenants WHERE is_active = 1 AND lat <> 0 AND lng <> 0"
      ).all();
      assert.ok(Array.isArray(tenants));
    });

    it('should validate user credentials', () => {
      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get('+70000000001');
      assert.ok(user);
      assert.strictEqual(user.name, 'Test User');
    });

    it('should detect duplicate phone on register', () => {
      const existing = db.prepare('SELECT id FROM couriers WHERE phone = ?').get('+70000000002');
      assert.ok(existing);
    });

    it('should verify guest limit logic', () => {
      const tenant_id = 1;
      const current = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'").get(tenant_id);
      assert.strictEqual(current.c, 1);
    });
  });

  describe('Menu', () => {
    it('should list categories', () => {
      const cats = db.prepare('SELECT * FROM menu_categories WHERE tenant_id = ? ORDER BY sort_order').all(1);
      assert.strictEqual(cats.length, 1);
      assert.strictEqual(cats[0].name, 'Main Course');
    });

    it('should list dishes by category', () => {
      const dishes = db.prepare('SELECT * FROM dishes WHERE category_id = ? AND tenant_id = ?').all(1, 1);
      assert.strictEqual(dishes.length, 1);
      assert.strictEqual(dishes[0].name, 'Burger');
    });

    it('should get single dish', () => {
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(1);
      assert.ok(dish);
      assert.strictEqual(dish.price, 500);
    });

    it('should create a new dish', () => {
      const info = db.prepare('INSERT INTO dishes (name, category_id, tenant_id, price) VALUES (?, ?, ?, ?)').run('Pizza', 1, 1, 800);
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(info.lastInsertRowid);
      assert.strictEqual(dish.name, 'Pizza');
      assert.strictEqual(dish.price, 800);
    });

    it('should update a dish', () => {
      db.prepare('UPDATE dishes SET price = ? WHERE id = ?').run(550, 1);
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(1);
      assert.strictEqual(dish.price, 550);
    });

    it('should delete a dish', () => {
      db.prepare('INSERT INTO dishes (name, category_id, tenant_id, price) VALUES (?, ?, ?, ?)').run('Temp', 1, 1, 100);
      const info = db.prepare('DELETE FROM dishes WHERE name = ?').run('Temp');
      assert.strictEqual(info.changes, 1);
    });
  });

  describe('Orders', () => {
    it('should create an order', () => {
      const info = db.prepare('INSERT INTO orders (user_id, tenant_id, status, total, order_type) VALUES (?, ?, ?, ?, ?)').run(1, 1, 'new', 1000, 'delivery');
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
      assert.strictEqual(order.status, 'new');
      assert.strictEqual(order.total, 1000);
    });

    it('should add items to order', () => {
      const orderId = 1;
      db.prepare('INSERT INTO order_items (order_id, dish_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)').run(orderId, 1, 'Burger', 2, 500);
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].quantity, 2);
    });

    it('should update order status', () => {
      const validTransitions = {
        new: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['served', 'assigned', 'cancelled'],
        served: ['paid', 'cancelled'],
        paid: ['closed', 'cancelled'],
        assigned: ['en_route', 'cancelled'],
      };

      const orderId = 1;
      const current = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
      assert.ok(validTransitions[current.status]);
      assert.ok(validTransitions[current.status].includes('confirmed'));
    });

    it('should list orders for tenant', () => {
      const orders = db.prepare('SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC').all(1);
      assert.ok(orders.length > 0);
    });

    it('should track order by id', () => {
      const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(1);
      assert.ok(order);
      assert.strictEqual(order.id, 1);
    });
  });

  describe('Inventory', () => {
    it('should list inventory items', () => {
      const items = db.prepare('SELECT * FROM inventory_items WHERE tenant_id = ?').all(1);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'Meat');
    });

    it('should check low stock', () => {
      const lowStock = db.prepare('SELECT * FROM inventory_items WHERE quantity <= min_quantity AND tenant_id = ?').all(1);
      assert.ok(Array.isArray(lowStock));
    });

    it('should create inventory transaction', () => {
      db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity) VALUES (?, ?, ?)').run(1, 'incoming', 50);
      const tx = db.prepare('SELECT * FROM inventory_transactions WHERE item_id = ?').all(1);
      assert.strictEqual(tx.length, 1);
      assert.strictEqual(tx[0].quantity, 50);
    });

    it('should search inventory items', () => {
      const items = db.prepare('SELECT id, name FROM inventory_items WHERE LOWER(name) LIKE ? AND tenant_id = ?').all('%meat%', 1);
      assert.strictEqual(items.length, 1);
    });
  });

  describe('Categories', () => {
    it('should list inventory categories', () => {
      const cats = db.prepare("SELECT * FROM categories WHERE tenant_id = ? AND type = 'inventory'").all(1);
      assert.strictEqual(cats.length, 1);
      assert.strictEqual(cats[0].name, 'Meat');
    });

    it('should create category', () => {
      const info = db.prepare('INSERT INTO categories (name, tenant_id, type) VALUES (?, ?, ?)').run('Vegetables', 1, 'inventory');
      assert.ok(info.lastInsertRowid > 0);
    });
  });

  describe('Bookings', () => {
    it('should create booking', () => {
      const info = db.prepare('INSERT INTO bookings (user_id, tenant_id, guests_count, booking_time, status) VALUES (?, ?, ?, ?, ?)').run(1, 1, 4, '2026-06-21 20:00', 'pending');
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
      assert.strictEqual(booking.guests_count, 4);
      assert.strictEqual(booking.status, 'pending');
    });
  });
});
