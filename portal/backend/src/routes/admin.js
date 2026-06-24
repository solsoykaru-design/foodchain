import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, db } from '../db.js';
import { config } from '../config.js';
import * as yookassa from '../services/yookassa.js';
import * as cloudpayments from '../services/cloudpayments.js';
import * as tbank from '../services/tbank.js';

function ensureColumn(table, column, definition) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); } catch (e) {}
}

export const adminRouter = Router();

function parseTariff(row) {
  if (!row) return null;
  if (typeof row.features === 'string') row.features = JSON.parse(row.features);
  return row;
}

function requireSuperadmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Доступ только суперадминистратору' });
  }
  next();
}
adminRouter.use(requireSuperadmin);

adminRouter.get('/tenants', (req, res, next) => {
  try {
    const { search, status, tariff_id, sort, order } = req.query;
    let sql = `SELECT t.*, tar.name as tariff_name, tar.code as tariff_code
               FROM tenants t LEFT JOIN tariffs tar ON tar.id = t.tariff_id WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ' AND (t.name LIKE ? OR t.email LIKE ? OR t.inn LIKE ?)';
      const p = `%${search}%`;
      params.push(p, p, p);
    }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (tariff_id) { sql += ' AND t.tariff_id = ?'; params.push(tariff_id); }

    const sortField = (sort && ['id', 'name', 'email', 'status', 'created_at', 'subscription_end'].includes(sort)) ? sort : 'created_at';
    sql += ` ORDER BY t.${sortField} ${order === 'asc' ? 'ASC' : 'DESC'}`;

    const tenants = query(sql, params);
    try {
      const staffCounts = {};
      const payments = {};
      const adminNames = {};
      for (const t of tenants) {
        try { staffCounts[t.id] = get('SELECT COUNT(*) as c FROM staff_accounts WHERE tenant_id = ? AND is_active = 1', [t.id])?.c || 0; } catch { staffCounts[t.id] = 0; }
        try { payments[t.id] = get('SELECT IFNULL(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = \'succeeded\'', [t.id])?.total || 0; } catch { payments[t.id] = 0; }
        try { adminNames[t.id] = get('SELECT username FROM staff_accounts WHERE tenant_id = ? AND role = \'superadmin\' LIMIT 1', [t.id])?.username || null; } catch { adminNames[t.id] = null; }
      }
      for (const t of tenants) {
        t.staff_count = staffCounts[t.id] || 0;
        t.total_paid = payments[t.id] || 0;
        t.admin_username = adminNames[t.id] || null;
      }
    } catch {}
    res.json(tenants);
  } catch (err) { next(err); }
});

const handleStatus = (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус' });
    }
    run("UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.status_changed', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ status, by: req.user.userId })]);
    res.json(get('SELECT * FROM tenants WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
};

const handleExtend = (req, res, next) => {
  try {
    const months = parseInt(req.body.months || '1', 10);
    if (months < 1 || months > 12) return res.status(400).json({ error: 'Месяцев: от 1 до 12' });

    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    const d = tenant.subscription_end ? new Date(tenant.subscription_end) : new Date();
    d.setMonth(d.getMonth() + months);
    const newEnd = d.toISOString().slice(0, 19).replace('T', ' ');

    run("UPDATE tenants SET subscription_end = ?, status = 'active', updated_at = datetime('now') WHERE id = ?", [newEnd, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.subscription_extended', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ months, new_end: newEnd })]);
    res.json(get('SELECT * FROM tenants WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
};

const handleNotes = (req, res, next) => {
  try {
    run("UPDATE tenants SET notes = ?, updated_at = datetime('now') WHERE id = ?", [req.body.notes || null, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.notes_updated', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ notes: req.body.notes })]);
    res.json(get('SELECT * FROM tenants WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
};

adminRouter.put('/tenants/:id/status', handleStatus);
adminRouter.patch('/tenants/:id/status', handleStatus);
adminRouter.put('/tenants/:id/extend', handleExtend);
adminRouter.patch('/tenants/:id/extend', handleExtend);
adminRouter.put('/tenants/:id/notes', handleNotes);
adminRouter.patch('/tenants/:id/notes', handleNotes);

// ─── Access mode management ────────────────────────────────

adminRouter.get('/tenants/:id/access-mode', (req, res, next) => {
  try {
    const tenant = get('SELECT id, access_mode, demo_data_created_at, demo_auto_cleanup_days FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    res.json(tenant);
  } catch (err) { next(err); }
});

adminRouter.put('/tenants/:id/access-mode', async (req, res, next) => {
  try {
    const { access_mode } = req.body;
    if (!['demo', 'production'].includes(access_mode)) {
      return res.status(400).json({ error: 'Режим должен быть demo или production' });
    }

    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    const prev = tenant.access_mode;

    run("UPDATE tenants SET access_mode = ?, updated_at = datetime('now') WHERE id = ?", [access_mode, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.access_mode_changed', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ from: prev, to: access_mode, by: req.user.userId })]);

    // Sync to main server
    try {
      const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: config.portalSyncKey,
          tenant: { id: tenant.id, name: tenant.name, allow_create_branches: tenant.allow_create_branches || 0, access_mode }
        })
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
        console.warn('[SYNC] access_mode sync warning:', errData.error || syncRes.status);
      }
    } catch (syncErr) {
      console.warn('[SYNC] access_mode sync error:', syncErr.message);
    }

    res.json(get('SELECT * FROM tenants WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

adminRouter.post('/tenants/:id/reset-demo', (req, res, next) => {
  try {
    const tenant = get('SELECT id, access_mode FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    if (tenant.access_mode !== 'demo') return res.status(400).json({ error: 'Сброс доступен только в демо-режиме' });

    // Signal main server to reset demo data
    fetch(`${config.mainServerUrl}/api/internal/reset-demo-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.portalSyncKey, tenant_id: tenant.id })
    }).then(r => {
      if (!r.ok) console.error('[SYNC] reset-demo error:', r.status);
      return r.json().catch(() => ({}));
    }).then(result => {
      run("UPDATE tenants SET demo_data_created_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [tenant.id]);
      run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.demo_data_reset', ?)",
        [tenant.id, req.user.userId, JSON.stringify({ by: req.user.userId })]);
      res.json({ message: 'Демо-данные сброшены', demo_data_created_at: new Date().toISOString() });
    }).catch(err => {
      console.error('[SYNC] reset-demo fetch error:', err.message);
      // Still update locally even if main server fails
      run("UPDATE tenants SET demo_data_created_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [tenant.id]);
      run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.demo_data_reset', ?)",
        [tenant.id, req.user.userId, JSON.stringify({ by: req.user.userId, note: 'main server sync failed' })]);
      res.json({ message: 'Демо-данные сброшены (локально)', demo_data_created_at: new Date().toISOString() });
    });
  } catch (err) { next(err); }
});

