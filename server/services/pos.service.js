/**
 * POS Terminal Service
 * Таблицы, настройки и бизнес-логика POS-терминала.
 */

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      org_name TEXT DEFAULT '',
      org_inn TEXT DEFAULT '',
      org_kpp TEXT DEFAULT '',
      org_address TEXT DEFAULT '',
      org_phone TEXT DEFAULT '',
      tax_system TEXT DEFAULT 'osno',
      vat_rate REAL DEFAULT 0,
      receipt_footer TEXT DEFAULT 'Спасибо за покупку!',
      receipt_width INTEGER DEFAULT 48,
      auto_print_receipt INTEGER DEFAULT 1,
      auto_print_precheck INTEGER DEFAULT 0,
      currency_symbol TEXT DEFAULT '₽',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_printers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      name TEXT DEFAULT 'Основной принтер',
      type TEXT DEFAULT 'ethernet',
      connection TEXT DEFAULT '',
      width INTEGER DEFAULT 48,
      is_default INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      allows_change INTEGER DEFAULT 0,
      requires_terminal INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pos_quick_buttons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      dish_id INTEGER,
      name TEXT,
      color TEXT DEFAULT '#f97316',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      order_id INTEGER,
      shift_id INTEGER,
      type TEXT DEFAULT 'sale',
      total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      payment_amount REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      fiscal_data TEXT DEFAULT '{}',
      is_fiscal INTEGER DEFAULT 0,
      is_printed INTEGER DEFAULT 0,
      printed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER,
      created_by_name TEXT
    );

    CREATE TABLE IF NOT EXISTS pos_cash_drawer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      shift_id INTEGER,
      operation TEXT NOT NULL,
      amount REAL DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER,
      created_by_name TEXT
    );

    CREATE TABLE IF NOT EXISTS pos_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      staff_id INTEGER,
      staff_name TEXT,
      opening_balance REAL DEFAULT 0,
      closing_balance REAL,
      status TEXT DEFAULT 'open',
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedDefaults(db);
}

function seedDefaults(db) {
  const methods = [
    ['cash', 'Наличные', 'Banknote', 1, 1, 1, 0],
    ['card', 'Карта', 'CreditCard', 1, 2, 0, 0],
    ['terminal', 'Терминал', 'Receipt', 1, 3, 0, 1],
    ['sbp', 'СБП / QR', 'QrCode', 1, 4, 0, 0],
    ['online', 'Онлайн', 'Globe', 1, 5, 0, 0],
  ];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO pos_payment_methods (tenant_id, key, name, icon, is_active, sort_order, allows_change, requires_terminal)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of methods) stmt.run(...m);

  const settings = db.prepare('SELECT id FROM pos_settings WHERE tenant_id = 1').get();
  if (!settings) {
    db.prepare(`
      INSERT INTO pos_settings (tenant_id, org_name, receipt_footer, tax_system)
      VALUES (1, 'FoodChain', 'Спасибо за покупку!', 'osno')
    `).run();
  }
}

// Settings
function getSettings(db, tenantId) {
  initTables(db);
  return db.prepare('SELECT * FROM pos_settings WHERE tenant_id = ?').get(tenantId) || {};
}

function saveSettings(db, tenantId, data) {
  initTables(db);
  const existing = db.prepare('SELECT id FROM pos_settings WHERE tenant_id = ?').get(tenantId);
  const fields = ['org_name', 'org_inn', 'org_kpp', 'org_address', 'org_phone', 'tax_system', 'vat_rate', 'receipt_footer', 'receipt_width', 'auto_print_receipt', 'auto_print_precheck', 'currency_symbol'];
  const values = fields.map(f => data[f] ?? null);
  if (existing) {
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    db.prepare(`UPDATE pos_settings SET ${setClause}, updated_at = datetime('now') WHERE tenant_id = ?`).run(...values, tenantId);
  } else {
    const placeholders = fields.map(() => '?').join(', ');
    db.prepare(`INSERT INTO pos_settings (tenant_id, ${fields.join(', ')}) VALUES (?, ${placeholders})`).run(tenantId, ...values);
  }
  return getSettings(db, tenantId);
}

