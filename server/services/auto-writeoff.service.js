const cron = require('node-cron');

let lastCheckTimestamp = null;
let cronJob = null;

function getLastCheck() { return lastCheckTimestamp; }

function getSettings(db, tenantId) {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_writeoff_settings'").get();
  if (!row) {
    return { enabled: false, warn_days: 3, auto_writeoff: false, notify_admin: true, include_losses: false };
  }
  try { return JSON.parse(row.value); } catch { return { enabled: false, warn_days: 3, auto_writeoff: false, notify_admin: true, include_losses: false }; }
}

function saveSettings(db, settings, tenantId) {
  db.prepare("INSERT INTO system_settings (key, value) VALUES ('auto_writeoff_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(settings));
  return settings;
}

function getExpiringSoon(db, warnDays) {
  return db.prepare(`
    SELECT id, name, unit, current_balance, current_stock, expiry_date,
      cold_loss_percent, heat_loss_percent,
      ROUND(julianday(expiry_date) - julianday('now')) as days_left
    FROM inventory_items
    WHERE expiry_date IS NOT NULL AND expiry_date != ''
      AND current_balance > 0
      AND julianday(expiry_date) - julianday('now') <= ?
    ORDER BY expiry_date ASC
  `).all(warnDays || 3);
}

function getExpiredItems(db) {
  return db.prepare(`
    SELECT id, name, unit, current_balance, current_stock, expiry_date,
      cold_loss_percent, heat_loss_percent,
      ROUND(julianday('now') - julianday(expiry_date)) as days_expired
    FROM inventory_items
    WHERE expiry_date IS NOT NULL AND expiry_date != ''
      AND current_balance > 0
      AND expiry_date < date('now')
    ORDER BY expiry_date ASC
  `).all();
}

function runAutoWriteoff(db, tenantId) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) return { written_off: 0, message: 'Автосписание отключено' };

  const expired = getExpiredItems(db);
  if (expired.length === 0) return { written_off: 0, message: 'Просроченных продуктов нет' };

  const itemsToWriteOff = settings.auto_writeoff ? expired : expired.filter(i => i.days_expired >= 1);
  if (itemsToWriteOff.length === 0) return { written_off: 0, message: 'Продукты просрочены, но автосписание отключено. Требуется ручное списание.' };

  const docNumber = `WR-${Date.now().toString(36).toUpperCase()}`;
  const includeLosses = settings.include_losses;
  const items = itemsToWriteOff.map(i => {
    const baseQty = i.current_balance || i.current_stock || 0;
    const coldLoss = (i.cold_loss_percent || 0);
    const heatLoss = (i.heat_loss_percent || 0);
    const totalLossPct = coldLoss + heatLoss;
    const adjustedQty = includeLosses ? Math.round(baseQty * (1 + totalLossPct / 100) * 100) / 100 : baseQty;
    return {
      name: i.name,
      quantity: baseQty,
      adjusted_quantity: adjustedQty,
      unit: i.unit || 'шт',
      price: 0,
      total: 0,
      itemId: i.id,
      inventory_item_id: i.id,
      cold_loss_percent: coldLoss,
      heat_loss_percent: heatLoss,
      note: `Просрочен на ${i.days_expired || 0} дн. (до ${i.expiry_date})${includeLosses && totalLossPct > 0 ? `, потери: ${totalLossPct}%` : ''}`,
    };
  });

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const info = db.prepare(`
    INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_at, updated_at)
    VALUES (?, ?, date('now'), ?, ?, 'confirmed', ?, ?, datetime('now'), datetime('now'))
  `).run(
    'writeoff', docNumber, 'Автосписание', 0,
    JSON.stringify(items),
    `Автоматическое списание просроченных продуктов: ${itemsToWriteOff.length} позиций, ${totalQty} ед.`
  );
  const docId = info.lastInsertRowid;

  // Update stock and create transactions (same as processDocStockImpact but simplified)
  for (const item of itemsToWriteOff) {
    const qty = item.current_balance || item.current_stock || 0;
    if (qty <= 0) continue;

    const coldLoss = (item.cold_loss_percent || 0);
    const heatLoss = (item.heat_loss_percent || 0);
    const totalLossPct = coldLoss + heatLoss;
    const writeQty = includeLosses ? Math.round(qty * (1 + totalLossPct / 100) * 100) / 100 : qty;

    db.prepare('UPDATE inventory_items SET current_balance = 0, current_stock = MAX(0, COALESCE(current_stock,0) - ?) WHERE id = ?').run(writeQty, item.id);
    db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
      VALUES (?, 'write_off', ?, 0, 0, 'Автосписание', ?, ?, datetime('now'))`)
      .run(item.id, -writeQty, `Просрочен: ${item.expiry_date}`, docNumber);
  }

  lastCheckTimestamp = new Date().toISOString();

  // Notify admin
  try {
    const admin = db.prepare("SELECT id FROM staff WHERE role IN ('admin','owner','manager') AND tenant_id = ? LIMIT 1").get(tenantId || 1);
    if (admin) {
      db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(
        admin.id, 'Списание просроченных продуктов',
        `Автоматически списано ${itemsToWriteOff.length} позиций (${totalQty} ед.)`
      );
    }
  } catch {}

  return { written_off: itemsToWriteOff.length, items: itemsToWriteOff, doc_id: docId, doc_number: docNumber, message: 'Списание выполнено' };
}

function scheduleAutoCheck(db) {
  if (cronJob) cronJob.stop();

  cronJob = cron.schedule('0 4 * * *', () => {
    try {
      const settings = getSettings(db, 1);
      if (!settings.enabled) return;
      const result = runAutoWriteoff(db, 1);
      if (result.written_off > 0) {
        console.log(`[AutoWriteoff] ${result.written_off} items written off`);
      }
    } catch (e) {
      console.error('[AutoWriteoff] Error:', e.message);
    }
  });

  return cronJob;
}

function calculateLosses(db, ids) {
  if (!ids || !Array.isArray(ids)) ids = [];
  const placeholders = ids.length ? ids.map(() => '?').join(',') : '0';
  const items = db.prepare(`
    SELECT id, name, unit, current_balance, current_stock, cold_loss_percent, heat_loss_percent,
      ROUND(current_balance * (1 + (COALESCE(cold_loss_percent,0) + COALESCE(heat_loss_percent,0)) / 100), 2) as theoretical_loss,
      ROUND(current_balance, 2) as actual_quantity
    FROM inventory_items WHERE id IN (${placeholders})
  `).all(...ids);
  return items.map(i => ({
    ...i,
    total_loss_percent: (i.cold_loss_percent || 0) + (i.heat_loss_percent || 0),
    loss_difference: Math.round((i.theoretical_loss || 0) * 100 - (i.actual_quantity || 0) * 100) / 100,
  }));
}

function rescheduleCron(db) { if (cronJob) cronJob.stop(); scheduleAutoCheck(db); }
function shutdown() { if (cronJob) cronJob.stop(); }

module.exports = {
  getSettings, saveSettings,
  getExpiringSoon, getExpiredItems,
  runAutoWriteoff, getLastCheck,
  scheduleAutoCheck, rescheduleCron, shutdown,
  calculateLosses,
};
