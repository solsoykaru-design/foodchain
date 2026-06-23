import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

ticketsRouter.get('/', (req, res, next) => {
  try {
    const { status, priority, tenant_id, limit, offset } = req.query;
    let sql = 'SELECT t.*, u.email as user_email, u.full_name as user_name, tn.name as tenant_name FROM tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN tenants tn ON tn.id = t.tenant_id WHERE 1=1';
    const params = [];
    if (req.user.role !== 'superadmin') {
      sql += ' AND t.tenant_id = ?';
      params.push(req.user.tenantId);
    }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
    if (tenant_id && req.user.role === 'superadmin') { sql += ' AND t.tenant_id = ?'; params.push(tenant_id); }
    sql += ` ORDER BY t.updated_at DESC LIMIT ${parseInt(limit || '50')} OFFSET ${parseInt(offset || '0')}`;
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

ticketsRouter.post('/', (req, res, next) => {
  try {
    const { subject, description, priority, attachment } = req.body;
    if (!subject || !description) return res.status(400).json({ error: 'Тема и описание обязательны' });
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'У вас нет арендатора' });
    const r = run(
      'INSERT INTO tickets (tenant_id, user_id, subject, description, priority, attachment) VALUES (?,?,?,?,?,?)',
      [tenantId, req.user.userId, subject, description, priority || 'medium', attachment || null]
    );
    res.status(201).json(get('SELECT * FROM tickets WHERE id = ?', [r.lastInsertRowid]));
  } catch (err) { next(err); }
});

ticketsRouter.get('/:id', (req, res, next) => {
  try {
    const ticket = get('SELECT t.*, u.email as user_email, u.full_name as user_name, tn.name as tenant_name FROM tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN tenants tn ON tn.id = t.tenant_id WHERE t.id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (req.user.role !== 'superadmin' && ticket.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    ticket.messages = query('SELECT tm.*, u.email as user_email, u.full_name as user_name FROM ticket_messages tm LEFT JOIN users u ON u.id = tm.user_id WHERE tm.ticket_id = ? ORDER BY tm.created_at', [req.params.id]);
    res.json(ticket);
  } catch (err) { next(err); }
});

ticketsRouter.post('/:id/messages', (req, res, next) => {
  try {
    const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (req.user.role !== 'superadmin' && ticket.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Сообщение обязательно' });
    const isInternal = req.user.role === 'superadmin' ? (req.body.is_internal ? 1 : 0) : 0;
    const r = run(
      'INSERT INTO ticket_messages (ticket_id, user_id, message, is_internal) VALUES (?,?,?,?)',
      [req.params.id, req.user.userId, message, isInternal]
    );
    run("UPDATE tickets SET status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END, updated_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.status(201).json(get('SELECT * FROM ticket_messages WHERE id = ?', [r.lastInsertRowid]));
  } catch (err) { next(err); }
});

ticketsRouter.patch('/:id/status', (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус' });
    }
    const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (req.user.role !== 'superadmin' && ticket.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (req.user.role !== 'superadmin' && status === 'closed') {
      return res.status(403).json({ error: 'Только суперадмин может закрыть тикет' });
    }
    run("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);
    run("INSERT INTO audit_logs (tenant_id, user_id, action, details) VALUES (?,?,?,?)",
      [ticket.tenant_id, req.user.userId, 'ticket.status_changed', JSON.stringify({ ticket_id: req.params.id, status })]);
    res.json(get('SELECT * FROM tickets WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});
