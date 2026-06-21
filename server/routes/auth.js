const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

module.exports = function(app, db, config) {
  const { JWT_SECRET, safeError, toCamelCase, getRoleLimit } = config;

app.post('/api/auth/login', (req, res) => {
  try {
    const { tenantName, login, password, phone, role } = req.body;

    // Staff login: tenantName + login + password
    if (tenantName && login && password) {
      const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE LOWER(nickname) = LOWER(?) OR LOWER(name) = LOWER(?)').get(tenantName.trim(), tenantName.trim());
      if (!tenant) return res.status(401).json({ error: 'Ресторан не найден. Проверьте название' });

      const staff = db.prepare("SELECT * FROM staff WHERE username = ? AND (tenant_id = ? OR tenant_id IS NULL) AND is_active = 1").get(login, tenant.id);
      if (!staff) return res.status(401).json({ error: 'Неверный логин или пароль' });

      const storedHash = staff.password;
      let valid = false;
      if (storedHash && storedHash.startsWith('$2')) {
        valid = bcrypt.compareSync(password, storedHash);
      } else {
        valid = storedHash === password;
      }
      if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });

      const staffData = toCamelCase(staff);
      const twoFactorRecord = db.prepare('SELECT * FROM user_2fa WHERE staff_id = ? AND enabled = 1').get(staff.id);
      if (twoFactorRecord) {
        const { twoFactorCode } = req.body;
        if (!twoFactorCode) {
          const tempToken = jwt.sign(
            { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id, pending2fa: true },
            JWT_SECRET, { expiresIn: '5m' }
          );
          return res.json({ token: tempToken, user: { ...staffData, tenantName: tenant.nickname || tenant.name }, require2fa: true });
        }
        const verified = speakeasy.totp.verify({ secret: twoFactorRecord.secret, encoding: 'base32', token: twoFactorCode });
        if (!verified) return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
      }

      const token = jwt.sign(
        { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id },
        JWT_SECRET, { expiresIn: '24h' }
      );
      return res.json({ token, user: { ...staffData, tenantName: tenant.nickname || tenant.name } });
    }

    // Guest login: phone + optional password
    if (phone) {
      const guestRole = role || 'guest';
      let user;
      if (guestRole === 'courier') {
        user = db.prepare('SELECT * FROM couriers WHERE phone = ?').get(phone);
      } else {
        user = db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(phone, guestRole);
      }
      if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
      if (password && user.password && user.password !== password) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      return res.json({ user: toCamelCase(user) });
    }

    return res.status(400).json({ error: 'Укажите tenantName+login+password для сотрудника или phone для гостя' });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, role, tenant_id } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
  try {
    // Check guest limit if tenant_id provided
    if (tenant_id && (role === 'guest' || !role)) {
      const guestLimit = getRoleLimit(db, tenant_id, 'guest');
      if (guestLimit !== null && guestLimit >= 0) {
        const current = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'").get(tenant_id)?.c || 0;
        if (current >= guestLimit) {
          return res.status(400).json({ error: `Достигнут лимит гостей (${current} из ${guestLimit}). Обратитесь к администратору.` });
        }
      }
    }

    const existing = db.prepare('SELECT id FROM couriers WHERE phone = ?').get(phone);
    if (existing) return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
    const table = role === 'courier' ? 'couriers' : 'users';
    const roleVal = role === 'courier' ? undefined : (role || 'guest');
    let info;
    const hashedPwd = password ? bcrypt.hashSync(password, 10) : null;
    if (role === 'courier') {
      info = db.prepare('INSERT INTO couriers (name, phone, password) VALUES (?, ?, ?)').run(name, phone, hashedPwd);
    } else {
      info = db.prepare('INSERT INTO users (name, phone, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)').run(name, phone, hashedPwd, roleVal, tenant_id || null);
    }
    const user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ user: toCamelCase(user) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/tenants/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const tenants = db.prepare(
      "SELECT id, name, nickname, address, lat, lng, photo_url, app_settings FROM foodchain_portal_tenants WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(nickname) LIKE ?) LIMIT 20"
    ).all(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    res.json(tenants.map(t => toCamelCase(t)));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/tenants/nearby', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const r = parseFloat(radius) || 20;
    if (!lat || !lng) return res.status(400).json({ error: 'lat и lng обязательны' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const tenants = db.prepare(
      "SELECT id, name, nickname, address, lat, lng, photo_url, app_settings FROM foodchain_portal_tenants WHERE is_active = 1 AND lat <> 0 AND lng <> 0"
    ).all();

    const earthRadius = 6371;
    const result = tenants.map(t => {
      const dlat = (t.lat - userLat) * Math.PI / 180;
      const dlng = (t.lng - userLng) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(t.lat * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
      const distance = earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...toCamelCase(t), distance: Math.round(distance * 100) / 100 };
    }).filter(t => t.distance <= r).sort((a, b) => a.distance - b.distance);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

  // Hardcoded superadmin (backward compat)
  if (username === 'admin' && password === 'admin') {
    const admins = db.prepare("SELECT * FROM users WHERE role = 'superadmin'").all();
    let admin = admins[0];
    if (!admin) {
      db.prepare("INSERT INTO users (name, phone, role) VALUES ('Admin', '+70000000000', 'superadmin')").run();
      admin = db.prepare("SELECT * FROM users WHERE role = 'superadmin'").get();
    }
    const token = jwt.sign({ id: admin.id, username: 'admin', role: 'superadmin', tenant_id: admin.tenant_id || null }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: toCamelCase(admin) });
  }

  // Staff login (portal-synced accounts)
  try {
    const staff = db.prepare("SELECT s.*, fpt.name as tenant_name FROM staff s LEFT JOIN foodchain_portal_tenants fpt ON fpt.id = s.tenant_id WHERE s.username = ? AND s.is_active = 1").get(username);
    if (!staff) return res.status(401).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }
    if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

    // Check 2FA
    const staffData = toCamelCase(staff);
    const twoFactorRecord = db.prepare('SELECT * FROM user_2fa WHERE staff_id = ? AND enabled = 1').get(staff.id);
    if (twoFactorRecord) {
      const { twoFactorCode } = req.body;
      if (!twoFactorCode) {
        const tempToken = jwt.sign({ id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null, pending2fa: true }, JWT_SECRET, { expiresIn: '5m' });
        return res.json({ token: tempToken, user: staffData, require2fa: true });
      }
      const verified = speakeasy.totp.verify({ secret: twoFactorRecord.secret, encoding: 'base32', token: twoFactorCode });
      if (!verified) {
        return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
      }
    }

    const token = jwt.sign({ id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: staffData });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/staff/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    const staff = db.prepare("SELECT * FROM staff WHERE username = ? AND is_active = 1").get(username);
    if (!staff) return res.status(401).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;

    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }

    if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

    const token = jwt.sign(
      { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: toCamelCase(staff) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/courier/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    const courier = db.prepare("SELECT * FROM staff WHERE username = ? AND role = 'courier' AND is_active = 1").get(username);
    if (!courier) return res.status(401).json({ error: 'Неверный логин или пароль. Обратитесь к администратору' });
    const storedHash = courier.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }
    if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль. Обратитесь к администратору' });
    res.json(toCamelCase(courier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/auth/2fa/setup', (req, res) => {
  try {
    const { staffId } = req.body;
    const secret = speakeasy.generateSecret({ name: 'FoodChain Admin' });
    const existing = db.prepare('SELECT id FROM user_2fa WHERE staff_id = ?').get(staffId);
    if (existing) {
      db.prepare('UPDATE user_2fa SET secret = ?, enabled = 0 WHERE staff_id = ?').run(secret.base32, staffId);
    } else {
      db.prepare('INSERT INTO user_2fa (staff_id, secret) VALUES (?, ?)').run(staffId, secret.base32);
    }
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) return res.status(500).json({ error: 'QR generation failed' });
      res.json({ secret: secret.base32, qrCode: dataUrl });
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/auth/2fa/verify', (req, res) => {
  try {
    const { staffId, token } = req.body;
    const record = db.prepare('SELECT secret FROM user_2fa WHERE staff_id = ?').get(staffId);
    if (!record) return res.status(400).json({ error: '2FA not set up' });
    const verified = speakeasy.totp.verify({ secret: record.secret, encoding: 'base32', token });
    if (verified) {
      db.prepare('UPDATE user_2fa SET enabled = 1 WHERE staff_id = ?').run(staffId);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Неверный код' });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/auth/2fa/status', (req, res) => {
  try {
    const { staffId } = req.query;
    const record = db.prepare('SELECT enabled FROM user_2fa WHERE staff_id = ?').get(staffId);
    res.json({ enabled: !!record?.enabled });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/auth/2fa/disable', (req, res) => {
  try {
    const { staffId } = req.body;
    db.prepare('DELETE FROM user_2fa WHERE staff_id = ?').run(staffId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};