adminRouter.delete('/tenants/:id', async (req, res, next) => {
  try {
    if (!get('SELECT id FROM tenants WHERE id = ?', [req.params.id])) {
      return res.status(404).json({ error: 'Ресторан не найден' });
    }
    const tid = req.params.id;
    run('DELETE FROM superadmin_logs WHERE tenant_id = ?', [tid]);
    run('DELETE FROM impersonation_log WHERE target_tenant_id = ?', [tid]);
    run('DELETE FROM tenants WHERE id = ?', [tid]);

    try {
      await fetch(`${config.mainServerUrl}/api/internal/delete-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: config.portalSyncKey, tenant_id: tid }),
      });
    } catch {}

    res.json({ message: 'Ресторан удалён' });
  } catch (err) { next(err); }
});

adminRouter.post('/tenants/:id/notify', async (req, res, next) => {
  try {
    const { subject, body, type, sendEmail } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Тема и текст обязательны' });
    run("INSERT INTO notification_logs (tenant_id, subject, body, type, is_read) VALUES (?, ?, ?, ?, 0)",
      [req.params.id, subject, body, type || 'info']);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.notification_sent', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ subject })]);

    if (sendEmail) {
      try {
        const tenant = get('SELECT email, name FROM tenants WHERE id = ?', [req.params.id]);
        if (tenant?.email) {
          const html = '<div style="font-family:Inter,sans-serif;padding:24px;"><h2 style="color:#1e40af;">' + subject + '</h2><p>' + body + '</p><hr style="margin-top:24px;"/><p style="color:#94a3b8;font-size:12px;">FoodChain — система автоматизации ресторанов</p></div>';
          await fetch(`${config.mainServerUrl}/api/internal/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: config.portalSyncKey, to: tenant.email, subject, html })
          });
        }
      } catch (emailErr) {
        console.warn('[NOTIFY_EMAIL] Failed:', emailErr.message);
      }
    }

    res.status(201).json({ message: 'Уведомление отправлено' });
  } catch (err) { next(err); }
});

