
module.exports = function(app, db, config) {
  const { safeError, toCamelCase, toCamelCaseArray } = config;

app.get('/api/tech-cards/limit', (req, res) => {
  try {
    const limitTenantId = db.prepare('SELECT current_tenant_id() as tid').get()?.tid || 1;
    const user = req.user;

    let maxCards = 3;
    let isOwner = false;

    if (user && (user.role === 'superadmin' || user.role === 'owner')) {
      isOwner = true;
      maxCards = -1;
    } else {
      const subscription = db.prepare('SELECT s.*, t.max_cards FROM subscriptions s LEFT JOIN tariffs t ON t.id = s.tariff_id WHERE s.tenant_id = ? AND s.status = ? ORDER BY s.end_date DESC LIMIT 1').get(limitTenantId, 'active');
      if (subscription && subscription.max_cards) {
        maxCards = subscription.max_cards;
      }
    }

    const totalCards = db.prepare('SELECT COUNT(*) as count FROM dish_tech_cards WHERE tenant_id = ? AND is_active = 1').get(limitTenantId)?.count || 0;

    res.json({
      total: totalCards,
      limit: maxCards,
      isOwner,
      remaining: maxCards === -1 ? -1 : Math.max(0, maxCards - totalCards)
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/tech-cards', (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE tc.tenant_id = current_tenant_id()';
    const params = [];

    if (search) { where += ' AND (tc.dish_name LIKE ? OR d.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (is_active !== undefined && is_active !== '') { where += ' AND tc.is_active = ?'; params.push(parseInt(is_active)); }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM dish_tech_cards tc LEFT JOIN dishes d ON d.id = tc.dish_id ${where}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const items = db.prepare(`
      SELECT tc.*, d.name as dish_name_db, d.price as dish_price, d.weight as dish_weight,
        (SELECT COUNT(*) FROM dish_tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count
      FROM dish_tech_cards tc
      LEFT JOIN dishes d ON d.id = tc.dish_id
      ${where}
      ORDER BY tc.is_active DESC, tc.dish_name ASC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ items, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-cards/export', (req, res) => {
  try {
    const cards = db.prepare(`SELECT * FROM dish_tech_cards WHERE tenant_id = current_tenant_id() ORDER BY dish_name`).all();
    const ingredients = db.prepare('SELECT tci.*, tc.dish_name, ii.name as item_name FROM dish_tech_card_ingredients tci LEFT JOIN dish_tech_cards tc ON tc.id = tci.tech_card_id LEFT JOIN inventory_items ii ON ii.id = tci.item_id WHERE tci.tenant_id = current_tenant_id() ORDER BY tci.tech_card_id, tci.id').all();
    try {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const cardRows = cards.map(c => ({ ID: c.id, Блюдо: c.dish_name, Выход: c.output, Себестоимость: c.cost_price, Время: c.cooking_time, Технология: c.technology, Описание: c.description, Версия: c.version }));
      const ingRows = ingredients.map(i => ({ Блюдо: i.dish_name, Ингредиент: i.item_name, Количество: i.quantity, Ед: i.unit, Цена: i.price_per_unit, Стоимость: i.cost }));
      const ws1 = XLSX.utils.json_to_sheet(cardRows);
      const ws2 = XLSX.utils.json_to_sheet(ingRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Техкарты');
      XLSX.utils.book_append_sheet(wb, ws2, 'Ингредиенты');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=tech-cards-${Date.now()}.xlsx`);
      res.send(buf);
    } catch {
      res.json({ items: cards, ingredients });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-cards/:id', (req, res) => {
  try {
    const tc = db.prepare(`
      SELECT tc.*, d.name as dish_name_db, d.price as dish_price
      FROM dish_tech_cards tc
      LEFT JOIN dishes d ON d.id = tc.dish_id
      WHERE tc.id = ? AND tc.tenant_id = current_tenant_id()
    `).get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });

    const ingredients = db.prepare(`
      SELECT tci.*, ii.name as item_name_inv, ii.price_per_unit, ii.last_price, ii.unit as inv_unit, ii.current_balance
      FROM dish_tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON tci.item_id = ii.id
      WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
      ORDER BY tci.id
    `).all(tc.id);

    let totalCost = 0;
    for (const ing of ingredients) {
      const price = ing.price_per_unit || ing.last_price || 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      const adjustedQty = qty * (1 + loss / 100);
      ing.cost = Math.round(price * (adjustedQty / 1000) * 100) / 100;
      totalCost += ing.cost;
    }

    res.json({ ...tc, ingredients, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-cards', (req, res) => {
  try {
    const { dish_id, dish_name, ingredients, technology, description, cooking_time, output, version, menu_category } = req.body;
    if (!dish_id) return res.status(400).json({ error: 'dish_id is required' });

    const tenantId = db.prepare('SELECT current_tenant_id() as tid').get()?.tid || 1;

    // Check subscription limit
    const existingForThisDish = db.prepare('SELECT id FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dish_id);
    if (!existingForThisDish) {
      const user = req.user;
      if (!user || (user.role !== 'superadmin' && user.role !== 'owner')) {
        const subscription = db.prepare('SELECT s.*, t.max_cards FROM subscriptions s LEFT JOIN tariffs t ON t.id = s.tariff_id WHERE s.tenant_id = ? AND s.status = ? ORDER BY s.end_date DESC LIMIT 1').get(tenantId, 'active');
        const totalCards = db.prepare('SELECT COUNT(*) as count FROM dish_tech_cards WHERE tenant_id = ? AND is_active = 1').get(tenantId)?.count || 0;
        const maxCards = subscription ? subscription.max_cards : 3;

        if (maxCards !== -1 && totalCards >= maxCards) {
          return res.status(403).json({ error: `Лимит техкарт исчерпан (${maxCards}). Оформите подписку для создания новых.` });
        }
      }
    }

    const dish = db.prepare('SELECT id, name, price, cost FROM dishes WHERE id = ?').get(dish_id);
    if (!dish) return res.status(404).json({ error: 'Dish not found' });

    const existing = db.prepare('SELECT id, version FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dish_id);
    const newVersion = existing ? existing.version + 1 : 1;

    if (existing) {
      db.prepare('UPDATE dish_tech_cards SET is_active = 0 WHERE id = ?').run(existing.id);
    }

    const aiService = require('../services/ai-tech-card.service');
    const createdInvNames = [];
    const createdCategoryNames = new Set();

    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      if (!ing.item_id && ing.item_name) {
        const ingName = ing.item_name;
        const catName = aiService.detectStockCategoryName(ingName);
        let catId = null;
        if (catName) {
          const cat = aiService.findOrCreateStockCategory(db, catName, tenantId);
          if (cat) { catId = cat.id; if (cat.created) createdCategoryNames.add(cat.name); }
        }
        const item = aiService.findOrCreateInventoryItem(db, ingName, ing.unit || 'г', tenantId, catId);
        if (item) {
          ing.item_id = Number(item.id);
          ing.price_per_unit = item.price_per_unit || 0;
          if (item.created) createdInvNames.push(item.name);
        }
      }
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.item_id);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      totalCost += price * (qty * (1 + loss / 100) / 1000);
    }

    // Update menu item (dish) cost and category
    try {
      const sets = ['cost = ?'];
      const params = [Math.round(totalCost * 100) / 100];
      if (menu_category) {
        const menuCat = aiService.findOrCreateMenuCategory(db, menu_category, tenantId);
        if (menuCat) { sets.push('category_id = ?'); params.push(menuCat.id); }
      }
      params.push(dish_id);
      db.prepare(`UPDATE dishes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    } catch {}

    const tc = db.prepare(`INSERT INTO dish_tech_cards
      (dish_id, dish_name, number, valid_from, portions, output, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id, version, is_active, cooking_time, description, updated_at)
      VALUES (?, ?, NULL, NULL, 1, ?, ?, 0, 0, ?, datetime('now'), 1, ?, 1, ?, ?, datetime('now'))`).run(
      dish_id, dish.name, output || 0, technology || '', Math.round(totalCost * 100) / 100,
      newVersion, cooking_time || 0, description || ''
    );

    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(tc.lastInsertRowid, ing.item_id, ing.item_name || '', ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.cold_loss_percent || 0, ing.heat_loss_percent || 0, ing.yield_percent || 100);
    }

    res.json({
      id: tc.lastInsertRowid, version: newVersion,
      totalCost: Math.round(totalCost * 100) / 100,
      createdItems: createdInvNames,
      createdCategories: Array.from(createdCategoryNames),
      menuItemId: dish_id,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/tech-cards/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { dish_name, ingredients, technology, description, cooking_time, output, is_active, version, step_mode, step_instructions } = req.body;

    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.item_id);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      totalCost += price * (qty * (1 + loss / 100) / 1000);
    }

    db.prepare(`UPDATE dish_tech_cards SET
      dish_name = ?, technology = ?, description = ?, cooking_time = ?, output = ?,
      cost_price = ?, is_active = ?, version = ?, step_mode = ?, step_instructions = ?, updated_at = datetime('now')
      WHERE id = ?`).run(
      dish_name || existing.dish_name, technology ?? existing.technology,
      description ?? existing.description, cooking_time ?? existing.cooking_time,
      output ?? existing.output, Math.round(totalCost * 100) / 100,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      version ?? existing.version,
      step_mode !== undefined ? (step_mode ? 1 : 0) : existing.step_mode,
      step_instructions !== undefined ? step_instructions : existing.step_instructions,
      req.params.id
    );

    // Delete old ingredients
    db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(req.params.id);

    // Insert new
    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(req.params.id, ing.item_id, ing.item_name || '', ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.cold_loss_percent || 0, ing.heat_loss_percent || 0, ing.yield_percent || 100);
    }

    res.json({ id: Number(req.params.id), totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/tech-cards/:id', (req, res) => {
  try {
    const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });

    // Archive
    const arch = db.prepare(`INSERT INTO dish_tech_cards_archive
      (original_tc_id, dish_id, dish_name, version, output, technology, description, cooking_time, total_cost, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      tc.id, tc.dish_id, tc.dish_name, tc.version, tc.output,
      tc.technology, tc.description, tc.cooking_time, tc.cost_price, tc.tenant_id
    );

    const archIngs = db.prepare('SELECT * FROM dish_tech_card_ingredients WHERE tech_card_id = ?').all(tc.id);
    for (const ing of archIngs) {
      db.prepare(`INSERT INTO dish_tech_card_ingredients_archive
        (archive_tc_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        arch.lastInsertRowid, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.netto,
        ing.cold_loss_percent, ing.heat_loss_percent, ing.yield_percent, ing.tenant_id
      );
    }

    db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(tc.id);
    db.prepare('DELETE FROM dish_tech_cards WHERE id = ?').run(tc.id);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-cards-stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM dish_tech_cards WHERE is_active = 1').get().c;
    const withCost = db.prepare('SELECT COUNT(*) as c FROM dish_tech_cards WHERE is_active = 1 AND cost_price > 0').get().c;
    const avgCost = db.prepare('SELECT AVG(cost_price) as avg FROM dish_tech_cards WHERE is_active = 1 AND cost_price > 0').get().avg || 0;
    const totalIngredients = db.prepare('SELECT COUNT(*) as c FROM dish_tech_card_ingredients tci JOIN dish_tech_cards tc ON tc.id = tci.tech_card_id WHERE tc.is_active = 1 AND tci.tenant_id = current_tenant_id()').get().c;
    res.json({ total, withCost, avgCost: Math.round(avgCost * 100) / 100, totalIngredients });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-cards-old', (req, res) => {
  try {
    const { dish_id } = req.query;
    let sql = `SELECT tc.*, d.name as dishName, d.description, d.calories, d.proteins, d.fats, d.carbs, d.price as dishPrice
      FROM tech_cards tc LEFT JOIN dishes d ON tc.dish_id = d.id WHERE tc.tenant_id = current_tenant_id()`;
    const params = [];
    if (dish_id) { sql += ' AND tc.dish_id = ?'; params.push(Number(dish_id)); }
    sql += ' ORDER BY tc.created_at DESC';
    const cards = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(cards));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/tech-cards/list', (req, res) => {
  try {
    const { search, type, store, is_active, page: qPage, limit: qLimit } = req.query;
    let sql = `SELECT tc.*, ii.name as item_name, ii.unit as item_unit, ii.category_name as item_category,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count
      FROM tech_cards tc LEFT JOIN inventory_items ii ON tc.item_id = ii.id WHERE tc.tenant_id = current_tenant_id()`;
    const params = [];
    if (search) { sql += ' AND (tc.name LIKE ? OR tc.number LIKE ? OR ii.name LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    if (type) { sql += ' AND tc.type = ?'; params.push(type); }
    if (store) { sql += ' AND tc.store LIKE ?'; params.push(`%${store}%`); }
    if (is_active !== undefined) { sql += ' AND tc.is_active = ?'; params.push(is_active === '1' || is_active === 'true' ? 1 : 0); }
    const page = parseInt(qPage) || 1;
    const limit = parseInt(qLimit) || 20;
    const total = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY tc.created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page - 1) * limit);
    res.json({ items: toCamelCaseArray(items), total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-card', (req, res) => {
  try {
    const { itemId, name, description, type, number, output, costPrice, store, validFrom, isActive, cookingTime,
      thermalLossPercent, coldLossPercent, packagingCost, additionalCosts, portions, grossWeight, kbjuSource,
      constantCosts, totalYield, ingredients, modifiers } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Не указан товар' });
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId);
    if (!item) return res.status(400).json({ error: 'Товар не найден' });
    const cardNumber = number || `TC-${Date.now().toString(36).toUpperCase()}`;
    const info = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active, cooking_time,
      thermal_loss_percent, cold_loss_percent, packaging_cost, additional_costs, portions, gross_weight, kbju_source, constant_costs, total_yield)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      itemId, name || item.name, description || '', type || 'individual', cardNumber,
      output || 0, costPrice || 0, store || '', validFrom || null, isActive !== undefined ? (isActive ? 1 : 0) : 1,
      cookingTime || null, thermalLossPercent || 0, coldLossPercent || 0, packagingCost || 0,
      JSON.stringify(additionalCosts || []), JSON.stringify(portions || []), grossWeight || 0, kbjuSource || 'auto',
      constantCosts || 0, totalYield || 0
    );
    const cardId = info.lastInsertRowid;

    if (ingredients && Array.isArray(ingredients)) {
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, cold_loss_percent, heat_loss_percent, yield, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of ingredients) {
        ins.run(cardId, ing.itemId || null, ing.itemName || '', ing.quantity || 0, ing.unit || 'г',
          ing.brutto || 0, ing.netto || ing.yield || 0, ing.pricePerUnit || 0, ing.cost || 0,
          ing.lossPercent || ing.coldLossPercent || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
          ing.yield || ing.netto || 0, ing.sortOrder || 0);
      }
    }

    if (modifiers && Array.isArray(modifiers)) {
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of modifiers) {
        ins.run(cardId, mod.name || '', mod.quantity || 1, mod.price || 0, mod.sortOrder || 0);
      }
    }

    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(cardId);
    res.status(201).json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-card/:id', (req, res) => {
  try {
    const card = db.prepare('SELECT tc.*, ii.name as item_name, ii.unit as item_unit, ii.category_name as item_category FROM tech_cards tc LEFT JOIN inventory_items ii ON tc.item_id = ii.id WHERE tc.id = ? AND tc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Техкарта не найдена' });
    const ingredients = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    const modifiers = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(toCamelCase({ ...card, ingredients, modifiers }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/tech-card/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Техкарта не найдена' });
    const b = req.body;
    const sets = []; const vals = [];
    if (b.itemId !== undefined) { sets.push('item_id = ?'); vals.push(b.itemId); }
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.description !== undefined) { sets.push('description = ?'); vals.push(b.description); }
    if (b.type !== undefined) { sets.push('type = ?'); vals.push(b.type); }
    if (b.number !== undefined) { sets.push('number = ?'); vals.push(b.number); }
    if (b.output !== undefined) { sets.push('output = ?'); vals.push(b.output); }
    if (b.costPrice !== undefined) { sets.push('cost_price = ?'); vals.push(b.costPrice); }
    if (b.store !== undefined) { sets.push('store = ?'); vals.push(b.store); }
    if (b.validFrom !== undefined) { sets.push('valid_from = ?'); vals.push(b.validFrom); }
    if (b.isActive !== undefined) { sets.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if (b.cookingTime !== undefined) { sets.push('cooking_time = ?'); vals.push(b.cookingTime); }
    if (b.thermalLossPercent !== undefined) { sets.push('thermal_loss_percent = ?'); vals.push(b.thermalLossPercent); }
    if (b.coldLossPercent !== undefined) { sets.push('cold_loss_percent = ?'); vals.push(b.coldLossPercent); }
    if (b.packagingCost !== undefined) { sets.push('packaging_cost = ?'); vals.push(b.packagingCost); }
    if (b.constantCosts !== undefined) { sets.push('constant_costs = ?'); vals.push(b.constantCosts); }
    if (b.totalYield !== undefined) { sets.push('total_yield = ?'); vals.push(b.totalYield); }
    if (b.additionalCosts !== undefined) { sets.push('additional_costs = ?'); vals.push(JSON.stringify(b.additionalCosts)); }
    if (b.portions !== undefined) { sets.push('portions = ?'); vals.push(JSON.stringify(b.portions)); }
    if (b.grossWeight !== undefined) { sets.push('gross_weight = ?'); vals.push(b.grossWeight); }
    if (b.kbjuSource !== undefined) { sets.push('kbju_source = ?'); vals.push(b.kbjuSource); }
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      vals.push(req.params.id);
      db.prepare(`UPDATE tech_cards SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }

    if (b.ingredients !== undefined) {
      db.prepare('DELETE FROM tech_card_ingredients WHERE tech_card_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, cold_loss_percent, heat_loss_percent, yield, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of b.ingredients) {
        ins.run(req.params.id, ing.itemId || null, ing.itemName || '', ing.quantity || 0, ing.unit || 'г',
          ing.brutto || 0, ing.netto || ing.yield || 0, ing.pricePerUnit || 0, ing.cost || 0,
          ing.lossPercent || ing.coldLossPercent || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
          ing.yield || ing.netto || 0, ing.sortOrder || 0);
      }
    }
    if (b.modifiers !== undefined) {
      db.prepare('DELETE FROM tech_card_modifiers WHERE tech_card_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of b.modifiers) {
        ins.run(req.params.id, mod.name || '', mod.quantity || 1, mod.price || 0, mod.sortOrder || 0);
      }
    }

    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/tech-card/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_cards WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-card/:id/calculate-kbju', (req, res) => {
  try {
    const ingredients = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(req.params.id);
    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Техкарта не найдена' });
    let totalKcal = 0, totalProteins = 0, totalFats = 0, totalCarbs = 0, totalWeight = 0;
    for (const ing of ingredients) {
      let kcal = 0, proteins = 0, fats = 0, carbs = 0;
      if (ing.item_id) {
        const item = db.prepare('SELECT kcal, proteins, fats, carbs FROM inventory_items WHERE id = ?').get(ing.item_id);
        if (item) { kcal = item.kcal || 0; proteins = item.proteins || 0; fats = item.fats || 0; carbs = item.carbs || 0; }
      }
      const qty = ing.quantity || 0;
      const factor = qty / 100;
      totalKcal += kcal * factor;
      totalProteins += proteins * factor;
      totalFats += fats * factor;
      totalCarbs += carbs * factor;
      totalWeight += qty;
    }
    const output = card.output || totalWeight || 100;
    const per100g = output > 0 ? { kcal: Math.round(totalKcal / output * 100), proteins: Math.round(totalProteins / output * 100 * 10) / 10, fats: Math.round(totalFats / output * 100 * 10) / 10, carbs: Math.round(totalCarbs / output * 100 * 10) / 10 } : { kcal: 0, proteins: 0, fats: 0, carbs: 0 };
    res.json({ total: { kcal: Math.round(totalKcal), proteins: Math.round(totalProteins * 10) / 10, fats: Math.round(totalFats * 10) / 10, carbs: Math.round(totalCarbs * 10) / 10 }, per100g, totalWeight: Math.round(totalWeight) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-card/:id/copy', (req, res) => {
  try {
    const original = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Техкарта не найдена' });
    const newValidFrom = req.body.validFrom || new Date().toISOString().slice(0, 10);
    const newNumber = `${original.number || 'TC'}-v${Date.now().toString(36).toUpperCase()}`;
    const info = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active, cooking_time,
      thermal_loss_percent, cold_loss_percent, packaging_cost, additional_costs, portions, gross_weight, kbju_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      original.item_id, original.name, original.description, original.type, newNumber,
      original.output, original.cost_price, original.store, newValidFrom, 1,
      original.cooking_time, original.thermal_loss_percent, original.cold_loss_percent,
      original.packaging_cost, original.additional_costs, original.portions,
      original.gross_weight, original.kbju_source
    );
    const newId = info.lastInsertRowid;
    const origIngs = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(req.params.id);
    if (origIngs.length > 0) {
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of origIngs) {
        ins.run(newId, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.brutto, ing.netto, ing.price_per_unit, ing.cost, ing.loss_percent, ing.sort_order);
      }
    }
    const origMods = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ?').all(req.params.id);
    if (origMods.length > 0) {
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of origMods) {
        ins.run(newId, mod.name, mod.quantity, mod.price, mod.sort_order);
      }
    }
    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(newId);
    res.status(201).json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-cards/import', (req, res) => {
  try {
    const XLSX = require('xlsx');
    if (!req.body || !req.body.rows) return res.status(400).json({ error: 'Нет данных для импорта' });
    const rows = req.body.rows;
    let imported = 0, errors = 0;
    const insCard = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active,
      cold_loss_percent, thermal_loss_percent, packaging_cost, gross_weight, kbju_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const row of rows) {
      try {
        if (!row.item_id && !row.item_name) { errors++; continue; }
        let itemId = row.item_id;
        if (!itemId && row.item_name) {
          const found = db.prepare('SELECT id FROM inventory_items WHERE name = ?').get(row.item_name);
          if (found) itemId = found.id;
        }
        if (!itemId) { errors++; continue; }
        insCard.run(itemId, row.name || '', row.description || '', row.type || 'individual', row.number || `TC-${Date.now().toString(36).toUpperCase()}`,
          row.output || 0, row.cost_price || 0, row.store || '', row.valid_from || null, 1,
          row.cold_loss_percent || 0, row.thermal_loss_percent || 0, row.packaging_cost || 0, row.gross_weight || 0, 'auto');
        imported++;
      } catch { errors++; }
    }
    res.json({ imported, errors });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-card/:id/ingredients', (req, res) => {
  try {
    const items = db.prepare('SELECT tci.*, ii.kcal, ii.proteins, ii.fats, ii.carbs FROM tech_card_ingredients tci LEFT JOIN inventory_items ii ON tci.item_id = ii.id WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id() ORDER BY tci.sort_order').all(req.params.id);
    res.json(items.map(i => ({ id: i.id, techCardId: i.tech_card_id, itemId: i.item_id, itemName: i.item_name, quantity: i.quantity, unit: i.unit, brutto: i.brutto, netto: i.netto, pricePerUnit: i.price_per_unit, cost: i.cost, lossPercent: i.loss_percent, sortOrder: i.sort_order, kcal: i.kcal, proteins: i.proteins, fats: i.fats, carbs: i.carbs })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-card/:id/ingredients', (req, res) => {
  try {
    const { itemId, itemName, quantity, unit, brutto, netto, pricePerUnit, cost, lossPercent, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.params.id, itemId || null, itemName || '', quantity || 0, unit || 'г', brutto || 0, netto || 0, pricePerUnit || 0, cost || 0, lossPercent || 0, sortOrder || 0);
    const ing = db.prepare('SELECT * FROM tech_card_ingredients WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(ing));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/tech-card/:id/ingredients/:ingId', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.itemId !== undefined) { sets.push('item_id = ?'); vals.push(b.itemId); }
    if (b.itemName !== undefined) { sets.push('item_name = ?'); vals.push(b.itemName); }
    if (b.quantity !== undefined) { sets.push('quantity = ?'); vals.push(b.quantity); }
    if (b.unit !== undefined) { sets.push('unit = ?'); vals.push(b.unit); }
    if (b.brutto !== undefined) { sets.push('brutto = ?'); vals.push(b.brutto); }
    if (b.netto !== undefined) { sets.push('netto = ?'); vals.push(b.netto); }
    if (b.pricePerUnit !== undefined) { sets.push('price_per_unit = ?'); vals.push(b.pricePerUnit); }
    if (b.cost !== undefined) { sets.push('cost = ?'); vals.push(b.cost); }
    if (b.lossPercent !== undefined) { sets.push('loss_percent = ?'); vals.push(b.lossPercent); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.ingId);
    db.prepare(`UPDATE tech_card_ingredients SET ${sets.join(', ')} WHERE id = ? AND tech_card_id = ?`).run(...vals, req.params.id);
    const ing = db.prepare('SELECT * FROM tech_card_ingredients WHERE id = ?').get(req.params.ingId);
    res.json(toCamelCase(ing));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/tech-card/:id/ingredients/:ingId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_card_ingredients WHERE id = ? AND tech_card_id = ?').run(req.params.ingId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-card/:id/modifiers', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/tech-card/:id/modifiers', (req, res) => {
  try {
    const { name, quantity, price, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      req.params.id, name || '', quantity || 1, price || 0, sortOrder || 0);
    const mod = db.prepare('SELECT * FROM tech_card_modifiers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(mod));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/tech-card/:id/modifiers/:modId', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.quantity !== undefined) { sets.push('quantity = ?'); vals.push(b.quantity); }
    if (b.price !== undefined) { sets.push('price = ?'); vals.push(b.price); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.modId);
    db.prepare(`UPDATE tech_card_modifiers SET ${sets.join(', ')} WHERE id = ? AND tech_card_id = ?`).run(...vals, req.params.id);
    const mod = db.prepare('SELECT * FROM tech_card_modifiers WHERE id = ?').get(req.params.modId);
    res.json(toCamelCase(mod));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/tech-card/:id/modifiers/:modId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_card_modifiers WHERE id = ? AND tech_card_id = ?').run(req.params.modId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/tech-cards/:id/steps', (req, res) => {
  try {
    const tc = db.prepare('SELECT step_instructions, step_mode, technology FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });
    const steps = (tc.step_instructions || tc.technology || '').split('\n').filter(s => s.trim());
    res.json({ stepMode: !!tc.step_mode, steps, raw: tc.step_instructions || tc.technology || '' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── AI Debug: reproduce exact queryOpenCode call ──────
app.get('/api/ai-test', async (req, res) => {
  const key = process.env.OPENCODE_API_KEY || '';
  const results = [];
  for (const model of ['deepseek-v4-flash-free', 'north-mini-code-free']) {
    const s = Date.now();
    try {
      const isReasoning = model === 'deepseek-v4-flash-free' || model === 'big-pickle';
      const prompt = isReasoning
        ? `Ты — профессиональный технолог общественного питания. Составь технологическую карту для блюда «Борщ». Категория блюда: Суп. Используй классические ингредиенты и их граммовку (нетто на 1 порцию).\n\nВерни ТОЛЬКО JSON без лишнего текста, без markdown, без комментариев, строго по схеме:\n{"ingredients":[{"name":"Название ингредиента","quantity":число в граммах,"unit":"г"}],"kbju_per_100g":{"calories":число,"proteins":число,"fats":число,"carbs":число},"output":число,"technology":"Пошаговая технология","cooking_time":число,"temperature":"Температура подачи","shelf_life":"Срок годности"}`
        : 'Say OK';
      const body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: isReasoning ? 3000 : 1000 });
      const r = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body,
        signal: AbortSignal.timeout(90000),
      });
      const t = await r.text();
      const j = JSON.parse(t);
      const msg = j.choices?.[0]?.message || {};
      const text = msg.content || msg.reasoning_content || msg.reasoning || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      let jsonPart = '';
      let parseOk = false;
      if (start !== -1 && end !== -1) {
        try { jsonPart = text.slice(start, end + 1); JSON.parse(jsonPart); parseOk = true; } catch {}
      }
      results.push({ model, time: Date.now() - s, status: r.status, hasContent: !!text, contentLen: text.length, startIdx: start, endIdx: end, parseOk, content: text.substring(0, 200) + '...mid...' + text.substring(Math.max(0, text.length - 300)) });
    } catch (e) {
      results.push({ model, time: Date.now() - s, error: e.message });
    }
  }
  res.json({ results });
});

// ─── AI Generate Tech Card ──────────────────────────────
app.post('/api/tech-cards/ai-generate', async (req, res) => {
  try {
    const { dish_name } = req.body;
    if (!dish_name || !dish_name.trim()) return res.status(400).json({ error: 'Введите название блюда' });

    const aiService = require('../services/ai-tech-card.service');
    const result = await aiService.generateTechCard(dish_name.trim());

    // Match ingredients with stock
    const tenantId = db.prepare('SELECT current_tenant_id() as tid').get()?.tid || 1;
    const { matched, unmatched } = aiService.matchIngredientsWithStock(result.ingredients, db, tenantId);

    aiService.logAIRequest(db, 'generate', dish_name, result, null);

    res.json({
      dish_name: dish_name.trim(),
      ingredients: result.ingredients,
      matched_ingredients: matched,
      unmatched_ingredients: unmatched,
      kbju_per_100g: result.kbju_per_100g,
      output: result.output,
      technology: result.technology,
      cooking_time: result.cooking_time,
      source: result.source,
    });
  } catch (e) {
    const aiService = require('../services/ai-tech-card.service');
    aiService.logAIRequest(db, 'generate', req.body?.dish_name, null, e.message || e);
    const msg = e.errors ? `Не удалось сгенерировать техкарту. TheMealDB: ${e.errors[0]?.error || 'ошибка'}. OpenCode: ${e.errors.slice(1,6).map(x => `${x.source}: ${x.error}`).join('; ') || 'недоступен'}.` : (e.message || 'Ошибка генерации');
    res.status(500).json({ error: msg });
  }
});

// ─── AI Save Generated Tech Card ───────────────────────
app.post('/api/tech-cards/ai-save', (req, res) => {
  try {
    const { dish_name, ingredients, kbju_per_100g, output, technology, cooking_time, matched_ingredients, unmatched_ingredients, menu_category } = req.body;
    if (!dish_name) return res.status(400).json({ error: 'dish_name is required' });

    const tenantId = db.prepare('SELECT current_tenant_id() as tid').get()?.tid || 1;

    // Check subscription limit
    const user = req.user;
    if (user && user.role !== 'superadmin' && user.role !== 'owner') {
      const subscription = db.prepare('SELECT s.*, t.max_cards FROM subscriptions s LEFT JOIN tariffs t ON t.id = s.tariff_id WHERE s.tenant_id = ? AND s.status = ? ORDER BY s.end_date DESC LIMIT 1').get(tenantId, 'active');
      const totalCards = db.prepare('SELECT COUNT(*) as count FROM dish_tech_cards WHERE tenant_id = ? AND is_active = 1').get(tenantId)?.count || 0;
      const maxCards = subscription ? subscription.max_cards : 3;

      if (maxCards !== -1 && totalCards >= maxCards) {
        return res.status(403).json({ error: `Лимит техкарт исчерпан (${maxCards}). Оформите подписку для создания новых.` });
      }
    }

    const aiService = require('../services/ai-tech-card.service');

    // Find or create menu item (dish) with category
    const totalCost = 0; // calculated after ingredients
    const menuItem = aiService.findOrCreateMenuItem(db, dish_name, 0, 0, menu_category || 'Общая', tenantId);
    const dishId = menuItem.id;
    let menuCreated = menuItem.created;

    if (!dishId) return res.status(500).json({ error: 'Не удалось создать блюдо' });

    // Check for existing active tech card
    const existing = db.prepare('SELECT id, version FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dishId);
    const newVersion = existing ? existing.version + 1 : 1;
    if (existing) {
      db.prepare('UPDATE dish_tech_cards SET is_active = 0 WHERE id = ?').run(existing.id);
    }

    // Auto-create inventory items for unmatched ingredients with stock categories
    const createdInvNames = [];
    const createdCategoryNames = new Set();
    for (const ing of [...(unmatched_ingredients || []), ...(ingredients || []).filter(i => !i.item_id)]) {
      if (ing.item_id) continue;
      const ingName = ing.item_name || ing.name;
      // Detect and create stock category
      const catName = aiService.detectStockCategoryName(ingName);
      let catId = null;
      if (catName) {
        const cat = aiService.findOrCreateStockCategory(db, catName, tenantId);
        if (cat) {
          catId = cat.id;
          if (cat.created) createdCategoryNames.add(cat.name);
        }
      }
      const item = aiService.findOrCreateInventoryItem(db, ingName, ing.unit || 'г', tenantId, catId);
      if (item) {
        ing.item_id = Number(item.id);
        ing.price_per_unit = item.price_per_unit || 0;
        ing.cost = ((item.price_per_unit || 0) * (ing.quantity || 0)) / 1000;
        if (item.created) createdInvNames.push(item.name);
      }
    }

    // Prepare merged ingredients
    const allIngredients = (matched_ingredients || []).concat(unmatched_ingredients || []);
    if (allIngredients.length === 0 && ingredients) {
      for (const ing of ingredients) {
        allIngredients.push({ item_id: ing.item_id, item_name: ing.item_name || ing.name, quantity: ing.quantity, unit: ing.unit || 'г', price_per_unit: 0, cost: 0 });
      }
    }

    // Calculate total cost
    let calculatedCost = 0;
    for (const ing of allIngredients) {
      calculatedCost += (ing.cost || ((ing.price_per_unit || 0) * (ing.quantity || 0) / 1000));
    }

    const kbju = kbju_per_100g || {};
    const techText = technology || '';
    const outputVal = parseFloat(output) || 300;
    const cookTime = parseInt(cooking_time) || 0;

    // Insert tech card
    const tc = db.prepare(`INSERT INTO dish_tech_cards
      (dish_id, dish_name, number, valid_from, portions, output, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id, version, is_active, cooking_time, description, updated_at)
      VALUES (?, ?, NULL, NULL, 1, ?, ?, 0, 0, ?, datetime('now'), ?, 1, 1, ?, ?, datetime('now'))`).run(
      dishId, dish_name, outputVal, techText, Math.round(calculatedCost * 100) / 100, tenantId, cookTime, JSON.stringify(kbju)
    );
    const techCardId = tc.lastInsertRowid;

    // Insert ingredients
    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)`);

    for (const ing of allIngredients) {
      insertIng.run(techCardId, ing.item_id, ing.item_name || ing.name, ing.quantity || 0, ing.unit || 'г', tenantId);
    }
    try {
      db.prepare('UPDATE dishes SET price = ?, cost = ?, calories = ?, proteins = ?, fats = ?, carbs = ? WHERE id = ?').run(
        0, Math.round(calculatedCost * 100) / 100,
        kbju.calories || 0, kbju.proteins || 0, kbju.fats || 0, kbju.carbs || 0, dishId
      );
    } catch {}

    aiService.logAIRequest(db, 'save', dish_name, { techCardId, dishId }, null);

    res.json({
      id: techCardId, dish_id: dishId, version: newVersion,
      totalCost: Math.round(calculatedCost * 100) / 100,
      createdItems: createdInvNames,
      createdCategories: Array.from(createdCategoryNames),
      menuItemCreated: menuCreated,
      menuItemId: dishId,
    });
  } catch (e) {
    const aiService = require('../services/ai-tech-card.service');
    aiService.logAIRequest(db, 'save', req.body?.dish_name, null, e.message || e);
    res.status(500).json({ error: safeError(e.message) });
  }
});
};