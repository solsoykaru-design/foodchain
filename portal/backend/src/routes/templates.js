import { Router } from 'express';
import { query, get, run } from '../db.js';

export const templatesRouter = Router();

templatesRouter.get('/', (req, res, next) => {
  try {
    const rows = query('SELECT * FROM templates WHERE is_active = 1 ORDER BY name');
    res.json(rows.map(t => ({
      ...t,
      categories: JSON.parse(t.categories),
      menu_items: JSON.parse(t.menu_items),
      roles: JSON.parse(t.roles),
      delivery_config: JSON.parse(t.delivery_config),
    })));
  } catch (err) { next(err); }
});

templatesRouter.post('/', (req, res, next) => {
  try {
    const { name, code, description, categories, menu_items, roles, delivery_config } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name и code обязательны' });
    const r = run(
      'INSERT INTO templates (name, code, description, categories, menu_items, roles, delivery_config) VALUES (?,?,?,?,?,?,?)',
      [name, code, description || null,
       JSON.stringify(categories || []), JSON.stringify(menu_items || []),
       JSON.stringify(roles || []), JSON.stringify(delivery_config || {})]
    );
    res.status(201).json(get('SELECT * FROM templates WHERE id = ?', [r.lastInsertRowid]));
  } catch (err) { next(err); }
});

templatesRouter.put('/:id', (req, res, next) => {
  try {
    const fields = [];
    const params = [];
    for (const key of ['name', 'code', 'description', 'is_active']) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key]); }
    }
    for (const key of ['categories', 'menu_items', 'roles']) {
      if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(JSON.stringify(req.body[key])); }
    }
    if (req.body.delivery_config) { fields.push('delivery_config = ?'); params.push(JSON.stringify(req.body.delivery_config)); }
    if (fields.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    run(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json(get('SELECT * FROM templates WHERE id = ?', [req.params.id]));
  } catch (err) { next(err); }
});

templatesRouter.delete('/:id', (req, res, next) => {
  try {
    run('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Шаблон удалён' });
  } catch (err) { next(err); }
});