adminRouter.post('/notify-all', async (req, res, next) => {
  try {
    const { subject, body, type, sendEmail } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Тема и текст обязательны' });
    const tenants = query("SELECT id, email, name FROM tenants WHERE status = 'active'");
    for (const t of tenants) {
      run("INSERT INTO notification_logs (tenant_id, subject, body, type, is_read) VALUES (?, ?, ?, ?, 0)",
        [t.id, subject, body, type || 'info']);

      if (sendEmail && t.email) {
        try {
          const html = '<div style="font-family:Inter,sans-serif;padding:24px;"><h2 style="color:#1e40af;">' + subject + '</h2><p>' + body + '</p><hr style="margin-top:24px;"/><p style="color:#94a3b8;font-size:12px;">FoodChain — система автоматизации ресторанов</p></div>';
          await fetch(`${config.mainServerUrl}/api/internal/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: config.portalSyncKey, to: t.email, subject, html })
          });
        } catch (emailErr) {
          console.warn('[BROADCAST_EMAIL] Failed for ' + t.email + ':', emailErr.message);
        }
      }
    }
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.broadcast_sent', ?)",
      [req.user.userId, JSON.stringify({ subject, tenant_count: tenants.length })]);
    res.status(201).json({ message: `Уведомление отправлено ${tenants.length} ресторанам` });
  } catch (err) { next(err); }
});

adminRouter.get('/tariffs', (req, res, next) => {
  try { res.json(query('SELECT * FROM tariffs ORDER BY sort_order').map(parseTariff)); }
  catch (err) { next(err); }
});

adminRouter.post('/tariffs', (req, res, next) => {
  try {
    const { name, code, price_monthly, max_orders, max_staff, max_branches, features, sort_order } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name и code обязательны' });
    const r = run(
      'INSERT INTO tariffs (name, code, price_monthly, max_orders, max_staff, max_branches, features, sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [name, code, price_monthly || 0, max_orders || 0, max_staff || 0, max_branches || 1, JSON.stringify(features || []), sort_order || 0]
    );
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.tariff_created', ?)",
      [req.user.userId, JSON.stringify({ name, code })]);
    res.status(201).json(parseTariff(get('SELECT * FROM tariffs WHERE id = ?', [r.lastInsertRowid])));
  } catch (err) { next(err); }
});

adminRouter.put('/tariffs/:id', (req, res, next) => {
  try {
    const fields = [];
    const params = [];
    for (const key of ['name', 'code', 'price_monthly', 'max_orders', 'max_staff', 'max_branches', 'is_active', 'sort_order']) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    if (req.body.features) { fields.push('features = ?'); params.push(JSON.stringify(req.body.features)); }
    if (fields.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    run(`UPDATE tariffs SET ${fields.join(', ')} WHERE id = ?`, params);
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.tariff_updated', ?)",
      [req.user.userId, JSON.stringify({ id: req.params.id, updates: req.body })]);
    res.json(parseTariff(get('SELECT * FROM tariffs WHERE id = ?', [req.params.id])));
  } catch (err) { next(err); }
});

adminRouter.delete('/tariffs/:id', (req, res, next) => {
  try {
    if ((query('SELECT COUNT(*) as c FROM tenants WHERE tariff_id = ?', [req.params.id])[0]?.c || 0) > 0) {
      return res.status(409).json({ error: 'Тариф используется ресторанами' });
    }
    run('DELETE FROM tariffs WHERE id = ?', [req.params.id]);
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.tariff_deleted', ?)",
      [req.user.userId, JSON.stringify({ id: req.params.id })]);
    res.json({ message: 'Тариф удалён' });
  } catch (err) { next(err); }
});

adminRouter.get('/subscriptions', (req, res, next) => {
  try {
    const { status, tariff_id, provider } = req.query;
    let sql = `SELECT s.*, t.name as tenant_name, t.email as tenant_email,
               tar.name as tariff_name, tar.code as tariff_code, tar.price_monthly
               FROM subscriptions s
               JOIN tenants t ON t.id = s.tenant_id
               JOIN tariffs tar ON tar.id = s.tariff_id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    if (tariff_id) { sql += ' AND s.tariff_id = ?'; params.push(tariff_id); }
    if (provider) { sql += ' AND s.provider = ?'; params.push(provider); }
    sql += ' ORDER BY s.created_at DESC';
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

adminRouter.get('/subscriptions/:tenantId', (req, res, next) => {
  try {
    const rows = query(
      `SELECT s.*, tar.name as tariff_name, tar.code as tariff_code, tar.price_monthly
       FROM subscriptions s
       JOIN tariffs tar ON tar.id = s.tariff_id
       WHERE s.tenant_id = ?
       ORDER BY s.created_at DESC`,
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

adminRouter.put('/subscriptions/:id/status', (req, res, next) => {
  try {
    const { status, end_date, note } = req.body;
    if (!['active', 'paused', 'expired', 'canceled'].includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус' });
    }
    const sub = get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });

    run("UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, sub.id]);
    if (status === 'active') {
      const now = new Date();
      const end = end_date ? new Date(end_date) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      run("UPDATE subscriptions SET start_date = ?, end_date = ? WHERE id = ?", [now.toISOString(), end.toISOString(), sub.id]);
      run("UPDATE tenants SET status = 'active', subscription_start = ?, subscription_end = ?, updated_at = datetime('now') WHERE id = ?",
        [now.toISOString(), end.toISOString(), sub.tenant_id]);
    } else if (status === 'expired' || status === 'canceled') {
      run("UPDATE subscriptions SET auto_renew = 0 WHERE id = ?", [sub.id]);
      run("UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?", [sub.tenant_id]);
    }

    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.subscription_status_updated', ?)",
      [req.user.userId, JSON.stringify({ subscription_id: sub.id, from: sub.status, to: status, note })]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

adminRouter.post('/subscriptions/:id/renew', (req, res, next) => {
  try {
    const { months } = req.body;
    const sub = get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });

    const m = parseInt(months) || 1;
    const existingEnd = sub.end_date ? new Date(sub.end_date) : new Date();
    const baseDate = existingEnd > new Date() ? existingEnd : new Date();
    const newEnd = new Date(baseDate.getTime() + m * 30 * 24 * 60 * 60 * 1000);

    run("UPDATE subscriptions SET status = 'active', end_date = ?, updated_at = datetime('now') WHERE id = ?",
      [newEnd.toISOString(), sub.id]);
    run("UPDATE tenants SET status = 'active', subscription_end = ?, updated_at = datetime('now') WHERE id = ?",
      [newEnd.toISOString(), sub.tenant_id]);

    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.subscription_renewed', ?)",
      [req.user.userId, JSON.stringify({ subscription_id: sub.id, months: m, new_end: newEnd.toISOString() })]);

    const tariff = get('SELECT price_monthly FROM tariffs WHERE id = ?', [sub.tariff_id]);
    const amount = tariff ? tariff.price_monthly * m : 0;

    run("INSERT INTO payments (tenant_id, amount, status, description) VALUES (?, ?, 'succeeded', ?)",
      [sub.tenant_id, amount, `Ручное продление подписки на ${m} мес. администратором`]);

    res.json({ success: true, newEnd: newEnd.toISOString() });
  } catch (err) { next(err); }
});

adminRouter.get('/subscriptions/:tenantId/payments', (req, res, next) => {
  try {
    const rows = query(
      'SELECT * FROM payme_transactions WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

adminRouter.get('/payment-providers', (req, res, next) => {
  try {
    const rows = query('SELECT * FROM payment_providers ORDER BY sort_order');
    const result = rows.map(r => {
      let cfg = {};
      try { cfg = JSON.parse(r.config); } catch {}
      return { ...r, config: cfg };
    });
    res.json(result);
  } catch (err) { next(err); }
});

adminRouter.put('/payment-providers/:code', (req, res, next) => {
  try {
    const { is_active, config: cfg } = req.body;
    const code = req.params.code;
    const existing = get('SELECT * FROM payment_providers WHERE code = ?', [code]);
    if (!existing) return res.status(404).json({ error: 'Провайдер не найден' });
    if (is_active !== undefined) {
      run('UPDATE payment_providers SET is_active = ?, updated_at = datetime(\'now\') WHERE code = ?', [is_active ? 1 : 0, code]);
    }
    if (cfg !== undefined) {
      run('UPDATE payment_providers SET config = ?, updated_at = datetime(\'now\') WHERE code = ?', [JSON.stringify(cfg), code]);
      // Apply config immediately without restart
      if (code === 'yookassa' && cfg.shopId) yookassa.configureYooKassa(cfg);
      if (code === 'cloudpayments' && cfg.publicId) cloudpayments.configureCloudPayments(cfg);
      if (code === 'tbank' && cfg.terminalKey) tbank.configureTBank(cfg);
    }
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.payment_provider_updated', ?)",
      [req.user.userId, JSON.stringify({ code, is_active, has_config: !!cfg })]);
    const updated = get('SELECT * FROM payment_providers WHERE code = ?', [code]);
    let configParsed = {};
    try { configParsed = JSON.parse(updated.config); } catch {}
    res.json({ ...updated, config: configParsed });
  } catch (err) { next(err); }
});

adminRouter.post('/payment-providers', (req, res, next) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code и name обязательны' });
    const existing = get('SELECT * FROM payment_providers WHERE code = ?', [code]);
    if (existing) return res.status(409).json({ error: 'Провайдер с таким code уже существует' });
    run('INSERT INTO payment_providers (code, name, description, config, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, \'{}\', 0, 0, datetime(\'now\'), datetime(\'now\'))',
      [code, name, description || '']);
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.payment_provider_created', ?)",
      [req.user.userId, JSON.stringify({ code, name })]);
    const created = get('SELECT * FROM payment_providers WHERE code = ?', [code]);
    let cfg = {};
    try { cfg = JSON.parse(created.config); } catch {}
    res.status(201).json({ ...created, config: cfg });
  } catch (err) { next(err); }
});

adminRouter.delete('/payment-providers/:code', (req, res, next) => {
  try {
    const existing = get('SELECT * FROM payment_providers WHERE code = ?', [req.params.code]);
    if (!existing) return res.status(404).json({ error: 'Провайдер не найден' });
    run('DELETE FROM payment_providers WHERE code = ?', [req.params.code]);
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.payment_provider_deleted', ?)",
      [req.user.userId, JSON.stringify({ code: req.params.code })]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

adminRouter.get('/stats', (req, res, next) => {
  try {
    let monthlyRevenue = 0, totalRevenue = 0;
    try { monthlyRevenue = query("SELECT IFNULL(SUM(amount), 0) as t FROM payments WHERE status = 'succeeded' AND paid_at >= datetime('now', '-30 days')")[0]?.t || 0; } catch {}
    try { totalRevenue = query("SELECT IFNULL(SUM(amount), 0) as t FROM payments WHERE status = 'succeeded'")[0]?.t || 0; } catch {}
    let byTariff = [];
    try { byTariff = query('SELECT tar.code, tar.name, COUNT(*) as count FROM tenants t JOIN tariffs tar ON tar.id = t.tariff_id GROUP BY tar.id, tar.code, tar.name'); } catch {}
    res.json({
      total_tenants: query("SELECT COUNT(*) as c FROM tenants")[0]?.c || 0,
      active_tenants: query("SELECT COUNT(*) as c FROM tenants WHERE status = 'active'")[0]?.c || 0,
      monthly_revenue: monthlyRevenue,
      total_revenue: totalRevenue,
      by_tariff: byTariff,
    });
  } catch (err) { next(err); }
});

adminRouter.post('/tenants', async (req, res, next) => {
  try {
    const { name, nickname, email, inn, phone, address, tariff_id, admin_username, admin_password, access_mode, with_demo_data, app_settings, base_currency } = req.body;
    if (!name || !email || !inn || !phone) return res.status(400).json({ error: 'name, email, inn, phone обязательны' });

    const mode = access_mode === 'production' ? 'production' : 'demo';
    const appSettingsStr = app_settings ? JSON.stringify(app_settings) : null;

    let tenantId;
    try {
      const tRes = run(
        'INSERT INTO tenants (uuid, name, nickname, inn, phone, address, email, tariff_id, status, access_mode, app_settings, base_currency) VALUES (?,?,?,?,?,?,?,?,\'active\',?,?,?)',
        [uuidv4(), name, nickname || null, inn, phone, address || null, email, tariff_id || 1, mode, appSettingsStr, base_currency || 'RUB']
      );
      tenantId = Number(tRes.lastInsertRowid);
    } catch (e) {
      return res.status(500).json({ error: 'Ошибка создания ресторана: ' + e.message });
    }

    const passwordHash = admin_password ? bcrypt.hashSync(admin_password, config.bcryptRounds) : null;
    let syncWarnings = [];
    let createErrors = [];

    if (admin_username && passwordHash) {
      try {
        run('INSERT INTO staff_accounts (tenant_id, username, password_hash, role, first_name) VALUES (?,?,?,\'superadmin\',?)',
          [tenantId, admin_username, passwordHash, name]);
      } catch (e) {
        createErrors.push('staff_accounts: ' + e.message);
      }

      try {
        const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: config.portalSyncKey,
            staff: {
              tenant_id: tenantId,
              username: admin_username,
              password_hash: passwordHash,
              role: 'admin',
              first_name: name,
              phone: phone,
              email: email,
            }
          })
        });
        if (!syncRes.ok) {
          const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
          syncWarnings.push(`sync-staff: ${errData.error || syncRes.status}`);
        }
      } catch (syncErr) {
        syncWarnings.push(`sync-staff: ${syncErr.message}`);
      }
    }

    try {
      run('INSERT INTO users (email, password_hash, full_name, role, tenant_id, email_verified) VALUES (?,?,?,\'partner\',?,1)',
        [email, passwordHash || bcrypt.hashSync('changeme', config.bcryptRounds), name, tenantId]);
    } catch (e) {
      createErrors.push('users: ' + e.message);
    }

    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,'admin.tenant_created',?)",
      [tenantId, req.user.userId, JSON.stringify({ name, email })]);

    const newTenant = get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    const tariff = tariff_id ? get('SELECT name FROM tariffs WHERE id = ?', [tariff_id]) : null;
    const tariffName = tariff?.name || '';
    const subscriptionStart = newTenant.subscription_start || '';
    const subscriptionEnd = newTenant.subscription_end || '';

    const tenantPayload = {
      id: newTenant.id, name: newTenant.name, nickname: newTenant.nickname,
      allow_create_branches: newTenant.allow_create_branches || 0,
      access_mode: newTenant.access_mode, with_demo_data: !!with_demo_data,
      app_settings: appSettingsStr, base_currency: newTenant.base_currency || 'RUB',
      admin_login: admin_username || '', admin_email: email || '',
      tariff_name: tariffName, subscription_start: subscriptionStart,
      subscription_end: subscriptionEnd,
    };

    try {
      const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: config.portalSyncKey, tenant: tenantPayload })
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
        syncWarnings.push(`sync-tenant: ${errData.error || syncRes.status}`);
      }
    } catch (syncErr) {
      syncWarnings.push(`sync-tenant: ${syncErr.message}`);
    }

    // ─── Send welcome email to tenant ─────────────────────────────────
    try {
      await fetch(`${config.mainServerUrl}/api/internal/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: config.portalSyncKey,
          tenant: { email, name: newTenant.name, nickname: newTenant.nickname, admin_login: admin_username || '', admin_password: admin_password || '', tariff_name: tariffName, subscription_start: subscriptionStart, subscription_end: subscriptionEnd }
        })
      });
    } catch (emailErr) {
      console.warn('[WELCOME_EMAIL] Failed:', emailErr.message);
    }

    const response = { ...newTenant };
    if (syncWarnings.length) response.syncWarnings = syncWarnings;
    if (createErrors.length) {
      response.createErrors = createErrors;
      console.warn('[TENANT_CREATE] Partial errors:', createErrors);
    }
    res.status(201).json(response);
  } catch (err) { next(err); }
});

adminRouter.get('/tenants/:id/notifications', (req, res, next) => {
  try {
    res.json(query('SELECT * FROM notification_logs WHERE tenant_id = ? ORDER BY created_at DESC', [req.params.id]));
  } catch (err) { next(err); }
});

adminRouter.get('/audit', (req, res, next) => {
  try {
    const { action, tenant_id, limit, offset } = req.query;
    let sql = 'SELECT al.*, u.email as user_email FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id WHERE 1=1';
    const params = [];
    if (action) { sql += ' AND al.action = ?'; params.push(action); }
    if (tenant_id) { sql += ' AND al.tenant_id = ?'; params.push(tenant_id); }
    sql += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit || '50')} OFFSET ${parseInt(offset || '0')}`;
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

adminRouter.get('/notifications', (req, res, next) => {
  try {
    const { tenant_id, is_read, limit, offset } = req.query;
    let sql = 'SELECT * FROM notification_logs WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(tenant_id); }
    if (is_read !== undefined) { sql += ' AND is_read = ?'; params.push(is_read === 'true' || is_read === '1' ? 1 : 0); }
    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit || '50')} OFFSET ${parseInt(offset || '0')}`;
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

adminRouter.get('/export', (req, res, next) => {
  try {
    const rows = query(
      `SELECT t.id, t.uuid, t.name, t.inn, t.email, t.phone, t.status,
              t.subscription_start, t.subscription_end, t.created_at,
              tar.name as tariff_name,
              (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE tenant_id = t.id AND status = 'succeeded') as total_paid
       FROM tenants t LEFT JOIN tariffs tar ON tar.id = t.tariff_id ORDER BY t.created_at DESC`
    );
    const header = 'ID,UUID,Название,ИНН,Email,Телефон,Статус,Режим,Тариф,Подписка с,Подписка до,Всего оплачено,Создан';
    const csv = [header, ...rows.map(r =>
      ['id', 'uuid', 'name', 'inn', 'email', 'phone', 'status', 'access_mode', 'tariff_name', 'subscription_start', 'subscription_end', 'total_paid', 'created_at']
        .map(k => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tenants_export.csv"');
    res.send('\ufeff' + csv);
  } catch (err) { next(err); }
});

// === Additional superadmin features ===

adminRouter.get('/users/:tenantId', (req, res, next) => {
  try {
    const users = query(
      "SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.last_login, u.created_at FROM users u WHERE u.tenant_id = ? ORDER BY u.created_at DESC",
      [req.params.tenantId]
    );
    const staff = query(
      "SELECT s.id, s.username, s.role, s.first_name, s.last_name, s.is_active, s.created_at FROM staff_accounts s WHERE s.tenant_id = ? ORDER BY s.created_at DESC",
      [req.params.tenantId]
    );
    res.json({ users, staff });
  } catch (err) { next(err); }
});

adminRouter.post('/impersonate', (req, res, next) => {
  try {
    const { staff_id, tenant_id } = req.body;
    if (!staff_id && !tenant_id) return res.status(400).json({ error: 'Укажите staff_id или tenant_id' });

    let target = null;
    if (staff_id) {
      const row = get('SELECT id, tenant_id, username, role, first_name, last_name, is_active FROM staff_accounts WHERE id = ?', [staff_id]);
      if (row) target = row;
    } else {
      target = { tenant_id, username: 'superadmin', role: 'superadmin' };
    }
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const token = jwt.sign(
      { userId: req.user.userId, sub: target.id, tenantId: target.tenant_id, role: 'impersonated', targetUser: target.username },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    run("INSERT INTO impersonation_log (superadmin_id, target_user_id, target_tenant_id, target_username, action, ip_address) VALUES (?,?,?,?,'impersonate',?)",
      [req.user.userId, target.id, target.tenant_id, target.username, req.ip]);

    res.json({ token, target });
  } catch (err) { next(err); }
});

adminRouter.get('/audit/export', (req, res, next) => {
  try {
    const { tenant_id, action, from, to } = req.query;
    let sql = 'SELECT al.*, u.email as user_email, tn.name as tenant_name FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id LEFT JOIN tenants tn ON tn.id = al.tenant_id WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND al.tenant_id = ?'; params.push(tenant_id); }
    if (action) { sql += ' AND al.action = ?'; params.push(action); }
    if (from) { sql += ' AND al.created_at >= ?'; params.push(from); }
    if (to) { sql += ' AND al.created_at <= ?'; params.push(to); }
    sql += ' ORDER BY al.created_at DESC';
    const rows = query(sql, params);
    const header = 'ID,Действие,Пользователь,Арендатор,Детали,Дата';
    const csv = [header, ...rows.map(r =>
      ['id', 'action', 'user_email', 'tenant_name', 'details', 'created_at']
        .map(k => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    res.send('\ufeff' + csv);
  } catch (err) { next(err); }
});

adminRouter.post('/invoices/manual', (req, res, next) => {
  try {
    const { tenant_id, amount, description, due_date } = req.body;
    if (!tenant_id || !amount) return res.status(400).json({ error: 'tenant_id и amount обязательны' });
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [tenant_id]);
    if (!tenant) return res.status(404).json({ error: 'Арендатор не найден' });
    const number = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const due = due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const r = run(
      'INSERT INTO invoices (tenant_id, number, amount, description, due_date) VALUES (?,?,?,?,?)',
      [tenant_id, number, amount, description || null, due]
    );
    run("INSERT INTO notification_logs (tenant_id, subject, body, type) VALUES (?,?,?,?)",
      [tenant_id, 'Выставлен новый счёт', `Счёт ${number} на сумму ${amount} ₽`, 'billing']);
    res.status(201).json(get('SELECT * FROM invoices WHERE id = ?', [r.lastInsertRowid]));
  } catch (err) { next(err); }
});

adminRouter.get('/invoices', (req, res, next) => {
  try {
    const { tenant_id, status } = req.query;
    let sql = 'SELECT i.*, tn.name as tenant_name FROM invoices i LEFT JOIN tenants tn ON tn.id = i.tenant_id WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND i.tenant_id = ?'; params.push(tenant_id); }
    if (status) { sql += ' AND i.status = ?'; params.push(status); }
    sql += ' ORDER BY i.created_at DESC LIMIT 200';
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

adminRouter.get('/dashboard', (req, res, next) => {
  try {
    const activeTenants = query("SELECT COUNT(*) as c FROM tenants WHERE status = 'active'")[0]?.c || 0;
    const monthRevenue = query("SELECT IFNULL(SUM(amount), 0) as t FROM payments WHERE status = 'succeeded' AND paid_at >= datetime('now', '-30 days')")[0]?.t || 0;
    const monthOrders = query("SELECT COUNT(*) as c FROM audit_logs WHERE action LIKE 'order.%' AND created_at >= datetime('now', '-30 days')")[0]?.c || 0;
    const avgOrder = monthOrders > 0 ? (monthRevenue / monthOrders) : 0;

    const signups = query(
      "SELECT date(created_at) as date, COUNT(*) as count FROM tenants WHERE created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY date"
    );

    const topRevenue = query(
      "SELECT t.id, t.name, IFNULL(SUM(p.amount), 0) as total FROM tenants t LEFT JOIN payments p ON p.tenant_id = t.id AND p.status = 'succeeded' WHERE t.status = 'active' GROUP BY t.id ORDER BY total DESC LIMIT 10"
    );

    const topOrders = query(
      "SELECT t.id, t.name, COUNT(*) as total FROM tenants t LEFT JOIN audit_logs al ON al.tenant_id = t.id AND al.action LIKE 'order.%' AND al.created_at >= datetime('now', '-30 days') GROUP BY t.id ORDER BY total DESC LIMIT 10"
    );

    res.json({
      active_tenants: activeTenants,
      monthly_revenue: monthRevenue,
      monthly_orders: monthOrders,
      avg_order: avgOrder,
      signups,
      top_by_revenue: topRevenue,
      top_by_orders: topOrders,
    });
  } catch (err) { next(err); }
});

adminRouter.post('/broadcast', (req, res, next) => {
  try {
    const { subject, body, type, tariff_ids } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Тема и текст обязательны' });
    let sql = "SELECT id FROM tenants WHERE status = 'active'";
    const params = [];
    if (tariff_ids && tariff_ids.length > 0) {
      sql += ` AND tariff_id IN (${tariff_ids.map(() => '?').join(',')})`;
      params.push(...tariff_ids);
    }
    const tenants = query(sql, params);
    for (const t of tenants) {
      run("INSERT INTO notification_logs (tenant_id, subject, body, type) VALUES (?, ?, ?, ?)",
        [t.id, subject, body, type || 'info']);
    }
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.broadcast_sent', ?)",
      [req.user.userId, JSON.stringify({ subject, tenant_count: tenants.length, tariff_ids })]);
    res.json({ message: `Уведомление отправлено ${tenants.length} ресторанам` });
  } catch (err) { next(err); }
});

adminRouter.get('/modules', (req, res, next) => {
  try {
    const modules = [
      { code: 'orders', name: 'Заказы', description: 'Управление заказами' },
      { code: 'menu', name: 'Меню', description: 'Создание и редактирование меню' },
      { code: 'staff', name: 'Сотрудники', description: 'Управление персоналом' },
      { code: 'warehouse', name: 'Склад', description: 'Учёт товаров на складе' },
      { code: 'finance', name: 'Финансы', description: 'Финансовые отчёты' },
      { code: 'marketing', name: 'Маркетинг', description: 'Маркетинговые инструменты' },
      { code: 'booking', name: 'Бронирование', description: 'Бронирование столов' },
      { code: 'pickup', name: 'Самовывоз', description: 'Самовывоз заказов' },
    ];
    const { tenant_id } = req.query;
    if (tenant_id) {
      const enabled = query('SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND is_enabled = 1', [tenant_id]);
      const enabledCodes = enabled.map(m => m.module_code);
      return res.json(modules.map(m => ({ ...m, enabled: enabledCodes.includes(m.code) })));
    }
    res.json(modules);
  } catch (err) { next(err); }
});

adminRouter.put('/modules/:tenantId', (req, res, next) => {
  try {
    const { modules } = req.body;
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules должен быть массивом' });
    for (const mod of modules) {
      const existing = get('SELECT id FROM tenant_modules WHERE tenant_id = ? AND module_code = ?', [req.params.tenantId, mod.code]);
      if (existing) {
        run('UPDATE tenant_modules SET is_enabled = ? WHERE id = ?', [mod.enabled ? 1 : 0, existing.id]);
      } else {
        run('INSERT INTO tenant_modules (tenant_id, module_code, is_enabled) VALUES (?,?,?)',
          [req.params.tenantId, mod.code, mod.enabled ? 1 : 0]);
      }
    }
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,'admin.modules_updated',?)",
      [req.params.tenantId, req.user.userId, JSON.stringify({ modules })]);
    res.json({ message: 'Модули обновлены' });
  } catch (err) { next(err); }
});

// ========== Extended superadmin tenant management ==========

// PUT /api/admin/tenants/:id — update tenant details (full control)
adminRouter.put('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    // Handle password change separately
    const { admin_password, ...restBody } = req.body;
    if (admin_password) {
      const staff = get("SELECT * FROM staff_accounts WHERE tenant_id = ? AND role = 'superadmin' LIMIT 1", [req.params.id]);
      if (staff) {
        const hash = bcrypt.hashSync(admin_password, config.bcryptRounds);
        run('UPDATE staff_accounts SET password_hash = ? WHERE id = ?', [hash, staff.id]);
        // Sync password to main server
        try {
          const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: config.portalSyncKey,
              staff: {
                tenant_id: req.params.id,
                username: staff.username,
                password_hash: hash,
                role: 'admin',
                first_name: staff.first_name || tenant.name,
              }
            })
          });
          if (!syncRes.ok) {
            const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
            console.warn('[SYNC] password sync warning:', errData.error || syncRes.status);
          }
        } catch (syncErr) {
          console.warn('[SYNC] password sync error:', syncErr.message);
        }
      }
    }

    const allowed = ['name','inn','phone','email','address','logo_url','nickname','contact_phone','contact_email','legal_address','working_hours','allow_create_branches','settings_json','app_settings','admin_username','base_currency'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (restBody[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(restBody[key]);
      }
    }
    if (sets.length === 0 && !admin_password) return res.status(400).json({ error: 'Нет полей для обновления' });

    if (sets.length > 0) {
      params.push(req.params.id);
      run(`UPDATE tenants SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);
    }

    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'tenant_updated',?)",
      [req.user.userId, req.params.id, JSON.stringify({ updates: req.body })]);

    // Sync to main server
    const updated = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    try {
      const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: config.portalSyncKey,
          tenant: { id: updated.id, name: updated.name, nickname: updated.nickname, allow_create_branches: updated.allow_create_branches, access_mode: updated.access_mode, base_currency: updated.base_currency || 'RUB' }
        })
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
        console.warn('[SYNC] tenant sync warning:', errData.error || syncRes.status);
      }
    } catch (syncErr) {
      console.warn('[SYNC] tenant sync error:', syncErr.message);
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/admin/tenants/:id/impersonate — generate impersonation JWT for WPF admin
adminRouter.post('/tenants/:id/impersonate', (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    // Find the tenant's admin staff account
    const staff = get("SELECT * FROM staff_accounts WHERE tenant_id = ? AND role = 'superadmin' LIMIT 1", [req.params.id]);
    if (!staff) return res.status(404).json({ error: 'Администратор ресторана не найден' });

    const token = jwt.sign(
      {
        userId: req.user.userId,
        sub: staff.id,
        tenantId: staff.tenant_id,
        role: 'impersonated',
        targetUser: staff.username,
        impersonatedBy: req.user.userId,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'tenant_impersonated',?)",
      [req.user.userId, req.params.id, JSON.stringify({ staff_id: staff.id, username: staff.username })]);

    res.json({ token, staff: { id: staff.id, username: staff.username, tenant_id: staff.tenant_id } });
  } catch (err) { next(err); }
});

// POST /api/admin/tenants/:id/reset-password — reset admin password
adminRouter.post('/tenants/:id/reset-password', async (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    const staff = get("SELECT * FROM staff_accounts WHERE tenant_id = ? AND role = 'superadmin' LIMIT 1", [req.params.id]);
    if (!staff) return res.status(404).json({ error: 'Администратор ресторана не найден' });

    const tempPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    const hash = bcrypt.hashSync(tempPassword, config.bcryptRounds);

    run('UPDATE staff_accounts SET password_hash = ? WHERE id = ?', [hash, staff.id]);

    // Save reset record
    run("INSERT INTO password_resets (tenant_id, staff_id, temp_password, created_by) VALUES (?,?,?,?)",
      [req.params.id, staff.id, tempPassword, req.user.userId]);

    // Sync to main server
    try {
      const syncRes = await fetch(`${config.mainServerUrl}/api/internal/sync-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: config.portalSyncKey,
          staff: { tenant_id: staff.tenant_id, id: staff.id, username: staff.username, password_hash: hash, role: staff.role, first_name: staff.first_name, phone: tenant.phone, email: tenant.email }
        })
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json().catch(() => ({ error: syncRes.statusText }));
        console.warn('[SYNC] password reset sync warning:', errData.error || syncRes.status);
      }
    } catch (syncErr) {
      console.warn('[SYNC] password reset sync error:', syncErr.message);
    }

    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'password_reset',?)",
      [req.user.userId, req.params.id, JSON.stringify({ staff_id: staff.id, username: staff.username })]);

    res.json({ temp_password: tempPassword, message: 'Пароль сброшен. Покажите временный пароль администратору.' });
  } catch (err) { next(err); }
});

// GET /api/admin/tenants/:id/statistics — get tenant statistics
adminRouter.get('/tenants/:id/statistics', async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const staffCount = query("SELECT COUNT(*) as c FROM staff_accounts WHERE tenant_id = ? AND is_active = 1", [tenantId])[0]?.c || 0;
    const totalPaid = query("SELECT IFNULL(SUM(amount),0) as t FROM payments WHERE tenant_id = ? AND status = 'succeeded'", [tenantId])[0]?.t || 0;

    let ordersCount = 0;
    let monthlyRevenue = 0;
    try {
      const url = `${config.mainServerUrl}/api/internal/tenant-stats?tenant_id=${tenantId}&key=${config.portalSyncKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const d = await resp.json();
        ordersCount = d.orders_count || 0;
        monthlyRevenue = d.monthly_revenue || 0;
      }
    } catch {}

    res.json({
      staff_count: staffCount,
      total_paid: totalPaid,
      orders_count: ordersCount,
      monthly_revenue: monthlyRevenue,
      tenant_id: parseInt(tenantId),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/tenants/:id/staff — list staff with block/unblock info
adminRouter.get('/tenants/:id/staff', (req, res, next) => {
  try {
    const staff = query(
      "SELECT s.id, s.tenant_id, s.username, s.role, s.first_name, s.last_name, s.is_active, s.created_at, (s.is_active = 0) as is_blocked FROM staff_accounts s WHERE s.tenant_id = ? ORDER BY s.created_at DESC",
      [req.params.id]
    );
    res.json(staff);
  } catch (err) { next(err); }
});

// PUT /api/admin/tenants/:id/staff/:staffId/block — block staff
adminRouter.put('/tenants/:id/staff/:staffId/block', (req, res, next) => {
  try {
    const s = get('SELECT * FROM staff_accounts WHERE id = ? AND tenant_id = ?', [req.params.staffId, req.params.id]);
    if (!s) return res.status(404).json({ error: 'Сотрудник не найден' });
    run('UPDATE staff_accounts SET is_active = 0 WHERE id = ?', [req.params.staffId]);
    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'staff_blocked',?)",
      [req.user.userId, req.params.id, JSON.stringify({ staff_id: s.id, username: s.username })]);
    res.json({ message: 'Сотрудник заблокирован' });
  } catch (err) { next(err); }
});

// PUT /api/admin/tenants/:id/staff/:staffId/unblock — unblock staff
adminRouter.put('/tenants/:id/staff/:staffId/unblock', (req, res, next) => {
  try {
    const s = get('SELECT * FROM staff_accounts WHERE id = ? AND tenant_id = ?', [req.params.staffId, req.params.id]);
    if (!s) return res.status(404).json({ error: 'Сотрудник не найден' });
    run('UPDATE staff_accounts SET is_active = 1 WHERE id = ?', [req.params.staffId]);
    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'staff_unblocked',?)",
      [req.user.userId, req.params.id, JSON.stringify({ staff_id: s.id, username: s.username })]);
    res.json({ message: 'Сотрудник разблокирован' });
  } catch (err) { next(err); }
});

// GET /api/admin/branches — list branches (superadmin sees all, can filter by tenant_id)
adminRouter.get('/branches', (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM branches WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(tenant_id); }
    sql += ' ORDER BY created_at DESC';
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

// POST /api/admin/branches — create branch (superadmin bypasses allow_create_branches)
adminRouter.post('/branches', async (req, res, next) => {
  try {
    const { tenant_id, name, address, phone } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: 'tenant_id и name обязательны' });
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [tenant_id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    const r = run('INSERT INTO branches (tenant_id, name, address, phone) VALUES (?,?,?,?)',
      [tenant_id, name, address || null, phone || null]);
    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,'branch_created',?)",
      [req.user.userId, tenant_id, JSON.stringify({ name, address, phone })]);
    const branch = get('SELECT * FROM branches WHERE id = ?', [r.lastInsertRowid]);

    // Sync to main server DB (so guest/courier apps see the branch)
    try {
      const syncUrl = `${config.mainServerUrl}/api/branches`;
      const syncKey = config.portalSyncKey;
      await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-sync-key': syncKey },
        body: JSON.stringify({ tenant_id, name, address, phone }),
      });
    } catch (syncErr) {
      console.error('Branch sync to main server failed:', syncErr.message);
    }

    res.status(201).json(branch);
  } catch (err) { next(err); }
});

