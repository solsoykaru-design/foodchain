/**
 * POS Terminal API Routes
 */

const posService = require('../services/pos.service');
const terminalIntegration = require('../services/terminal-integration.service');

module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, toCamelCase } = config;

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
  app.get('/api/pos/printers', authenticateToken, (req, res) => {
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
  app.get('/api/pos/payment-methods', authenticateToken, (req, res) => {
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
  app.get('/api/pos/quick-buttons', authenticateToken, (req, res) => {
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
  app.get('/api/pos/receipts', authenticateToken, (req, res) => {
    try {
      res.json(posService.getReceipts(db, req.tenant_id, req.query).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/receipts', authenticateToken, (req, res) => {
    try {
      res.json(toCamelCase(posService.createReceipt(db, req.tenant_id, { ...req.body, createdBy: req.user?.id, createdByName: req.user?.username || req.user?.name })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/receipts/:id/print', authenticateToken, (req, res) => {
    try {
      res.json(toCamelCase(posService.markReceiptPrinted(db, req.tenant_id, Number(req.params.id))));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Cash drawer
  app.get('/api/pos/cash-drawer/:shiftId', authenticateToken, (req, res) => {
    try {
      res.json(posService.getCashDrawerOps(db, req.tenant_id, Number(req.params.shiftId)).map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/cash-drawer', authenticateToken, (req, res) => {
    try {
      res.json(toCamelCase(posService.cashOperation(db, req.tenant_id, { ...req.body, createdBy: req.user?.id, createdByName: req.user?.username || req.user?.name })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Shifts
  app.get('/api/pos/shifts/current', authenticateToken, (req, res) => {
    try {
      res.json({ shift: posService.getCurrentShift(db, req.tenant_id) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pos/shifts/open', authenticateToken, (req, res) => {
    try {
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
      const shift = posService.closeShift(db, req.tenant_id, Number(req.params.id), { closingBalance: req.body.closingBalance || 0 });
      res.json({ success: true, shift: toCamelCase(shift) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Terminal pay integration
  app.post('/api/pos/terminal/pay', authenticateToken, async (req, res) => {
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
