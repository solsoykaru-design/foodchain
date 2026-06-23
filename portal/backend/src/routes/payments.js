import { Router } from 'express';
import { z } from 'zod';
import { query, get, run } from '../db.js';

export const paymentsRouter = Router();

paymentsRouter.get('/', async (req, res, next) => {
  try {
    const rows = query(
      'SELECT * FROM payments WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

paymentsRouter.get('/invoices', async (req, res, next) => {
  try {
    const rows = query(
      'SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const createPaymentSchema = z.object({
  amount: z.number().positive('Сумма должна быть положительной'),
  description: z.string().optional(),
});

paymentsRouter.post('/create', async (req, res, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);

    const payResult = run(
      "INSERT INTO payments (tenant_id, amount, description, status) VALUES (?, ?, ?, 'pending')",
      [req.user.tenantId, data.amount, data.description || null]
    );
    const paymentId = payResult.lastInsertRowid;

    const invoiceNumber = `INV-${req.user.tenantId}-${Date.now()}`;
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    run(
      `INSERT INTO invoices (tenant_id, number, amount, status, due_date, description, payment_id)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [req.user.tenantId, invoiceNumber, data.amount, dueDate, data.description || null, paymentId]
    );

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'payment.created', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ amount: data.amount, payment_id: paymentId })]
    );

    const payment = get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

paymentsRouter.post('/:id/confirm', async (req, res, next) => {
  try {
    const payment = get('SELECT * FROM payments WHERE id = ? AND tenant_id = ?', [req.params.id, req.user.tenantId]);
    if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    run(
      "UPDATE payments SET status = 'succeeded', transaction_id = ?, paid_at = datetime('now') WHERE id = ?",
      [transactionId, req.params.id]
    );

    run("UPDATE invoices SET status = 'paid' WHERE payment_id = ?", [req.params.id]);

    const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const info = run(
      `UPDATE tenants SET status = 'active', subscription_end = ?, updated_at = datetime('now')
       WHERE id = ? AND (subscription_end IS NULL OR subscription_end < datetime('now'))`,
      [newEndDate, req.user.tenantId]
    );

    if (info.changes > 0) {
      run(
        `INSERT INTO audit_logs (tenant_id, user_id, action, details)
         VALUES (?, ?, 'subscription.renewed', ?)`,
        [req.user.tenantId, req.user.userId, JSON.stringify({ payment_id: req.params.id })]
      );
    }

    const result = get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
