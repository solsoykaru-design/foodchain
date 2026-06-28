import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query, get, run } from '../db.js';
import { config } from '../config.js';

async function syncToMainServer(staffData) {
  try {
    await fetch(`${config.mainServerUrl}/api/internal/sync-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.portalSyncKey, staff: staffData })
    });
  } catch (err) {
    console.error('[SYNC] Failed to sync staff to main server:', err.message);
  }
}

export const staffRouter = Router();

const staffSchema = z.object({
  username: z.string().min(2, 'Логин минимум 2 символа'),
  password: z.string().min(4, 'Пароль минимум 4 символа').optional(),
  role: z.enum(['superadmin', 'owner', 'manager', 'chef', 'waiter', 'courier', 'accountant', 'analyst']),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

staffRouter.get('/', async (req, res, next) => {
  try {
    const rows = query(
      `SELECT id, username, role, first_name, last_name, is_active, created_at
       FROM staff_accounts WHERE tenant_id = ? ORDER BY created_at DESC`,
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/', async (req, res, next) => {
  try {
    const data = staffSchema.parse(req.body);

    const existing = query('SELECT id FROM staff_accounts WHERE tenant_id = ? AND username = ?', [
      req.user.tenantId, data.username,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Логин уже используется' });
    }

    const password = data.password || data.username;
    const passwordHash = bcrypt.hashSync(password, config.bcryptRounds);

    const result = run(
      `INSERT INTO staff_accounts (tenant_id, username, password_hash, role, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.tenantId, data.username, passwordHash, data.role, data.first_name || null, data.last_name || null]
    );

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'staff.created', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ username: data.username, role: data.role })]
    );

    const row = get('SELECT id, username, role, first_name, last_name, is_active, created_at FROM staff_accounts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(row);

    if (passwordHash) {
      syncToMainServer({
        tenant_id: req.user.tenantId,
        username: data.username,
        password_hash: passwordHash,
        role: data.role,
        first_name: data.first_name || data.username,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
});

staffRouter.put('/:id', async (req, res, next) => {
  try {
    const account = get('SELECT id FROM staff_accounts WHERE id = ? AND tenant_id = ?', [
      req.params.id, req.user.tenantId,
    ]);
    if (!account) return res.status(404).json({ error: 'Сотрудник не найден' });

    const updates = [];
    const params = [];

    if (req.body.role) {
      updates.push('role = ?');
      params.push(req.body.role);
    }
    if (req.body.first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(req.body.first_name);
    }
    if (req.body.last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(req.body.last_name);
    }
    let newPasswordHash = null;
    if (req.body.password) {
      newPasswordHash = bcrypt.hashSync(req.body.password, config.bcryptRounds);
      updates.push('password_hash = ?');
      params.push(newPasswordHash);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      run(`UPDATE staff_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'staff.updated', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ id: req.params.id, updates: req.body })]
    );

    const row = get('SELECT id, username, role, first_name, last_name, is_active, created_at FROM staff_accounts WHERE id = ?', [req.params.id]);
    res.json(row);

    if (newPasswordHash) {
      syncToMainServer({
        tenant_id: req.user.tenantId,
        username: row.username,
        password_hash: newPasswordHash,
        role: row.role,
        first_name: row.first_name || row.username,
      });
    }
  } catch (err) {
    next(err);
  }
});

staffRouter.delete('/:id', async (req, res, next) => {
  try {
    const account = get('SELECT id FROM staff_accounts WHERE id = ? AND tenant_id = ?', [
      req.params.id, req.user.tenantId,
    ]);
    if (!account) return res.status(404).json({ error: 'Сотрудник не найден' });

    run('DELETE FROM staff_accounts WHERE id = ?', [req.params.id]);

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'staff.deleted', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ id: req.params.id })]
    );

    res.json({ message: 'Сотрудник удалён' });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/:id/toggle', async (req, res, next) => {
  try {
    const account = get('SELECT id, is_active FROM staff_accounts WHERE id = ? AND tenant_id = ?', [
      req.params.id, req.user.tenantId,
    ]);
    if (!account) return res.status(404).json({ error: 'Сотрудник не найден' });

    const newStatus = account.is_active ? 0 : 1;
    run('UPDATE staff_accounts SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'staff.toggle', ?)`,
      [req.user.tenantId, req.user.userId, JSON.stringify({ id: req.params.id, new_status: !!newStatus })]
    );

    const row = get('SELECT id, username, role, first_name, last_name, is_active, created_at FROM staff_accounts WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) {
    next(err);
  }
});
