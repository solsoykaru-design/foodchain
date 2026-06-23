import { Router } from 'express';
import { query, get } from '../db.js';

function parseTariff(row) {
  if (!row) return null;
  if (typeof row.features === 'string') row.features = JSON.parse(row.features);
  return row;
}

export const tariffsRouter = Router();

tariffsRouter.get('/', async (req, res, next) => {
  try {
    const rows = query('SELECT * FROM tariffs WHERE is_active = 1 ORDER BY sort_order');
    res.json(rows.map(parseTariff));
  } catch (err) {
    next(err);
  }
});

tariffsRouter.get('/:id', async (req, res, next) => {
  try {
    const row = get('SELECT * FROM tariffs WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Тариф не найден' });
    res.json(parseTariff(row));
  } catch (err) {
    next(err);
  }
});
