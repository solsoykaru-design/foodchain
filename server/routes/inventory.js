
module.exports = function(app, db, config) {
  const { safeError, toCamelCase, toCamelCaseArray } = config;

app.get('/api/inventory-items', (req, res) => {
  try {
    let baseSql = 'SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance, COALESCE(ii.last_price, ii.price_per_unit, 0) as lastPrice, (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) > 0 as hasTechCard FROM inventory_items ii WHERE ii.tenant_id = current_tenant_id()';
    const params = [];
    const { warehouse, category, category_id, include_subcategories, tech_card, contragent, page = 1, limit = 20 } = req.query;

    if (category_id) {
      if (include_subcategories === 'true') {
        const childIds = [];
        const stack = [Number(category_id)];
        while (stack.length) {
          const pid = stack.pop();
          childIds.push(pid);
          const kids = db.prepare('SELECT id FROM stock_categories WHERE parent_id = ?').all(pid);
          kids.forEach(k => stack.push(k.id));
        }
        baseSql += ` AND (ii.category_id IN (${childIds.map(() => '?').join(',')}) OR ii.id IN (SELECT id FROM inventory_items WHERE category_id IN (${childIds.map(() => '?').join(',')})))`;
        params.push(...childIds, ...childIds);
      } else {
        baseSql += ' AND ii.category_id = ?';
        params.push(Number(category_id));
      }
    } else {
      if (warehouse) { baseSql += ' AND ii.branch_name LIKE ?'; params.push(`%${warehouse}%`); }
      if (category) { baseSql += ' AND (ii.category_name LIKE ? OR CAST(ii.category_id AS TEXT) = ?)'; params.push(`%${category}%`, category); }
      if (tech_card === 'has') baseSql += ' AND (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) > 0';
      else if (tech_card === 'none') baseSql += ' AND (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) = 0';
      if (contragent) { baseSql += ' AND ii.contragent_name LIKE ?'; params.push(`%${contragent}%`); }
    }

    const whereClause = baseSql.split(/WHERE\s+ii\.tenant_id\s*=\s*current_tenant_id\(\)/)[1] || '';
    const countSql = `SELECT COUNT(*) as total FROM inventory_items ii WHERE ii.tenant_id = current_tenant_id()${whereClause}`;
    const total = db.prepare(countSql).get(...params)?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / Number(limit)));

    baseSql += ' ORDER BY ii.name ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const items = db.prepare(baseSql).all(...params);
    const result = items.map(i => {
      const b = i.branch_id ? db.prepare('SELECT name FROM branches WHERE id = ?').get(i.branch_id) : null;
      const s = i.supplier_id ? db.prepare('SELECT name FROM suppliers WHERE id = ?').get(i.supplier_id) : null;
      const cat = db.prepare('SELECT name FROM menu_categories WHERE id = ?').get(i.category);
      return {
        id: i.id, name: i.name, category: i.category_name || i.category || cat?.name || '',
        unit: i.unit || 'шт', barcode: i.barcode || '',
        brutto: i.brutto || 0, netto: i.netto || 0,
        currentBalance: i.currentBalance, documentQuantity: i.document_quantity || 0,
        pricePerUnit: i.lastPrice || i.price_per_unit || 0,
        branchId: i.branch_id, branchName: i.branch_name || b?.name || '',
        supplierId: i.supplier_id, supplierName: i.contragent_name || s?.name || '',
        isIngredient: i.is_ingredient ? true : false,
        hasTechCard: i.hasTechCard ? true : false,
        minStock: i.min_stock || 0,
      };
    });
    res.json({ items: result, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/inventory-items', (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !b.unit) return res.status(400).json({ error: 'Название и единица измерения обязательны' });
    const tenantId = req.tenant_id || null;
    const branchName = b.branch_id ? db.prepare('SELECT name FROM branches WHERE id = ?').get(b.branch_id)?.name || null : null;
    const info = db.prepare(`INSERT INTO inventory_items (
      name, unit, barcode, current_balance, last_price, price_per_unit, branch_id,
      category_name, category_id, supplier_id, is_ingredient, branch_name,
      brutto, netto, cold_loss_percent, weight_by_tech_card, article, gtin,
      base_price, with_vat, tax_rate, kcal, proteins, fats, carbs,
      calories_by_tech_card, heat_treatment, is_returnable, exclude_neg_control,
      beer_type, alcohol_type, tobacco_type, sugar_type, id_1c, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`).run(
      b.name, b.unit, b.barcode || null, b.current_balance || 0,
      b.price_per_unit || 0, b.price_per_unit || 0,
      b.branch_id || null, b.category || null, b.category_id || null,
      b.supplier_id || null, b.is_ingredient ? 1 : 0, branchName,
      b.brutto || 0, b.netto || 0, b.cold_loss_percent || 0,
      b.weight_by_tech_card ? 1 : 0, b.article || null, b.gtin || null,
      b.base_price || 0, b.with_vat ? 1 : 0, b.tax_rate || 'Без НДС',
      b.kcal || 0, b.proteins || 0, b.fats || 0, b.carbs || 0,
      b.calories_by_tech_card ? 1 : 0, b.heat_treatment ? 1 : 0,
      b.is_returnable ? 1 : 0, b.exclude_neg_control ? 1 : 0,
      b.beer_type ? 1 : 0, b.alcohol_type ? 1 : 0,
      b.tobacco_type ? 1 : 0, b.sugar_type ? 1 : 0, b.id_1c || null, tenantId
    );
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ id: item.id, name: item.name, unit: item.unit });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/inventory-items/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const { name, unit, barcode, current_balance, price_per_unit, branch_id, category, supplier_id, is_ingredient } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (barcode !== undefined) { sets.push('barcode = ?'); params.push(barcode); }
    if (current_balance !== undefined) { sets.push('current_balance = ?'); params.push(current_balance); }
    if (price_per_unit !== undefined) { sets.push('last_price = ?'); sets.push('price_per_unit = ?'); params.push(price_per_unit); params.push(price_per_unit); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); sets.push("branch_name = (SELECT name FROM branches WHERE id = ?)"); params.push(branch_id); params.push(branch_id); }
    if (category !== undefined) { sets.push('category_name = ?'); params.push(category); }
    if (supplier_id !== undefined) { sets.push('supplier_id = ?'); params.push(supplier_id); }
    if (is_ingredient !== undefined) { sets.push('is_ingredient = ?'); params.push(is_ingredient ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/inventory-items/import', (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Нет данных для импорта' });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name) {
        errors.push(`Строка ${i + 1}: отсутствует название`);
        continue;
      }

      try {
        const existing = db.prepare('SELECT id FROM inventory_items WHERE name = ?').get(row.name);
        if (existing) {
          db.prepare(`UPDATE inventory_items SET
            category = COALESCE(?, category),
            unit = COALESCE(?, unit),
            price_per_unit = COALESCE(?, price_per_unit),
            current_stock = COALESCE(?, current_stock),
            article = COALESCE(?, article),
            barcode = COALESCE(?, barcode)
            WHERE id = ?`).run(
              row.category || null, row.unit || null,
              row.price_per_unit || 0, row.current_stock || 0,
              row.article || null, row.barcode || null,
              existing.id
            );
          imported.push(existing.id);
        } else {
          const info = db.prepare(`INSERT INTO inventory_items (name, category, unit, price_per_unit, current_stock, article, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            row.name, row.category || '', row.unit || 'шт',
            row.price_per_unit || 0, row.current_stock || 0,
            row.article || '', row.barcode || ''
          );
          imported.push(info.lastInsertRowid);
        }
      } catch (e) {
        errors.push(`Строка ${i + 1} («${row.name}»): ${e.message}`);
      }
    }

    res.json({ imported: imported.length, errors });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/stock-item/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json({
      id: item.id, name: item.name, createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      category: item.category_name || item.category || '', unit: item.unit || 'шт',
      brutto: item.brutto || 0, netto: item.netto || 0, coldLossPercent: item.cold_loss_percent || 0,
      weightByTechCard: !!item.weight_by_tech_card, barcode: item.barcode || '',
      article: item.article || '', gtin: item.gtin || '',
      basePrice: item.base_price || item.price_per_unit || 0, withVat: !!item.with_vat,
      taxRate: item.tax_rate || 'Без НДС', currentCost: item.price_per_unit || 0,
      lastPrice: item.last_price || item.price_per_unit || 0,
      kcal: item.kcal || 0, proteins: item.proteins || 0, fats: item.fats || 0, carbs: item.carbs || 0,
      caloriesByTechCard: !!item.calories_by_tech_card, heatTreatment: !!item.heat_treatment,
      isReturnable: !!item.is_returnable, excludeNegControl: !!item.exclude_neg_control,
      beerType: !!item.beer_type, alcoholType: !!item.alcohol_type, tobaccoType: !!item.tobacco_type, sugarType: !!item.sugar_type,
      id1c: item.id_1c || '',
      isMain: !!item.is_main,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/stock-item/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const b = req.body;
    const updates = [];
    const vals = [];
    if (b.name !== undefined) { updates.push('name = ?'); vals.push(b.name); }
    if (b.category !== undefined) { updates.push('category_name = ?'); vals.push(b.category); }
    if (b.unit !== undefined) { updates.push('unit = ?'); vals.push(b.unit); }
    if (b.brutto !== undefined) { updates.push('brutto = ?'); vals.push(b.brutto); }
    if (b.netto !== undefined) { updates.push('netto = ?'); vals.push(b.netto); }
    if (b.coldLossPercent !== undefined) { updates.push('cold_loss_percent = ?'); vals.push(b.coldLossPercent); }
    else if (b.cold_loss_percent !== undefined) { updates.push('cold_loss_percent = ?'); vals.push(b.cold_loss_percent); }
    if (b.weightByTechCard !== undefined) { updates.push('weight_by_tech_card = ?'); vals.push(b.weightByTechCard ? 1 : 0); }
    else if (b.weight_by_tech_card !== undefined) { updates.push('weight_by_tech_card = ?'); vals.push(b.weight_by_tech_card ? 1 : 0); }
    if (b.barcode !== undefined) { updates.push('barcode = ?'); vals.push(b.barcode); }
    if (b.article !== undefined) { updates.push('article = ?'); vals.push(b.article); }
    if (b.gtin !== undefined) { updates.push('gtin = ?'); vals.push(b.gtin); }
    if (b.base_price !== undefined) { updates.push('base_price = ?'); vals.push(b.base_price); }
    if (b.withVat !== undefined) { updates.push('with_vat = ?'); vals.push(b.withVat ? 1 : 0); }
    else if (b.with_vat !== undefined) { updates.push('with_vat = ?'); vals.push(b.with_vat ? 1 : 0); }
    if (b.taxRate !== undefined) { updates.push('tax_rate = ?'); vals.push(b.taxRate); }
    else if (b.tax_rate !== undefined) { updates.push('tax_rate = ?'); vals.push(b.tax_rate); }
    if (b.kcal !== undefined) { updates.push('kcal = ?'); vals.push(b.kcal); }
    if (b.proteins !== undefined) { updates.push('proteins = ?'); vals.push(b.proteins); }
    if (b.fats !== undefined) { updates.push('fats = ?'); vals.push(b.fats); }
    if (b.carbs !== undefined) { updates.push('carbs = ?'); vals.push(b.carbs); }
    if (b.caloriesByTechCard !== undefined) { updates.push('calories_by_tech_card = ?'); vals.push(b.caloriesByTechCard ? 1 : 0); }
    else if (b.calories_by_tech_card !== undefined) { updates.push('calories_by_tech_card = ?'); vals.push(b.calories_by_tech_card ? 1 : 0); }
    if (b.heatTreatment !== undefined) { updates.push('heat_treatment = ?'); vals.push(b.heatTreatment ? 1 : 0); }
    else if (b.heat_treatment !== undefined) { updates.push('heat_treatment = ?'); vals.push(b.heat_treatment ? 1 : 0); }
    if (b.isReturnable !== undefined) { updates.push('is_returnable = ?'); vals.push(b.isReturnable ? 1 : 0); }
    else if (b.is_returnable !== undefined) { updates.push('is_returnable = ?'); vals.push(b.is_returnable ? 1 : 0); }
    if (b.excludeNegControl !== undefined) { updates.push('exclude_neg_control = ?'); vals.push(b.excludeNegControl ? 1 : 0); }
    else if (b.exclude_neg_control !== undefined) { updates.push('exclude_neg_control = ?'); vals.push(b.exclude_neg_control ? 1 : 0); }
    if (b.beerType !== undefined) { updates.push('beer_type = ?'); vals.push(b.beerType ? 1 : 0); }
    else if (b.beer_type !== undefined) { updates.push('beer_type = ?'); vals.push(b.beer_type ? 1 : 0); }
    if (b.alcoholType !== undefined) { updates.push('alcohol_type = ?'); vals.push(b.alcoholType ? 1 : 0); }
    else if (b.alcohol_type !== undefined) { updates.push('alcohol_type = ?'); vals.push(b.alcohol_type ? 1 : 0); }
    if (b.tobaccoType !== undefined) { updates.push('tobacco_type = ?'); vals.push(b.tobaccoType ? 1 : 0); }
    else if (b.tobacco_type !== undefined) { updates.push('tobacco_type = ?'); vals.push(b.tobacco_type ? 1 : 0); }
    if (b.sugarType !== undefined) { updates.push('sugar_type = ?'); vals.push(b.sugarType ? 1 : 0); }
    else if (b.sugar_type !== undefined) { updates.push('sugar_type = ?'); vals.push(b.sugar_type ? 1 : 0); }
    if (b.id1c !== undefined) { updates.push('id_1c = ?'); vals.push(b.id1c); }
    else if (b.id_1c !== undefined) { updates.push('id_1c = ?'); vals.push(b.id_1c); }
    if (b.isMain !== undefined) { updates.push('is_main = ?'); vals.push(b.isMain ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    vals.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/tech-cards', (req, res) => {
  try {
    let sql = `SELECT tc.*,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count,
      (SELECT SUM(cost) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_cost,
      (SELECT SUM(yield) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_ing_yield
      FROM tech_cards tc WHERE tc.item_id = ? AND tc.tenant_id = current_tenant_id()`;
    const params = [req.params.id];
    if (req.query.store) { sql += ' AND tc.store LIKE ?'; params.push(`%${req.query.store}%`); }
    if (req.query.current_only) { sql += " AND (tc.valid_from IS NULL OR tc.valid_from <= date('now')) AND (tc.expiry_date IS NULL OR tc.expiry_date >= date('now'))"; }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY tc.created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items: toCamelCaseArray(items), total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/stock-item/:id/tech-cards', (req, res) => {
  try {
    const info = db.prepare('INSERT INTO tech_cards (item_id, number, output, cost_price, type, store) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.params.id, req.body.number || 'TC-001', req.body.output || 0, req.body.cost_price || 0, req.body.type || '', req.body.store || '');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/stock-item/:id/tech-cards/:cardId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_cards WHERE id = ? AND item_id = ?').run(req.params.cardId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/tech-cards-as-ingredient', (req, res) => {
  try {
    const sql = `SELECT DISTINCT tc.*, tci.item_name as ing_name, tci.quantity as ing_qty, tci.unit as ing_unit,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count,
      (SELECT SUM(cost) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_cost,
      (SELECT SUM(yield) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_ing_yield
      FROM tech_cards tc
      JOIN tech_card_ingredients tci ON tc.id = tci.tech_card_id
      WHERE tci.item_id = ? AND tc.tenant_id = current_tenant_id()
      ORDER BY tc.created_at DESC`;
    const items = db.prepare(sql).all(req.params.id);
    res.json({ items: toCamelCaseArray(items) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-items/search', (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 1) return res.json([]);
    const items = db.prepare(`SELECT id, name, unit, brutto, netto, cold_loss_percent, price_per_unit, category_name FROM inventory_items WHERE name LIKE ? LIMIT 20`).all(`%${q}%`);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/breakdown-tech-cards', (req, res) => {
  try {
    let sql = "SELECT * FROM tech_cards WHERE item_id = ? AND type = 'breakdown'";
    const params = [req.params.id];
    if (req.query.store) { sql += ' AND store LIKE ?'; params.push(`%${req.query.store}%`); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/packagings', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM packaging WHERE item_id = ? ORDER BY id').all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/stock-item/:id/packagings', (req, res) => {
  try {
    const { name, barcode, isPrimary, size } = req.body;
    const info = db.prepare('INSERT INTO packaging (item_id, name, barcode, is_primary, size) VALUES (?, ?, ?, ?, ?)').run(
      req.params.id, name || '', barcode || '', isPrimary ? 1 : 0, size || 1);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/stock-item/:id/packagings/:packId', (req, res) => {
  try {
    const sets = []; const vals = [];
    if (req.body.name !== undefined) { sets.push('name = ?'); vals.push(req.body.name); }
    if (req.body.barcode !== undefined) { sets.push('barcode = ?'); vals.push(req.body.barcode); }
    if (req.body.isPrimary !== undefined) { sets.push('is_primary = ?'); vals.push(req.body.isPrimary ? 1 : 0); }
    if (req.body.size !== undefined) { sets.push('size = ?'); vals.push(req.body.size); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.packId);
    db.prepare(`UPDATE packaging SET ${sets.join(', ')} WHERE id = ? AND item_id = ?`).run(...vals, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/stock-item/:id/packagings/:packId', (req, res) => {
  try {
    db.prepare('DELETE FROM packaging WHERE id = ? AND item_id = ?').run(req.params.packId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/composition', (req, res) => {
  try {
    // For now return empty - requires recipe/tech_card_items table
    res.json([]);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/batches', (req, res) => {
  try {
    let sql = 'SELECT * FROM batches WHERE item_id = ?';
    const params = [req.params.id];
    if (req.query.warehouse) { sql += ' AND warehouse LIKE ?'; params.push(`%${req.query.warehouse}%`); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY arrival_date DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/contragents', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM stock_contragents WHERE item_id = ? ORDER BY id').all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/stock-item/:id/contragents', (req, res) => {
  try {
    const info = db.prepare('INSERT INTO stock_contragents (item_id, contragent_name) VALUES (?, ?)').run(req.params.id, req.body.name || '');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/stock-item/:id/contragents/:contragentId', (req, res) => {
  try {
    db.prepare('DELETE FROM stock_contragents WHERE id = ? AND item_id = ?').run(req.params.contragentId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/history', (req, res) => {
  try {
    let sql = "SELECT * FROM inventory_transactions WHERE item_id = ?";
    const params = [req.params.id];
    if (req.query.warehouse) { sql += ' AND (note LIKE ? OR item_id = ?)'; params.push(`%${req.query.warehouse}%`, req.params.id); }
    if (req.query.doc_type) { sql += ' AND type = ?'; params.push(req.query.doc_type); }
    if (req.query.date_from) { sql += " AND created_at >= ?"; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += " AND created_at <= ?"; params.push(req.query.date_to + ' 23:59:59'); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    const mapped = items.map(i => ({
      id: i.id, date: i.created_at, document: i.document_number || i.note || '',
      warehouse: '', change: i.quantity || 0, price: i.price_per_unit || 0,
      docQuantity: i.quantity || 0,
    }));
    res.json({ items: mapped, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/stock-item/:id/warehouse-bindings', (req, res) => {
  try {
    let sql = 'SELECT * FROM warehouse_bindings WHERE item_id = ?';
    const params = [req.params.id];
    if (req.query.only_bound) { sql += ' AND is_bound = 1'; }
    if (req.query.search) { sql += ' AND warehouse_name LIKE ?'; params.push(`%${req.query.search}%`); }
    const items = db.prepare(sql + ' ORDER BY id').all(...params);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/stock-item/:id/warehouse-bindings/:bindingId', (req, res) => {
  try {
    const sets = []; const vals = [];
    if (req.body.is_bound !== undefined) { sets.push('is_bound = ?'); vals.push(req.body.is_bound ? 1 : 0); }
    if (req.body.min_qty !== undefined) { sets.push('min_qty = ?'); vals.push(req.body.min_qty); }
    if (req.body.max_qty !== undefined) { sets.push('max_qty = ?'); vals.push(req.body.max_qty); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    vals.push(req.params.bindingId);
    db.prepare(`UPDATE warehouse_bindings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/stock-item/:id/warehouse-bindings/bind-all', (req, res) => {
  try {
    const existing = db.prepare('SELECT warehouse_id FROM warehouse_bindings WHERE item_id = ?').all(req.params.id).map(r => r.warehouse_id);
    const allBranches = db.prepare('SELECT id, name FROM branches').all();
    for (const branch of allBranches) {
      if (!existing.includes(branch.id)) {
        db.prepare('INSERT INTO warehouse_bindings (item_id, warehouse_id, warehouse_name, is_bound, min_qty, max_qty) VALUES (?, ?, ?, 1, 0, 0)').run(req.params.id, branch.id, branch.name);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/inventory', (req, res) => {
  try {
    let sql = 'SELECT * FROM inventory_items WHERE 1=1';
    const params = [];
    if (req.query.category) { sql += ' AND category = ?'; params.push(req.query.category); }
    sql += ' ORDER BY name ASC';
    const items = db.prepare(sql).all(...params);
    const result = items.map(i => {
      let supplierName = null;
      if (i.supplier_id) {
        const s = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(i.supplier_id);
        if (s) supplierName = s.name;
      }
      const balance = i.current_balance ?? i.current_stock ?? 0;
      return toCamelCase({ ...i, currentBalance: balance });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/inventory', (req, res) => {
  try {
    const { name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id } = req.body;
    if (!name || !unit) return res.status(400).json({ error: 'Название и единица измерения обязательны' });
    const info = db.prepare('INSERT INTO inventory_items (name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, category || 'ingredient', unit, price_per_unit || 0, current_balance || 0, supplier_id || null, expiry_date || null, branch_id || null
    );
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase({ ...item, currentBalance: item.current_balance ?? 0 }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/inventory/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const { name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (category !== undefined) { sets.push('category = ?'); params.push(category); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (price_per_unit !== undefined) {
      if (Number(price_per_unit) !== Number(existing.price_per_unit)) {
        db.prepare('INSERT INTO price_history (item_id, old_price, new_price) VALUES (?, ?, ?)').run(req.params.id, existing.price_per_unit, Number(price_per_unit));
      }
      sets.push('price_per_unit = ?'); params.push(price_per_unit);
    }
    if (current_balance !== undefined) { sets.push('current_balance = ?'); params.push(current_balance); }
    if (supplier_id !== undefined) { sets.push('supplier_id = ?'); params.push(supplier_id); }
    if (expiry_date !== undefined) { sets.push('expiry_date = ?'); params.push(expiry_date); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    res.json(toCamelCase({ ...item, currentBalance: item.current_balance ?? 0 }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/inventory/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const id = req.params.id;
    const del = db.transaction(() => {
      db.prepare('DELETE FROM inventory_transactions WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM forecasts WHERE product_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM packaging WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM stock_contragents WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM batches WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM warehouse_bindings WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM price_history WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM tech_card_ingredients WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM tech_cards WHERE item_id = ? /* current_tenant_id */').run(id);
      db.prepare('DELETE FROM inventory_items WHERE id = ? AND tenant_id = current_tenant_id()').run(id);
    });
    del();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/inventory/:id error:', e);
    res.status(500).json({ error: 'Невозможно удалить элемент: ' + e.message });
  }
});
app.get('/api/inventory/transactions', (req, res) => {
  try {
    const { item_id } = req.query;
    let sql = 'SELECT * FROM inventory_transactions WHERE 1=1';
    const params = [];
    if (item_id) { sql += ' AND item_id = ?'; params.push(Number(item_id)); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(transactions));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/inventory/transactions', (req, res) => {
  try {
    const { item_id, type, quantity, price_per_unit, total, supplier_id, supplier_name, note, document_number } = req.body;
    if (!item_id || !type || !quantity) return res.status(400).json({ error: 'ID товара, тип и количество обязательны' });
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    const qty = Number(quantity);
    const info = db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_id, supplier_name, note, document_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      item_id, type, qty, price_per_unit || 0, total || (qty * (price_per_unit || 0)), supplier_id || null, supplier_name || null, note || '', document_number || ''
    );
    if (type === 'incoming') {
      db.prepare('UPDATE inventory_items SET current_balance = COALESCE(current_balance, 0) + ? WHERE id = ?').run(qty, item_id);
    } else if (type === 'outgoing' || type === 'write_off') {
      db.prepare('UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?').run(qty, item_id);
    }
    const transaction = db.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(transaction));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/inventory/price-history/:id', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM price_history WHERE item_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    res.json(toCamelCaseArray(history));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/forecast', (req, res) => {
  try {
    const { product_id, from_date, to_date } = req.query;
    let sql = `SELECT f.*, i.name as product_name, i.unit, i.current_stock, i.min_stock, COALESCE(f.recommended_purchase, 0) as recommended_purchase
      FROM forecasts f
      LEFT JOIN inventory_items i ON f.product_id = i.id
      WHERE f.tenant_id = current_tenant_id()`;
    const params = [];
    if (product_id) { sql += ' AND f.product_id = ?'; params.push(Number(product_id)); }
    if (from_date) { sql += ' AND f.forecast_date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND f.forecast_date <= ?'; params.push(to_date); }
    sql += ' ORDER BY f.product_id, f.forecast_date';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/forecast/generate', (req, res) => {
  try {
    const result = forecastService.generateForecast(db, req.body.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/forecast/history', (req, res) => {
  try {
    const { product_id, days } = req.query;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const limit = days ? Number(days) : 90;
    const rows = db.prepare(`
      SELECT DATE(created_at) as date, SUM(quantity) as qty
      FROM inventory_transactions
      WHERE item_id = ? AND type = 'writeoff'
        AND created_at >= datetime('now', ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(Number(product_id), `-${limit}`);
    res.json(rows.map(r => ({ date: r.date, quantity: Math.abs(r.qty || 0) })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/forecast/adjust', (req, res) => {
  try {
    const { forecast_id, quantity } = req.body;
    if (!forecast_id || quantity === undefined) return res.status(400).json({ error: 'forecast_id and quantity are required' });
    db.prepare('UPDATE forecasts SET forecast_quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(quantity, forecast_id);
    const updated = db.prepare('SELECT * FROM forecasts WHERE id = ?').get(forecast_id);
    res.json(toCamelCase(updated));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/inventory/by-barcode/:barcode', (req, res) => {
  try {
    const item = db.prepare("SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance FROM inventory_items ii WHERE ii.barcode = ? LIMIT 1").get(req.params.barcode);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/inventory-items/by-barcode/:barcode', (req, res) => {
  try {
    const item = db.prepare("SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance FROM inventory_items ii WHERE ii.barcode = ? LIMIT 1").get(req.params.barcode);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json({ ...item, currentBalance: item.currentBalance, barcode: item.barcode || '' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/barcode/generate', (req, res) => {
  const { type } = req.query;
  const base = '20' + String(Date.now()).slice(-10) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const ean13 = base.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(ean13[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  const fullBarcode = ean13 + check;
  res.json({ barcode: fullBarcode, type: 'ean13' });
});
app.get('/api/barcode/print', (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'Missing ids' });
  const idList = ids.split(',').map(Number);
  const placeholders = idList.map(() => '?').join(',');
  const items = db.prepare(`SELECT id, name, barcode, unit FROM inventory_items WHERE id IN (${placeholders})`).all(...idList);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Печать этикеток</title>
  <style>
    @page { margin: 0; size: 210mm 297mm; }
    body { margin: 10mm; font-family: 'Courier New', monospace; }
    .label-sheet { display: grid; grid-template-columns: repeat(3, 63.5mm); gap: 2mm; }
    .label { border: 1px solid #ccc; padding: 4mm; text-align: center; page-break-inside: avoid; }
    .label .name { font-size: 10px; font-weight: bold; margin-bottom: 2mm; word-wrap: break-word; }
    .label .barcode-img { margin: 2mm auto; display: block; }
    .label .barcode-text { font-size: 12px; letter-spacing: 2px; }
    .label .unit { font-size: 9px; color: #666; margin-top: 1mm; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="no-print" style="margin-bottom:10mm;"><button onclick="window.print()">Печать</button> <button onclick="window.close()">Закрыть</button></div>
  <div class="label-sheet">
    ${items.map(item => `
    <div class="label">
      <div class="name">${item.name}</div>
      <div class="barcode-text">${item.barcode || '—'}</div>
      <div class="unit">${item.unit || ''}</div>
    </div>`).join('')}
  </div>
  <script>window.onload=setTimeout(()=>{window.print()},500);</script>
  </body></html>`);
});
};