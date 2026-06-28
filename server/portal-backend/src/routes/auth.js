import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, get, run, transaction } from '../db.js';
import { config } from '../config.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
  full_name: z.string().min(2, 'Имя минимум 2 символа'),
  restaurant_name: z.string().min(2, 'Название ресторана минимум 2 символа'),
  inn: z.string().regex(/^\d{10}$|^\d{12}$/, 'ИНН должен быть 10 или 12 цифр'),
  phone: z.string().min(10, 'Телефон минимум 10 символов'),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(userId, role, tenantId) {
  const accessToken = jwt.sign(
    { userId, role, tenantId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  const refreshToken = jwt.sign(
    { userId, role, tenantId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  return { accessToken, refreshToken };
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = query('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email уже зарегистрирован' });
    }

    const passwordHash = bcrypt.hashSync(data.password, config.bcryptRounds);
    const tenantUuid = uuidv4();

    const result = transaction(() => {
      const tariff = query("SELECT id FROM tariffs WHERE code = 'basic' AND is_active = 1 LIMIT 1");
      const tariffId = tariff.length > 0 ? tariff[0].id : 1;

      const tenantResult = run(
        `INSERT INTO tenants (uuid, name, inn, phone, address, email, tariff_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [tenantUuid, data.restaurant_name, data.inn, data.phone, data.address || null, data.email, tariffId]
      );
      const tenantId = tenantResult.lastInsertRowid;

      const userResult = run(
        `INSERT INTO users (email, password_hash, full_name, role, tenant_id, email_verified)
         VALUES (?, ?, ?, 'partner', ?, 0)`,
        [data.email, passwordHash, data.full_name, tenantId]
      );
      const userId = userResult.lastInsertRowid;

      return { tenantId, userId };
    })();

    const { accessToken, refreshToken } = generateTokens(result.userId, 'partner', result.tenantId);

    run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [result.userId, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'tenant.registered', ?)`,
      [result.tenantId, result.userId, JSON.stringify({ email: data.email, name: data.restaurant_name })]
    );

    res.status(201).json({
      message: 'Регистрация успешна.',
      accessToken,
      refreshToken,
      user: { id: result.userId, email: data.email, role: 'partner', tenant_id: result.tenantId },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = get(
      `SELECT u.id, u.email, u.password_hash, u.role, u.tenant_id, u.is_active,
              t.status as tenant_status
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = ?`,
      [data.email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Учётная запись заблокирована' });
    }

    if (user.tenant_status === 'suspended') {
      return res.status(403).json({ error: 'Подписка приостановлена' });
    }

    const valid = bcrypt.compareSync(data.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.tenant_id);

    run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    run(
      `INSERT INTO audit_logs (tenant_id, user_id, action, details)
       VALUES (?, ?, 'auth.login', ?)`,
      [user.tenant_id, user.id, JSON.stringify({ ip: req.ip })]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Требуется refresh-токен' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      return res.status(401).json({ error: 'Недействительный refresh-токен' });
    }

    const tokenRow = get(
      'SELECT id FROM refresh_tokens WHERE token = ? AND expires_at > datetime(\'now\')',
      [refreshToken]
    );
    if (!tokenRow) {
      return res.status(401).json({ error: 'Refresh-токен не найден или истёк' });
    }

    run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const tokens = generateTokens(payload.userId, payload.role, payload.tenantId);

    run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [payload.userId, tokens.refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    res.json({ message: 'Выход выполнен' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Требуется авторизация' });

    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret);

    const user = get(
      `SELECT u.id, u.email, u.full_name, u.role, u.tenant_id,
              t.name as tenant_name, t.status as tenant_status, t.subscription_end,
              tar.name as tariff_name, tar.code as tariff_code
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN tariffs tar ON tar.id = t.tariff_id
       WHERE u.id = ?`,
      [payload.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});
