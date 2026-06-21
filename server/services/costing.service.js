const cron = require('node-cron');

let cronJob = null;
let lastRunTimestamp = null;

function getLastRun() { return lastRunTimestamp; }

// Recalculate cost_price for all dishes that have a tech_card_id
function recalculateAll(db, tenantId) {
  const dishes = db.prepare(`
    SELECT d.id, d.name, d.price, d.cost, d.markup, d.tech_card_id
    FROM dishes d
    WHERE d.tech_card_id IS NOT NULL AND d.tech_card_id > 0
      AND (d.tenant_id = ? OR ? = 0)
  `).all(tenantId || 1, tenantId || 0);

  let updated = 0;
  let errors = 0;

  for (const dish of dishes) {
    try {
      const result = recalculateOne(db, dish.id, dish.tech_card_id);
      if (result.success) updated++;
      else errors++;
    } catch { errors++; }
  }

  lastRunTimestamp = new Date().toISOString();
  return { total: dishes.length, updated, errors };
}

// Recalculate cost for a single dish from its tech card
function recalculateOne(db, dishId, techCardId) {
  const ingredients = db.prepare(`
    SELECT tci.*, ii.price_per_unit, ii.last_price, ii.unit as item_unit
    FROM tech_card_ingredients tci
    LEFT JOIN inventory_items ii ON ii.id = tci.item_id
    WHERE tci.tech_card_id = ?
  `).all(techCardId);

  if (ingredients.length === 0) {
    return { success: true, cost: 0, ingredients_count: 0 };
  }

  let totalCost = 0;

  for (const ing of ingredients) {
    const price = ing.price_per_unit || ing.last_price || 0;
    const qty = ing.quantity || 0;
    const unit = ing.unit || ing.item_unit || 'г';

    // Convert to kg for calculation
    let kg = 0;
    if (unit === 'г' || unit === 'мл' || unit === 'g' || unit === 'ml') {
      kg = qty / 1000;
    } else if (unit === 'кг' || unit === 'kg') {
      kg = qty;
    } else if (unit === 'шт' || unit === 'pcs') {
      kg = qty; // Treat as a single unit if no weight info
    } else {
      kg = qty;
    }

    // Apply loss percentages
    const coldLoss = (ing.cold_loss_percent || 0) / 100;
    const heatLoss = (ing.heat_loss_percent || 0) / 100;
    const loss = (ing.loss_percent || 0) / 100;
    const totalLoss = coldLoss + heatLoss + loss;

    const yieldKg = kg * (1 - totalLoss);
    const itemCost = price * yieldKg;
    totalCost += itemCost;
  }

  // Add fixed costs from tech card
  const tc = db.prepare('SELECT cost_price, constant_costs, packaging_cost FROM tech_cards WHERE id = ?').get(techCardId);
  if (tc) {
    totalCost += (tc.constant_costs || 0) + (tc.packaging_cost || 0);
  }

  totalCost = Math.round(totalCost * 100) / 100;

  // Update dish cost
  const markup = dishId > 0 ? null : 0;
  db.prepare('UPDATE dishes SET cost = ?, updated_at = datetime(\'now\') WHERE id = ?').run(totalCost, dishId);

  // Also update tech_card cost_price
  db.prepare('UPDATE tech_cards SET cost_price = ?, updated_at = datetime(\'now\') WHERE id = ?').run(totalCost, techCardId);

  return { success: true, cost: totalCost, ingredients_count: ingredients.length };
}

// Get all dishes with their cost info
function getCostingOverview(db, tenantId) {
  return db.prepare(`
    SELECT d.id, d.name, d.price, d.cost, d.markup, d.tech_card_id,
      tc.cost_price as tc_cost, tc.output,
      CASE WHEN d.price > 0 THEN ROUND((d.price - COALESCE(d.cost, 0)) / d.price * 100, 1) ELSE 0 END as margin_percent,
      CASE WHEN d.cost > 0 THEN ROUND((d.price - d.cost) / d.cost * 100, 1) ELSE 0 END as markup_percent,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = d.tech_card_id) as ing_count
    FROM dishes d
    LEFT JOIN tech_cards tc ON tc.id = d.tech_card_id
    WHERE d.is_active = 1 AND (d.tenant_id = ? OR ? = 0)
    ORDER BY margin_percent ASC
  `).all(tenantId || 1, tenantId || 0);
}

function scheduleAutoRecalc(db) {
  if (cronJob) cronJob.stop();
  // Run daily at 5:00
  cronJob = cron.schedule('0 5 * * *', () => {
    try {
      const result = recalculateAll(db, 1);
      console.log(`[Costing] Auto-recalc: ${result.updated}/${result.total} dishes updated`);
    } catch (e) {
      console.error('[Costing] Error:', e.message);
    }
  });
  return cronJob;
}

function shutdown() { if (cronJob) cronJob.stop(); }

module.exports = {
  recalculateAll, recalculateOne,
  getCostingOverview, getLastRun,
  scheduleAutoRecalc, shutdown,
};
