const https = require('https');
const url = require('url');

function getSettings(db, tenantId = 1) {
  const row = db.prepare('SELECT * FROM push_settings WHERE tenant_id = ?').get(tenantId);
  return row || { api_key: '', project_id: '', sender_id: '', app_id: '', is_enabled: 0 };
}

function saveSettings(db, { tenant_id, api_key, project_id, sender_id, app_id, is_enabled }) {
  const tid = tenant_id || 1;
  const existing = db.prepare('SELECT id FROM push_settings WHERE tenant_id = ?').get(tid);
  if (existing) {
    db.prepare('UPDATE push_settings SET api_key = ?, project_id = ?, sender_id = ?, app_id = ?, is_enabled = ? WHERE tenant_id = ?')
      .run(api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0, tid);
  } else {
    db.prepare('INSERT INTO push_settings (tenant_id, api_key, project_id, sender_id, app_id, is_enabled) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tid, api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0);
  }
  return { ok: true };
}

function getDeviceTokens(db, tenantId = 1) {
  return db.prepare('SELECT token, platform FROM device_tokens WHERE tenant_id = ? AND is_active = 1').all(tenantId);
}

function registerDeviceToken(db, { tenant_id, token, platform, device_info }) {
  const tid = tenant_id || 1;
  const existing = db.prepare('SELECT id FROM device_tokens WHERE token = ? AND tenant_id = ?').get(token, tid);
  if (existing) {
    db.prepare('UPDATE device_tokens SET platform = ?, device_info = ?, is_active = 1, updated_at = datetime("now") WHERE id = ?')
      .run(platform || '', device_info || '', existing.id);
  } else {
    db.prepare('INSERT INTO device_tokens (tenant_id, token, platform, device_info) VALUES (?, ?, ?, ?)')
      .run(tid, token, platform || '', device_info || '');
  }
  return { ok: true };
}

function unregisterDeviceToken(db, token) {
  db.prepare('UPDATE device_tokens SET is_active = 0, updated_at = datetime("now") WHERE token = ?').run(token);
  return { ok: true };
}

function makeFcmPayload(title, body, data = {}) {
  return {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: { priority: 'high', notification: { channel_id: 'default', priority: 'high', sound: 'default' } },
    apns: { payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } } },
  };
}

async function sendFcmLegacy(serverKey, fcmPayload, tokens) {
  const body = JSON.stringify({ ...fcmPayload, registration_ids: tokens });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path: '/fcm/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + serverKey,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ success: 0, failure: tokens.length, results: tokens.map(() => ({ error: data })) }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendToAll(db, { title, body, data }, tenantId = 1, logCb) {
  const settings = getSettings(db, tenantId);
  if (!settings.is_enabled || !settings.api_key) {
    const err = 'Push not configured';
    if (logCb) logCb('push', null, title, 'failed', err);
    return { success: false, error: err };
  }
  const tokens = getDeviceTokens(db, tenantId);
  if (!tokens.length) {
    const err = 'No device tokens registered';
    if (logCb) logCb('push', null, title, 'failed', err);
    return { success: false, error: err };
  }
  const fcmPayload = makeFcmPayload(title, body, data);
  const batchSize = 500;
  let totalSuccess = 0;
  let totalFailure = 0;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize).map(t => t.token);
    const result = await sendFcmLegacy(settings.api_key, fcmPayload, batch);
    if (result.success) totalSuccess += result.success;
    if (result.failure) totalFailure += result.failure;
    if (result.results) {
      result.results.forEach((r, idx) => {
        if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
          const actualIdx = i + idx;
          if (tokens[actualIdx]) {
            db.prepare('UPDATE device_tokens SET is_active = 0 WHERE token = ?').run(tokens[actualIdx].token);
          }
        }
      });
    }
  }
  if (logCb) logCb('push', tokens.length + ' devices', title, 'sent', `success=${totalSuccess} failure=${totalFailure}`);
  return { success: true, total: tokens.length, sent: totalSuccess, failed: totalFailure };
}

async function sendToToken(db, token, { title, body, data }, tenantId = 1, logCb) {
  const settings = getSettings(db, tenantId);
  if (!settings.is_enabled || !settings.api_key) {
    const err = 'Push not configured';
    if (logCb) logCb('push', token, title, 'failed', err);
    return { success: false, error: err };
  }
  const fcmPayload = makeFcmPayload(title, body, data);
  const result = await sendFcmLegacy(settings.api_key, fcmPayload, [token]);
  if (result.success > 0) {
    if (logCb) logCb('push', token, title, 'sent');
    return { success: true };
  }
  if (result.results && result.results[0] && (result.results[0].error === 'NotRegistered' || result.results[0].error === 'InvalidRegistration')) {
    db.prepare('UPDATE device_tokens SET is_active = 0 WHERE token = ?').run(token);
  }
  const err = result.results?.[0]?.error || 'unknown';
  if (logCb) logCb('push', token, title, 'failed', err);
  return { success: false, error: err };
}

async function sendTest(db, tenantId = 1) {
  const settings = getSettings(db, tenantId);
  if (!settings.api_key) return { success: false, error: 'API key not configured' };
  const tokens = getDeviceTokens(db, tenantId);
  if (!tokens.length) return { success: false, error: 'No devices registered. Register a mobile device first.' };
  const result = await sendToAll(db, { title: 'Тест FCM FoodChain', body: 'Если вы видите это — push-уведомления работают!' }, tenantId);
  return result;
}

module.exports = { getSettings, saveSettings, getDeviceTokens, registerDeviceToken, unregisterDeviceToken, sendToAll, sendToToken, sendTest };
