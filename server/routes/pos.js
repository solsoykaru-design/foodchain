/**
 * POS Terminal API Routes
 */

const posService = require('../services/pos.service');
const terminalIntegration = require('../services/terminal-integration.service');

module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, toCamelCase } = config;
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  const POS_ROLES = ['admin', 'manager', 'waiter'];
  const SHIFT_MANAGER_ROLES = ['admin', 'manager'];

  function signPosToken(staff) {
    return jwt.sign(
      { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || 1 },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Password-only POS auth
  app.post('/api/pos/auth', async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Введите пароль' });

      const staffList = db.prepare(`
        SELECT s.*, fpt.name as tenant_name FROM staff s
        LEFT JOIN foodchain_portal_tenants fpt ON fpt.id = s.tenant_id
        WHERE s.is_active = 1
      `).all();

      const matches = [];
      for (const staff of staffList) {
        const role = String(staff.role || '').toLowerCase();
        if (!POS_ROLES.includes(role)) continue;
        const storedHash = staff.password;
        let valid = false;
        if (storedHash && storedHash.startsWith('$2')) {
          valid = await bcrypt.compare(password, storedHash);
        } else {
          valid = storedHash === password;
        }
        if (valid) matches.push(staff);
      }

      if (matches.length === 0) {
        return res.status(401).json({ error: 'Неверный пароль или сотрудник не найден' });
      }
      if (matches.length > 1) {
        return res.status(409).json({ error: 'Найдено несколько сотрудников с таким паролем. Измените пароли.' });
      }

      const staff = matches[0];
      const token = signPosToken(staff);
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
      let subtotal = 0;
      const enriched = items.map((item) => {
        const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(item.dishId || item.dish_id);
        const name = dish?.name || item.name;
        const price = dish?.price || item.price || 0;
        subtotal += price * (item.quantity || 1);
        return { ...item, name, price };
      });
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
      res.json(toCamelCase({ ...order, status: 'cancelled' }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pos/couriers', authenticateToken, requireOpenShift, (req, res) => {
    try {
      const couriers = db.prepare("SELECT id, name, phone, is_online, is_available FROM couriers WHERE tenant_id = ? ORDER BY is_online DESC, name").all(req.tenant_id);
      res.json(couriers.map(toCamelCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
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

  console.log('[POS] Routes registered');
};
