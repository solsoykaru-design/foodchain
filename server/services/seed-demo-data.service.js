function seedDemoData(db, bcrypt, tenantId) {
  const existingStaff = db.prepare('SELECT id FROM staff WHERE tenant_id = ?').get(tenantId);
  if (!existingStaff) {
    const adminHash = bcrypt.hashSync('demo123', 10);
    db.prepare("INSERT INTO staff (username, password, role, first_name, tenant_id, is_active) VALUES (?,?,?,?,?,1)")
      .run('admin', adminHash, 'admin', 'Демо-администратор', tenantId);
    db.prepare("INSERT INTO staff (username, password, role, first_name, tenant_id, is_active) VALUES (?,?,?,?,?,1)")
      .run('waiter', bcrypt.hashSync('demo123', 10), 'waiter', 'Демо-официант', tenantId);
    db.prepare("INSERT INTO staff (username, password, role, first_name, tenant_id, is_active) VALUES (?,?,?,?,?,1)")
      .run('chef', bcrypt.hashSync('demo123', 10), 'chef', 'Демо-повар', tenantId);
  }

  const existingCats = db.prepare('SELECT id FROM menu_categories WHERE tenant_id = ?').get(tenantId);
  if (!existingCats) {
    db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Закуски', tenantId, 1);
    db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Основные блюда', tenantId, 2);
    db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Напитки', tenantId, 3);
    db.prepare("INSERT INTO menu_categories (name, tenant_id, sort_order) VALUES (?,?,?)").run('Десерты', tenantId, 4);

    const cat1 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Закуски' AND tenant_id = ?").get(tenantId)?.id;
    const cat2 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Основные блюда' AND tenant_id = ?").get(tenantId)?.id;
    const cat3 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Напитки' AND tenant_id = ?").get(tenantId)?.id;
    const cat4 = db.prepare("SELECT id FROM menu_categories WHERE name = 'Десерты' AND tenant_id = ?").get(tenantId)?.id;

    if (cat1) {
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Брускетта с томатами', cat1, 350, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Сырная тарелка', cat1, 590, tenantId);
    }
    if (cat2) {
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Стейк Рибай', cat2, 1890, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Паста Карбонара', cat2, 690, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Цезарь с курицей', cat2, 490, tenantId);
    }
    if (cat3) {
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Лимонад', cat3, 250, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Чай чёрный', cat3, 150, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Кофе американо', cat3, 200, tenantId);
    }
    if (cat4) {
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Тирамису', cat4, 450, tenantId);
      db.prepare("INSERT INTO dishes (name, category_id, price, tenant_id, is_active) VALUES (?,?,?,?,1)").run('Чизкейк', cat4, 390, tenantId);
    }
  }

  const existingInv = db.prepare('SELECT id FROM inventory_items WHERE tenant_id = ?').get(tenantId);
  if (!existingInv) {
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Говядина', 'кг', 50, 10, tenantId, 'Мясо');
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Куриное филе', 'кг', 30, 5, tenantId, 'Мясо');
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Спагетти', 'кг', 20, 5, tenantId, 'Бакалея');
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Помидоры', 'кг', 15, 3, tenantId, 'Овощи');
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Сыр пармезан', 'кг', 5, 1, tenantId, 'Молочные');
    db.prepare("INSERT INTO inventory_items (name, unit, current_balance, min_balance, tenant_id, category_name) VALUES (?,?,?,?,?,?)").run('Сливки', 'л', 10, 2, tenantId, 'Молочные');
  }

  const existingOrder = db.prepare('SELECT id FROM orders WHERE tenant_id = ?').get(tenantId);
  if (!existingOrder) {
    const dishes = db.prepare('SELECT id, name, price FROM dishes WHERE tenant_id = ? LIMIT 3').all(tenantId);
    if (dishes.length > 0) {
      const items = dishes.map(d => ({ dish_id: d.id, name: d.name, quantity: 1, price: d.price }));
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      db.prepare(`INSERT INTO orders (tenant_id, items, total, status, payment_method, guest_name, comment, created_at)
        VALUES (?, ?, ?, 'new', 'cash', ?, ?, datetime('now'))`)
        .run(tenantId, JSON.stringify(items), total, 'Демо-гость', 'Тестовый заказ для демонстрации');
    }
  }
}

module.exports = { seedDemoData };
