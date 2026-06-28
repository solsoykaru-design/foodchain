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
