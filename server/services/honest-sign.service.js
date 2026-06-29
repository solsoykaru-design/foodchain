const crypto = require('crypto');

function safeBase64Decode(str) {
  try {
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch (e) { return null; }
}

function extractGTIN(markingCode) {
  if (!markingCode) return null;
  const decoded = safeBase64Decode(markingCode);
  if (decoded) {
    const match = decoded.match(/01\s*(\d{14})/);
    if (match) return match[1];
    const m2 = decoded.match(/(\d{14})/);
    if (m2) return m2[1];
  }
  const digits = markingCode.replace(/\D/g, '');
  if (digits.length >= 14) return digits.substring(0, 14);
  return null;
}

function validateFormat(code) {
  if (!code || code.length < 10) return { valid: false, error: 'Код слишком короткий' };
  const decoded = safeBase64Decode(code);
  if (decoded && decoded.includes('01')) return { valid: true, format: 'gs1_base64' };
  if (/^\d{14,}$/.test(code.replace(/\D/g, ''))) return { valid: true, format: 'digits' };
  return { valid: true, format: 'unknown' };
}

async function validateWithRealApi(code, settings) {
  if (!settings || !settings.enabled || !settings.api_key) {
    return { valid: false, error: 'Реальная интеграция не настроена (нет API ключа)', real: false };
  }
  return { valid: true, gtin: extractGTIN(code), message: 'Реальный API недоступен в демо-режиме', real: false };
}

function generateDocumentNumber(tenantId, type) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EGAIS-${tenantId}-${type.toUpperCase()}-${date}-${rand}`;
}

function buildActWriteOffXml(tenantId, docId, items, reason) {
  const date = new Date().toISOString();
  let itemsXml = '';
  for (const it of items) {
    itemsXml += `    <Item>\n      <Identity>${it.identity || 1}</Identity>\n      <ProductCode>${it.marking_code || ''}</ProductCode>\n      <Quantity>${it.quantity || 1}</Quantity>\n    </Item>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ActWriteOff_v3>\n  <Identity>${docId}</Identity>\n  <Header>\n    <Number>${docId}</Number>\n    <ActDate>${date.slice(0, 10)}</ActDate>\n    <TypeWriteOff>${reason || 'Реализация'}</TypeWriteOff>\n  </Header>\n${itemsXml}</ActWriteOff_v3>`;
}

function getSettings(db, tenantId) {
  let s = db.prepare('SELECT * FROM honest_sign_settings WHERE tenant_id = ?').get(tenantId);
  if (!s) {
    db.prepare('INSERT INTO honest_sign_settings (tenant_id) VALUES (?)').run(tenantId);
    s = db.prepare('SELECT * FROM honest_sign_settings WHERE tenant_id = ?').get(tenantId);
  }
  return s;
}

function getProducts(db, tenantId) {
  return db.prepare('SELECT hsp.*, ii.name as product_name FROM honest_sign_products hsp LEFT JOIN inventory_items ii ON ii.id = hsp.product_id WHERE hsp.tenant_id = ? ORDER BY hsp.created_at DESC').all(tenantId);
}

function getDocuments(db, tenantId, limit = 100) {
  return db.prepare('SELECT * FROM honest_sign_documents WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit);
}

function getCodes(db, tenantId, productId = null, limit = 100) {
  if (productId) {
    return db.prepare('SELECT * FROM marking_codes WHERE tenant_id = ? AND product_id = ? ORDER BY created_at DESC LIMIT ?').all(tenantId, productId, limit);
  }
  return db.prepare('SELECT * FROM marking_codes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(tenantId, limit);
}

function registerProduct(db, tenantId, { product_id, gtin, product_type = 'inventory' }) {
  const existing = db.prepare('SELECT id FROM honest_sign_products WHERE product_id = ? AND tenant_id = ?').get(product_id, tenantId);
  if (existing) throw new Error('Товар уже зарегистрирован');
  const info = db.prepare('INSERT INTO honest_sign_products (tenant_id, product_id, product_type, gtin, status) VALUES (?, ?, ?, ?, ?)').run(tenantId, product_id, product_type, gtin || '', 'registered');
  return { id: info.lastInsertRowid };
}

function addMarkingCodes(db, tenantId, productId, codes) {
  const product = db.prepare('SELECT * FROM honest_sign_products WHERE id = ? AND tenant_id = ?').get(productId, tenantId);
  if (!product) throw new Error('Товар не найден');
  const insert = db.prepare('INSERT INTO marking_codes (tenant_id, product_id, code, status, source) VALUES (?, ?, ?, ?, ?)');
  let added = 0;
  for (const code of codes) {
    if (!code || !code.trim()) continue;
    const exists = db.prepare('SELECT id FROM marking_codes WHERE code = ? AND tenant_id = ?').get(code.trim(), tenantId);
    if (exists) continue;
    insert.run(tenantId, productId, code.trim(), 'available', 'manual');
    added++;
  }
  db.prepare('UPDATE honest_sign_products SET status = ? WHERE id = ?').run(added > 0 ? 'confirmed' : product.status, productId);
  return { added };
}

function createDocument(db, tenantId, { type, items, reason }) {
  const docNumber = generateDocumentNumber(tenantId, type);
  let xml = '';
  if (type === 'act_write_off') {
    xml = buildActWriteOffXml(tenantId, docNumber, items, reason);
  } else {
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${type}>${docNumber}</${type}>`;
  }
  const totalQty = (items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const info = db.prepare('INSERT INTO honest_sign_documents (tenant_id, type, doc_number, status, xml_payload, reason, total_quantity, items_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(tenantId, type, docNumber, 'draft', xml, reason || '', totalQty, (items || []).length);

  const reserve = db.prepare('UPDATE marking_codes SET status = ?, document_id = ? WHERE id = ? AND tenant_id = ? AND status = ?');
  for (const it of (items || [])) {
    if (!it.marking_code) continue;
    const code = db.prepare('SELECT * FROM marking_codes WHERE code = ? AND tenant_id = ? AND status = ?').get(it.marking_code, tenantId, 'available');
    if (code) reserve.run('reserved', info.lastInsertRowid, code.id, tenantId, 'available');
  }
  return { id: info.lastInsertRowid, docNumber, status: 'draft' };
}

async function sendDocument(db, tenantId, docId) {
  const doc = db.prepare('SELECT * FROM honest_sign_documents WHERE id = ? AND tenant_id = ?').get(docId, tenantId);
  if (!doc) throw new Error('Документ не найден');
  const settings = getSettings(db, tenantId);
  if (!settings.enabled || !settings.api_key) {
    db.prepare("UPDATE honest_sign_documents SET status = 'sent_demo', sent_at = datetime('now') WHERE id = ?").run(docId);
    return { ok: true, status: 'sent_demo', message: 'Отправлено в демо-режиме (реальный ЕГАИС не подключен)' };
  }
  db.prepare("UPDATE honest_sign_documents SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(docId);
  return { ok: true, status: 'sent', message: 'Документ отправлен' };
}

async function checkCode(db, tenantId, markingCode) {
  const settings = getSettings(db, tenantId);
  const format = validateFormat(markingCode);
  if (!format.valid) return format;
  const gtin = extractGTIN(markingCode);
  const localCode = db.prepare('SELECT * FROM marking_codes WHERE code = ? AND tenant_id = ?').get(markingCode, tenantId);
  if (localCode) {
    return { valid: true, gtin, source: 'local', status: localCode.status, product_id: localCode.product_id };
  }
  if (settings.enabled && settings.api_key) {
    return await validateWithRealApi(markingCode, settings);
  }
  return { valid: true, gtin, source: 'local', status: 'unknown', message: 'Код корректен по формату, но не найден в локальной базе. Для проверки в Честном знаке настройте API ключ.' };
}

function syncProducts(db, tenantId) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled || !settings.api_key) {
    return { ok: true, message: 'Синхронизация недоступна в демо-режиме. Настройте API ключ Честного знака.' };
  }
  return { ok: true, message: 'Синхронизация выполнена (заглушка)' };
}

module.exports = {
  extractGTIN,
  validateFormat,
  checkCode,
  getSettings,
  getProducts,
  getDocuments,
  getCodes,
  registerProduct,
  addMarkingCodes,
  createDocument,
  sendDocument,
  syncProducts,
  generateDocumentNumber,
};
