/**
 * POS Terminal Service
 * Таблицы, настройки и бизнес-логика POS-терминала.
 */

function toCamelCase(obj) {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      out[key] = toCamelCase(v);
    }
    return out;
  }
  return obj;
}

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

    CREATE TABLE IF NOT EXISTS pos_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      shift_id INTEGER,
      order_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER,
      created_by_name TEXT
    );

    CREATE TABLE IF NOT EXISTS pos_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      opened_by INTEGER,
      opened_by_name TEXT,
      closed_by INTEGER,
      closed_by_name TEXT,
      opening_balance REAL DEFAULT 0,
      closing_balance REAL,
      status TEXT DEFAULT 'open',
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_shift_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      shift_id INTEGER,
      staff_id INTEGER,
      staff_name TEXT,
      staff_role TEXT,
      login_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_shift_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      shift_id INTEGER UNIQUE,
      total_orders INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      cash_revenue REAL DEFAULT 0,
      card_revenue REAL DEFAULT 0,
      online_revenue REAL DEFAULT 0,
      sbp_revenue REAL DEFAULT 0,
      terminal_revenue REAL DEFAULT 0,
      other_revenue REAL DEFAULT 0,
      tips REAL DEFAULT 0,
      average_check REAL DEFAULT 0,
      canceled_orders INTEGER DEFAULT 0,
      opened_by_name TEXT,
      closed_by_name TEXT,
      report_data TEXT DEFAULT '{}',
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pos_combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      items TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure orders table has shift linkage
  try { db.exec(`ALTER TABLE orders ADD COLUMN shift_id INTEGER`); } catch (e) { /* already exists */ }
  try { db.exec(`ALTER TABLE orders ADD COLUMN handled_by INTEGER`); } catch (e) { /* already exists */ }
  try { db.exec(`ALTER TABLE orders ADD COLUMN handled_by_name TEXT`); } catch (e) { /* already exists */ }

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

// Combos
function getCombos(db, tenantId) {
  initTables(db);
  return db.prepare('SELECT * FROM pos_combos WHERE tenant_id = ? AND is_active = 1 ORDER BY name').all(tenantId);
}

function createCombo(db, tenantId, data) {
  initTables(db);
  const { name, price, items } = data;
  const result = db.prepare('INSERT INTO pos_combos (tenant_id, name, price, items) VALUES (?, ?, ?, ?)').run(tenantId, name, price, JSON.stringify(items));
  return db.prepare('SELECT * FROM pos_combos WHERE id = ?').get(result.lastInsertRowid);
}

function updateCombo(db, tenantId, id, data) {
  initTables(db);
  const { name, price, items, isActive } = data;
  db.prepare('UPDATE pos_combos SET name = ?, price = ?, items = ?, is_active = ? WHERE id = ? AND tenant_id = ?')
    .run(name, price, JSON.stringify(items), isActive ? 1 : 0, id, tenantId);
  return db.prepare('SELECT * FROM pos_combos WHERE id = ?').get(id);
}

function deleteCombo(db, tenantId, id) {
  initTables(db);
  db.prepare('UPDATE pos_combos SET is_active = 0 WHERE id = ? AND tenant_id = ?').run(id, tenantId);
}

// Shifts
function openShift(db, tenantId, data) {
  initTables(db);
  const { staffId, staffName, openingBalance } = data;
  const current = getCurrentShift(db, tenantId);
  if (current) throw new Error('Смена уже открыта');
  const result = db.prepare(`
    INSERT INTO pos_shifts (tenant_id, opened_by, opened_by_name, opening_balance, status)
    VALUES (?, ?, ?, ?, 'open')
  `).run(tenantId, staffId, staffName || '', openingBalance || 0);
  return db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(result.lastInsertRowid);
}

