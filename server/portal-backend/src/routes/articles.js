import { Router } from 'express';
import { query, get, run } from '../db.js';

export const articlesRouter = Router();

articlesRouter.get('/', (req, res, next) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT id, title, slug, category, sort_order, created_at, updated_at FROM articles WHERE is_published = 1';
    const params = [];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; const p = `%${search}%`; params.push(p, p); }
    sql += ' ORDER BY sort_order, created_at DESC';
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

articlesRouter.get('/:slug', (req, res, next) => {
  try {
    const article = get('SELECT * FROM articles WHERE slug = ? AND is_published = 1', [req.params.slug]);
    if (!article) return res.status(404).json({ error: 'Статья не найдена' });
    res.json(article);
  } catch (err) { next(err); }
});
