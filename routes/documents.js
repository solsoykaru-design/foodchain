const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

let db;

function init(database) {
  db = database;
}

const DOCUMENT_TYPES = [
  'journal', 'receipt', 'writeoff', 'transfer', 'inventory',
  'production', 'return', 'shipment', 'breakdown', 'processing',
  'contactor_order', 'production_order', 'service',
];

const TYPE_LABELS = {
  journal: 'Журнал документов',
  receipt: 'Приходы',
  writeoff: 'Списания',
  transfer: 'Перемещения',
  inventory: 'Инвентаризация',
  production: 'Производства',
  return: 'Возвраты',
  shipment: 'Отгрузки',
  breakdown: 'Разборы',
  processing: 'Переработки',
  contactor_order: 'Заказы контрагентам',
  production_order: 'Заказы на производство',
  service: 'Услуги',
};

function nextNumber(db, type) {
  const today = new Date();
  const prefix = today.toISOString().slice(2, 10).replace(/-/g, '');
  const row = db.prepare("SELECT COUNT(*) as cnt FROM documents WHERE type = ? AND number LIKE ?").get(type, prefix + '%');
  const seq = String((row.cnt || 0) + 1).padStart(3, '0');
  return prefix + '-' + seq;
}

// GET /api/documents?type=...&search=...&filter_item=...&page=...&limit=...
router.get('/', (req, res) => {
  try {
    let { type, search, filter_item, page, limit, sort, order } = req.query;
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (type && type !== 'journal') {
      conditions.push('d.type = ?');
      params.push(type);
    }

    if (search) {
      conditions.push('(d.number LIKE ? OR d.counterparty LIKE ? OR d.note LIKE ? OR d.items LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    if (filter_item) {
      conditions.push('d.items LIKE ?');
      params.push(`%"name":"%${filter_item}%"%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents d ${where}`).get(...params);
    const total = countRow.total;

    const sortCol = sort && ['date', 'number', 'type', 'counterparty', 'sum', 'status'].includes(sort) ? sort : 'date';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const rows = db.prepare(
      `SELECT * FROM documents d ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents/types
router.get('/types', (req, res) => {
  res.json(DOCUMENT_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] })));
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (typeof doc.items === 'string') {
      try { doc.items = JSON.parse(doc.items); } catch (e) { doc.items = []; }
    }
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/documents
router.post('/', (req, res) => {
  try {
    const { type, counterparty, sum, items, note, status } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid document type' });

    const number = nextNumber(db, type);
    const itemsJson = JSON.stringify(items || []);
    const info = db.prepare(
      `INSERT INTO documents (type, number, date, counterparty, sum, status, items, note)
       VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, ?, ?, ?)`
    ).run(type, number, counterparty || '', parseFloat(sum) || 0, status || 'draft', itemsJson, note || '');

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/documents/:id
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const { type, counterparty, sum, items, note, status } = req.body;
    const updates = [];
    const params = [];

    if (type && DOCUMENT_TYPES.includes(type)) { updates.push('type = ?'); params.push(type); }
    if (counterparty !== undefined) { updates.push('counterparty = ?'); params.push(counterparty); }
    if (sum !== undefined) { updates.push('sum = ?'); params.push(parseFloat(sum)); }
    if (items !== undefined) { updates.push('items = ?'); params.push(JSON.stringify(items)); }
    if (note !== undefined) { updates.push('note = ?'); params.push(note); }
    if (status !== undefined) { updates.push('status = ?'); params.push([ 'draft', 'confirmed', 'completed', 'cancelled' ].includes(status) ? status : 'draft'); }
    updates.push("updated_at = datetime('now', '+3 hours')");

    if (updates.length > 1) {
      params.push(req.params.id);
      db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/documents/import
router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let imported = 0;
    let errors = [];

    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const typeIdx = header.indexOf('type');
      const counterpartyIdx = header.indexOf('counterparty');
      const sumIdx = header.indexOf('sum');
      const noteIdx = header.indexOf('note');

      if (typeIdx === -1) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'CSV must have a "type" column' });
      }

      for (let i = 1; i < lines.length; i++) {
        try {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const type = cols[typeIdx];
          if (!DOCUMENT_TYPES.includes(type)) continue;
          const number = nextNumber(db, type);
          db.prepare(
            `INSERT INTO documents (type, number, date, counterparty, sum, status, note)
             VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, 'draft', ?)`
          ).run(
            type, number,
            counterpartyIdx >= 0 ? cols[counterpartyIdx] : '',
            sumIdx >= 0 ? parseFloat(cols[sumIdx]) || 0 : 0,
            noteIdx >= 0 ? cols[noteIdx] : ''
          );
          imported++;
        } catch (e) {
          errors.push({ line: i + 1, error: e.message });
        }
      }
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Only .csv files are supported currently' });
    }

    try { fs.unlinkSync(filePath); } catch (e) {}

    res.json({ imported, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, init, TYPE_LABELS, DOCUMENT_TYPES };
