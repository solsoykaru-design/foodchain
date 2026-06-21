const https = require('https');

const CRM_PROVIDERS = {
  amocrm: {
    name: 'amoCRM',
    tokenUrl: (domain) => `https://${domain}.amocrm.ru/oauth2/access_token`,
    leadUrl: (domain) => `https://${domain}.amocrm.ru/api/v4/leads`,
    contactUrl: (domain) => `https://${domain}.amocrm.ru/api/v4/contacts`,
  },
  bitrix24: {
    name: 'Bitrix24',
    webhookUrl: (domain, hook) => `https://${domain}.bitrix24.ru/rest/${hook}`,
  },
};

function saveSettings(db, provider, settings, tenantId = 1) {
  const existing = db.prepare('SELECT id FROM integration_settings WHERE type = ? AND tenant_id = ?').get(`crm_${provider}`, tenantId);
  const data = JSON.stringify(settings);
  if (existing) {
    db.prepare('UPDATE integration_settings SET value = ? WHERE type = ? AND tenant_id = ?').run(data, `crm_${provider}`, tenantId);
  } else {
    db.prepare('INSERT INTO integration_settings (type, value, tenant_id) VALUES (?, ?, ?)').run(`crm_${provider}`, data, tenantId);
  }
  return { success: true };
}

function getSettings(db, provider, tenantId = 1) {
  const row = db.prepare('SELECT value FROM integration_settings WHERE type = ? AND tenant_id = ?').get(`crm_${provider}`, tenantId);
  if (!row) return {};
  try { return JSON.parse(row.value); } catch { return {}; }
}

async function testConnection(provider, settings) {
  try {
    if (provider === 'amocrm') {
      return await testAmoCrm(settings);
    } else if (provider === 'bitrix24') {
      return await testBitrix24(settings);
    }
    return { success: false, error: 'Unknown provider' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function exportClients(db, provider, tenantId = 1) {
  const settings = getSettings(db, provider, tenantId);
  if (!settings.enabled) return { success: false, error: 'CRM not connected' };
  const clients = db.prepare('SELECT id, name, phone, email, birthday, total_orders, total_spent, created_at FROM users WHERE tenant_id = ? ORDER BY id').all(tenantId);
  const staff = db.prepare('SELECT id, name, role, phone, email FROM staff WHERE tenant_id = ? ORDER BY id').all(tenantId);
  try {
    if (provider === 'amocrm') return await exportToAmoCrm(settings, clients, staff);
    if (provider === 'bitrix24') return await exportToBitrix24(settings, clients, staff);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── amoCRM helpers ────────────────────────────────────────────
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...options.headers }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function getAmoToken(settings) {
  if (!settings.client_id || !settings.client_secret || !settings.domain || !settings.redirect_uri) throw new Error('amoCRM not configured');
  const cfg = CRM_PROVIDERS.amocrm;
  const tokenRes = await fetchJson(cfg.tokenUrl(settings.domain), {
    method: 'POST',
    body: {
      client_id: settings.client_id,
      client_secret: settings.client_secret,
      grant_type: 'authorization_code',
      code: settings.code,
      redirect_uri: settings.redirect_uri,
    },
  });
  if (tokenRes.access_token) {
    settings.access_token = tokenRes.access_token;
    settings.refresh_token = tokenRes.refresh_token;
    settings.expires_at = Date.now() + tokenRes.expires_in * 1000;
    return tokenRes.access_token;
  }
  if (tokenRes.error) throw new Error(`amoCRM auth error: ${tokenRes.error} ${tokenRes.error_description || ''}`);
  throw new Error('Failed to get amoCRM token');
}

async function testAmoCrm(settings) {
  let token = settings.access_token;
  if (!token || (settings.expires_at && Date.now() > settings.expires_at)) {
    token = await getAmoToken(settings);
  }
  const res = await fetchJson(`${CRM_PROVIDERS.amocrm.leadUrl(settings.domain)}?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res._embedded ? { success: true } : { success: false, error: 'API response invalid' };
}

async function exportToAmoCrm(settings, clients) {
  let token = settings.access_token;
  if (!token || (settings.expires_at && Date.now() > settings.expires_at)) {
    token = await getAmoToken(settings);
  }
  const contacts = clients.filter(c => c.phone).map(c => ({
    name: c.name || 'Guest',
    custom_fields_values: [
      { field_code: 'PHONE', values: [{ value: c.phone }] },
      ...(c.email ? [{ field_code: 'EMAIL', values: [{ value: c.email }] }] : []),
    ],
  }));
  if (contacts.length === 0) return { success: true, exported: 0 };
  const res = await fetchJson(CRM_PROVIDERS.amocrm.contactUrl(settings.domain), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: contacts.slice(0, 50),
  });
  return { success: true, exported: Math.min(contacts.length, 50) };
}

// ─── Bitrix24 helpers ─────────────────────────────────────────
async function testBitrix24(settings) {
  if (!settings.domain || !settings.webhook) throw new Error('Bitrix24 not configured');
  const res = await fetchJson(`${CRM_PROVIDERS.bitrix24.webhookUrl(settings.domain, settings.webhook)}/crm.contact.list?limit=1`);
  return !res.error ? { success: true } : { success: false, error: res.error_description || res.error };
}

async function exportToBitrix24(settings, clients) {
  const webhook = CRM_PROVIDERS.bitrix24.webhookUrl(settings.domain, settings.webhook);
  let count = 0;
  for (const c of clients.slice(0, 50)) {
    if (!c.phone) continue;
    const res = await fetchJson(webhook + '/crm.contact.add', {
      method: 'POST',
      body: {
        fields: {
          NAME: c.name || 'Guest',
          PHONE: [{ VALUE: c.phone, VALUE_TYPE: 'WORK' }],
          ...(c.email ? { EMAIL: [{ VALUE: c.email, VALUE_TYPE: 'WORK' }] } : {}),
        },
      },
    });
    if (!res.error) count++;
  }
  return { success: true, exported: count };
}

module.exports = { saveSettings, getSettings, testConnection, exportClients };