// Printers
function getPrinters(db, tenantId) {
  initTables(db);
  return db.prepare('SELECT * FROM pos_printers WHERE tenant_id = ? ORDER BY is_default DESC, id').all(tenantId);
}

function savePrinter(db, tenantId, data) {
  initTables(db);
  const { id, name, type, connection, width, isDefault, isActive } = data;
  if (id) {
    db.prepare(`
      UPDATE pos_printers SET name = ?, type = ?, connection = ?, width = ?, is_default = ?, is_active = ?
      WHERE id = ? AND tenant_id = ?
    `).run(name, type, connection, width, isDefault ? 1 : 0, isActive ? 1 : 0, id, tenantId);
    return db.prepare('SELECT * FROM pos_printers WHERE id = ?').get(id);
  }
  const result = db.prepare(`
    INSERT INTO pos_printers (tenant_id, name, type, connection, width, is_default, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, name, type, connection, width, isDefault ? 1 : 0, isActive ? 1 : 0);
  return db.prepare('SELECT * FROM pos_printers WHERE id = ?').get(result.lastInsertRowid);
}

function deletePrinter(db, tenantId, id) {
  initTables(db);
  db.prepare('DELETE FROM pos_printers WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { success: true };
}

// Payment methods
function getPaymentMethods(db, tenantId) {
  initTables(db);
  return db.prepare('SELECT * FROM pos_payment_methods WHERE tenant_id = ? ORDER BY sort_order, id').all(tenantId);
}

function savePaymentMethod(db, tenantId, data) {
  initTables(db);
  const { id, key, name, icon, isActive, sortOrder, allowsChange, requiresTerminal } = data;
  if (id) {
    db.prepare(`
      UPDATE pos_payment_methods SET key = ?, name = ?, icon = ?, is_active = ?, sort_order = ?, allows_change = ?, requires_terminal = ?
      WHERE id = ? AND tenant_id = ?
    `).run(key, name, icon, isActive ? 1 : 0, sortOrder, allowsChange ? 1 : 0, requiresTerminal ? 1 : 0, id, tenantId);
    return db.prepare('SELECT * FROM pos_payment_methods WHERE id = ?').get(id);
  }
  const result = db.prepare(`
    INSERT INTO pos_payment_methods (tenant_id, key, name, icon, is_active, sort_order, allows_change, requires_terminal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, key, name, icon, isActive ? 1 : 0, sortOrder, allowsChange ? 1 : 0, requiresTerminal ? 1 : 0);
  return db.prepare('SELECT * FROM pos_payment_methods WHERE id = ?').get(result.lastInsertRowid);
}

// Quick buttons
function getQuickButtons(db, tenantId) {
  initTables(db);
  return db.prepare(`
    SELECT qb.*, d.name as dish_name, d.price as dish_price, d.zone
    FROM pos_quick_buttons qb
    LEFT JOIN dishes d ON qb.dish_id = d.id
    WHERE qb.tenant_id = ?
    ORDER BY qb.sort_order, qb.id
  `).all(tenantId);
}

function saveQuickButton(db, tenantId, data) {
  initTables(db);
  const { id, dishId, name, color, sortOrder } = data;
  if (id) {
    db.prepare(`
      UPDATE pos_quick_buttons SET dish_id = ?, name = ?, color = ?, sort_order = ?
      WHERE id = ? AND tenant_id = ?
    `).run(dishId, name, color, sortOrder, id, tenantId);
    return db.prepare('SELECT * FROM pos_quick_buttons WHERE id = ?').get(id);
  }
  const result = db.prepare(`
    INSERT INTO pos_quick_buttons (tenant_id, dish_id, name, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(tenantId, dishId, name, color, sortOrder);
  return db.prepare('SELECT * FROM pos_quick_buttons WHERE id = ?').get(result.lastInsertRowid);
}

function deleteQuickButton(db, tenantId, id) {
  initTables(db);
  db.prepare('DELETE FROM pos_quick_buttons WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { success: true };
}

// Receipts
function createReceipt(db, tenantId, data) {
  initTables(db);
  const { orderId, shiftId, type, total, paymentMethod, paymentAmount, changeAmount, fiscalData, createdBy, createdByName } = data;
  const result = db.prepare(`
    INSERT INTO pos_receipts (tenant_id, order_id, shift_id, type, total, payment_method, payment_amount, change_amount, fiscal_data, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, orderId, shiftId, type || 'sale', total, paymentMethod, paymentAmount, changeAmount, JSON.stringify(fiscalData || {}), createdBy, createdByName);
  return db.prepare('SELECT * FROM pos_receipts WHERE id = ?').get(result.lastInsertRowid);
}

function getReceipts(db, tenantId, params = {}) {
  initTables(db);
  let sql = 'SELECT * FROM pos_receipts WHERE tenant_id = ?';
  const args = [tenantId];
  if (params.shiftId) { sql += ' AND shift_id = ?'; args.push(params.shiftId); }
  if (params.orderId) { sql += ' AND order_id = ?'; args.push(params.orderId); }
  sql += ' ORDER BY created_at DESC';
  if (params.limit) { sql += ' LIMIT ?'; args.push(params.limit); }
  return db.prepare(sql).all(...args);
}

function markReceiptPrinted(db, tenantId, id) {
  initTables(db);
  db.prepare(`UPDATE pos_receipts SET is_printed = 1, printed_at = datetime('now') WHERE id = ? AND tenant_id = ?`).run(id, tenantId);
  return db.prepare('SELECT * FROM pos_receipts WHERE id = ?').get(id);
}

// Cash drawer operations
function cashOperation(db, tenantId, data) {
  initTables(db);
  const { shiftId, operation, amount, note, createdBy, createdByName } = data;
  const result = db.prepare(`
    INSERT INTO pos_cash_drawer (tenant_id, shift_id, operation, amount, note, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, shiftId, operation, amount, note, createdBy, createdByName);
  return db.prepare('SELECT * FROM pos_cash_drawer WHERE id = ?').get(result.lastInsertRowid);
}

function getCashDrawerOps(db, tenantId, shiftId) {
  initTables(db);
  return db.prepare('SELECT * FROM pos_cash_drawer WHERE tenant_id = ? AND shift_id = ? ORDER BY created_at DESC').all(tenantId, shiftId);
}

// Shifts
function openShift(db, tenantId, data) {
  initTables(db);
  const { staffId, staffName, openingBalance } = data;
  const result = db.prepare(`
    INSERT INTO pos_shifts (tenant_id, staff_id, staff_name, opening_balance, status)
    VALUES (?, ?, ?, ?, 'open')
  `).run(tenantId, staffId, staffName || '', openingBalance || 0);
  return db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(result.lastInsertRowid);
}

function closeShift(db, tenantId, id, data) {
  initTables(db);
  const { closingBalance } = data;
  db.prepare(`UPDATE pos_shifts SET closing_balance = ?, status = 'closed', closed_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .run(closingBalance || 0, id, tenantId);
  return db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(id);
}

function getCurrentShift(db, tenantId) {
  initTables(db);
  return db.prepare(`SELECT * FROM pos_shifts WHERE tenant_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`).get(tenantId);
}

module.exports = {
  initTables,
  getSettings,
  saveSettings,
  getPrinters,
  savePrinter,
  deletePrinter,
  getPaymentMethods,
  savePaymentMethod,
  getQuickButtons,
  saveQuickButton,
  deleteQuickButton,
  createReceipt,
  getReceipts,
  markReceiptPrinted,
  cashOperation,
  getCashDrawerOps,
  openShift,
  closeShift,
  getCurrentShift,
};
