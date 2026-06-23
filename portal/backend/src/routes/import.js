import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

export const importRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function applyMapping(row, mapping) {
  const result = {};
  for (const [col, field] of Object.entries(mapping)) {
    if (row[col] !== undefined) result[field] = row[col];
  }
  return result;
}

function parseNum(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return val;
  return parseFloat(String(val).replace(',', '.').replace(/\s/g, ''));
}

function parseBool(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  return s === 'да' || s === 'yes' || s === '1' || s === 'true' || s === '+';
}

importRouter.post('/menu', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const columnMapping = JSON.parse(req.body.column_mapping || '{}');
    const settings = JSON.parse(req.body.settings || '{}');
    const tenant_id = parseInt(req.body.tenant_id || req.user?.tenantId, 10);
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const items = rows.map(row => {
      const mapped = applyMapping(row, columnMapping);
      return {
        name: mapped.name ? String(mapped.name).trim() : undefined,
        category: mapped.category ? String(mapped.category).trim() : undefined,
        price: parseNum(mapped.price),
        cost: parseNum(mapped.cost),
        description: mapped.description ? String(mapped.description).trim() : undefined,
        unit: mapped.unit ? String(mapped.unit).trim() : undefined,
        gross_weight: parseNum(mapped.gross_weight),
        net_weight: parseNum(mapped.net_weight),
        kcal: parseNum(mapped.kcal),
        proteins: parseNum(mapped.proteins),
        fats: parseNum(mapped.fats),
        carbs: parseNum(mapped.carbs),
        energy_display: mapped.energy_display ? String(mapped.energy_display).trim() : undefined,
        is_active: parseBool(mapped.is_active),
        tags: mapped.tags ? String(mapped.tags).split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };
    });

    const errors = [];
    items.forEach((item, i) => {
      if (!item.name) errors.push({ row: i, error: 'Name is required' });
      if (item.price === undefined || item.price === null) errors.push({ row: i, error: 'Price is required' });
    });
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const response = await fetch(`${config.mainServerUrl}/api/internal/import-menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.portalSyncKey, tenant_id, items, settings }),
    });

    const result = await response.json();
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

importRouter.post('/tech-cards', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const columnMapping = JSON.parse(req.body.column_mapping || '{}');
    const settings = JSON.parse(req.body.settings || '{}');
    const tenant_id = parseInt(req.body.tenant_id || req.user?.tenantId, 10);
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'No data rows found' });

    const items = rows.map(row => {
      const mapped = applyMapping(row, columnMapping);
      return {
        dish_name: mapped.dish_name ? String(mapped.dish_name).trim() : undefined,
        valid_from: mapped.valid_from ? String(mapped.valid_from).trim() : undefined,
        portions: parseNum(mapped.portions),
        technology: mapped.technology ? String(mapped.technology).trim() : undefined,
        fixed_costs: parseNum(mapped.fixed_costs),
        package_weight: parseNum(mapped.package_weight),
        name: mapped.name ? String(mapped.name).trim() : undefined,
        quantity: parseNum(mapped.quantity),
        unit: mapped.unit ? String(mapped.unit).trim() : undefined,
        netto: parseNum(mapped.netto),
        yield: parseNum(mapped.yield),
      };
    });

    const errors = [];
    items.forEach((item, i) => {
      if (!item.dish_name) errors.push({ row: i, error: 'dish_name is required' });
    });
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const response = await fetch(`${config.mainServerUrl}/api/internal/import-tech-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.portalSyncKey, tenant_id, items, settings }),
    });

    const result = await response.json();
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