function closeShift(db, tenantId, id, data) {
  initTables(db);
  const { closedBy, closedByName, closingBalance } = data;
  const shift = db.prepare('SELECT * FROM pos_shifts WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  if (!shift) throw new Error('Смена не найдена');
  if (shift.status !== 'open') throw new Error('Смена уже закрыта');

  // Check for open orders
  const openOrders = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE shift_id = ? AND status NOT IN ('closed', 'cancelled')`).get(id);
  if (openOrders && openOrders.cnt > 0) throw new Error(`Нельзя закрыть смену: ${openOrders.cnt} открытых заказов`);

  db.prepare(`UPDATE pos_shifts SET closing_balance = ?, closed_by = ?, closed_by_name = ?, status = 'closed', closed_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .run(closingBalance || 0, closedBy, closedByName || '', id, tenantId);
  return db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(id);
}

function getCurrentShift(db, tenantId) {
  initTables(db);
  return db.prepare(`SELECT * FROM pos_shifts WHERE tenant_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`).get(tenantId);
}

function recordShiftLogin(db, tenantId, shiftId, staff) {
  initTables(db);
  if (!shiftId) return null;
  const result = db.prepare(`
    INSERT INTO pos_shift_logins (tenant_id, shift_id, staff_id, staff_name, staff_role)
    VALUES (?, ?, ?, ?, ?)
  `).run(tenantId, shiftId, staff.id, staff.username || staff.name || '', staff.role || '');
  return db.prepare('SELECT * FROM pos_shift_logins WHERE id = ?').get(result.lastInsertRowid);
}

function getShiftEmployees(db, tenantId, shiftId) {
  initTables(db);
  const logins = db.prepare(`
    SELECT staff_id as id, staff_name as name, staff_role as role, COUNT(*) as login_count, MAX(login_at) as last_login_at
    FROM pos_shift_logins
    WHERE tenant_id = ? AND shift_id = ?
    GROUP BY staff_id, staff_name, staff_role
    ORDER BY last_login_at DESC
  `).all(tenantId, shiftId);
  return logins;
}

function generateShiftReport(db, tenantId, shiftId) {
  initTables(db);
  const shift = db.prepare('SELECT * FROM pos_shifts WHERE id = ? AND tenant_id = ?').get(shiftId, tenantId);
  if (!shift) throw new Error('Смена не найдена');

  const orders = db.prepare(`SELECT * FROM orders WHERE shift_id = ?`).all(shiftId);
  const totalOrders = orders.length;
  const canceledOrders = orders.filter(o => o.status === 'cancelled').length;
  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((s, o) => s + (o.total || 0), 0);
  const averageCheck = validOrders.length ? totalRevenue / validOrders.length : 0;

  // Revenue by payment method
  const methodMap = {};
  for (const o of validOrders) {
    const m = o.payment_method || 'cash';
    methodMap[m] = (methodMap[m] || 0) + (o.total || 0);
  }

  // Tips - from orders if tips field exists
  const tips = validOrders.reduce((s, o) => s + (o.tips || 0), 0);

  // Per employee stats
  const employeeMap = {};
  for (const o of orders) {
    const key = o.handled_by || o.user_id;
    const name = o.handled_by_name || o.user_name || 'Неизвестно';
    if (!employeeMap[key]) employeeMap[key] = { id: key, name, orders: 0, revenue: 0, payments: 0 };
    employeeMap[key].orders += 1;
    if (o.status !== 'cancelled') employeeMap[key].revenue += (o.total || 0);
    if (o.payment_method && o.status === 'closed') employeeMap[key].payments += 1;
  }
  const employees = Object.values(employeeMap);

  // Order types
  const dineIn = orders.filter(o => (o.type || 'dine_in') === 'dine_in').length;
  const delivery = orders.filter(o => o.type === 'delivery').length;
  const pickup = orders.filter(o => o.type === 'pickup').length;

  const reportData = {
    employees,
    orderTypes: { dine_in: dineIn, delivery: delivery, pickup: pickup },
    paymentMethods: methodMap,
  };

  const existing = db.prepare('SELECT id FROM pos_shift_reports WHERE shift_id = ?').get(shiftId);
  const data = {
    totalOrders, totalRevenue,
    cashRevenue: methodMap.cash || 0,
    cardRevenue: methodMap.card || 0,
    onlineRevenue: methodMap.online || 0,
    sbpRevenue: methodMap.sbp || 0,
    terminalRevenue: methodMap.terminal || 0,
    otherRevenue: methodMap.other || 0,
    tips, averageCheck, canceledOrders,
    openedByName: shift.opened_by_name || '',
    closedByName: shift.closed_by_name || '',
    reportData: JSON.stringify(reportData),
  };

  if (existing) {
    const fields = Object.keys(data);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    db.prepare(`UPDATE pos_shift_reports SET ${setClause}, generated_at = datetime('now') WHERE shift_id = ?`).run(...fields.map(f => data[f]), shiftId);
  } else {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    db.prepare(`INSERT INTO pos_shift_reports (tenant_id, shift_id, ${fields.join(', ')}) VALUES (?, ?, ${placeholders})`).run(tenantId, shiftId, ...fields.map(f => data[f]));
  }

  return { ...data, reportData, shift: toCamelCase(shift) };
}

function getShiftReport(db, tenantId, shiftId) {
  initTables(db);
  const report = db.prepare('SELECT * FROM pos_shift_reports WHERE shift_id = ? AND tenant_id = ?').get(shiftId, tenantId);
  if (!report) return null;
  const parsed = { ...report, reportData: JSON.parse(report.report_data || '{}') };
  return toCamelCase(parsed);
}

function getShiftOrderCount(db, tenantId, shiftId) {
  initTables(db);
  const result = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE shift_id = ?`).get(shiftId);
  return result ? result.cnt : 0;
}

function ensureOpenShift(db, tenantId, defaultStaff) {
  initTables(db);
  const current = getCurrentShift(db, tenantId);
  if (current) return current;
  return openShift(db, tenantId, {
    staffId: defaultStaff?.id || 1,
    staffName: defaultStaff?.name || 'System',
    openingBalance: 0,
  });
}

function logAction(db, tenantId, { shiftId, orderId, action, details, createdBy, createdByName }) {
  try {
    db.prepare('INSERT INTO pos_action_logs (tenant_id, shift_id, order_id, action, details, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(tenantId, shiftId || null, orderId || null, action, details || '', createdBy || null, createdByName || '');
  } catch (e) { console.error('[pos.action.log]', e.message); }
}

function getActionLogs(db, tenantId, limit = 100) {
  return db.prepare('SELECT * FROM pos_action_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit);
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
  getCombos,
  createCombo,
  updateCombo,
  deleteCombo,
  logAction,
  getActionLogs,
  openShift,
  closeShift,
  getCurrentShift,
  recordShiftLogin,
  getShiftEmployees,
  generateShiftReport,
  getShiftReport,
  getShiftOrderCount,
  ensureOpenShift,
};
