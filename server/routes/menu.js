
module.exports = function(app, db, config) {
  const { safeError, toCamelCase, toCamelCaseArray } = config;

app.get('/api/menu-items', (req, res) => {
  try {
    const {
      category_id, store_id, tech_card_filter = 'all', type = 'all',
      search, sort_by = 'name', sort_order = 'asc',
      page = 1, limit = 20,
    } = req.query;

    let baseSql = `FROM dishes d LEFT JOIN menu_categories mc ON d.category_id = mc.id`;
    const params = [];

    // category filter
    if (category_id) { baseSql += ' WHERE d.category_id = ?'; params.push(Number(category_id)); }
    else { baseSql += ' WHERE 1=1'; }
    baseSql += ' AND d.tenant_id = ?'; params.push(req.tenant_id);

    // store filter
    if (store_id) { baseSql += ' AND d.branch_id = ?'; params.push(Number(store_id)); }

    // type filter
    if (type && type !== 'all') { baseSql += ' AND d.type = ?'; params.push(type); }

    // tech_card filter
    if (tech_card_filter === 'yes') {
      baseSql += ' AND d.id IN (SELECT DISTINCT dish_id FROM tech_cards WHERE dish_id IS NOT NULL)';
    } else if (tech_card_filter === 'no') {
      baseSql += ' AND d.id NOT IN (SELECT DISTINCT dish_id FROM tech_cards WHERE dish_id IS NOT NULL)';
    }

    // search
    if (search) {
      const s = `%${search}%`;
      baseSql += ' AND (d.name LIKE ? OR d.article LIKE ? OR d.barcode LIKE ?)';
      params.push(s, s, s);
    }

    // count total
    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseSql}`).get(...params);
    const total = countRow.total;

    // sorting (whitelist for safety)
    const allowedSort = ['name', 'price', 'cost', 'weight', 'netto', 'barcode', 'article', 'unit', 'type', 'is_available', 'created_at', 'markup'];
    let sb = allowedSort.includes(sort_by) ? sort_by : 'name';
    const so = sort_order === 'desc' ? 'DESC' : 'ASC';

    // special handling for markup sort (computed field)
    let orderClause;
    if (sb === 'markup') {
      orderClause = `ORDER BY ${so === 'DESC' ? '(CASE WHEN d.price > 0 THEN (d.price - COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0)) / d.price * 100 ELSE 0 END) DESC' : '(CASE WHEN d.price > 0 THEN (d.price - COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0)) / d.price * 100 ELSE 0 END) ASC'}`;
    } else {
      orderClause = `ORDER BY d.${sb} ${so}`;
    }

    // pagination
    const p = Math.max(1, Number(page));
    const l = Math.min(200, Math.max(1, Number(limit)));
    const offset = (p - 1) * l;

    const sql = `SELECT d.*, mc.name as categoryName, COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0) as cost ${baseSql} ${orderClause} LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, l, offset);

    // compute markup for each item
    const result = items.map(item => {
      const camel = toCamelCase(item);
      camel.markup = camel.price > 0 ? ((camel.price - camel.cost) / camel.price * 100) : 0;
      return camel;
    });

    res.json({ items: result, total, page: p, limit: l, totalPages: Math.ceil(total / l) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/dishes', (req, res) => {
  try {
    const { category_id, include_subcategories, include_unavailable } = req.query;
    let sql = `SELECT d.*, mc.name as categoryName, s.name as stationName FROM dishes d LEFT JOIN menu_categories mc ON d.category_id = mc.id LEFT JOIN stations s ON d.station_id = s.id WHERE 1=1`;
    const params = [];
    sql += ' AND d.tenant_id = ?'; params.push(req.tenant_id);
    // POS/guest apps should only see available dishes unless explicitly requested
    if (include_unavailable !== 'true') {
      sql += ' AND d.is_available = 1';
    }
    if (category_id) {
      if (include_subcategories === 'true') {
        // get all child category IDs recursively
        const childIds = [];
        const stack = [Number(category_id)];
        while (stack.length) {
          const pid = stack.pop();
          childIds.push(pid);
          const kids = db.prepare('SELECT id FROM menu_categories WHERE parent_id = ?').all(pid);
          kids.forEach(k => stack.push(k.id));
        }
        sql += ` AND d.category_id IN (${childIds.map(() => '?').join(',')})`;
        params.push(...childIds);
      } else {
        sql += ' AND d.category_id = ?';
        params.push(Number(category_id));
      }
    }
    sql += ' ORDER BY d.created_at DESC';
    const dishes = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(dishes));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/dishes/:id', (req, res) => {
  try {
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
    res.json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/dishes', (req, res) => {
  try {
    const { name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, course, branch_id, tech_card_id } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Название и цена обязательны' });
    const info = db.prepare(`INSERT INTO dishes (name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, course, branch_id, tech_card_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, description || '', compound || '[]', price, old_price || null, image_url || '', category_id || null,
      weight || netto || null, netto || weight || null, unit || 'г',
      calories || null, proteins || null, fats || null, carbs || null,
      typeof kbju === 'string' ? kbju : JSON.stringify(kbju || {}),
      is_available !== undefined ? (is_available ? 1 : 0) : 1,
      is_popular ? 1 : 0, is_new ? 1 : 0,
      typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      typeof allergens === 'string' ? allergens : JSON.stringify(allergens || []),
      barcode || null, article || null, type || 'goods', cost || 0, course || 'main', branch_id || null, tech_card_id || null,
      req.tenant_id
    );
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(info.lastInsertRowid, req.tenant_id);
    res.status(201).json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/dishes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Блюдо не найдено' });
    const { name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, course, branch_id, tech_card_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (compound !== undefined) { sets.push('compound = ?'); params.push(typeof compound === 'string' ? compound : JSON.stringify(compound)); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (old_price !== undefined) { sets.push('old_price = ?'); params.push(old_price); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (category_id !== undefined) { sets.push('category_id = ?'); params.push(category_id); }
    if (weight !== undefined) { sets.push('weight = ?'); params.push(weight); }
    if (calories !== undefined) { sets.push('calories = ?'); params.push(calories); }
    if (proteins !== undefined) { sets.push('proteins = ?'); params.push(proteins); }
    if (fats !== undefined) { sets.push('fats = ?'); params.push(fats); }
    if (carbs !== undefined) { sets.push('carbs = ?'); params.push(carbs); }
    if (kbju !== undefined) { sets.push('kbju = ?'); params.push(typeof kbju === 'string' ? kbju : JSON.stringify(kbju)); }
    if (is_available !== undefined) { sets.push('is_available = ?'); params.push(is_available ? 1 : 0); }
    if (is_popular !== undefined) { sets.push('is_popular = ?'); params.push(is_popular ? 1 : 0); }
    if (is_new !== undefined) { sets.push('is_new = ?'); params.push(is_new ? 1 : 0); }
    if (tags !== undefined) { sets.push('tags = ?'); params.push(typeof tags === 'string' ? tags : JSON.stringify(tags)); }
    if (allergens !== undefined) { sets.push('allergens = ?'); params.push(typeof allergens === 'string' ? allergens : JSON.stringify(allergens)); }
    if (barcode !== undefined) { sets.push('barcode = ?'); params.push(barcode); }
    if (article !== undefined) { sets.push('article = ?'); params.push(article); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (cost !== undefined) { sets.push('cost = ?'); params.push(cost); }
    if (course !== undefined) { sets.push('course = ?'); params.push(course); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (tech_card_id !== undefined) { sets.push('tech_card_id = ?'); params.push(tech_card_id); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (netto !== undefined) { sets.push('netto = ?'); params.push(netto); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, req.tenant_id);
    db.prepare(`UPDATE dishes SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    res.json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/dishes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    if (!existing) return res.status(404).json({ error: 'Блюдо не найдено' });
    db.prepare('DELETE FROM dishes WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/menu-categories', (req, res) => {
  try {
    const flat = db.prepare(`
      SELECT mc.*, COALESCE(cnt.dish_count, 0) as dish_count
      FROM menu_categories mc
      LEFT JOIN (
        SELECT category_id, COUNT(*) as dish_count
        FROM dishes
        WHERE category_id IS NOT NULL AND tenant_id = ?
        GROUP BY category_id
      ) cnt ON cnt.category_id = mc.id
      WHERE mc.tenant_id = ?
      ORDER BY mc.sort_order ASC, mc.name ASC
    `).all(req.tenant_id, req.tenant_id);

    if (req.query.tree === 'true') {
      const map = new Map();
      flat.forEach(c => map.set(c.id, { ...c, children: [] }));

      const roots = [];
      for (const c of flat) {
        const node = map.get(c.id);
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      }

      // sort children by sort_order
      const sortKids = (arr) => {
        arr.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
        arr.forEach(n => sortKids(n.children));
      };
      sortKids(roots);

      res.json(toCamelCaseArray(roots));
    } else {
      res.json(toCamelCaseArray(flat));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/menu-categories', (req, res) => {
  try {
    const { name, icon, parent_id, sort_order, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare('INSERT INTO menu_categories (name, icon, parent_id, sort_order, image_url, tenant_id) VALUES (?, ?, ?, ?, ?, ?)').run(name, icon || null, parent_id || null, sort_order || 0, image_url || null, req.tenant_id);
    const cat = db.prepare('SELECT * FROM menu_categories WHERE id = ? AND tenant_id = ?').get(info.lastInsertRowid, req.tenant_id);
    res.status(201).json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/menu-categories/batch-visibility', (req, res) => {
  try {
    const { ids, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids is required' });
    const sets = []; const params = [];
    if (show_on_site !== undefined) { sets.push('show_on_site = ?'); params.push(show_on_site ? 1 : 0); }
    if (show_on_app !== undefined) { sets.push('show_on_app = ?'); params.push(show_on_app ? 1 : 0); }
    if (show_on_kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(show_on_kiosk ? 1 : 0); }
    if (show_on_waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(show_on_waiter ? 1 : 0); }
    if (show_on_aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(show_on_aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    const placeholders = ids.map(() => '?').join(',');
    params.push(...ids, req.tenant_id);
    const result = db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id IN (${placeholders}) AND tenant_id = ?`).run(...params);
    res.json({ ok: true, updated: result.changes });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/menu-categories/:id/visibility', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { showOnSite, showOnApp, showOnKiosk, showOnWaiter, showOnAggregators, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    const sets = []; const params = [];
    const site = showOnSite !== undefined ? showOnSite : show_on_site;
    const app = showOnApp !== undefined ? showOnApp : show_on_app;
    const kiosk = showOnKiosk !== undefined ? showOnKiosk : show_on_kiosk;
    const waiter = showOnWaiter !== undefined ? showOnWaiter : show_on_waiter;
    const aggregators = showOnAggregators !== undefined ? showOnAggregators : show_on_aggregators;
    if (site !== undefined) { sets.push('show_on_site = ?'); params.push(site ? 1 : 0); }
    if (app !== undefined) { sets.push('show_on_app = ?'); params.push(app ? 1 : 0); }
    if (kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(kiosk ? 1 : 0); }
    if (waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(waiter ? 1 : 0); }
    if (aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT id, name, icon, parent_id, sort_order, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators FROM menu_categories WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/menu-categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { name, icon, parent_id, sort_order, image_url, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (icon !== undefined) { sets.push('icon = ?'); params.push(icon); }
    if (parent_id !== undefined) { sets.push('parent_id = ?'); params.push(parent_id); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (show_on_site !== undefined) { sets.push('show_on_site = ?'); params.push(show_on_site ? 1 : 0); }
    if (show_on_app !== undefined) { sets.push('show_on_app = ?'); params.push(show_on_app ? 1 : 0); }
    if (show_on_kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(show_on_kiosk ? 1 : 0); }
    if (show_on_waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(show_on_waiter ? 1 : 0); }
    if (show_on_aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(show_on_aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/menu-categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    // reassign child categories to parent
    db.prepare('UPDATE menu_categories SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, req.params.id);
    // unlink dishes
    db.prepare('UPDATE dishes SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/dishes/:id/tech-card', (req, res) => {
  try {
    const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(req.params.id);
    if (!tc) return res.json(null);
    const ingredients = db.prepare(`
      SELECT tci.*, ii.name as item_name_inv, ii.price_per_unit, ii.last_price, ii.unit as inv_unit, ii.current_balance
      FROM dish_tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON tci.item_id = ii.id
      WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
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
app.get('/api/dishes/:id/tech-card/versions', (req, res) => {
  try {
    const versions = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? ORDER BY version DESC').all(req.params.id);
    res.json(versions);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/dishes/:id/tech-card', (req, res) => {
  try {
    const dishId = req.params.id;
    const { ingredients, technology, description, cookingTime, output, isVersion, step_instructions, step_mode } = req.body;

    const existing = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dishId);
    let newVersion = 1;

    if (existing && isVersion) {
      // Archive old version
      newVersion = existing.version + 1;
      const arch = db.prepare(`INSERT INTO dish_tech_cards_archive
        (original_tc_id, dish_id, dish_name, version, output, technology, description, cooking_time, total_cost, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        existing.id, dishId, existing.dish_name, existing.version, existing.output,
        existing.technology, existing.description, existing.cooking_time, existing.cost_price, existing.tenant_id
      );

      const archIngs = db.prepare('SELECT * FROM dish_tech_card_ingredients WHERE tech_card_id = ?').all(existing.id);
      for (const ing of archIngs) {
        db.prepare(`INSERT INTO dish_tech_card_ingredients_archive
          (archive_tc_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          arch.lastInsertRowid, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.netto,
          ing.cold_loss_percent, ing.heat_loss_percent, ing.yield_percent, ing.tenant_id
        );
      }

      // Deactivate old
      db.prepare('UPDATE dish_tech_cards SET is_active = 0 WHERE id = ?').run(existing.id);
    }

    // Calculate cost
    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.itemId);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.coldLossPercent || 0) + (ing.heatLossPercent || 0);
      const adjustedQty = qty * (1 + loss / 100);
      totalCost += price * (adjustedQty / 1000);
    }

    const dish = db.prepare('SELECT name FROM dishes WHERE id = ?').get(dishId);
    if (!dish) return res.status(404).json({ error: 'Dish not found' });

    const tcId = db.prepare(`INSERT INTO dish_tech_cards
      (dish_id, dish_name, number, valid_from, portions, output, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id, version, is_active, cooking_time, description, step_mode, step_instructions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 1, ?, ?, ?, ?, datetime('now'))`).run(
      dishId, dish.name, existing ? existing.number : null, existing ? existing.valid_from : null,
      existing ? existing.portions : null, output || existing?.output || 0,
      technology || existing?.technology || '', 0, 0, Math.round(totalCost * 100) / 100, 1,
      newVersion, cookingTime || existing?.cooking_time || 0, description || existing?.description || '',
      step_mode !== undefined ? (step_mode ? 1 : 0) : 0, step_instructions || ''
    );

    // Insert ingredients
    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(tcId.lastInsertRowid, ing.itemId, ing.itemName, ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
        ing.yieldPercent || 100, 1);
    }

    res.json({ id: tcId.lastInsertRowid, version: newVersion, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/dishes-food-cost', (req, res) => {
  try {
    const dishes = db.prepare(`
      SELECT d.id, d.name, d.price, d.weight, tc.id as tc_id, tc.output, tc.version, tc.cooking_time
      FROM dishes d
      JOIN dish_tech_cards tc ON tc.dish_id = d.id AND tc.is_active = 1
      WHERE d.tenant_id = current_tenant_id()
      ORDER BY d.name
    `).all();

    const results = [];
    for (const dish of dishes) {
      const ings = db.prepare(`
        SELECT tci.quantity, tci.cold_loss_percent, tci.heat_loss_percent, ii.price_per_unit, ii.last_price
        FROM dish_tech_card_ingredients tci
        LEFT JOIN inventory_items ii ON tci.item_id = ii.id
        WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
      `).all(dish.tc_id);

      let totalCost = 0;
      for (const ing of ings) {
        const price = ing.price_per_unit || ing.last_price || 0;
        const qty = ing.quantity || 0;
        const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
        totalCost += price * (qty * (1 + loss / 100) / 1000);
      }

      results.push({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        cost: Math.round(totalCost * 100) / 100,
        margin: dish.price > 0 ? Math.round((1 - totalCost / dish.price) * 10000) / 100 : 0,
        output: dish.output || dish.weight || 0,
        version: dish.version,
        cookingTime: dish.cooking_time,
      });
    }

    res.json(results);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/categories', (req, res) => {
  try {
    const { tenant_id } = req.query;
    const tid = tenant_id || 1;
    const flat = db.prepare(`
      SELECT sc.*, COALESCE(cnt.item_count, 0) as item_count
      FROM stock_categories sc
      LEFT JOIN (
        SELECT category_id, COUNT(*) as item_count
        FROM inventory_items
        WHERE category_id IS NOT NULL
        GROUP BY category_id
      ) cnt ON cnt.category_id = sc.id
      WHERE sc.tenant_id = ?
      ORDER BY sc.name ASC
    `).all(tid);

    if (req.query.tree === 'true') {
      const map = new Map();
      flat.forEach(c => map.set(c.id, { ...c, children: [] }));
      const roots = [];
      for (const c of flat) {
        const node = map.get(c.id);
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      }
      const sortKids = (arr) => {
        arr.sort((a, b) => a.name.localeCompare(b.name));
        arr.forEach(n => sortKids(n.children));
      };
      sortKids(roots);
      res.json(toCamelCaseArray(roots));
    } else {
      res.json(toCamelCaseArray(flat));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/categories', (req, res) => {
  try {
    const { name, parent_id, tenant_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
    const tid = tenant_id || 1;
    const existing = db.prepare('SELECT id FROM stock_categories WHERE name = ? AND tenant_id = ?').get(name.trim(), tid);
    if (existing) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    const info = db.prepare('INSERT INTO stock_categories (name, parent_id, tenant_id) VALUES (?, ?, ?)').run(name.trim(), parent_id || null, tid);
    const cat = db.prepare('SELECT id, name, parent_id, 0 as item_count FROM stock_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { name, parent_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Название обязательно' });
      const dup = db.prepare('SELECT id FROM stock_categories WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
      if (dup) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
      sets.push('name = ?'); params.push(name.trim());
    }
    if (parent_id !== undefined) {
      if (Number(parent_id) === Number(req.params.id)) return res.status(400).json({ error: 'Категория не может быть родителем самой себя' });
      sets.push('parent_id = ?'); params.push(parent_id || null);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE stock_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT sc.id, sc.name, sc.parent_id, COALESCE(COUNT(ii.id), 0) as item_count FROM stock_categories sc LEFT JOIN inventory_items ii ON ii.category_id = sc.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id() GROUP BY sc.id').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    // reassign children to parent
    db.prepare('UPDATE stock_categories SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, req.params.id);
    // unlink items
    db.prepare('UPDATE inventory_items SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM stock_categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/tables', (req, res) => {
  try {
    const tables = db.prepare('SELECT * FROM booking_tables WHERE tenant_id = ? ORDER BY name ASC').all(req.tenant_id);
    res.json(toCamelCaseArray(tables));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
  app.post('/api/tables', (req, res) => {
  try {
    const { name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Название стола обязательно' });
    const info = db.prepare('INSERT INTO booking_tables (name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, capacity || null, zone || null, x || 0, y || 0, width || 80, height || 80, color || '#4CAF50', shape || 'rectangle', branch_id || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, status || 'free', req.tenant_id
    );
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(table));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/tables/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Стол не найден' });
    const { name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active, status } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (capacity !== undefined) { sets.push('capacity = ?'); params.push(capacity); }
    if (zone !== undefined) { sets.push('zone = ?'); params.push(zone); }
    if (x !== undefined) { sets.push('x = ?'); params.push(x); }
    if (y !== undefined) { sets.push('y = ?'); params.push(y); }
    if (width !== undefined) { sets.push('width = ?'); params.push(width); }
    if (height !== undefined) { sets.push('height = ?'); params.push(height); }
    if (color !== undefined) { sets.push('color = ?'); params.push(color); }
    if (shape !== undefined) { sets.push('shape = ?'); params.push(shape); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE booking_tables SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(table));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.delete('/api/tables/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Стол не найден' });
    db.prepare('DELETE FROM booking_tables WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
};