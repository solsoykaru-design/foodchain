import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate } from '../middleware/auth.js';

export const brandingRouter = Router();

brandingRouter.use(authenticate);

brandingRouter.get('/platform', (req, res, next) => {
  try {
    const settings = get('SELECT * FROM branding_settings WHERE tenant_id IS NULL');
    res.json(settings || { platform_name: 'FoodChain', primary_color: '#f97316', secondary_color: '#ef4444' });
  } catch (err) { next(err); }
});

brandingRouter.put('/platform', (req, res, next) => {
  try {
    const { platform_name, primary_color, secondary_color, logo_url } = req.body;
    run("UPDATE branding_settings SET platform_name = COALESCE(?, platform_name), primary_color = COALESCE(?, primary_color), secondary_color = COALESCE(?, secondary_color), logo_url = COALESCE(?, logo_url), updated_at = datetime('now') WHERE tenant_id IS NULL",
      [platform_name || null, primary_color || null, secondary_color || null, logo_url || null]);
    res.json(get('SELECT * FROM branding_settings WHERE tenant_id IS NULL'));
  } catch (err) { next(err); }
});

brandingRouter.get('/tenant/:tenantId', (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.tenantId !== parseInt(req.params.tenantId)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    let settings = get('SELECT * FROM branding_settings WHERE tenant_id = ?', [req.params.tenantId]);
    if (!settings) {
      run('INSERT INTO branding_settings (tenant_id) VALUES (?)', [req.params.tenantId]);
      settings = get('SELECT * FROM branding_settings WHERE tenant_id = ?', [req.params.tenantId]);
    }
    res.json(settings);
  } catch (err) { next(err); }
});

brandingRouter.put('/tenant/:tenantId', (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.tenantId !== parseInt(req.params.tenantId)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const { logo_url, primary_color, secondary_color, allow_customization } = req.body;
    run("UPDATE branding_settings SET logo_url = COALESCE(?, logo_url), primary_color = COALESCE(?, primary_color), secondary_color = COALESCE(?, secondary_color), allow_customization = COALESCE(?, allow_customization), updated_at = datetime('now') WHERE tenant_id = ?",
      [logo_url || null, primary_color || null, secondary_color || null, allow_customization !== undefined ? (allow_customization ? 1 : 0) : null, req.params.tenantId]);
    res.json(get('SELECT * FROM branding_settings WHERE tenant_id = ?', [req.params.tenantId]));
  } catch (err) { next(err); }
});