// PUT /api/admin/branches/:id
adminRouter.put('/branches/:id', (req, res, next) => {
  try {
    const branch = get('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    if (!branch) return res.status(404).json({ error: 'Точка не найдена' });
    const sets = []; const params = [];
    for (const key of ['name', 'address', 'phone', 'is_active']) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    run(`UPDATE branches SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);
    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,?,'branch_updated',?)",
      [req.user.userId, branch.tenant_id, JSON.stringify({ branch_id: branch.id, updates: req.body })]);
    res.json(get('SELECT * FROM branches WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/admin/branches/:id
adminRouter.delete('/branches/:id', (req, res, next) => {
  try {
    const branch = get('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    if (!branch) return res.status(404).json({ error: 'Точка не найдена' });
    run('DELETE FROM branches WHERE id = ?', [req.params.id]);
    run("INSERT INTO superadmin_logs (superadmin_id, tenant_id, action, details) VALUES (?,?,?,'branch_deleted',?)",
      [req.user.userId, branch.tenant_id, JSON.stringify({ branch_id: branch.id })]);
    res.json({ message: 'Точка удалена' });
  } catch (err) { next(err); }
});

// GET /api/admin/superadmin-logs — view superadmin action history
adminRouter.get('/superadmin-logs', (req, res, next) => {
  try {
    const { tenant_id, limit, offset } = req.query;
    let sql = 'SELECT sl.*, u.email as admin_email FROM superadmin_logs sl LEFT JOIN users u ON u.id = sl.superadmin_id WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND sl.tenant_id = ?'; params.push(tenant_id); }
    sql += ` ORDER BY sl.created_at DESC LIMIT ${parseInt(limit || '50')} OFFSET ${parseInt(offset || '0')}`;
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

// ─── Exchange Rates (global for portal) ─────────────────────

adminRouter.get('/exchange-rates', (req, res, next) => {
  try {
    const rates = query('SELECT * FROM exchange_rates ORDER BY currency_code');
    res.json(rates);
  } catch (err) { next(err); }
});

adminRouter.post('/exchange-rates', (req, res, next) => {
  try {
    const { currency_code, name, symbol, rate } = req.body;
    if (!currency_code) return res.status(400).json({ error: 'currency_code обязателен' });
    const existing = get('SELECT id FROM exchange_rates WHERE currency_code = ?', [currency_code]);
    if (existing) return res.status(409).json({ error: 'Валюта уже существует' });
    const r = run(
      "INSERT INTO exchange_rates (currency_code, name, symbol, rate) VALUES (?,?,?,?)",
      [currency_code, name || '', symbol || '', rate || 1]
    );
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.exchange_rate_created', ?)",
      [req.user.userId, JSON.stringify({ currency_code, rate })]);
    res.status(201).json(get('SELECT * FROM exchange_rates WHERE id = ?', [r.lastInsertRowid]));
  } catch (err) { next(err); }
});

adminRouter.put('/exchange-rates/:id', (req, res, next) => {
  try {
    const existing = get('SELECT * FROM exchange_rates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Курс не найден' });
    const { rate, name, symbol } = req.body;
    if (rate !== undefined) {
      run("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ?", [rate, req.params.id]);
    }
    if (name !== undefined) {
      run("UPDATE exchange_rates SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, req.params.id]);
    }
    if (symbol !== undefined) {
      run("UPDATE exchange_rates SET symbol = ?, updated_at = datetime('now') WHERE id = ?", [symbol, req.params.id]);
    }
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.exchange_rate_updated', ?)",
      [req.user.userId, JSON.stringify({ id: req.params.id, updates: req.body })]);
    res.json(get('SELECT * FROM exchange_rates WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

adminRouter.delete('/exchange-rates/:id', (req, res, next) => {
  try {
    const existing = get('SELECT * FROM exchange_rates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Курс не найден' });
    run('DELETE FROM exchange_rates WHERE id = ?', [req.params.id]);
    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.exchange_rate_deleted', ?)",
      [req.user.userId, JSON.stringify({ id: req.params.id, currency_code: existing.currency_code })]);
    res.json({ message: 'Курс удалён' });
  } catch (err) { next(err); }
});

adminRouter.post('/exchange-rates/auto-update', async (req, res, next) => {
  try {
    // Fetch rates from CBR (Central Bank of Russia) and update
    const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
    if (!response.ok) return res.status(502).json({ error: 'Не удалось получить курсы ЦБ РФ' });
    const data = await response.json();
    const valutes = data?.Valute;
    if (!valutes) return res.status(502).json({ error: 'Неверный формат данных ЦБ РФ' });

    const fixedCodes = {
      'USD': 'Доллар США', 'EUR': 'Евро', 'BYN': 'Белорусский рубль',
      'KZT': 'Казахстанский тенге', 'UZS': 'Узбекский сум',
      'AMD': 'Армянский драм', 'KGS': 'Киргизский сом',
      'CNY': 'Китайский юань', 'TRY': 'Турецкая лира',
      'GBP': 'Фунт стерлингов', 'AED': 'Дирхам ОАЭ',
    };

    let updated = 0;
    for (const [code, info] of Object.entries(valutes)) {
      if (!fixedCodes[code]) continue;
      const rate = info.Value / info.Nominal;
      const existing = get('SELECT id FROM exchange_rates WHERE currency_code = ?', [code]);
      if (existing) {
        run("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ?", [rate, existing.id]);
      } else {
        const symbolMap = { USD: '$', EUR: '€', BYN: 'Br', KZT: '₸', UZS: "so'm", AMD: '֏', KGS: 'som', CNY: '¥', TRY: '₺', GBP: '£', AED: 'د.إ' };
        run("INSERT INTO exchange_rates (currency_code, name, symbol, rate) VALUES (?,?,?,?)",
          [code, fixedCodes[code], symbolMap[code] || '', rate]);
      }
      updated++;
    }

    // Ensure RUB as base
    const rub = get('SELECT id FROM exchange_rates WHERE currency_code = ?', ['RUB']);
    if (!rub) {
      run("INSERT INTO exchange_rates (currency_code, name, symbol, rate) VALUES ('RUB', 'Российский рубль', '₽', 1)");
    } else {
      run("UPDATE exchange_rates SET rate = 1 WHERE currency_code = 'RUB'");
    }

    run("INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'admin.exchange_rates_auto_updated', ?)",
      [req.user.userId, JSON.stringify({ updated_currencies: updated })]);
    res.json({ message: `Обновлено ${updated} курсов`, updated });
  } catch (err) { next(err); }
});

// ─── Role-based Limits (staff quotas per role) ───────────────

const ROLES = ['admin', 'waiter', 'chef', 'kitchen', 'courier', 'manager', 'stock_manager', 'guest'];

const ROLE_LABELS = {
  admin: 'Администратор',
  waiter: 'Официант',
  chef: 'Повар',
  kitchen: 'Кухня',
  courier: 'Курьер',
  manager: 'Менеджер',
  stock_manager: 'Кладовщик',
  guest: 'Гости (регистрация)',
};

const DEFAULT_ROLE_LIMITS = {
  admin: -1, waiter: -1, chef: -1, kitchen: -1,
  courier: -1, manager: -1, stock_manager: -1, guest: -1,
};

function parseRoleLimits(raw) {
  if (!raw) return { ...DEFAULT_ROLE_LIMITS };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = {};
    for (const role of ROLES) {
      const val = parsed[role];
      if (typeof val === 'number') {
        result[role] = val;
      } else if (typeof val === 'object' && val !== null) {
        // Support old format { enabled: true, limit: 5 } — extract limit
        result[role] = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : DEFAULT_ROLE_LIMITS[role]);
      } else {
        result[role] = DEFAULT_ROLE_LIMITS[role];
      }
    }
    return result;
  } catch { return { ...DEFAULT_ROLE_LIMITS }; }
}

// GET /api/admin/tenants/:id/app-settings — get current role limits
adminRouter.get('/tenants/:id/app-settings', (req, res, next) => {
  try {
    const tenant = get('SELECT id, app_settings, name FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    res.json({ tenant_id: tenant.id, app_settings: parseRoleLimits(tenant.app_settings) });
  } catch (err) { next(err); }
});

// PUT /api/admin/tenants/:id/app-settings — update role limits
adminRouter.put('/tenants/:id/app-settings', (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    const newSettings = req.body.app_settings;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'app_settings обязателен' });
    }

    const validated = parseRoleLimits(newSettings);
    const appSettingsStr = JSON.stringify(validated);

    run("UPDATE tenants SET app_settings = ?, updated_at = datetime('now') WHERE id = ?", [appSettingsStr, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?, ?, 'admin.role_limits_updated', ?)",
      [req.params.id, req.user.userId, JSON.stringify({ role_limits: validated, by: req.user.userId })]);

    // Sync to main server
    fetch(`${config.mainServerUrl}/api/internal/sync-tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: config.portalSyncKey,
        tenant: { id: tenant.id, name: tenant.name, allow_create_branches: tenant.allow_create_branches || 0, access_mode: tenant.access_mode, app_settings: appSettingsStr }
      })
    }).catch(err => console.error('[SYNC] role_limits sync error:', err.message));

    res.json({ tenant_id: tenant.id, app_settings: validated, message: 'Лимиты ролей обновлены' });
  } catch (err) { next(err); }
});

