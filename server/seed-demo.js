const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'foodchain.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const TENANT_ID = 1;

console.log('Seeding', DB_PATH, '...\n');

// 1. Tenant
const existingTenant = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(TENANT_ID);
if (!existingTenant) {
  db.prepare("INSERT INTO foodchain_portal_tenants (id, name, nickname, allow_create_branches, access_mode, base_currency) VALUES (?, ?, ?, 1, 'development', 'RUB')")
    .run(TENANT_ID, 'Demo Restaurant', 'demo');
  console.log('  ✓ Default tenant created (id=1, name=Demo Restaurant)');
} else {
  console.log('  - Tenant already exists, skipping');
}

// 2. Branches
const existingBranch = db.prepare('SELECT id FROM branches WHERE id = ?').get(TENANT_ID);
if (!existingBranch) {
  db.prepare("INSERT INTO branches (id, name, address, phone, tenant_id) VALUES (?, ?, ?, ?, ?)")
    .run(TENANT_ID, 'Main Branch', 'Moscow, Tverskaya 1', '+7 (495) 123-45-67', TENANT_ID);
  console.log('  ✓ Default branch created');
} else {
  console.log('  - Branch already exists, skipping');
}

// 3. Staff accounts
const adminHash = bcrypt.hashSync('admin', 10);
const existingAdmin = db.prepare('SELECT id FROM staff WHERE username = ?').get('admin');
if (!existingAdmin) {
  db.prepare("INSERT INTO staff (username, password, role, first_name, last_name, phone, tenant_id, is_active) VALUES (?,?,?,?,?,?,?,1)")
    .run('admin', adminHash, 'admin', 'Admin', 'Adminov', '+7 (900) 000-00-01', TENANT_ID);
  console.log('  ✓ Admin created (login: admin, password: admin)');
} else {
  console.log('  - Admin already exists, skipping');
}

const existingWaiter = db.prepare('SELECT id FROM staff WHERE username = ?').get('waiter');
if (!existingWaiter) {
  db.prepare("INSERT INTO staff (username, password, role, first_name, tenant_id, is_active) VALUES (?,?,?,?,?,1)")
    .run('waiter', bcrypt.hashSync('waiter', 10), 'waiter', 'Waiter Test', TENANT_ID);
  console.log('  ✓ Waiter created (login: waiter, password: waiter)');
} else {
  console.log('  - Waiter already exists, skipping');
}

const existingChef = db.prepare('SELECT id FROM staff WHERE username = ?').get('chef');
if (!existingChef) {
  db.prepare("INSERT INTO staff (username, password, role, first_name, tenant_id, is_active) VALUES (?,?,?,?,?,1)")
    .run('chef', bcrypt.hashSync('chef', 10), 'chef', 'Chef Test', TENANT_ID);
  console.log('  ✓ Chef created (login: chef, password: chef)');
} else {
  console.log('  - Chef already exists, skipping');
}

// 4. Menu categories + dishes
const existingCat = db.prepare("SELECT id FROM menu_categories WHERE tenant_id = ? LIMIT 1").get(TENANT_ID);
if (!existingCat) {
  db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Appetizers', TENANT_ID, 1);
  db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Main Courses', TENANT_ID, 2);
  db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Drinks', TENANT_ID, 3);
  db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Desserts', TENANT_ID, 4);

  const cat1 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Appetizers' AND tenant_id = ?").get(TENANT_ID).id;
  const cat2 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Main Courses' AND tenant_id = ?").get(TENANT_ID).id;
  const cat3 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Drinks' AND tenant_id = ?").get(TENANT_ID).id;
  const cat4 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Desserts' AND tenant_id = ?").get(TENANT_ID).id;

  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Bruschetta with Tomatoes', cat1, 350, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Cheese Platter', cat1, 590, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Ribeye Steak', cat2, 1890, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Carbonara Pasta', cat2, 690, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Caesar with Chicken', cat2, 490, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Lemonade', cat3, 250, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Black Tea', cat3, 150, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Americano Coffee', cat3, 200, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Tiramisu', cat4, 450, TENANT_ID);
  db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Cheesecake', cat4, 390, TENANT_ID);
  console.log('  ✓ Menu created (4 categories, 10 dishes)');
} else {
  console.log('  - Menu already exists, skipping');
}

