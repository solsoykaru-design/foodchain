const XLSX = require('xlsx');

module.exports = function (app, db, config) {
  const { safeError, authenticateToken } = config;

  function parseBool(val) {
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase().trim();
    return ['да', 'yes', '1', 'true', '✔', '✓', '✅', '+'].includes(s);
  }

  function parseNum(val) {
    if (val === undefined || val === null || val === '') return null;
    const s = String(val).replace(',', '.').replace(/[^\d.\-]/g, '').trim();
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function findOrCreateMenuCategory(name, tenantId) {
    const t = name.trim();
    let cat = db.prepare('SELECT id FROM menu_categories WHERE name = ?').get(t);
    if (cat) return cat.id;
    const info = db.prepare('INSERT INTO menu_categories (name, tenant_id) VALUES (?, ?)').run(t, tenantId);
    return info.lastInsertRowid;
  }

  function findOrCreateStockCategory(name) {
    const t = name.trim();
    let cat = db.prepare('SELECT id FROM stock_categories WHERE name = ?').get(t);
    if (cat) return cat.id;
    const info = db.prepare('INSERT INTO stock_categories (name) VALUES (?)').run(t);
    return info.lastInsertRowid;
  }

  function findOrCreateInventoryItem(name, unit, tenantId) {
    const t = name.trim();
    let item = db.prepare('SELECT id, unit FROM inventory_items WHERE name = ?').get(t);
    if (item) return item;
    const info = db.prepare('INSERT INTO inventory_items (name, unit, current_balance, tenant_id) VALUES (?, ?, 0, ?)').run(t, unit || 'шт', tenantId);
    return { id: info.lastInsertRowid, name: t, unit: unit || 'шт' };
  }

  function logImport(adminName, action, details, tenantId) {
    try {
      db.prepare('INSERT INTO audit_logs (admin_name, action, details, ip, tenant_id) VALUES (?, ?, ?, ?, current_tenant_id())').run(
        adminName || 'system', 'yuma_import:' + action, JSON.stringify(details), ''
      );
    } catch (e) { /* ignore */ }
  }

  // ─── IMPORT MENU ITEMS ───────────────────────────────────────────
  app.post('/api/yuma-import/items', authenticateToken, (req, res) => {
    try {
      const { rows, map } = req.body;
      if (!rows || !rows.length) return res.status(400).json({ error: 'Нет данных' });

      const tenantId = req.tenant_id;
      const created = [], updated = [], errors = [];

      const rev = {};
      if (map) for (const [k, v] of Object.entries(map)) rev[v] = k;

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const col = (field) => rows[rowIdx][rev[field] || field];
        const row = rows[rowIdx];
        const rn = rowIdx + 2;
        try {
          const name = (col('name') || '').toString().trim();
          if (!name) { errors.push(`Строка ${rn}: пустое название`); continue; }

          const price = parseNum(col('price'));
          if (price === null || price <= 0) { errors.push(`Строка ${rn} («${name}»): не указана цена`); continue; }

          const catName = (col('category') || '').toString().trim();
          if (!catName) { errors.push(`Строка ${rn} («${name}»): не указана категория`); continue; }
          const categoryId = findOrCreateMenuCategory(catName, tenantId);

          const unit = (col('unit') || 'г').toString().trim();

          const description = (col('description') || '').toString();
          const barcode = (col('barcode') || '').toString();
          const article = (col('article') || '').toString();
          const composition = (col('composition') || '[]').toString();
          const grossWeight = parseNum(col('gross_weight'));
          const netWeight = parseNum(col('net_weight'));
          const kcal = parseNum(col('kcal'));
          const proteins = parseNum(col('proteins'));
          const fats = parseNum(col('fats'));
          const carbs = parseNum(col('carbohydrates'));
          const sortOrder = parseNum(col('sort_order')) || 0;
          const isActive = parseBool(col('is_active'));

          // Detect tags and allergens from unmapped boolean columns
          const knownAllergens = ['глютен', 'ракообразные', 'яйца', 'рыба', 'арахис', 'соя',
            'молоко', 'орехи', 'сельдерей', 'горчица', 'кунжут', 'сульфиты', 'люпин', 'моллюски',
            'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts',
            'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];
          const knownTags = ['новинка', 'новинки', 'популярное', 'хит', 'хиты', 'острое',
            'веганское', 'веган', 'халяльное', 'халяль', 'горячее', 'холодное', 'детское',
            'диетическое', 'сезонное', 'авторское', 'премиум', 'акция', 'new', 'popular',
            'spicy', 'vegan', 'halal', 'hot', 'cold'];

          const tags = [], allergens = [];
          const skipCols = new Set(Object.values(map || {}));
          for (const s of ['name', 'category', 'price', 'unit', 'description', 'barcode', 'article',
            'composition', 'gross_weight', 'net_weight', 'kcal', 'proteins', 'fats',
            'carbohydrates', 'sort_order', 'is_active']) skipCols.add(s);

          for (const colName of Object.keys(row)) {
            if (skipCols.has(colName)) continue;
            if (!parseBool(row[colName])) continue;
            const lc = colName.toLowerCase().trim();
            if (knownAllergens.some(a => lc.includes(a))) {
              allergens.push(colName.trim());
            } else {
              tags.push(colName.trim());
            }
          }

          const existing = db.prepare('SELECT id FROM dishes WHERE name = ? AND tenant_id = ?').get(name, tenantId);

          if (existing) {
            const sets = []; const p = [];
            const fields = { description, compound: composition, price, category_id: categoryId, unit,
              barcode, article, is_available: isActive ? 1 : 0, tags: JSON.stringify(tags),
              allergens: JSON.stringify(allergens), display_order: sortOrder };
            if (grossWeight !== null) fields.weight = grossWeight;
            if (netWeight !== null) fields.netto = netWeight;
            if (kcal !== null) fields.calories = kcal;
            if (proteins !== null) fields.proteins = proteins;
            if (fats !== null) fields.fats = fats;
            if (carbs !== null) fields.carbs = carbs;
            for (const [k, v] of Object.entries(fields)) {
              if (v !== undefined) { sets.push(`${k} = ?`); p.push(v); }
            }
            if (sets.length > 0) {
              p.push(existing.id, tenantId);
              db.prepare(`UPDATE dishes SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`).run(...p);
              updated.push(name);
            }
          } else {
            const cols = ['name', 'description', 'compound', 'price', 'category_id', 'weight', 'netto',
              'unit', 'calories', 'proteins', 'fats', 'carbs', 'is_available', 'barcode', 'article',
              'display_order', 'tags', 'allergens', 'tenant_id'];
            const vals = [name, description || '', composition, price, categoryId,
              grossWeight, netWeight, unit, kcal, proteins, fats, carbs, isActive ? 1 : 0,
              barcode || null, article || null, sortOrder,
              JSON.stringify(tags), JSON.stringify(allergens), tenantId];
            db.prepare(`INSERT INTO dishes (${cols.join(', ')}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
            created.push(name);
          }
        } catch (e) {
          errors.push(`Строка ${rn}: ${e.message}`);
        }
      }

      const report = { created, updated, errors, total: rows.length };
      logImport(req.user?.name, 'menu-items', report, tenantId);
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── IMPORT TECH CARDS ───────────────────────────────────────────
  app.post('/api/yuma-import/tech-cards', authenticateToken, (req, res) => {
    try {
      const { rows, map } = req.body;
      if (!rows || !rows.length) return res.status(400).json({ error: 'Нет данных' });

      // Ensure tables exist
      db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT, dish_id INTEGER, dish_name TEXT,
        number TEXT, valid_from TEXT, portions REAL, output REAL, technology TEXT,
        fixed_costs REAL, package_weight REAL, cost_price REAL, created_at TEXT,
        tenant_id INTEGER DEFAULT 1
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_card_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tech_card_id INTEGER,
        item_id INTEGER, item_name TEXT, quantity REAL, unit TEXT,
        netto REAL, yield REAL, tenant_id INTEGER DEFAULT 1
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, unit TEXT, current_balance REAL, tenant_id INTEGER DEFAULT 1)`);

      const tenantId = req.tenant_id;
      const created = [], updated = [], errors = [];
      let ingredientsCreated = 0;

      const rev = {};
      if (map) for (const [k, v] of Object.entries(map)) rev[v] = k;

      // Group rows by dish name
      const grouped = {};
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const col = (field) => rows[rowIdx][rev[field] || field];
        const row = rows[rowIdx];
        const dishName = (col('dish_name') || '').toString().trim();
        if (!dishName) { errors.push(`Строка ${rowIdx + 2}: пустое название блюда`); continue; }
        if (!grouped[dishName]) {
          grouped[dishName] = {
            valid_from: col('valid_from') || null,
            portions: parseNum(col('portions')),
            technology: (col('technology') || '').toString(),
            fixed_costs: parseNum(col('fixed_costs')),
            package_weight: parseNum(col('package_weight')),
            output: parseNum(col('output')),
            ingredients: []
          };
        }
        // Only update if later rows have values
        if (col('valid_from')) grouped[dishName].valid_from = col('valid_from');
        if (parseNum(col('portions')) !== null) grouped[dishName].portions = parseNum(col('portions'));
        if (col('technology')) grouped[dishName].technology = col('technology');
        if (parseNum(col('fixed_costs')) !== null) grouped[dishName].fixed_costs = parseNum(col('fixed_costs'));
        if (parseNum(col('package_weight')) !== null) grouped[dishName].package_weight = parseNum(col('package_weight'));
        if (parseNum(col('output')) !== null) grouped[dishName].output = parseNum(col('output'));

        const ingName = (col('ingredient_name') || '').toString().trim();
        if (ingName) {
          grouped[dishName].ingredients.push({
            name: ingName,
            quantity: parseNum(col('quantity')),
            netto: parseNum(col('netto')),
            yield: parseNum(col('yield')),
            unit: (col('ingredient_unit') || 'кг').toString().trim(),
          });
        }
      }

      for (const [dishName, g] of Object.entries(grouped)) {
        try {
          const dish = db.prepare('SELECT id FROM dishes WHERE name = ? AND tenant_id = ?').get(dishName, tenantId);
          if (!dish) {
            errors.push(`«${dishName}»: блюдо не найдено в меню`);
            continue;
          }

          // Find or create tech card
          let tc = db.prepare('SELECT id FROM dish_tech_cards WHERE dish_id = ?').get(dish.id);
          if (tc) {
            db.prepare(`UPDATE dish_tech_cards SET valid_from = ?, portions = ?, technology = ?,
              fixed_costs = ?, package_weight = ?, output = ?, cost_price = ?
              WHERE id = ?`).run(
              g.valid_from || null, g.portions || null, g.technology || null,
              g.fixed_costs || 0, g.package_weight || 0, g.output || 0,
              0, tc.id
            );
            updated.push(dishName);
          } else {
            const info = db.prepare(`INSERT INTO dish_tech_cards
              (dish_id, dish_name, valid_from, portions, technology, fixed_costs, package_weight, output, cost_price, tenant_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(
              dish.id, dishName, g.valid_from || null, g.portions || null,
              g.technology || null, g.fixed_costs || 0, g.package_weight || 0,
              g.output || 0, tenantId
            );
            tc = { id: info.lastInsertRowid };
            created.push(dishName);
          }

          // Process ingredients
          for (const ing of g.ingredients) {
            const stockItem = findOrCreateInventoryItem(ing.name, ing.unit || 'кг', tenantId);
            const existingIng = db.prepare(
              'SELECT id FROM dish_tech_card_ingredients WHERE tech_card_id = ? AND item_id = ?'
            ).get(tc.id, stockItem.id);
            if (existingIng) {
              db.prepare(`UPDATE dish_tech_card_ingredients SET quantity = ?, netto = ?, yield = ?, unit = ?
                WHERE id = ?`).run(ing.quantity, ing.netto, ing.yield, ing.unit || 'кг', existingIng.id);
            } else {
              db.prepare(`INSERT INTO dish_tech_card_ingredients
                (tech_card_id, item_id, item_name, quantity, unit, netto, yield, tenant_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                tc.id, stockItem.id, ing.name, ing.quantity || 0, ing.unit || 'кг',
                ing.netto || 0, ing.yield || 0, tenantId
              );
            }
            ingredientsCreated++;
          }
        } catch (e) {
          errors.push(`«${dishName}»: ${e.message}`);
        }
      }

      const report = { created, updated, errors, ingredientsCreated, total: Object.keys(grouped).length };
      logImport(req.user?.name, 'tech-cards', report, tenantId);
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── IMPORT STOCK ITEMS ──────────────────────────────────────────
  app.post('/api/yuma-import/stock', authenticateToken, (req, res) => {
    try {
      const { rows, map } = req.body;
      if (!rows || !rows.length) return res.status(400).json({ error: 'Нет данных' });

      const tenantId = req.tenant_id;
      const created = [], updated = [], errors = [];

      const rev = {};
      if (map) for (const [k, v] of Object.entries(map)) rev[v] = k;

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const col = (field) => rows[rowIdx][rev[field] || field];
        const row = rows[rowIdx];
        const rn = rowIdx + 2;
        try {
          const name = (col('name') || '').toString().trim();
          if (!name) { errors.push(`Строка ${rn}: пустое название`); continue; }

          const catName = (col('category') || '').toString().trim();
          if (catName) findOrCreateStockCategory(catName);

          const unit = (col('unit') || 'шт').toString().trim();
          const cost = parseNum(col('cost'));
          const isReturnable = parseBool(col('is_returnable'));
          const grossWeight = parseNum(col('gross_weight'));
          const netWeight = parseNum(col('net_weight'));
          const kcal = parseNum(col('kcal'));
          const proteins = parseNum(col('proteins'));
          const fats = parseNum(col('fats'));
          const carbs = parseNum(col('carbohydrates'));

          const existing = db.prepare('SELECT id FROM inventory_items WHERE name = ?').get(name);
          if (existing) {
            db.prepare(`UPDATE inventory_items SET
              unit = COALESCE(?, unit),
              category_name = COALESCE(?, category_name),
              last_price = COALESCE(?, last_price),
              brutto = COALESCE(?, brutto),
              netto = COALESCE(?, netto),
              kcal = COALESCE(?, kcal),
              proteins = COALESCE(?, proteins),
              fats = COALESCE(?, fats),
              carbs = COALESCE(?, carbs),
              is_returnable = ?
              WHERE id = ?`).run(
              unit || null, catName || null, cost, grossWeight, netWeight,
              kcal, proteins, fats, carbs, isReturnable ? 1 : 0, existing.id
            );
            updated.push(name);
          } else {
            db.prepare(`INSERT INTO inventory_items
              (name, unit, category_name, last_price, brutto, netto, kcal, proteins, fats, carbs, is_returnable, current_balance, tenant_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(
              name, unit, catName || null, cost || 0, grossWeight || 0, netWeight || 0,
              kcal || 0, proteins || 0, fats || 0, carbs || 0, isReturnable ? 1 : 0,
              tenantId
            );
            created.push(name);
          }
        } catch (e) {
          errors.push(`Строка ${rn}: ${e.message}`);
        }
      }

      const report = { created, updated, errors, total: rows.length };
      logImport(req.user?.name, 'stock-items', report, tenantId);
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });
};
