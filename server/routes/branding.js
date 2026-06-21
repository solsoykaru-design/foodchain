const path = require('path');
const jwt = require('jsonwebtoken');

module.exports = function(app, db, config) {
  const { JWT_SECRET, safeError, uploadBranding, uploadSiteImage, authenticateBrandingUpload } = config;

app.get('/api/branding', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const row = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({ branding: parseBranding(row?.branding) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/branding', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const branding = req.body.branding;
    if (!branding || typeof branding !== 'object') return res.status(400).json({ error: 'branding object required' });
    const merged = parseBranding(branding);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET branding = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, branding) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ branding: merged, message: 'Настройки брендирования сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/branding/reset', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const defaults = JSON.parse(DEFAULT_BRANDING);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET branding = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, branding) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ branding: defaults, message: 'Настройки брендирования сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/branding/public/:tenantId', (req, res) => {
  try {
    const row = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    res.json({ branding: parseBranding(row?.branding) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/branding/upload', authenticateBrandingUpload, uploadBranding.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname);
    const newName = `${req.tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    req.file.filename = newName;
    req.file.path = newPath;
    const url = `/uploads/branding/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/site-settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const row = db.prepare('SELECT site_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({ settings: parseSiteSettings(row?.site_settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/site-settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const settings = req.body.settings;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const merged = parseSiteSettings(settings);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET site_settings = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, site_settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: merged, message: 'Настройки сайта сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/site-settings/reset', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const defaults = JSON.parse(DEFAULT_SITE_SETTINGS);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET site_settings = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, site_settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: defaults, message: 'Настройки сайта сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/site-settings/upload', uploadSiteImage.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let tenantId = 'unknown';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        tenantId = payload.tenantId || payload.tenant_id || 'unknown';
      } catch {}
    }
    const ext = path.extname(req.file.originalname);
    const newName = `${tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    const url = `/uploads/site/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/site-settings/public/:tenantId', (req, res) => {
  try {
    const row = db.prepare('SELECT site_settings FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    res.json({ settings: parseSiteSettings(row?.site_settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};