import { Router } from 'express';
import { query, get, run } from '../db.js';

export const searchRouter = Router();

searchRouter.get('/', (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ tenants: [], users: [], orders: [] });

    const searchTerm = `%${q}%`;

    const tenants = query(
      "SELECT id, name, inn, email, status FROM tenants WHERE name LIKE ? OR inn LIKE ? OR email LIKE ? LIMIT 20",
      [searchTerm, searchTerm, searchTerm]
    );

    const users = query(
      "SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, t.name as tenant_name FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email LIKE ? OR u.full_name LIKE ? LIMIT 20",
      [searchTerm, searchTerm]
    );

    res.json({ tenants, users });
  } catch (err) { next(err); }
});

searchRouter.get('/staff', (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const searchTerm = `%${q}%`;
    const rows = query(
      "SELECT s.id, s.tenant_id, s.username, s.role, s.first_name, s.last_name, s.is_active, s.created_at, t.name as tenant_name FROM staff_accounts s LEFT JOIN tenants t ON t.id = s.tenant_id WHERE s.username LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? LIMIT 20",
      [searchTerm, searchTerm, searchTerm]
    );
    res.json(rows);
  } catch (err) { next(err); }
});
