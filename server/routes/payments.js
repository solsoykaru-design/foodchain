const jwt = require('jsonwebtoken');

module.exports = function(app, db, config) {
  const { JWT_SECRET, safeError, toCamelCase, toCamelCaseArray, io } = config;

app.get('/api/payment-methods', (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods ORDER BY sort_order').all();
    res.json(toCamelCaseArray(methods));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/payment-methods/:id', (req, res) => {
  try {
    const { is_active, name, description, sort_order } = req.body;
    const existing = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Способ оплаты не найден' });
    const sets = [];
    const vals = [];
    if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
    vals.push(req.params.id);
    db.prepare(`UPDATE payment_methods SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const updated = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(updated));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/payment-methods/active', (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order').all();
    res.json(toCamelCaseArray(methods));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/terminal/pay', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const tenantId = order.tenant_id || 1;
    const payAmount = amount || order.total;
    const result = await terminalIntegration.initPayment(db, tenantId, orderId, payAmount, io);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/terminal/status/:transactionId', (req, res) => {
  try {
    const result = terminalIntegration.checkStatus(db, req.params.transactionId);
    if (!result) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/terminal/cancel/:transactionId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const result = await terminalIntegration.cancelPayment(db, tenantId, req.params.transactionId, io);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};