/**
 * POS Terminal API Routes
 */

const posService = require('../services/pos.service');
const terminalIntegration = require('../services/terminal-integration.service');
const fiscalization = require('../services/fiscalization.service');
const posPrint = require('../services/pos-print.service');
const telegramBot = require('../services/telegram-bot.service');
const pricingService = require('../services/pricing.service');

module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, toCamelCase } = config;
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  const POS_ROLES = ['admin', 'manager', 'waiter', 'bartender'];
  const SHIFT_MANAGER_ROLES = ['admin', 'manager'];

  const logAction = (req, action, details, orderId, shiftId) => {
    try {
      posService.logAction(db, req.tenant_id, {
        shiftId: shiftId || req.shift?.id || null,
        orderId: orderId || null,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        createdBy: req.user?.id,
        createdByName: req.user?.username || req.user?.name,
      });
    } catch (e) { console.error('[logAction]', e.message); }
  };

  function signPosToken(staff) {
    return jwt.sign(
      { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || 1 },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  function applyDynamicPricing(items, tenantId) {
    const enriched = (items || []).map(item => {
      const dishId = item.dishId || item.dish_id || item.id;
      const dish = dishId ? db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId) : null;
      const basePrice = Number(dish?.price || item.base_price || item.price || 0);
      return {
        ...item,
        name: item.name || dish?.name || '',
        dish_id: dishId || item.dish_id || item.id,
        base_price: basePrice,
        price: basePrice,
        quantity: item.quantity || 1,
      };
    });
    return pricingService.recalculateOrder(db, tenantId || 1, enriched);
  }

  // PIN-first POS auth, password fallback
  app.post('/api/pos/auth', async (req, res) => {
    try {
      const { pin, password } = req.body;
      const credential = pin || password;
      if (!credential) return res.status(400).json({ error: 'Введите PIN или пароль' });

      const staffList = db.prepare(`
        SELECT s.*, fpt.name as tenant_name FROM staff s
        LEFT JOIN foodchain_portal_tenants fpt ON fpt.id = s.tenant_id
        WHERE s.is_active = 1
      `).all();

      const matches = [];
      for (const staff of staffList) {
        const role = String(staff.role || '').toLowerCase();
        if (!POS_ROLES.includes(role)) continue;

        let valid = false;
        if (pin && staff.pin) {
          const storedPin = String(staff.pin);
          if (storedPin.startsWith('$2')) {
            valid = await bcrypt.compare(pin, storedPin);
          } else {
            valid = storedPin === pin;
          }
        } else if (!pin && staff.password) {
          const storedHash = staff.password;
          if (storedHash.startsWith('$2')) {
            valid = await bcrypt.compare(password, storedHash);
          } else {
            valid = storedHash === password;
          }
        }
        if (valid) matches.push(staff);
      }

      if (matches.length === 0) {
        return res.status(401).json({ error: 'Неверный PIN/пароль или сотрудник не найден' });
      }
      if (matches.length > 1) {
        return res.status(409).json({ error: 'Найдено несколько сотрудников с таким PIN/паролем. Измените данные.' });
      }

      const staff = matches[0];
      const role = String(staff.role || '').toLowerCase();
      if (['admin', 'manager'].includes(role)) {
        const twoFactorRecord = db.prepare('SELECT * FROM user_2fa WHERE staff_id = ? AND enabled = 1').get(staff.id);
        if (twoFactorRecord) {
          const { twoFactorCode } = req.body;
          if (!twoFactorCode) {
            const tempToken = jwt.sign(
              { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || 1, pending2fa: true },
              JWT_SECRET,
              { expiresIn: '5m' }
            );
            return res.json({ token: tempToken, user: toCamelCase(staff), require2fa: true });
          }
          const verified = require('speakeasy').totp.verify({ secret: twoFactorRecord.secret, encoding: 'base32', token: twoFactorCode });
          if (!verified) return res.status(401).json({ error: 'Неверный код 2FA' });
        }
      }
      const token = signPosToken(staff);
      logAction({ user: staff, tenant_id: staff.tenant_id || 1 }, 'login', `Вход в POS: ${staff.username}`, null, null);
      res.json({ token, user: toCamelCase(staff) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Middleware: require active shift for POS operations
  function requireOpenShift(req, res, next) {
    const shift = posService.getCurrentShift(db, req.tenant_id);
    if (!shift) {
      return res.status(403).json({ error: 'Смена не открыта. Обратитесь к менеджеру.' });
    }
    req.shift = shift;
    next();
  }

  // Settings
  app.get('/api/pos/settings', authenticateToken, (req, res) => {
    try {
      res.json(toCamelCase(posService.getSettings(db, req.tenant_id)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/pos/settings', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(posService.saveSettings(db, req.tenant_id, req.body));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Printers
  app.get('/api/pos/printers', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(posService.getPrinters(db, req.tenant_id).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/printers', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(posService.savePrinter(db, req.tenant_id, req.body)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/pos/printers/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(posService.savePrinter(db, req.tenant_id, { ...req.body, id: Number(req.params.id) })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/pos/printers/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(posService.deletePrinter(db, req.tenant_id, Number(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Payment methods
  app.get('/api/pos/payment-methods', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(posService.getPaymentMethods(db, req.tenant_id).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/payment-methods', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(posService.savePaymentMethod(db, req.tenant_id, req.body)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Quick buttons
  app.get('/api/pos/quick-buttons', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(posService.getQuickButtons(db, req.tenant_id).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/quick-buttons', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(toCamelCase(posService.saveQuickButton(db, req.tenant_id, req.body)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/pos/quick-buttons/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      res.json(posService.deleteQuickButton(db, req.tenant_id, Number(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Receipts
  app.get('/api/pos/receipts', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(posService.getReceipts(db, req.tenant_id, req.query).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/receipts', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(toCamelCase(posService.createReceipt(db, req.tenant_id, { ...req.body, createdBy: req.user?.id, createdByName: req.user?.username || req.user?.name })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/receipts/:id/print', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(toCamelCase(posService.markReceiptPrinted(db, req.tenant_id, Number(req.params.id))));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Cash drawer
  app.get('/api/pos/cash-drawer/:shiftId', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(posService.getCashDrawerOps(db, req.tenant_id, Number(req.params.shiftId)).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/cash-drawer', authenticateToken, requireOpenShift, (req, res) => {
    try {
      res.json(toCamelCase(posService.cashOperation(db, req.tenant_id, { ...req.body, createdBy: req.user?.id, createdByName: req.user?.username || req.user?.name })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Shifts
  app.get('/api/pos/shifts/current', authenticateToken, (req, res) => {
    try {
      const shift = posService.getCurrentShift(db, req.tenant_id);
      const orderCount = shift ? posService.getShiftOrderCount(db, req.tenant_id, shift.id) : 0;
      res.json({ shift: shift ? toCamelCase(shift) : null, orderCount });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/shifts/open', authenticateToken, (req, res) => {
    try {
      const role = String(req.user?.role || '').toLowerCase();
      if (!SHIFT_MANAGER_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Только менеджер или администратор может открыть смену' });
      }
      const current = posService.getCurrentShift(db, req.tenant_id);
      if (current) return res.status(400).json({ error: 'Смена уже открыта' });
      const shift = posService.openShift(db, req.tenant_id, {
        staffId: req.user?.id,
        staffName: req.user?.username || req.user?.name,
        openingBalance: req.body.openingBalance || 0,
      });
      logAction(req, 'shift_open', `Открыта смена #${shift.id}`, null, shift.id);
      res.json({ success: true, shift: toCamelCase(shift) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/shifts/:id/close', authenticateToken, (req, res) => {
    try {
      const role = String(req.user?.role || '').toLowerCase();
      if (!SHIFT_MANAGER_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Только менеджер или администратор может закрыть смену' });
      }
      const shift = posService.closeShift(db, req.tenant_id, Number(req.params.id), {
        closedBy: req.user?.id,
        closedByName: req.user?.username || req.user?.name,
        closingBalance: req.body.closingBalance || 0,
      });
      const report = posService.generateShiftReport(db, req.tenant_id, shift.id);
      logAction(req, 'shift_close', `Закрыта смена #${shift.id}, факт: ${req.body.closingBalance || 0}`, null, shift.id);
      telegramBot.notifyOwner(db, req.tenant_id, `🏁 *Смена #${shift.id} закрыта*\nВыручка: ${report.totalRevenue || 0}₽\nЗаказов: ${report.totalOrders || 0}\nФакт в ящике: ${req.body.closingBalance || 0}₽`);
      res.json({ success: true, shift: toCamelCase(shift), report });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/pos/shifts/:id/report', authenticateToken, (req, res) => {
    try {
      const report = posService.getShiftReport(db, req.tenant_id, Number(req.params.id));
      if (!report) {
        const generated = posService.generateShiftReport(db, req.tenant_id, Number(req.params.id));
        return res.json({ report: generated });
      }
      res.json({ report });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/pos/shifts/:id/employees', authenticateToken, (req, res) => {
    try {
      const employees = posService.getShiftEmployees(db, req.tenant_id, Number(req.params.id));
      res.json({ employees });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/shifts/:id/login', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const shiftId = Number(req.params.id);
      if (req.shift.id !== shiftId) {
        return res.status(400).json({ error: 'Смена не совпадает с текущей' });
      }
      posService.recordShiftLogin(db, req.tenant_id, shiftId, {
        id: req.user?.id,
        username: req.user?.username,
        name: req.user?.name,
        role: req.user?.role,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POS Order management
  app.get('/api/pos/orders', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { status, type, search } = req.query;
      let sql = 'SELECT * FROM orders WHERE tenant_id = ?';
      const args = [req.tenant_id];
      if (status) { sql += ' AND status = ?'; args.push(status); }
      if (type) { sql += ' AND type = ?'; args.push(type); }
      if (search) { sql += ' AND (user_name LIKE ? OR id LIKE ?)'; args.push(`%${search}%`, `%${search}%`); }
      sql += ' ORDER BY created_at DESC LIMIT 200';
      const orders = db.prepare(sql).all(...args);
      res.json(orders.map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pos/orders/:id', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      res.json(toCamelCase(order));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/pos/orders/:id/status', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { status, note } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      db.prepare('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)').run(req.params.id, status, note || '', req.tenant_id);
      res.json(toCamelCase({ ...order, status }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/pos/orders/:id/assign-courier', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { courierId, courierName } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const status = 'assigned';
      db.prepare('UPDATE orders SET courier_id = ?, courier_name = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
        .run(courierId, courierName || '', status, req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)')
        .run(req.params.id, status, `Назначен курьер ${courierName}`, req.tenant_id);
      res.json(toCamelCase({ ...order, courierId, courierName, status }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/pos/orders/:id/items', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Состав обязателен' });
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const enriched = applyDynamicPricing(items, req.tenant_id);
      const subtotal = enriched.reduce((sum, item) => sum + item.total, 0);
      db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime("now") WHERE id = ?')
        .run(JSON.stringify(enriched), subtotal, subtotal, req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)')
        .run(req.params.id, order.status, 'Состав изменён на кассе', req.tenant_id);
      res.json(toCamelCase({ ...order, items: enriched, subtotal, total: subtotal }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/orders/:id/cancel', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { reason } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      db.prepare('UPDATE orders SET status = "cancelled", updated_at = datetime("now") WHERE id = ?').run(req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)')
        .run(req.params.id, 'cancelled', `Отмена на кассе: ${reason || 'не указана'}`, req.tenant_id);
      logAction(req, 'order_cancel', `Аннулирование заказа #${order.id}: ${reason || 'не указана'}`, order.id, order.shift_id);
      telegramBot.notifyOwner(db, req.tenant_id, `🚨 *Заказ #${order.id} аннулирован*\nПричина: ${reason || 'не указана'}\nСумма: ${order.total || 0}₽\nКассир: ${req.user?.username || req.user?.name}`);
      res.json(toCamelCase({ ...order, status: 'cancelled' }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/orders/:id/transfer', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { table_id } = req.body;
      const tid = Number(table_id);
      if (!tid) return res.status(400).json({ error: 'Неверный ID стола' });
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const table = db.prepare('SELECT * FROM booking_tables WHERE id = ? AND tenant_id = ?').get(tid, req.tenant_id);
      if (!table) return res.status(404).json({ error: 'Стол не найден' });
      db.prepare("UPDATE orders SET table_id = ?, address = ?, updated_at = datetime('now') WHERE id = ?")
        .run(tid, `Стол ${table.name}`, req.params.id);
      db.prepare("INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)")
        .run(req.params.id, order.status, `Перенос на стол ${table.name}`, req.tenant_id);
      logAction(req, 'order_transfer', `Перенос заказа #${order.id} на стол ${table.name}`, order.id, order.shift_id);
      res.json(toCamelCase({ ...order, table_id: tid, address: `Стол ${table.name}` }));
    } catch (e) { console.error('[transfer]', e.message); res.status(500).json({ error: e.message }); }
  });

  app.put('/api/pos/orders/:id/rating', authenticateToken, (req, res) => {
    try {
      const { waiterRating, waiterReview } = req.body;
      try { db.prepare('ALTER TABLE orders ADD COLUMN waiter_rating INTEGER').run(); } catch (_) {}
      try { db.prepare('ALTER TABLE orders ADD COLUMN waiter_review TEXT').run(); } catch (_) {}
      db.prepare('UPDATE orders SET waiter_rating = ?, waiter_review = ? WHERE id = ? AND tenant_id = ?')
        .run(Number(waiterRating) || 0, waiterReview || '', req.params.id, req.tenant_id);
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      res.json(toCamelCase(order));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pos/couriers', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const couriers = db.prepare("SELECT id, name, phone, is_online, is_available FROM couriers WHERE tenant_id = ? ORDER BY is_online DESC, name").all(req.tenant_id);
      res.json(couriers.map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pos/action-logs', authenticateToken, (req, res) => {
    try { res.json(posService.getActionLogs(db, req.tenant_id, 200).map(toCamelCase)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Terminal pay integration
  app.post('/api/pos/terminal/pay', authenticateToken, requireOpenShift, async (req, res) => {
    try {
      const { orderId, amount } = req.body;
      const result = await terminalIntegration.initPayment(db, req.tenant_id, orderId, amount, req.app.get('io'));
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Combos
  app.get('/api/pos/combos', authenticateToken, (req, res) => {
    try { res.json(posService.getCombos(db, req.tenant_id).map(toCamelCase)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pos/combos', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try { res.json(toCamelCase(posService.createCombo(db, req.tenant_id, req.body))); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.put('/api/pos/combos/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try { res.json(toCamelCase(posService.updateCombo(db, req.tenant_id, Number(req.params.id), req.body))); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/pos/combos/:id', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try { posService.deleteCombo(db, req.tenant_id, Number(req.params.id)); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/orders/:id/partial-pay', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const { amount, paymentMethod } = req.body;
      const sum = Number(amount);
      if (!sum || sum <= 0) return res.status(400).json({ error: 'Сумма обязательна' });
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const total = Number(order.total) || 0;
      db.prepare('INSERT INTO pos_receipts (tenant_id, order_id, shift_id, type, total, payment_method, payment_amount, change_amount, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(req.tenant_id, order.id, order.shift_id || null, 'partial', sum, paymentMethod || 'cash', sum, 0, req.user?.id, req.user?.username || req.user?.name);
      const paid = db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM pos_receipts WHERE order_id = ? AND type IN ("sale", "partial")').get(order.id).s || 0;
      const remaining = Math.max(0, total - paid);
      if (remaining <= 0.01) {
        db.prepare("UPDATE orders SET status = 'paid', is_paid = 1, updated_at = datetime('now') WHERE id = ?").run(order.id);
        db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)').run(order.id, 'paid', 'Полностью оплачено частями', req.tenant_id);
        // Inventory write-off on paid order
        try {
          const posInventory = require('../services/pos-inventory.service');
          posInventory.writeOffOrder(db, order.id);
        } catch (e) { console.error('[POS Inventory] Write-off error:', e.message); }
      } else {
        db.prepare("UPDATE orders SET status = 'partially_paid', updated_at = datetime('now') WHERE id = ?").run(order.id);
      }
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      logAction(req, 'partial_payment', `Частичная оплата ${sum}₽ методом ${paymentMethod || 'cash'}, остаток ${remaining}`, order.id, order.shift_id);
      res.json({ success: true, order: toCamelCase(updated), paid, remaining });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pos/waiter/orders', authenticateToken, (req, res) => {
    try {
      const statuses = ['new', 'confirmed', 'preparing', 'ready', 'served', 'partially_paid', 'bill_requested'];
      const orders = db.prepare(`SELECT * FROM orders WHERE tenant_id = ? AND status IN (${statuses.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(req.tenant_id, ...statuses);
      const tables = db.prepare('SELECT id, name, zone, capacity, status FROM booking_tables WHERE tenant_id = ?').all(req.tenant_id);
      const result = orders.map(o => {
        const table = tables.find((t) => t.id === o.table_id);
        return toCamelCase({ ...o, tableName: table?.name, tableStatus: table?.status });
      });
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Printing
  app.post('/api/pos/cash-drawer/open', authenticateToken, requireOpenShift, async (req, res) => {
    try {
      const printer = db.prepare('SELECT * FROM pos_printers WHERE tenant_id = ? AND is_active = 1 AND (type = "ethernet" OR type = "usb") ORDER BY is_default DESC LIMIT 1').get(req.tenant_id);
      if (!printer) return res.json({ skipped: true, message: 'Принтер/ящик не настроен' });
      const result = await posPrintService.openCashDrawer(printer);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/print/receipt', authenticateToken, requireOpenShift, async (req, res) => {
    try {
      const { orderId } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(orderId, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const printer = db.prepare('SELECT * FROM pos_printers WHERE tenant_id = ? AND is_active = 1 AND (type = "ethernet" OR type = "usb") ORDER BY is_default DESC LIMIT 1').get(req.tenant_id);
      if (!printer) return res.json({ skipped: true, message: 'Принтер чеков не настроен' });
      const items = JSON.parse(order.items || '[]');
      const settings = posService.getSettings(db, req.tenant_id);
      const pm = db.prepare('SELECT name FROM pos_payment_methods WHERE key = ? AND tenant_id = ?').get(order.payment_method || 'cash', req.tenant_id);
      const lines = posPrint.generateReceiptLines({ ...order, items, shiftId: order.shift_id }, settings, pm?.name || order.payment_method, 0, 0);
      const result = await posPrint.printReceiptToPrinter(printer, lines);
      res.json({ success: true, result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/print/kitchen', authenticateToken, requireOpenShift, async (req, res) => {
    try {
      const { orderId, stationName } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(orderId, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const printer = db.prepare('SELECT * FROM pos_printers WHERE tenant_id = ? AND is_active = 1 AND (type = "ethernet" OR type = "usb") ORDER BY is_default DESC LIMIT 1').get(req.tenant_id);
      if (!printer) return res.json({ skipped: true, message: 'Принтер не настроен' });
      const items = JSON.parse(order.items || '[]');
      const table = order.table_id ? db.prepare('SELECT name FROM booking_tables WHERE id = ?').get(order.table_id) : null;
      const lines = posPrint.generateKitchenLines({ ...order, items, tableName: table?.name }, stationName);
      const result = await posPrint.printReceiptToPrinter(printer, lines);
      res.json({ success: true, result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Fiscalization from POS
  app.post('/api/pos/fiscal/:orderId', authenticateToken, requireOpenShift, async (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(req.params.orderId, req.tenant_id);
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      const kkt = db.prepare('SELECT * FROM fiscal_settings WHERE tenant_id = ? AND enabled = 1').get(req.tenant_id);
      if (!kkt) return res.json({ skipped: true, message: 'ККТ не настроена' });
      const receiptId = fiscalization.createReceipt(db, { ...order, total: order.total || 0 }, req.body.paymentMethod || order.payment_method || 'cash');
      const result = await fiscalization.printReceiptById(db, receiptId);
      res.json({ success: true, receiptId, result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Aggregator integration (POS-facing)
  const aggregatorIntegration = require('../aggregator-integration');
  app.get('/api/pos/aggregators', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM aggregator_settings WHERE tenant_id = ?').all(req.tenant_id);
      const result = Object.keys(aggregatorIntegration.PROVIDERS).map(key => {
        const row = rows.find((r) => r.provider === key);
        return {
          provider: key,
          name: aggregatorIntegration.PROVIDER_NAMES[key] || key,
          enabled: !!row?.enabled,
          credentials: (() => { try { return JSON.parse(row?.credentials || '{}'); } catch { return {}; } })(),
          lastSyncAt: row?.last_sync_at || null,
          lastMenuSyncAt: row?.last_menu_sync_at || null,
        };
      });
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.put('/api/pos/aggregators/:provider', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const provider = req.params.provider;
      if (!aggregatorIntegration.PROVIDERS[provider]) return res.status(400).json({ error: 'Неизвестный провайдер' });
      const { enabled, credentials } = req.body;
      const existing = db.prepare('SELECT id FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(req.tenant_id, provider);
      if (existing) {
        db.prepare("UPDATE aggregator_settings SET enabled = ?, credentials = ?, updated_at = datetime('now') WHERE id = ?")
          .run(enabled ? 1 : 0, JSON.stringify(credentials || {}), existing.id);
      } else {
        db.prepare("INSERT INTO aggregator_settings (tenant_id, provider, enabled, credentials) VALUES (?, ?, ?, ?)")
          .run(req.tenant_id, provider, enabled ? 1 : 0, JSON.stringify(credentials || {}));
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pos/aggregators/:provider/test', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = aggregatorIntegration.PROVIDERS[provider];
      const credentials = req.body.credentials || (() => { const row = db.prepare('SELECT credentials FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(req.tenant_id, provider); try { return JSON.parse(row?.credentials || '{}'); } catch { return {}; } })();
      const result = await p.testConnection(credentials);
      res.json({ ok: result.ok, data: result.data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pos/aggregators/:provider/sync-menu', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const provider = req.params.provider;
      const p = aggregatorIntegration.PROVIDERS[provider];
      const row = db.prepare('SELECT credentials FROM aggregator_settings WHERE tenant_id = ? AND provider = ?').get(req.tenant_id, provider);
      const credentials = (() => { try { return JSON.parse(row?.credentials || '{}'); } catch { return {}; } })();
      const result = await p.syncMenu(req.tenant_id, credentials, db);
      if (result.ok) db.prepare("UPDATE aggregator_settings SET last_menu_sync_at = datetime('now'), last_sync_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ? AND provider = ?").run(req.tenant_id, provider);
      res.json({ ok: result.ok, data: result.data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Accounting export from POS
  const integration1c = require('../services/integration-1c.service');
  app.get('/api/pos/accounting/export', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const { shiftId, date, format = '1c' } = req.query;
      let sql = 'SELECT * FROM orders WHERE tenant_id = ? AND status = \'paid\'';
      const params = [req.tenant_id];
      if (shiftId) { sql += ' AND shift_id = ?'; params.push(Number(shiftId)); }
      if (date) { sql += ' AND date(created_at) = ?'; params.push(date); }
      sql += ' ORDER BY created_at DESC';
      const orders = db.prepare(sql).all(...params);
      const receipts = db.prepare('SELECT * FROM pos_receipts WHERE tenant_id = ? AND type = \'sale\' AND order_id IN (' + orders.map(() => '?').join(',') + ')').all(req.tenant_id, ...orders.map((o) => o.id));
      if (format === '1c') {
        const result = await integration1c.exportOrdersTo1C(db, req.tenant_id);
        return res.json({ ok: result.ok, data: result.data });
      }
      if (format === 'moysklad') {
        const sales = orders.map(o => ({
          name: `Заказ #${o.id}`,
          moment: o.created_at,
          sum: o.total,
          agent: { name: o.user_name || 'Розничный покупатель' },
          positions: (JSON.parse(o.items || '[]') || []).map((it) => ({ assortment: { name: it.name }, quantity: it.quantity, price: it.price })),
        }));
        return res.json({ ok: true, format, count: sales.length, sales });
      }
      if (format === 'bitrix24') {
        const deals = orders.map(o => ({ TITLE: `Заказ #${o.id}`, STAGE_ID: 'WON', COMPANY_TITLE: 'Розница', OPPORTUNITY: o.total, CURRENCY_ID: 'RUB', COMMENTS: o.comment || '' }));
        return res.json({ ok: true, format, count: deals.length, deals });
      }
      res.status(400).json({ error: 'Unsupported format' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/pos/aggregators/:provider/retry', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const provider = req.params.provider;
      if (!aggregatorIntegration.PROVIDERS[provider]) return res.status(400).json({ error: 'Неизвестный провайдер' });
      const pending = db.prepare('SELECT * FROM aggregator_status_queue WHERE provider = ? AND attempts < 5 ORDER BY created_at ASC').all(provider);
      res.json({ queued: pending.length, items: pending });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // CRM integration settings (POS-facing)
  const crmIntegration = require('../services/crm-integration.service');
  app.get('/api/pos/crm/:provider/settings', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const settings = crmIntegration.getSettings(db, req.params.provider, req.tenant_id);
      res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.put('/api/pos/crm/:provider/settings', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      crmIntegration.saveSettings(db, req.params.provider, req.body, req.tenant_id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/pos/crm/:provider/auth-url', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const provider = req.params.provider;
      const settings = crmIntegration.getSettings(db, provider, req.tenant_id);
      if (provider === 'amocrm') {
        const redirectUri = settings.redirect_uri || `${req.protocol}://${req.get('host')}/api/pos/crm/amocrm/callback`;
        const url = `https://${settings.domain}.amocrm.ru/oauth2/authorize?client_id=${settings.client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${req.tenant_id}`;
        return res.json({ url });
      }
      res.status(400).json({ error: 'OAuth URL не поддерживается для этого провайдера' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/pos/crm/:provider/callback', async (req, res) => {
    try {
      const provider = req.params.provider;
      const tenantId = Number(req.query.state) || 1;
      if (provider === 'amocrm') {
        const settings = crmIntegration.getSettings(db, provider, tenantId);
        settings.code = req.query.code;
        const result = await crmIntegration.testConnection(provider, settings);
        if (result.success) crmIntegration.saveSettings(db, provider, { ...settings, enabled: true }, tenantId);
        return res.json({ ok: result.success, message: result.error });
      }
      res.status(400).json({ error: 'Callback не поддерживается' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pos/crm/:provider/test', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const provider = req.params.provider;
      const settings = { ...crmIntegration.getSettings(db, provider, req.tenant_id), ...req.body };
      const result = await crmIntegration.testConnection(provider, settings);
      res.json({ ok: result.success, error: result.error });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/pos/crm/:provider/export-clients', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const result = await crmIntegration.exportClients(db, req.params.provider, req.tenant_id);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // 1C integration sync trigger
  app.post('/api/pos/1c/sync', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const result = await integration1c.runSyncAll(db, req.tenant_id);
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Barcode lookup
  app.get('/api/pos/dishes/barcode/:barcode', authenticateToken, (req, res) => {
    try {
      const dish = db.prepare('SELECT * FROM dishes WHERE tenant_id = ? AND barcode = ? AND is_available = 1').get(req.tenant_id, req.params.barcode);
      if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
      res.json(toCamelCase(dish));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  console.log('[POS] Routes registered');
};
