import { Router } from 'express';
import { z } from 'zod';
import { query, get, run } from '../db.js';
import { config } from '../config.js';
import * as payme from '../services/payme.js';
import * as yookassa from '../services/yookassa.js';
import * as cloudpayments from '../services/cloudpayments.js';
import * as tbank from '../services/tbank.js';

export const subscriptionsRouter = Router();

const PROVIDERS = {
  payme: { service: payme, name: 'Payme' },
  yookassa: { service: yookassa, name: 'ЮKassa' },
  cloudpayments: { service: cloudpayments, name: 'CloudPayments' },
  tbank: { service: tbank, name: 'Т-Банк' },
};

function getActiveProviders() {
  return query('SELECT * FROM payment_providers WHERE is_active = 1 ORDER BY sort_order');
}

function getService(provider) {
  const svc = PROVIDERS[provider];
  if (!svc) return null;
  if (!svc.service.isConfigured()) return null;
  return svc.service;
}

subscriptionsRouter.get('/providers', (req, res, next) => {
  try {
    const rows = getActiveProviders();
    const result = rows.map(r => {
      let cfg = {};
      try { cfg = JSON.parse(r.config); } catch {}
      return {
        code: r.code,
        name: r.name,
        description: r.description,
        methods: cfg.methods || [],
      };
    });
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionsRouter.get('/status', (req, res, next) => {
  try {
    const sub = get(
      `SELECT s.*, t.name as tariff_name, t.code as tariff_code, t.price_monthly,
              t.max_orders, t.max_staff, t.max_branches, t.features
       FROM subscriptions s
       JOIN tariffs t ON t.id = s.tariff_id
       WHERE s.tenant_id = ? AND s.status IN ('active','pending','paused')
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.tenantId]
    );
    if (!sub) return res.json({ active: false, hasSubscription: false });
    if (typeof sub.features === 'string') sub.features = JSON.parse(sub.features);
    return res.json({ active: sub.status === 'active', hasSubscription: true, subscription: sub });
  } catch (err) { next(err); }
});

subscriptionsRouter.get('/payments', (req, res, next) => {
  try {
    const rows = query(
      'SELECT * FROM payme_transactions WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const createSchema = z.object({
  tariffId: z.number().int().positive(),
  provider: z.string().optional().default('payme'),
  returnUrl: z.string().optional(),
  cardNumber: z.string().optional(),
  expireDate: z.string().optional(),
});

subscriptionsRouter.post('/create', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const tenantId = req.user.tenantId;
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Арендатор не найден' });

    const tariff = get('SELECT * FROM tariffs WHERE id = ? AND is_active = 1', [data.tariffId]);
    if (!tariff) return res.status(400).json({ error: 'Тариф не найден или неактивен' });

    const existingActive = get("SELECT id FROM subscriptions WHERE tenant_id = ? AND status = 'active'", [tenantId]);
    if (existingActive) return res.status(400).json({ error: 'У вас уже есть активная подписка. Сначала отмените её.' });

    const providerCode = data.provider || 'payme';
    const svc = getService(providerCode);
    if (!svc && providerCode !== 'payme') return res.status(400).json({ error: 'Провайдер не настроен' });

    let paymentUrl = null;
    let transactionId = null;
    let paymentMethodId = null;

    switch (providerCode) {
      case 'yookassa': {
        const result = await yookassa.createSubscription({
          amount: tariff.price_monthly,
          description: `Подписка "${tariff.name}"`,
          tenantId, tariffId: tariff.id, tariffName: tariff.name,
          returnUrl: data.returnUrl,
        });
        transactionId = result.paymentId;
        paymentUrl = result.confirmationUrl;
        paymentMethodId = result.paymentMethodId;
        break;
      }
      case 'cloudpayments': {
        const result = await cloudpayments.createSubscription({
          amount: tariff.price_monthly,
          description: `Подписка "${tariff.name}"`,
          tenantId, tariffId: tariff.id, tariffName: tariff.name,
          email: tenant.email,
        });
        transactionId = result.subscriptionId;
        paymentUrl = result.paymentUrl;
        break;
      }
      case 'tbank': {
        const result = await tbank.createSubscription({
          amount: tariff.price_monthly,
          description: `Подписка "${tariff.name}"`,
          tenantId, tariffId: tariff.id, tariffName: tariff.name,
          email: tenant.email,
        });
        transactionId = result.paymentId;
        paymentUrl = result.confirmationUrl;
        paymentMethodId = result.rebillId;
        break;
      }
      default: {
        if (data.cardNumber && data.expireDate) {
          const result = await payme.createSubscription({
            cardNumber: data.cardNumber, expireDate: data.expireDate,
            amount: tariff.price_monthly, tenantId,
            tariffName: tariff.name, tariffId: tariff.id,
          });
          transactionId = result.subscriptionId;
          paymentUrl = result.redirectUrl;
        } else {
          const result = await payme.createInitialPayment(
            tariff.price_monthly, tenantId, tariff.id, tariff.name, tenant.phone
          );
          transactionId = result.receiptId;
          paymentUrl = result.redirectUrl;
        }
      }
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subResult = run(
      `INSERT INTO subscriptions (tenant_id, tariff_id, status, start_date, end_date, auto_renew, provider, payme_subscription_id)
       VALUES (?, ?, 'pending', ?, ?, 1, ?, ?)`,
      [tenantId, tariff.id, now.toISOString(), endDate.toISOString(), providerCode, transactionId]
    );
    const subscriptionDbId = subResult.lastInsertRowid;

    run("UPDATE tenants SET tariff_id = ?, status = 'pending', updated_at = datetime('now') WHERE id = ?", [tariff.id, tenantId]);
    run(`INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'subscription.created', ?)`,
      [tenantId, req.user.userId, JSON.stringify({ subscription_id: subscriptionDbId, tariff_id: tariff.id, amount: tariff.price_monthly, provider: providerCode })]);

    res.status(201).json({
      subscriptionId: subscriptionDbId,
      transactionId,
      paymentUrl,
      paymentMethodId,
      amount: tariff.price_monthly,
      tariff: tariff.name,
      provider: providerCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

subscriptionsRouter.post('/confirm/:id', (req, res, next) => {
  try {
    const subId = req.params.id;
    const tenantId = req.user.tenantId;
    const sub = get(
      'SELECT s.*, t.price_monthly FROM subscriptions s JOIN tariffs t ON t.id = s.tariff_id WHERE s.id = ? AND s.tenant_id = ?',
      [subId, tenantId]
    );
    if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });
    if (sub.status !== 'pending') return res.status(400).json({ error: 'Подписка уже обработана' });

    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    run("UPDATE subscriptions SET status = 'active', start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?",
      [now.toISOString(), endDate.toISOString(), subId]);
    run("UPDATE tenants SET status = 'active', subscription_start = ?, subscription_end = ?, updated_at = datetime('now') WHERE id = ?",
      [now.toISOString(), endDate.toISOString(), tenantId]);
    run(`INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'subscription.activated', ?)`,
      [tenantId, req.user.userId, JSON.stringify({ subscription_id: parseInt(subId) })]);

    const updated = get(
      `SELECT s.*, t.name as tariff_name, t.code as tariff_code, t.price_monthly,
              t.max_orders, t.max_staff, t.max_branches, t.features
       FROM subscriptions s JOIN tariffs t ON t.id = s.tariff_id WHERE s.id = ?`, [subId]);
    if (updated && typeof updated.features === 'string') updated.features = JSON.parse(updated.features);
    res.json(updated);
  } catch (err) { next(err); }
});

subscriptionsRouter.post('/cancel', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { reason } = req.body;
    const sub = get(
      "SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ('active','paused') ORDER BY created_at DESC LIMIT 1",
      [tenantId]
    );
    if (!sub) return res.status(404).json({ error: 'Активная подписка не найдена' });

    if (sub.provider === 'cloudpayments' && sub.payme_subscription_id) {
      try { await cloudpayments.cancelSubscription(sub.payme_subscription_id); } catch {}
    }

    run("UPDATE subscriptions SET status = 'canceled', auto_renew = 0, cancel_reason = ?, updated_at = datetime('now') WHERE id = ?",
      [reason || 'Отменено пользователем', sub.id]);
    run("UPDATE tenants SET updated_at = datetime('now') WHERE id = ?", [tenantId]);
    run(`INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'subscription.canceled', ?)`,
      [tenantId, req.user.userId, JSON.stringify({ subscription_id: sub.id, reason })]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

subscriptionsRouter.post('/change-tariff', (req, res, next) => {
  try {
    const data = z.object({ tariffId: z.number().int().positive() }).parse(req.body);
    const tenantId = req.user.tenantId;
    const tariff = get('SELECT * FROM tariffs WHERE id = ? AND is_active = 1', [data.tariffId]);
    if (!tariff) return res.status(400).json({ error: 'Тариф не найден' });
    const sub = get("SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ('active','paused') ORDER BY created_at DESC LIMIT 1", [tenantId]);
    if (!sub) return res.status(404).json({ error: 'Активная подписка не найдена' });
    run("UPDATE subscriptions SET tariff_id = ?, updated_at = datetime('now') WHERE id = ?", [tariff.id, sub.id]);
    run("UPDATE tenants SET tariff_id = ?, updated_at = datetime('now') WHERE id = ?", [tariff.id, tenantId]);
    run(`INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'subscription.tariff_changed', ?)`,
      [tenantId, req.user.userId, JSON.stringify({ from: sub.tariff_id, to: tariff.id })]);
    res.json({ success: true, tariff });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

subscriptionsRouter.get('/history', (req, res, next) => {
  try {
    const rows = query(
      `SELECT s.*, t.name as tariff_name FROM subscriptions s JOIN tariffs t ON t.id = s.tariff_id WHERE s.tenant_id = ? ORDER BY s.created_at DESC`,
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});
