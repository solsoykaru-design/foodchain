// POS inventory write-off: deduct ingredients when order is paid
const pos = require('./pos.service');

function getTenantId() {
  const store = pos.getStore?.();
  return store?.tenantId || 1;
}

function writeOffOrder(db, orderId) {
  const tenantId = getTenantId();
  const items = db.prepare(`
    SELECT oi.dish_id, oi.quantity, d.name as dish_name, d.tech_card_id
    FROM order_items oi
    JOIN dishes d ON d.id = oi.dish_id
    WHERE oi.order_id = ?
  `).all(orderId);

  let totalDeductions = 0;
  const deductions = [];

  for (const item of items) {
    if (!item.tech_card_id) continue;
    const ingredients = db.prepare(`
      SELECT tci.item_id, tci.quantity, tci.unit, tci.loss_percent, tci.cold_loss_percent, tci.heat_loss_percent,
        ii.name as item_name, ii.current_stock, ii.current_balance, ii.price_per_unit
      FROM tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON ii.id = tci.item_id
      WHERE tci.tech_card_id = ?
    `).all(item.tech_card_id);

    for (const ing of ingredients) {
      if (!ing.item_id) continue;
      const baseQty = ing.quantity || 0;
      const totalLoss = ((ing.loss_percent || 0) + (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0)) / 100;
      const writeQty = baseQty * item.quantity * (1 + totalLoss);
      const factor = (ing.unit === 'г' || ing.unit === 'мл' || ing.unit === 'g' || ing.unit === 'ml') ? 1 / 1000 : 1;
      const finalQty = Math.round(writeQty * factor * 1000) / 1000;
      if (finalQty <= 0) continue;

      db.prepare(`UPDATE inventory_items
        SET current_stock = MAX(0, COALESCE(current_stock,0) - ?),
            current_balance = MAX(0, COALESCE(current_balance,0) - ?)
        WHERE id = ?`).run(finalQty, finalQty, ing.item_id);

      const price = ing.price_per_unit || 0;
      db.prepare(`INSERT INTO inventory_transactions
        (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, tenant_id, created_at)
        VALUES (?, 'write_off', ?, ?, ?, 'POS', ?, ?, ?, datetime('now'))`)
        .run(ing.item_id, -finalQty, price, Math.round(-finalQty * price * 100) / 100,
          `Продажа блюда "${item.dish_name}" (заказ #${orderId})`, `ORD-${orderId}`, tenantId);

      totalDeductions++;
      deductions.push({ item: ing.item_name, qty: finalQty, unit: ing.unit });
    }
  }

  return { success: true, deductionsCount: totalDeductions, deductions };
}

module.exports = { writeOffOrder };
