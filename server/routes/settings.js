const path = require('path');
const bcrypt = require('bcrypt');

module.exports = function(app, db, config) {
  const { safeError } = config;

app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM system_settings').all();
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/settings', (req, res) => {
  try {
    const body = req.body;
    const upsert = db.prepare('INSERT INTO system_settings (key, value, type) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [key, value] of Object.entries(body)) {
      const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text';
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      upsert.run(key, strVal, type);
    }
    const rows = db.prepare('SELECT * FROM system_settings').all();
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/settings/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, '..', `foodchain-backup-${timestamp}.db`);
    db.backup(backupPath);
    res.json({ ok: true, path: backupPath });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/settings/change-password', (req, res) => {
  try {
    const { oldPassword, newPassword, username } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Старый и новый пароль обязательны' });

    // Hardcoded superadmin password change
    if (!username || username === 'admin') {
      if (oldPassword !== 'admin') return res.status(403).json({ error: 'Неверный старый пароль' });
      const admin = db.prepare("SELECT * FROM users WHERE role = 'superadmin' LIMIT 1").get();
      if (admin) {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, admin.id);
      }
      return res.json({ ok: true });
    }

    // Staff password change (portal-synced accounts)
    const staff = db.prepare('SELECT * FROM staff WHERE username = ? AND is_active = 1').get(username);
    if (!staff) return res.status(404).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(oldPassword, storedHash);
    } else {
      valid = storedHash === oldPassword;
    }
    if (!valid) return res.status(403).json({ error: 'Неверный старый пароль' });

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE staff SET password = ? WHERE id = ?').run(newHash, staff.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/tenant-mode', (req, res) => {
  try {
    const tenantId = req.tenant_id;

    const pt = db.prepare('SELECT access_mode, demo_data_created_at, demo_auto_cleanup_days FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({
      access_mode: pt?.access_mode || 'production',
      is_demo: pt?.access_mode === 'demo',
      demo_data_created_at: pt?.demo_data_created_at || null,
      demo_auto_cleanup_days: pt?.demo_auto_cleanup_days || 30,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tenant-limits', (req, res) => {
  try {
    const tenantId = req.tenant_id;

    const pt = db.prepare('SELECT app_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    let settings = {};
    if (pt?.app_settings) { try { settings = JSON.parse(pt.app_settings); } catch {} }

    // Count current staff per role
    const staffRows = db.prepare('SELECT role, COUNT(*) as cnt FROM staff WHERE is_active = 1 AND tenant_id = ? GROUP BY role').all(tenantId);
    const staffCountByRole = {};
    for (const row of staffRows) staffCountByRole[row.role] = row.cnt;

    const STAFF_ROLES = ['admin', 'waiter', 'chef', 'kitchen', 'courier', 'manager', 'stock_manager'];
    const result = {};
    for (const role of STAFF_ROLES) {
      let limit = -1;
      const val = settings[role];
      if (typeof val === 'number') {
        limit = val;
      } else if (typeof val === 'object' && val !== null) {
        limit = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
      }
      result[role] = {
        limit,
        current: staffCountByRole[role] || 0,
      };
    }

    // Guest count (users table)
    const guestCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'").get(tenantId);
    let guestLimit = -1;
    const guestVal = settings.guest;
    if (typeof guestVal === 'number') {
      guestLimit = guestVal;
    } else if (typeof guestVal === 'object' && guestVal !== null) {
      guestLimit = guestVal.enabled === false ? 0 : (typeof guestVal.limit === 'number' ? guestVal.limit : -1);
    }
    result.guest = {
      limit: guestLimit,
      current: guestCount?.c || 0,
    };

    res.json({ tenant_id: tenantId, usage: result });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/push-settings', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    const row = db.prepare('SELECT * FROM push_settings WHERE tenant_id = ?').get(tenantId);
    res.json(row || { api_key: '', project_id: '', sender_id: '', app_id: '', is_enabled: false });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/push-settings', (req, res) => {
  try {
    const { tenant_id, api_key, project_id, sender_id, app_id, is_enabled } = req.body;
    const tid = tenant_id || 1;
    const existing = db.prepare('SELECT id FROM push_settings WHERE tenant_id = ?').get(tid);
    if (existing) {
      db.prepare('UPDATE push_settings SET api_key = ?, project_id = ?, sender_id = ?, app_id = ?, is_enabled = ? WHERE tenant_id = ?')
        .run(api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0, tid);
    } else {
      db.prepare('INSERT INTO push_settings (tenant_id, api_key, project_id, sender_id, app_id, is_enabled) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tid, api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/push-settings/test', (req, res) => {
  try {
    const tenantId = (req.body && req.body.tenant_id) || 1;
    const row = db.prepare('SELECT * FROM push_settings WHERE tenant_id = ?').get(tenantId);
    if (!row || !row.api_key) {
      return res.status(400).json({ error: 'Push-настройки не заданы. Укажите API-ключ.' });
    }
    res.json({ ok: true, message: 'Тестовое подключение выполнено (имитация).' });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
};