// POST /api/admin/tenants/:id/app-settings/check-limits — check if reducing limits would block users
adminRouter.post('/tenants/:id/app-settings/check-limits', (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    const proposed = parseRoleLimits(req.body.app_settings);
    const current = parseRoleLimits(tenant.app_settings);

    // Count current staff per role
    const staffRows = query('SELECT role, COUNT(*) as cnt FROM staff_accounts WHERE tenant_id = ? AND is_active = 1 GROUP BY role', [req.params.id]);
    const staffCountByRole = {};
    for (const row of staffRows) staffCountByRole[row.role] = row.cnt;

    const warnings = [];
    for (const role of ROLES) {
      if (role === 'guest') {
        const proposedLimit = proposed.guest;
        if (proposedLimit >= 0) {
          const guestCount = query("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'", [req.params.id])[0]?.c || 0;
          if (guestCount > proposedLimit) {
            warnings.push({
              role: 'guest',
              label: 'Гости',
              current_count: guestCount,
              proposed_limit: proposedLimit,
              excess: guestCount - proposedLimit,
              message: `Гости: зарегистрировано ${guestCount} пользователей, новый лимит ${proposedLimit}. Превышение: ${guestCount - proposedLimit}.`,
            });
          }
        }
        continue;
      }
      const proposedLimit = proposed[role];
      if (proposedLimit < 0) continue;
      const currentCount = staffCountByRole[role] || 0;
      if (currentCount > proposedLimit) {
        warnings.push({
          role,
          label: ROLE_LABELS[role] || role,
          current_count: currentCount,
          proposed_limit: proposedLimit,
          excess: currentCount - proposedLimit,
          message: `${ROLE_LABELS[role] || role}: используется ${currentCount} пользователей, новый лимит ${proposedLimit}. Превышение: ${currentCount - proposedLimit}.`,
        });
      }
    }

    res.json({ has_warnings: warnings.length > 0, warnings });
  } catch (err) { next(err); }
});

// GET /api/admin/app-settings/templates — list available templates
adminRouter.get('/app-settings/templates', (req, res, next) => {
  try {
    const templates = [
      {
        id: 'small',
        name: 'Маленький ресторан',
        description: 'До 3 курьеров, 5 официантов, 2 повара, 1 менеджер',
        app_settings: { admin: -1, waiter: 5, chef: 2, kitchen: 2, courier: 3, manager: 1, stock_manager: -1, guest: 500 },
      },
      {
        id: 'medium',
        name: 'Средний ресторан',
        description: 'До 5 курьеров, 8 официантов, 3 повара, 5 менеджеров',
        app_settings: { admin: -1, waiter: 8, chef: 3, kitchen: 3, courier: 5, manager: 2, stock_manager: -1, guest: 2000 },
      },
      {
        id: 'large',
        name: 'Сеть / Крупный ресторан',
        description: 'До 20 курьеров, 20 официантов, 10 поваров, 10 менеджеров',
        app_settings: { admin: -1, waiter: 20, chef: 10, kitchen: 10, courier: 20, manager: 5, stock_manager: -1, guest: -1 },
      },
    ];
    res.json(templates);
  } catch (err) { next(err); }
});