// 5. Inventory items (use current_stock + min_stock to match actual schema)
const existingInv = db.prepare("SELECT id FROM inventory_items WHERE tenant_id = ? LIMIT 1").get(TENANT_ID);
if (!existingInv) {
  db.prepare("INSERT INTO inventory_items (name, unit, current_stock, min_stock, tenant_id, category) VALUES (?,?,?,?,?,?)").run('Beef', 'kg', 50, 10, TENANT_ID, 'Meat');
  db.prepare("INSERT INTO inventory_items (name, unit, current_stock, min_stock, tenant_id, category) VALUES (?,?,?,?,?,?)").run('Chicken Fillet', 'kg', 30, 5, TENANT_ID, 'Meat');
  db.prepare("INSERT INTO inventory_items (name, unit, current_stock, min_stock, tenant_id, category) VALUES (?,?,?,?,?,?)").run('Spaghetti', 'kg', 20, 5, TENANT_ID, 'Groceries');
  db.prepare("INSERT INTO inventory_items (name, unit, current_stock, min_stock, tenant_id, category) VALUES (?,?,?,?,?,?)").run('Tomatoes', 'kg', 15, 3, TENANT_ID, 'Vegetables');
  db.prepare("INSERT INTO inventory_items (name, unit, current_stock, min_stock, tenant_id, category) VALUES (?,?,?,?,?,?)").run('Cheese', 'kg', 10, 2, TENANT_ID, 'Dairy');
  console.log('  ✓ Inventory created (5 items)');
} else {
  console.log('  - Inventory already exists, skipping');
}

// 6. Payment methods
const existingPay = db.prepare("SELECT id FROM payment_methods WHERE tenant_id = ? LIMIT 1").get(TENANT_ID);
if (!existingPay) {
  db.prepare("INSERT INTO payment_methods (name, type, is_active, tenant_id) VALUES (?,?,1,?)").run('Cash', 'cash', TENANT_ID);
  db.prepare("INSERT INTO payment_methods (name, type, is_active, tenant_id) VALUES (?,?,1,?)").run('Card', 'card', TENANT_ID);
  db.prepare("INSERT INTO payment_methods (name, type, is_active, tenant_id) VALUES (?,?,1,?)").run('QR Payment', 'qr', TENANT_ID);
  console.log('  ✓ Payment methods created (3)');
} else {
  console.log('  - Payment methods already exist, skipping');
}

// 7. Add sample orders
const existingOrder = db.prepare("SELECT id FROM orders WHERE tenant_id = ? LIMIT 1").get(TENANT_ID);
if (!existingOrder) {
  const dishes = db.prepare("SELECT id, name, price FROM dishes WHERE tenant_id = ? LIMIT 4").all(TENANT_ID);
  if (dishes.length >= 2) {
    const items1 = JSON.stringify([{ id: dishes[0].id, name: dishes[0].name, price: dishes[0].price, quantity: 2 }, { id: dishes[1].id, name: dishes[1].name, price: dishes[1].price, quantity: 1 }]);
    db.prepare("INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, status, type, payment_method, tenant_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))")
      .run(1, 'Test Guest', '+7 (900) 000-00-02', items1, dishes[0].price * 2 + dishes[1].price, dishes[0].price * 2 + dishes[1].price, 'delivered', 'delivery', 'card', TENANT_ID);

    const items2 = JSON.stringify([{ id: dishes[2].id, name: dishes[2].name, price: dishes[2].price, quantity: 1 }]);
    db.prepare("INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, status, type, payment_method, tenant_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','-1 day'))")
      .run(1, 'Test Guest', '+7 (900) 000-00-02', items2, dishes[2].price, dishes[2].price, 'new', 'dine-in', 'cash', TENANT_ID);
    console.log('  ✓ Sample orders created (2)');
  }
} else {
  console.log('  - Orders already exist, skipping');
}

console.log('\n✅ Seed complete!');
console.log('');
console.log('Login credentials:');
console.log('  Admin: login=admin  password=admin');
console.log('  Waiter: login=waiter  password=waiter');
console.log('  Chef:  login=chef   password=chef');
console.log('');
console.log('Auth endpoint: POST /api/auth/login (body: { tenantName, login, password })');
console.log('  tenantName = "demo"');
console.log('');

db.close();
