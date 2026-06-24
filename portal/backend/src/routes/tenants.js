import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { requireRole } from '../middleware/auth.js';

export const tenantsRouter = Router();

tenantsRouter.get('/my', async (req, res, next) => {
  try {
    if (!req.user.tenantId) {
      return res.json(null);
    }
    const row = get(
      `SELECT t.*, tar.name as tariff_name, tar.code as tariff_code,
               tar.price_monthly, tar.max_orders, tar.max_staff, tar.max_branches, tar.features
       FROM tenants t
       LEFT JOIN tariffs tar ON tar.id = t.tariff_id
       WHERE t.id = ?`,
      [req.user.tenantId]
    );
    if (!row) return res.status(404).json({ error: 'Ресторан не найден' });
    if (typeof row.features === 'string') row.features = JSON.parse(row.features);
    if (typeof row.settings_json === 'string' && row.settings_json !== '{}') {
      try { row.settings_json = JSON.parse(row.settings_json); } catch { row.settings_json = {}; }
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.put('/my', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'address', 'logo_url', 'working_hours', 'settings_json'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.user.tenantId);
    run(`UPDATE tenants SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);

    const { name, phone, address } = req.body;
    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'tenant.updated', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ name, phone, address })]
    );

    const row = get('SELECT * FROM tenants WHERE id = ?', [req.user.tenantId]);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/my/change-tariff', async (req, res, next) => {
  try {
    const { tariff_id } = req.body;
    if (!tariff_id) return res.status(400).json({ error: 'Укажите tariff_id' });

    const tariff = get('SELECT * FROM tariffs WHERE id = ? AND is_active = 1', [tariff_id]);
    if (!tariff) return res.status(404).json({ error: 'Тариф не найден' });

    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

    run(
      "UPDATE tenants SET tariff_id = ?, updated_at = datetime('now') WHERE id = ?",
      [tariff_id, req.user.tenantId]
    );

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'tariff.changed', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ from: tenant.tariff_id, to: tariff_id })]
    );

    const updated = get(
      `SELECT t.*, tar.name as tariff_name, tar.code as tariff_code,
              tar.price_monthly, tar.max_orders, tar.max_staff, tar.max_branches, tar.features
       FROM tenants t
       LEFT JOIN tariffs tar ON tar.id = t.tariff_id
       WHERE t.id = ?`,
      [req.user.tenantId]
    );
    if (typeof updated.features === 'string') updated.features = JSON.parse(updated.features);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.get('/my/stats', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const staffRows = query(
      'SELECT COUNT(*) as count FROM staff_accounts WHERE tenant_id = ? AND is_active = 1',
      [tenantId]
    );

    const payRows = query(
      "SELECT IFNULL(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = 'succeeded'",
      [tenantId]
    );

    const invoice = get(
      "SELECT * FROM invoices WHERE tenant_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 1",
      [tenantId]
    );

    res.json({
      staff_count: staffRows[0]?.count || 0,
      total_paid: payRows[0]?.total || 0,
      upcoming_invoice: invoice || null,
    });
  } catch (err) {
    next(err);
  }
});

const ROLE_LABELS = {
  admin: 'Администратор', waiter: 'Официант', chef: 'Повар',
  kitchen: 'Кухня', courier: 'Курьер', manager: 'Менеджер',
  stock_manager: 'Кладовщик', guest: 'Гости',
};

const STAFF_ROLES = ['admin', 'waiter', 'chef', 'kitchen', 'courier', 'manager', 'stock_manager'];

function parseRoleLimits(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = {};
    for (const role of [...STAFF_ROLES, 'guest']) {
      const val = parsed[role];
      if (typeof val === 'number') {
        result[role] = val;
      } else if (typeof val === 'object' && val !== null) {
        result[role] = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
      } else {
        result[role] = -1;
      }
    }
    return result;
  } catch { return {}; }
}

tenantsRouter.get('/my/app-settings', async (req, res, next) => {
  try {
    const row = get('SELECT app_settings FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (!row) return res.status(404).json({ error: 'Ресторан не найден' });
    const limits = parseRoleLimits(row.app_settings);

    const staffRows = query("SELECT role, COUNT(*) as cnt FROM staff_accounts WHERE tenant_id = ? AND is_active = 1 GROUP BY role", [req.user.tenantId]);
    const staffCountByRole = {};
    for (const r of staffRows) staffCountByRole[r.role] = r.cnt;

    const usage = {};
    for (const role of STAFF_ROLES) {
      usage[role] = {
        limit: limits[role] !== undefined ? limits[role] : -1,
        current: staffCountByRole[role] || 0,
      };
    }

    const guestCount = query("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'", [req.user.tenantId])[0]?.c || 0;
    usage.guest = {
      limit: limits.guest !== undefined ? limits.guest : -1,
      current: guestCount,
    };

    res.json({ tenant_id: req.user.tenantId, usage });
  } catch (err) { next(err); }
});

tenantsRouter.get('/:tenantId', requireRole('superadmin'), async (req, res, next) => {
  try {
    const row = get(
      `SELECT t.*, tar.name as tariff_name, tar.code as tariff_code
       FROM tenants t LEFT JOIN tariffs tar ON tar.id = t.tariff_id
       WHERE t.id = ?`,
      [req.params.tenantId]
    );
    if (!row) return res.status(404).json({ error: 'Ресторан не найден' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ========== Tenant branch management (with allow_create_branches check) ==========

tenantsRouter.get('/my/branches', async (req, res, next) => {
  try {
    const branches = query('SELECT * FROM branches WHERE tenant_id = ? ORDER BY created_at DESC', [req.user.tenantId]);
    res.json(branches);
  } catch (err) { next(err); }
});

tenantsRouter.post('/my/branches', async (req, res, next) => {
  try {
    const tenant = get('SELECT * FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });
    if (!tenant.allow_create_branches) {
      return res.status(403).json({ error: 'Функция недоступна, обратитесь к суперадминистратору' });
    }
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const r = run('INSERT INTO branches (tenant_id, name, address, phone) VALUES (?,?,?,?)',
      [req.user.tenantId, name, address || null, phone || null]);
    const branch = get('SELECT * FROM branches WHERE id = ?', [r.lastInsertRowid]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,'branch_created',?)",
      [req.user.tenantId, req.user.userId, JSON.stringify({ name, address })]);
    res.status(201).json(branch);
  } catch (err) { next(err); }
});

tenantsRouter.put('/my/branches/:id', async (req, res, next) => {
  try {
    const branch = get('SELECT * FROM branches WHERE id = ? AND tenant_id = ?', [req.params.id, req.user.tenantId]);
    if (!branch) return res.status(404).json({ error: 'Точка не найдена' });
    const sets = []; const params = [];
    for (const key of ['name', 'address', 'phone', 'is_active']) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    run(`UPDATE branches SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, params);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,'branch_updated',?)",
      [req.user.tenantId, req.user.userId, JSON.stringify({ branch_id: branch.id, updates: req.body })]);
    res.json(get('SELECT * FROM branches WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

tenantsRouter.delete('/my/branches/:id', async (req, res, next) => {
  try {
    const branch = get('SELECT * FROM branches WHERE id = ? AND tenant_id = ?', [req.params.id, req.user.tenantId]);
    if (!branch) return res.status(404).json({ error: 'Точка не найдена' });
    run('DELETE FROM branches WHERE id = ?', [req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,'branch_deleted',?)",
      [req.user.tenantId, req.user.userId, JSON.stringify({ branch_id: branch.id, name: branch.name })]);
    res.json({ message: 'Точка удалена' });
  } catch (err) { next(err); }
});

// ─── Tenant notifications ──────────────────────────────────────────
tenantsRouter.get('/my/notifications', async (req, res, next) => {
  try {
    const rows = query(
      'SELECT * FROM notification_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.tenantId]
    );
    const unread = get(
      'SELECT COUNT(*) as cnt FROM notification_logs WHERE tenant_id = ? AND is_read = 0',
      [req.user.tenantId]
    );
    res.json({ notifications: rows, unreadCount: unread?.cnt || 0 });
  } catch (err) { next(err); }
});

tenantsRouter.put('/my/notifications/:id/read', async (req, res, next) => {
  try {
    const notif = get('SELECT id FROM notification_logs WHERE id = ? AND tenant_id = ?', [req.params.id, req.user.tenantId]);
    if (!notif) return res.status(404).json({ error: 'Уведомление не найдено' });
    run('UPDATE notification_logs SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
