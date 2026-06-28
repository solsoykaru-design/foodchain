import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    req.user = payload;

    const rows = query('SELECT role FROM users WHERE id = ? AND is_active = 1', [payload.userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк', code: 'token_expired' });
    }
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

export function requireTenantAccess(req, res, next) {
  const tenantId = parseInt(req.params.tenantId, 10);
  if (!tenantId) {
    return res.status(400).json({ error: 'Не указан tenant_id' });
  }
  if (req.user.role !== 'superadmin' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Нет доступа к этому ресторану' });
  }
  req.tenantId = tenantId;
  next();
}
