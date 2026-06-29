const https = require('https');
const http = require('http');
const { URL } = require('url');

function generateSecret() {
  return 'hook_' + Math.random().toString(36).substring(2, 18);
}

function installBuiltinExtension(db, tenantId, ext) {
  const existing = db.prepare('SELECT id FROM extensions WHERE name = ? AND tenant_id = ?').get(ext.name, tenantId);
  if (existing) return existing.id;
  const info = db.prepare(`
    INSERT INTO extensions (name, description, version, developer, icon, url, type, is_active, tenant_id, hook_secret, installed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))
  `).run(ext.name, ext.description || '', ext.version || '1.0.0', ext.developer || '', ext.icon || '', ext.url || '', ext.type || 'integration', tenantId, generateSecret());
  return info.lastInsertRowid;
}

function getActiveExtensions(db, tenantId) {
  return db.prepare('SELECT * FROM extensions WHERE tenant_id = ? AND is_active = 1').all(tenantId);
}

function getExtensionHooks(db, extensionId) {
  return db.prepare('SELECT * FROM extension_hooks WHERE extension_id = ?').all(extensionId);
}

function logWebhook(db, hookId, extensionId, tenantId, event, endpoint, status, response) {
  try {
    db.prepare(`
      INSERT INTO extension_webhook_logs (hook_id, extension_id, tenant_id, event, endpoint, status, response, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(hookId, extensionId, tenantId, event, endpoint, status, response ? String(response).substring(0, 1000) : '');
  } catch (e) { console.error('[Extensions] logWebhook error:', e.message); }
}

function sendWebhook(endpoint, payload, secret) {
  return new Promise((resolve) => {
    try {
      const url = new URL(endpoint);
      const body = JSON.stringify(payload);
      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'X-Hook-Secret': secret,
          'X-Event': payload.event,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 5000,
      };
      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data.substring(0, 500) }));
      });
      req.on('error', (err) => resolve({ status: 0, body: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
      req.write(body);
      req.end();
    } catch (e) {
      resolve({ status: 0, body: e.message });
    }
  });
}

async function dispatchEvent(db, tenantId, event, data) {
  const extensions = getActiveExtensions(db, tenantId);
  for (const ext of extensions) {
    const hooks = getExtensionHooks(db, ext.id).filter(h => h.event === event || h.event === '*');
    for (const hook of hooks) {
      const payload = { event, data, tenantId, extension: ext.name, timestamp: new Date().toISOString() };
      const result = await sendWebhook(hook.endpoint, payload, ext.hook_secret);
      logWebhook(db, hook.id, ext.id, tenantId, event, hook.endpoint, result.status, result.body);
    }
  }
}

function getWebhookLogs(db, tenantId, limit = 50) {
  return db.prepare('SELECT * FROM extension_webhook_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit);
}

module.exports = { installBuiltinExtension, getActiveExtensions, getExtensionHooks, dispatchEvent, getWebhookLogs, generateSecret };
