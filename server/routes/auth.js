const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');

module.exports = function(app, db, config) {
  const { JWT_SECRET, safeError, toCamelCase, getRoleLimit } = config;

  function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return '+7' + digits;
    if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
    return phone;
  }

  app.post('/api/auth/phone-login', (req, res) => {
    try {
      let { phone, name } = req.body;
      if (!phone) return res.status(400).json({ error: 'Номер телефона обязателен' });

      phone = normalizePhone(phone);
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({ error: 'Неверный формат номера' });
      }

      let user = db.prepare('SELECT * FROM users WHERE phone = ? ORDER BY id DESC LIMIT 1').get(phone);

      if (!user) {
        const randomName = name || 'Гость ' + digits.slice(-4);
        const randomPwd = crypto.randomBytes(16).toString('hex');
        const hashedPwd = bcrypt.hashSync(randomPwd, 10);

        const info = db.prepare('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)').run(randomName, phone, hashedPwd, 'guest');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, tenant_id: user.tenant_id || null },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({ token, user: toCamelCase(user) });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  function logAuth(userId, tenantId, action, req) {
    try {
      db.prepare('INSERT INTO auth_logs (user_id, tenant_id, action, ip, user_agent) VALUES (?, ?, ?, ?, ?)').run(
        userId, tenantId, action, req.ip, req.headers['user-agent'] || ''
      );
    } catch {}
  }

  app.post('/api/auth/login', (req, res) => {
    try {
      const { tenantName, login, password, phone, role } = req.body;

      if (tenantName && login && password) {
        const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE LOWER(nickname) = LOWER(?) OR LOWER(name) = LOWER(?)').get(tenantName.trim(), tenantName.trim());
        if (!tenant) {
          logAuth(null, null, 'LOGIN_FAIL:tenant_not_found:' + tenantName, req);
          return res.status(401).json({ error: 'Ресторан не найден. Проверьте название' });
        }

        // BRANCH A: Check superadmin in users table
        let superadmin;
        try {
          superadmin = db.prepare("SELECT * FROM users WHERE login = ? AND role = 'superadmin'").get(login);
        } catch { superadmin = null; }
        if (superadmin) {
          const storedHash = superadmin.password;
          let valid = false;
          if (storedHash && storedHash.startsWith('$2')) {
            valid = bcrypt.compareSync(password, storedHash);
          } else {
            valid = storedHash === password;
          }
          if (!valid) {
            logAuth(superadmin.id, tenant.id, 'LOGIN_FAIL:wrong_password', req);
            return res.status(401).json({ error: 'Неверный логин или пароль' });
          }
          const token = jwt.sign(
            { id: superadmin.id, login: superadmin.login, role: 'superadmin', tenant_id: tenant.id },
            JWT_SECRET, { expiresIn: '24h' }
          );
          logAuth(superadmin.id, tenant.id, 'LOGIN_OK:superadmin', req);
          return res.json({ token, user: { ...toCamelCase(superadmin), role: 'superadmin', tenantName: tenant.nickname || tenant.name, tenantId: tenant.id } });
        }

        // BRANCH B: Staff login
        const staff = db.prepare("SELECT * FROM staff WHERE username = ? AND (tenant_id = ? OR tenant_id IS NULL) AND is_active = 1").get(login, tenant.id);
        if (!staff) {
          logAuth(null, tenant.id, 'LOGIN_FAIL:staff_not_found:' + login, req);
          return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const storedHash = staff.password;
        let valid = false;
        if (storedHash && storedHash.startsWith('$2')) {
          valid = bcrypt.compareSync(password, storedHash);
        } else {
          valid = storedHash === password;
        }
        if (!valid) {
          logAuth(staff.id, tenant.id, 'LOGIN_FAIL:wrong_password', req);
          return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

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
        logAuth(staff.id, tenant.id, 'LOGIN_OK:staff', req);
        return res.json({ token, user: { ...staffData, tenantName: tenant.nickname || tenant.name } });
      }

      if (phone) {
        const guestRole = role || 'guest';
        let user;
        if (guestRole === 'courier') {
          user = db.prepare('SELECT * FROM couriers WHERE phone = ?').get(phone);
          if (!user) return res.status(401).json({ error: 'Курьер не найден' });
          return res.json({ user: toCamelCase(user) });
        }
        user = db.prepare('SELECT * FROM users WHERE phone = ? ORDER BY id DESC LIMIT 1').get(phone);
        if (!user) {
          const normalized = phone.startsWith('+') ? phone : '+7' + phone.replace(/\D/g, '').slice(-10);
          const randomPwd = crypto.randomBytes(16).toString('hex');
          const hashedPwd = bcrypt.hashSync(randomPwd, 10);
          const info = db.prepare('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)').run('Гость', normalized, hashedPwd, guestRole);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
        }
        const token = jwt.sign(
          { id: user.id, phone: user.phone, role: user.role, tenant_id: user.tenant_id || null },
          JWT_SECRET, { expiresIn: '30d' }
        );
        logAuth(user.id, user.tenant_id, 'LOGIN_OK:guest', req);
        return res.json({ token, user: toCamelCase(user) });
      }

      return res.status(400).json({ error: 'Укажите tenantName+login+password для сотрудника или phone для гостя' });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── Superadmin: switch tenant ───────────────────────────────
  app.post('/api/auth/switch-tenant', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Только для суперадмина' });

      const { tenantId } = req.body;
      if (!tenantId) return res.status(400).json({ error: 'tenantId обязателен' });

      const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Ресторан не найден' });

      const newToken = jwt.sign(
        { id: decoded.id, login: decoded.login, role: 'superadmin', tenant_id: tenant.id },
        JWT_SECRET, { expiresIn: '24h' }
      );
      logAuth(decoded.id, tenant.id, 'SWITCH_TENANT:' + tenant.name, req);
      res.json({ token: newToken, tenant: toCamelCase(tenant) });
    } catch (e) {
      if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── Superadmin: list all tenants ────────────────────────────
  app.get('/api/tenants', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Только для суперадмина' });

      const tenants = db.prepare("SELECT id, name, nickname, address, is_active, photo_url FROM foodchain_portal_tenants ORDER BY name").all();
      res.json(tenants.map(t => toCamelCase(t)));
    } catch (e) {
      if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, phone, password, role, tenant_id } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
    try {
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

  app.get('/api/auth/me', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      let user;
      if (decoded.role === 'superadmin') {
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (user) {
          const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE id = ?').get(decoded.tenant_id);
          return res.json({ user: { ...toCamelCase(user), role: 'superadmin', tenantName: tenant?.nickname || tenant?.name || '', tenantId: decoded.tenant_id } });
        }
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ user: toCamelCase(user) });
    } catch (e) {
      res.status(401).json({ error: 'Недействительный токен' });
    }
  });

  app.put('/api/auth/profile', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const { name, email, birthday } = req.body;
      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (email !== undefined) { updates.push('email = ?'); values.push(email); }
      if (birthday !== undefined) { updates.push('birthday = ?'); values.push(birthday); }
      if (updates.length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });
      values.push(decoded.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      res.json({ user: toCamelCase(user) });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });
};
