import { Router } from 'express';
import crypto from 'crypto';
import { get, run, query } from '../db.js';
import { config } from '../config.js';
import * as yookassa from '../services/yookassa.js';
import * as cloudpayments from '../services/cloudpayments.js';
import * as tbank from '../services/tbank.js';

export const webhooksRouter = Router();

function activateSubscription(subscriptionId, tenantId) {
  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  run("UPDATE subscriptions SET status = 'active', start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?",
    [now.toISOString(), endDate.toISOString(), subscriptionId]);
  run("UPDATE tenants SET status = 'active', subscription_start = ?, subscription_end = ?, updated_at = datetime('now') WHERE id = ?",
    [now.toISOString(), endDate.toISOString(), tenantId]);
}

function renewSubscription(subscriptionId, tenantId) {
  const sub = get('SELECT end_date FROM subscriptions WHERE id = ?', [subscriptionId]);
  const baseDate = sub?.end_date ? new Date(sub.end_date) : new Date();
  const newEnd = new Date(Math.max(baseDate.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);
  run("UPDATE subscriptions SET status = 'active', end_date = ?, updated_at = datetime('now') WHERE id = ?",
    [newEnd.toISOString(), subscriptionId]);
  run("UPDATE tenants SET status = 'active', subscription_end = ?, updated_at = datetime('now') WHERE id = ?",
    [newEnd.toISOString(), tenantId]);
}

webhooksRouter.post('/payme', (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-payme-signature'];
    const timestamp = req.headers['x-payme-timestamp'];

    if (config.payme.secretKey && config.payme.secretKey !== 'dev-payme-secret' && signature && timestamp) {
      const payload = `${timestamp}.${body}`;
      const expected = crypto.createHmac('sha256', config.payme.secretKey).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { method, params } = req.body;
    const tenantId = params?.account?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant_id' });

    switch (method) {
      case 'Recurring.OnTransaction': {
        const { transaction_id, subscription_id, state, amount } = params;
        run(`INSERT INTO payme_transactions (tenant_id, subscription_id, payme_id, amount, state, status, provider, perform_time, payme_response)
             VALUES (?, NULL, ?, ?, ?, 'pending', 'payme', datetime('now'), ?)`,
          [parseInt(tenantId), transaction_id, amount / 100, state, body]);
        const sub = get('SELECT id FROM subscriptions WHERE payme_subscription_id = ?', [subscription_id]);
        if (sub) {
          if (state === 2) { activateSubscription(sub.id, parseInt(tenantId));
            run("UPDATE payme_transactions SET status = 'success', subscription_id = ? WHERE payme_id = ?", [sub.id, transaction_id]);
          } else if (state < 0) {
            run("UPDATE subscriptions SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [sub.id]);
            run("UPDATE payme_transactions SET status = 'failed' WHERE payme_id = ?", [transaction_id]);
          }
        }
        break;
      }
      case 'Recurring.OnCancel': {
        const sub = get('SELECT id FROM subscriptions WHERE payme_subscription_id = ?', [params.subscription_id]);
        if (sub) run("UPDATE subscriptions SET status = 'canceled', auto_renew = 0, updated_at = datetime('now') WHERE id = ?", [sub.id]);
        break;
      }
      case 'Recurring.OnRecurring': {
        const { transaction_id, subscription_id, state, amount } = params;
        run(`INSERT INTO payme_transactions (tenant_id, subscription_id, payme_id, amount, state, status, provider, perform_time, payme_response)
             VALUES (?, NULL, ?, ?, ?, 'pending', 'payme', datetime('now'), ?)`,
          [parseInt(tenantId), transaction_id, amount / 100, state, body]);
        const sub = get('SELECT id FROM subscriptions WHERE payme_subscription_id = ?', [subscription_id]);
        if (sub && state === 2) {
          renewSubscription(sub.id, parseInt(tenantId));
          run("UPDATE payme_transactions SET status = 'success', subscription_id = ? WHERE payme_id = ?", [sub.id, transaction_id]);
        } else if (sub) { run("UPDATE payme_transactions SET status = 'failed' WHERE payme_id = ?", [transaction_id]); }
        break;
      }
      case 'Recurring.OnFailed': {
        const sub = get('SELECT id FROM subscriptions WHERE payme_subscription_id = ?', [params.subscription_id]);
        if (sub) run("UPDATE subscriptions SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [sub.id]);
        break;
      }
    }
    res.json({ result: { success: true } });
  } catch (err) { console.error('Payme webhook error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

webhooksRouter.post('/yookassa', async (req, res) => {
  try {
    const signature = req.headers['x-yookassa-signature'] || '';
    if (!yookassa.verifyWebhook(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const { event, object } = req.body;
    const metadata = object?.metadata || {};
    const tenantId = parseInt(metadata.tenant_id);
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant_id' });

    if (event === 'payment.succeeded' || event === 'payment.waiting_for_capture') {
      const sub = get("SELECT id FROM subscriptions WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [tenantId]);
      const subscriptionId = sub?.id || null;

      run(`INSERT INTO payme_transactions (tenant_id, subscription_id, payme_id, amount, status, provider, provider_transaction_id, payment_method, perform_time, payme_response)
           VALUES (?, ?, ?, ?, 'success', 'yookassa', ?, ?, datetime('now'), ?)`,
        [tenantId, subscriptionId, object.id, parseFloat(object.amount?.value) || 0,
         object.id, object.payment_method?.type || 'bank_card', JSON.stringify(req.body)]);

      if (subscriptionId) {
        activateSubscription(subscriptionId, tenantId);
        if (object.payment_method?.id) {
          run("UPDATE subscriptions SET payme_subscription_id = ? WHERE id = ?", [object.payment_method.id, subscriptionId]);
        }
      }
    } else if (event === 'payment.canceled') {
      run(`INSERT INTO payme_transactions (tenant_id, payme_id, amount, status, provider, provider_transaction_id, payme_response)
           VALUES (?, ?, ?, 'failed', 'yookassa', ?, ?)`,
        [tenantId, object.id, parseFloat(object.amount?.value) || 0, object.id, JSON.stringify(req.body)]);
    }
    res.json({ result: { success: true } });
  } catch (err) { console.error('YooKassa webhook error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

webhooksRouter.post('/cloudpayments', async (req, res) => {
  try {
    const signature = req.headers['x-content-hmac'] || '';
    if (!cloudpayments.verifyWebhook(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const body = req.body;
    const tenantId = parseInt(body.AccountId) || parseInt(body.JsonData?.tenant_id);
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant_id' });

    if (body.Status === 'Active' && body.TransactionId) {
      const sub = get("SELECT id FROM subscriptions WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [tenantId]);
      const subscriptionId = sub?.id || null;

      run(`INSERT INTO payme_transactions (tenant_id, subscription_id, payme_id, amount, status, provider, provider_transaction_id, perform_time, payme_response)
           VALUES (?, ?, ?, ?, 'success', 'cloudpayments', ?, datetime('now'), ?)`,
        [tenantId, subscriptionId, body.TransactionId, parseFloat(body.Amount) || 0,
         body.TransactionId, JSON.stringify(body)]);

      if (subscriptionId) {
        activateSubscription(subscriptionId, tenantId);
        run("UPDATE subscriptions SET payme_subscription_id = ? WHERE id = ?", [body.SubscriptionId, subscriptionId]);
      }
    } else if (body.Status === 'Expired' || body.Status === 'Cancelled' || body.Status === 'Failed') {
      if (body.SubscriptionId) {
        const sub = get('SELECT id FROM subscriptions WHERE payme_subscription_id = ?', [body.SubscriptionId]);
        if (sub) run("UPDATE subscriptions SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [sub.id]);
      }
    }
    res.json({ code: 0 });
  } catch (err) { console.error('CloudPayments webhook error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

webhooksRouter.post('/tbank', async (req, res) => {
  try {
    const body = req.body;
    if (body.TerminalKey && !tbank.verifyWebhook(body, body.TerminalKey)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const tenantId = parseInt(body.CustomerKey) || parseInt(body.DATA?.tenant_id);
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant_id' });

    if (body.Status === 'CONFIRMED' || body.Status === 'AUTHORIZED') {
      const sub = get("SELECT id FROM subscriptions WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [tenantId]);
      const subscriptionId = sub?.id || null;

      run(`INSERT INTO payme_transactions (tenant_id, subscription_id, payme_id, amount, status, provider, provider_transaction_id, payment_method, perform_time, payme_response)
           VALUES (?, ?, ?, ?, 'success', 'tbank', ?, ?, datetime('now'), ?)`,
        [tenantId, subscriptionId, body.PaymentId, (parseInt(body.Amount) || 0) / 100,
         body.PaymentId, body.PayType || 'card', JSON.stringify(body)]);

      if (subscriptionId) {
        activateSubscription(subscriptionId, tenantId);
        if (body.RebillId) run("UPDATE subscriptions SET payme_subscription_id = ? WHERE id = ?", [body.RebillId, subscriptionId]);
      }
    } else if (body.Status === 'REJECTED' || body.Status === 'CANCELED') {
      run(`INSERT INTO payme_transactions (tenant_id, payme_id, amount, status, provider, provider_transaction_id, payme_response)
           VALUES (?, ?, ?, 'failed', 'tbank', ?, ?)`,
        [tenantId, body.PaymentId, (parseInt(body.Amount) || 0) / 100, body.PaymentId, JSON.stringify(body)]);
    }
    res.json({ Success: true });
  } catch (err) { console.error('T-Bank webhook error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

webhooksRouter.post('/payme/test', (req, res) => {
  res.json({ success: true, message: 'Payme webhook endpoint is alive' });
});
