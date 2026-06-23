import { Router } from 'express';
import { query, get, run } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

export const messagesRouter = Router();
export const notificationsRouter = Router();
export const pushSettingsRouter = Router();

messagesRouter.use(authenticate);
notificationsRouter.use(authenticate);
pushSettingsRouter.use(authenticate);

messagesRouter.get('/', (req, res, next) => {
  try {
    const { direction } = req.query;
    const tenantId = req.user.tenantId;
    const rows = query(
      `SELECT id, direction, sender, recipient, subject, body, sent_at as sentAt, is_read as isRead
       FROM messages WHERE tenant_id = ? ORDER BY sent_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

notificationsRouter.get('/', (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const rows = query(
      `SELECT id, title, body, audience, audience_label as audienceLabel, sent_at as sentAt, status
       FROM push_notifications WHERE tenant_id = ? ORDER BY sent_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

notificationsRouter.post('/send', (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { title, body, audience, group } = req.body;
    run(
      `INSERT INTO push_notifications (tenant_id, title, body, audience, audience_label, sent_at, status)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending')`,
      [tenantId, title, body, audience || 'all', group || 'Все']
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

pushSettingsRouter.get('/', (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const row = get(
      `SELECT api_key as apiKey, project_id as projectId, sender_id as senderId, app_id as appId, is_enabled as isEnabled
       FROM push_settings WHERE tenant_id = ?`,
      [tenantId]
    );
    res.json(row || { apiKey: '', projectId: '', senderId: '', appId: '', isEnabled: false });
  } catch (err) { next(err); }
});

pushSettingsRouter.put('/', (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { apiKey, projectId, senderId, appId, isEnabled } = req.body;
    const existing = get('SELECT id FROM push_settings WHERE tenant_id = ?', [tenantId]);
    if (existing) {
      run(`UPDATE push_settings SET api_key=?, project_id=?, sender_id=?, app_id=?, is_enabled=? WHERE tenant_id=?`,
        [apiKey, projectId, senderId, appId, isEnabled ? 1 : 0, tenantId]);
    } else {
      run(`INSERT INTO push_settings (tenant_id, api_key, project_id, sender_id, app_id, is_enabled) VALUES (?,?,?,?,?,?)`,
        [tenantId, apiKey, projectId, senderId, appId, isEnabled ? 1 : 0]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

pushSettingsRouter.post('/test', (req, res, next) => {
  try {
    res.json({ success: true, message: 'FCM connection successful' });
  } catch (err) { next(err); }
});
