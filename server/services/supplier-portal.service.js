const bcrypt = require('bcrypt');

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_portal_user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_portal_user_id) REFERENCES supplier_portal_users(id)
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_portal_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      permissions TEXT DEFAULT '{"prices":1,"stock":1,"orders":1,"products":1}',
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'RUB',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (product_id) REFERENCES inventory_items(id),
      UNIQUE(supplier_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS supplier_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (product_id) REFERENCES inventory_items(id),
      UNIQUE(supplier_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS supplier_order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      order_id INTEGER,
      document_number TEXT,
      product_id INTEGER,
      quantity REAL,
      price REAL,
      total REAL,
      status TEXT DEFAULT 'new',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      supplier_id INTEGER,
      portal_user_id INTEGER,
      action TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const existingUser = db.prepare('SELECT id FROM supplier_portal_users LIMIT 1').get();
  if (!existingUser) {
    const info = db.prepare("INSERT INTO suppliers (name, contact_person, phone, email) VALUES (?, ?, ?, ?)").run('ООО "Поставщик"', 'Иван Иванов', '+7 (999) 123-45-67', 'info@supplier.ru');
    const supplierId = info.lastInsertRowid;
    const hash = hashPassword('supplier123');
    db.prepare("INSERT INTO supplier_portal_users (supplier_id, login, password_hash, permissions) VALUES (?, ?, ?, ?)").run(supplierId, 'supplier', hash, '{"prices":1,"stock":1,"orders":1,"products":1}');
    const items = db.prepare('SELECT id, name FROM inventory_items LIMIT 5').all();
    for (const item of items) {
      db.prepare("INSERT INTO supplier_products (supplier_id, product_id, price) VALUES (?, ?, ?)").run(supplierId, item.id, Math.round(Math.random() * 1000 + 100));
    }
    db.prepare("INSERT INTO supplier_order_history (supplier_id, product_id, quantity, price, total, status) VALUES (?, ?, ?, ?, ?, ?)").run(supplierId, items[0]?.id || 1, 10, 500, 5000, 'delivered');
    db.prepare("INSERT INTO supplier_order_history (supplier_id, product_id, quantity, price, total, status) VALUES (?, ?, ?, ?, ?, ?)").run(supplierId, items[1]?.id || 1, 5, 300, 1500, 'new');
  }
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function authenticate(db, login, password) {
  const user = db.prepare('SELECT * FROM supplier_portal_users WHERE login = ? AND is_active = 1').get(login);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  db.prepare("UPDATE supplier_portal_users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(user.supplier_id);
  return { ...user, supplier };
}

function logActivity(db, { tenantId, supplierId, portalUserId, action, details, ip }) {
  db.prepare('INSERT INTO supplier_activity_log (tenant_id, supplier_id, portal_user_id, action, details, ip) VALUES (?, ?, ?, ?, ?, ?)').run(
    tenantId || 1, supplierId || null, portalUserId || null, action, details || '', ip || ''
  );
}

function getProductCatalog(db, supplierId, tenantId = 1) {
  const products = db.prepare(`
    SELECT sp.id as link_id, ii.id, ii.name, ii.unit, ii.barcode,
           ii.current_stock, ii.min_stock, sp.price, sp.updated_at as price_updated_at,
           COALESCE(ss.quantity, 0) as supplier_quantity
    FROM supplier_products sp
    JOIN inventory_items ii ON ii.id = sp.product_id
    LEFT JOIN supplier_stock ss ON ss.supplier_id = sp.supplier_id AND ss.product_id = sp.product_id
    WHERE sp.supplier_id = ? AND sp.is_active = 1 AND sp.tenant_id = ?
    ORDER BY ii.name
  `).all(supplierId, tenantId);
  return products;
}

function updatePrices(db, supplierId, prices, tenantId = 1) {
  const txn = db.transaction(() => {
    const stmt = db.prepare('UPDATE supplier_products SET price = ?, updated_at = datetime(\'now\') WHERE supplier_id = ? AND product_id = ? AND tenant_id = ?');
    for (const p of prices) {
      stmt.run(p.price, supplierId, p.product_id, tenantId);
    }
  });
  txn();
  return { updated: prices.length };
}

function updateStock(db, supplierId, stock, tenantId = 1) {
  const txn = db.transaction(() => {
    const upsert = db.prepare('INSERT INTO supplier_stock (tenant_id, supplier_id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\')) ON CONFLICT(supplier_id, product_id) DO UPDATE SET quantity = ?, updated_at = datetime(\'now\')');
    for (const s of stock) {
      upsert.run(tenantId, supplierId, s.product_id, s.quantity, s.quantity);
    }
  });
  txn();
  return { updated: stock.length };
}

function getOrders(db, supplierId, tenantId = 1) {
  return db.prepare(`
    SELECT soh.*, ii.name as product_name, ii.unit
    FROM supplier_order_history soh
    LEFT JOIN inventory_items ii ON ii.id = soh.product_id
    WHERE soh.supplier_id = ? AND soh.tenant_id = ?
    ORDER BY soh.created_at DESC
    LIMIT 100
  `).all(supplierId, tenantId);
}

function confirmOrder(db, orderId, supplierId, status) {
  const allowed = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) throw new Error('Invalid status');
  const order = db.prepare('SELECT * FROM supplier_order_history WHERE id = ? AND supplier_id = ?').get(orderId, supplierId);
  if (!order) throw new Error('Order not found');
  db.prepare('UPDATE supplier_order_history SET status = ? WHERE id = ?').run(status, orderId);
  return { ...order, status };
}

function getDashboardStats(db, supplierId, tenantId = 1) {
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND tenant_id = ? AND is_active = 1').get(supplierId, tenantId);
  const recentOrders = db.prepare("SELECT COUNT(*) as c FROM supplier_order_history WHERE supplier_id = ? AND tenant_id = ? AND status = 'new'").get(supplierId, tenantId);
  const deliveredOrders = db.prepare("SELECT COUNT(*) as c FROM supplier_order_history WHERE supplier_id = ? AND tenant_id = ? AND status = 'delivered'").get(supplierId, tenantId);
  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM supplier_order_history WHERE supplier_id = ? AND tenant_id = ?').get(supplierId, tenantId);
  return {
    totalProducts: totalProducts.c,
    pendingOrders: recentOrders.c,
    deliveredOrders: deliveredOrders.c,
    totalOrders: totalOrders.c,
  };
}

function generateToken(user, secret) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({
    id: user.id,
    supplier_id: user.supplier_id,
    login: user.login,
    permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
  }, secret, { expiresIn: '24h' });
}

function verifyToken(token, secret) {
  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch { return null; }
}

function createPasswordResetToken(db, userId) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  db.prepare('INSERT INTO supplier_password_resets (supplier_portal_user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
  return token;
}

function resetPassword(db, token, newPassword) {
  const row = db.prepare("SELECT * FROM supplier_password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')").get(token);
  if (!row) return { success: false, error: 'Invalid or expired token' };
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE supplier_portal_users SET password_hash = ? WHERE id = ?').run(hash, row.supplier_portal_user_id);
  db.prepare('UPDATE supplier_password_resets SET used = 1 WHERE id = ?').run(row.id);
  return { success: true };
}

function importPricesFromExcel(db, supplierId, rows, tenantId = 1) {
  let imported = 0; let errors = 0;
  const updateStmt = db.prepare('UPDATE supplier_products SET price = ?, updated_at = datetime(\'now\') WHERE supplier_id = ? AND product_id = ? AND tenant_id = ?');
  const findStmt = db.prepare('SELECT id FROM inventory_items WHERE (name = ? OR barcode = ? OR article = ?) AND tenant_id = ?');
  for (const row of rows) {
    const product = findStmt.get(row.name, row.barcode || '', row.article || row.barcode || '', tenantId);
    if (product) {
      updateStmt.run(parseFloat(row.price) || 0, supplierId, product.id, tenantId);
      imported++;
    } else { errors++; }
  }
  return { imported, errors, total: rows.length };
}

module.exports = {
  initTables, hashPassword, verifyPassword, authenticate,
  logActivity, getProductCatalog, updatePrices, updateStock,
  getOrders, confirmOrder, getDashboardStats,
  generateToken, verifyToken,
  createPasswordResetToken, resetPassword,
  importPricesFromExcel,
};
