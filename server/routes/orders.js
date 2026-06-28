
module.exports = function(app, db, config) {
  const { io, broadcast, safeError, toCamelCase, toCamelCaseArray, getOrderFull, emitOrderUpdate, STATUS_CHAIN, STATUS_LABELS, validateTransition, getLoyaltySettings, getGuestBonusInfo, emailService, pushService, notifLog, aggregatorIntegration, authenticateToken, requireRole } = config;

app.get('/api/orders', (req, res) => {
  const { status, courier_id, user_id } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  sql += ' AND tenant_id = ?'; params.push(req.tenant_id);
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (courier_id) { sql += ' AND courier_id = ?'; params.push(Number(courier_id)); }
  if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }
  sql += ' ORDER BY created_at DESC';
  const orders = db.prepare(sql).all(...params);
  const result = orders.map(o => {
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? AND tenant_id = ? ORDER BY created_at ASC').all(o.id, req.tenant_id);
    let courierPhone = null;
    if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
    return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
  });
  res.json(result);
});
app.get('/api/orders/track', (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Телефон обязателен' });
  const orders = db.prepare('SELECT * FROM orders WHERE user_phone = ? ORDER BY created_at DESC LIMIT 10').all(phone);
  const result = orders.map(o => {
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
    let courierPhone = null;
    if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
    return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
  });
  res.json(result);
});
app.get('/api/orders/:id', (req, res) => {
  const order = getOrderFull(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});
app.get('/api/orders/:id/tracking', (req, res) => {
  try {
    const order = getOrderFull(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    let courierLocation = null;
    let eta = null;
    let distance = null;
    let restaurantLocation = null;

    if (order.branchId) {
      const branch = db.prepare('SELECT lat, lng, name, address FROM branches WHERE id = ?').get(order.branchId);
      if (branch && branch.lat && branch.lng) {
        restaurantLocation = { lat: branch.lat, lng: branch.lng, name: branch.name, address: branch.address };
      }
    }

    if (order.courierId) {
      let loc = db.prepare('SELECT lat, lng, recorded_at as updated_at FROM courier_locations WHERE staff_id = ?').get(order.courierId);
      if (!loc) {
        loc = db.prepare('SELECT latitude as lat, longitude as lng, updated_at FROM courier_locations WHERE courier_id = ?').get(order.courierId);
      }
      if (loc) {
        courierLocation = { lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at };

        if (order.address && restaurantLocation) {
          const R = 6371;
          const dLat = (restaurantLocation.lat - loc.latitude) * Math.PI / 180;
          const dLng = (restaurantLocation.lng - loc.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(loc.latitude*Math.PI/180)*Math.cos(restaurantLocation.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = Math.round(R * c * 10) / 10;
          eta = Math.round(distance / 0.3);
        }
      }
    }

    res.json({
      ...order,
      courierLocation,
      restaurantLocation,
      eta,
      distance,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/orders/:id/items', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Состав заказа обязателен' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    let subtotal = 0;
    for (const item of items) {
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(item.dishId);
      if (dish) {
        item.name = dish.name;
        item.price = dish.price;
        subtotal += dish.price * (item.quantity || 1);
      }
    }

    const itemsJson = JSON.stringify(items);
    db.prepare("UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?")
      .run(itemsJson, subtotal, subtotal, req.params.id);

    db.prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)")
      .run(req.params.id, order.status, 'Состав заказа изменён');

    const updated = emitOrderUpdate(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.put('/api/orders/:id/assign-courier', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { courier_id, courier_name } = req.body;
    if (!courier_id || !courier_name) return res.status(400).json({ error: 'ID и имя курьера обязательны' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    if (order.courier_id || (order.status !== 'ready' && order.status !== 'new')) {
      return res.status(400).json({ error: 'Курьер уже назначен или заказ не готов для назначения' });
    }

    db.prepare("UPDATE orders SET courier_id = ?, courier_name = ?, assigned_at = datetime('now'), status = 'assigned', updated_at = datetime('now') WHERE id = ?")
      .run(courier_id, courier_name, req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)')
      .run(req.params.id, 'assigned', `Назначен курьер ${courier_name}`);

    const updated = emitOrderUpdate(req.params.id);
    io.emit('order:assigned', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/orders/:id/chat', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const chat = db.prepare('SELECT * FROM courier_guest_chats WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    if (chat) {
      res.json({ exists: true, chatId: chat.id, isActive: chat.status === 'active', status: chat.status });
    } else {
      res.json({ exists: false, chatId: null, isActive: false, status: null });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders', (req, res) => {
  const { user_id, user_name, user_phone, address, items, total, payment_method, type, comment, bonus_used, promo_code, shift_id, handled_by, handled_by_name } = req.body;
  if (!user_id || !user_name || !user_phone) return res.status(400).json({ error: 'Данные пользователя обязательны' });
  
  let finalTotal = total || 0;
  let appliedBonus = 0;
  
  // Apply bonus if requested
  if (bonus_used && bonus_used > 0) {
    try {
      const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
      if (bonus && bonus.balance >= bonus_used) {
        const info = getGuestBonusInfo(user_id);
        const maxWriteOff = finalTotal * (info.maxWriteOffPercent / 100);
        const canUse = Math.min(bonus_used, bonus.balance, maxWriteOff);
        if (canUse > 0) {
          appliedBonus = canUse;
          finalTotal = Math.max(0, finalTotal - canUse);
        }
      }
    } catch (e) {}
  }

  const itemsJson = JSON.stringify(items || []);
  const subtotal = total || 0;
  const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, address, items, subtotal, total, discount, payment_method, type, comment, promo_code, status, bonus_used, tenant_id, shift_id, handled_by, handled_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`).run(user_id, user_name, user_phone, address || '', itemsJson, subtotal, finalTotal, appliedBonus, payment_method || 'cash', type || 'delivery', comment || '', promo_code || null, appliedBonus, req.tenant_id, shift_id || null, handled_by || null, handled_by_name || null);
  const orderId = info.lastInsertRowid;
  db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)').run(orderId, 'new', 'Заказ создан', req.tenant_id);

  db.prepare('UPDATE users SET visits_count = visits_count + 1, total_spent = total_spent + ? WHERE id = ?').run(subtotal, user_id);

  // Spend bonuses if applied
  if (appliedBonus > 0) {
    try {
      const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
      if (bonus) {
        db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(appliedBonus, appliedBonus, bonus.id);
        db.prepare('UPDATE users SET bonus_balance = MAX(0, bonus_balance - ?) WHERE id = ?').run(appliedBonus, user_id);
        db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(user_id, bonus.id, 'spend', appliedBonus, `Списание за заказ #${orderId}`, 'order', orderId);
      }
    } catch (e) { console.error('[Loyalty] Spend error:', e.message); }
  }

  io.emit('order:new', getOrderFull(orderId));
  emitOrderUpdate(orderId);
  broadcast({ type: 'order:new', orderId: Number(orderId) });
  const orderData = getOrderFull(orderId);
  orderData.bonusSaved = appliedBonus;
  res.status(201).json(orderData);
});
app.get('/api/orders/:id/splits', (req, res) => {
  try {
    const splits = db.prepare('SELECT * FROM order_splits WHERE order_id = ? ORDER BY id ASC').all(req.params.id);
    res.json(toCamelCaseArray(splits));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/orders/:id/split', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { splits } = req.body;
    if (!splits || !Array.isArray(splits) || splits.length === 0) return res.status(400).json({ error: 'splits required' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const created = [];
    for (const s of splits) {
      const info = db.prepare("INSERT INTO order_splits (order_id, guest_name, items, amount, payment_method) VALUES (?, ?, ?, ?, ?)").run(
        req.params.id, s.guest_name || '', JSON.stringify(s.items || []), s.amount || 0, s.payment_method || null
      );
      created.push({ id: info.lastInsertRowid, orderId: Number(req.params.id), guestName: s.guest_name, items: s.items, amount: s.amount });
    }
    res.json({ splits: created });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/order-splits/:id/pay', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { payment_method } = req.body;
    const split = db.prepare('SELECT * FROM order_splits WHERE id = ?').get(req.params.id);
    if (!split) return res.status(404).json({ error: 'Split not found' });
    db.prepare("UPDATE order_splits SET is_paid = 1, payment_method = ? WHERE id = ?").run(payment_method || 'cash', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/self-order', (req, res) => {
  try {
    const { items, table_id, guest_name, comment } = req.body;
    const result = db.prepare("INSERT INTO orders (items, table_id, user_name, comment, status, source, created_at, tenant_id) VALUES (?, ?, ?, ?, 'new', 'qr_self_order', datetime('now'), ?)").run(
      JSON.stringify(items || []), table_id || null, guest_name || 'Гость', comment || '', req.tenant_id || 1
    );
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/orders/:id/status', authenticateToken, requireRole('waiter', 'courier'), async (req, res) => {
  const { status, note } = req.body;
  if (!status) return res.status(400).json({ error: 'Статус обязателен' });
  if (!STATUS_CHAIN[status]) return res.status(400).json({ error: `Неизвестный статус: ${status}` });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (status !== order.status) {
    const validation = validateTransition(order.id, order.status, status);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
  }

  const writeOffTr = db.transaction(() => {
    if (status === 'ready' && order.status !== 'ready') {
      const items = JSON.parse(order.items || '[]');
      for (const item of items) {
        const dishId = item.dishId || item.dish_id;
        const qty = item.quantity || 1;
        
        // Try new dish_tech_cards first, fallback to old tech_cards
        const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dishId);
        let ingredientRows;

        if (tc) {
          ingredientRows = db.prepare('SELECT tci.*, ii.name as inv_name, ii.current_balance, ii.unit as inv_unit FROM dish_tech_card_ingredients tci LEFT JOIN inventory_items ii ON tci.item_id = ii.id WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()').all(tc.id);
        } else {
          // Fallback to old tech_cards
          const oldTc = db.prepare('SELECT * FROM tech_cards WHERE dish_id = ? ORDER BY created_at DESC').get(dishId);
          if (!oldTc) continue;
          let oldIngs = [];
          try { oldIngs = JSON.parse(oldTc.ingredients || '[]'); } catch {}
          ingredientRows = oldIngs.map(ing => ({
            item_name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit || 'г',
          }));
        }
        
        if (!ingredientRows || ingredientRows.length === 0) continue;

        // Check stock (with losses)
        for (const ing of ingredientRows) {
          if (!ing.item_id) continue;
          const qtyRaw = (ing.quantity || 0) * qty;
          const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
          const needQty = Math.round(qtyRaw * (1 + loss / 100) * 100) / 100;
          const actualStock = ing.current_balance ?? 0;
          if (actualStock < needQty) {
            throw new Error(`Недостаточно "${ing.inv_name || ing.item_name}" на складе: нужно ${needQty} ${ing.inv_unit || ing.unit || 'г'}, осталось ${actualStock}`);
          }
        }

        // Deduct stock (with losses)
        for (const ing of ingredientRows) {
          if (!ing.item_id) continue;
          const qtyRaw = (ing.quantity || 0) * qty;
          const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
          const needQty = Math.round(qtyRaw * (1 + loss / 100) * 100) / 100;
          db.prepare("UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?").run(needQty, ing.item_id);
          db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(ing.item_id, 'write_off', needQty, `Списание: заказ #${req.params.id}, блюдо ${item.name || dishId}`);
        }
      }
    }

      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
    const noteText = note || STATUS_LABELS[status] || status;
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, status, noteText);
    broadcast({ type: 'order:update', orderId: Number(req.params.id), status, note: noteText });

    if (status === 'delivered') {
      db.prepare('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?').run(order.courier_id);
      db.prepare('UPDATE users SET total_spent = total_spent + ? WHERE id = ?').run(order.total, order.user_id);
      // Auto-accrue loyalty bonuses
      try {
        const settings = getLoyaltySettings();
        const userId = order.user_id;
        const bonusAmount = Math.round(order.total * (settings.bonusPercent / 100) * 100) / 100;
        if (bonusAmount > 0) {
          const levels = settings.levels || [];
          let multiplier = 1;
          const user = db.prepare('SELECT total_spent FROM users WHERE id = ?').get(userId);
          if (user) {
            const sorted = [...levels].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));
            const current = [...sorted].reverse().find(l => user.total_spent >= (l.minSpent || 0));
            if (current && current.bonusMultiplier) multiplier = current.bonusMultiplier;
          }
          const finalBonus = Math.round(bonusAmount * multiplier * 100) / 100;
          let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
          if (!bonus) {
            const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(userId);
            bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
          }
          db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(finalBonus, finalBonus, bonus.id);
          db.prepare('UPDATE users SET bonus_balance = bonus_balance + ? WHERE id = ?').run(finalBonus, userId);
          db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'earned', finalBonus, `Начисление за заказ #${order.id}`, 'order', order.id);
          // Update loyalty level based on total spent
          if (settings.levels && settings.levels.length > 0) {
            const sorted = [...settings.levels].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));
            const current = [...sorted].reverse().find(l => (user.total_spent + order.total) >= (l.minSpent || 0));
            if (current) {
              db.prepare("UPDATE users SET loyalty_level = ? WHERE id = ?").run(current.name.toLowerCase(), userId);
            }
          }
        }
      } catch (e) { console.error('[Loyalty] Auto-accrue error:', e.message); }
    }
  });

  try {
    writeOffTr();
  } catch (e) {
    return res.status(400).json({ error: safeError(e.message) });
  }

  try {
    const tenantId = order.tenant_id || 1;
    const memberId = order.user_id;
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(memberId);
    const title = 'Статус заказа #' + order.id + ': ' + (STATUS_LABELS[status] || status);
    // Email
    if (user && user.email) {
      const unsub = db.prepare('SELECT id FROM email_unsubscribes WHERE tenant_id = ? AND email = ?').get(tenantId, user.email);
      if (!unsub) {
        const tmpl = db.prepare("SELECT * FROM email_templates WHERE tenant_id = ? AND name = 'status_changed' AND is_system = 1").get(tenantId) || db.prepare("SELECT * FROM email_templates WHERE tenant_id = ? AND name = 'Новый заказ' AND is_system = 1").get(tenantId);
        if (tmpl) {
          let body = (tmpl.body_html || '') + '';
          body = body.replace(/\{status\}/g, STATUS_LABELS[status] || status).replace(/\{order_id\}/g, order.id).replace(/\{user_name\}/g, user.name || '');
          body += '<br><br><small><a href="' + (process.env.BASE_URL || '') + '/api/email/unsubscribe?email=' + encodeURIComponent(user.email) + '&tenant=' + tenantId + '">Отписаться от рассылки</a></small>';
          await emailService.sendMail(db, { to: user.email, subject: tmpl.subject, html: body }, tenantId, notifLog);
        }
      }
    }
    // Push
    const pushTitle = 'Статус заказа #' + order.id;
    const pushBody = STATUS_LABELS[status] || status;
    pushService.sendToAll(db, { title: pushTitle, body: pushBody, data: { orderId: String(order.id), status } }, tenantId, notifLog).catch(() => {});
  } catch (e) { console.error('[Status change notification error]:', e.message); }

  const updated = emitOrderUpdate(req.params.id);

  if (aggregatorIntegration.setupRoutes && typeof aggregatorIntegration.setupRoutes === 'function') {
    try {
      const orderData = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (orderData && orderData.source === 'external' && orderData.external_provider && orderData.external_order_id) {
        const provider = orderData.external_provider;
        const p = aggregatorIntegration.PROVIDERS ? aggregatorIntegration.PROVIDERS[provider] : null;
        if (p) {
          const settings = db.prepare('SELECT * FROM aggregator_settings WHERE provider = ? AND enabled = 1').get(provider);
          if (settings) {
            const credentials = (() => { try { return JSON.parse(settings.credentials || '{}'); } catch { return {}; } })();
            p.updateStatus(orderData, orderData.external_order_id, status, credentials)
              .then(result => {
                const logStatus = result.ok ? 'success' : 'error';
                try {
                  db.prepare(`INSERT INTO aggregator_sync_log (tenant_id, provider, operation, request, response, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    settings.tenant_id || 1, provider, 'status_update',
                    `PUT /orders/${orderData.external_order_id}/status -> ${status}`,
                    JSON.stringify(result.data), logStatus,
                    result.ok ? null : (result.data?.message || JSON.stringify(result.data))
                  );
                } catch(e) {}
              })
              .catch(err => {
                try {
                  db.prepare(`INSERT INTO aggregator_sync_log (tenant_id, provider, operation, request, response, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    settings.tenant_id || 1, provider, 'status_update',
                    `PUT /orders/${orderData.external_order_id}/status -> ${status}`, '', 'error', err.message
                  );
                } catch(e) {}
              });
          }
        }
      }
    } catch(e) {}
  }

  res.json(updated);
});
app.put('/api/orders/:id/assign', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { courier_id, courier_name, assigned_by } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    if (courier_id && courier_id > 0) {
      db.prepare("UPDATE orders SET courier_id = ?, courier_name = ?, assigned_by = ?, assigned_at = datetime('now'), status = 'assigned', updated_at = datetime('now') WHERE id = ?")
        .run(courier_id, courier_name, assigned_by, req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'assigned', `Назначен курьер ${courier_name}`);
      broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'assigned', courier: courier_name });
    } else {
      db.prepare("UPDATE orders SET courier_id = NULL, courier_name = NULL, assigned_by = NULL, assigned_at = NULL, status = 'ready', updated_at = datetime('now') WHERE id = ?")
        .run(req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Курьер отказался');
      broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready', note: 'Курьер отказался' });
    }

    const updated = emitOrderUpdate(req.params.id);
    io.emit('order:assigned', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/orders/:id/returning', authenticateToken, requireRole('courier'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Заказ ещё не доставлен' });
    const rc = getRestaurantCoords();
    if (!rc) return res.status(400).json({ error: 'Не указаны координаты ресторана' });
    const route = await calcRoute(lat, lng, rc.lat, rc.lng);
    const eta = new Date(Date.now() + route.durationMin * 60000).toISOString();
    db.prepare(`UPDATE orders SET is_returning = 1, return_started_at = datetime('now'),
      return_distance_km = ?, return_duration_min = ?, return_eta = ?,
      return_courier_lat = ?, return_courier_lng = ?, return_route_polyline = ? WHERE id = ?`)
      .run(route.distanceKm, route.durationMin, eta, lat, lng, route.polyline, req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-update', orderId: Number(req.params.id), courierName: order.courier_name, distanceKm: route.distanceKm, durationMin: route.durationMin, eta, courierLat: lat, courierLng: lng, polyline: route.polyline }));
    res.json({ ok: true, distanceKm: route.distanceKm, durationMin: route.durationMin, eta, polyline: route.polyline });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/orders/:id/returning', authenticateToken, requireRole('courier'), (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    db.prepare(`UPDATE orders SET is_returning = 0, return_started_at = NULL, return_distance_km = 0,
      return_duration_min = 0, return_eta = NULL, return_courier_lat = 0, return_courier_lng = 0,
      return_route_polyline = '' WHERE id = ?`)
      .run(req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-cancelled', orderId: Number(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/:id/returning/arrived', authenticateToken, requireRole('courier'), (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    db.prepare(`UPDATE orders SET is_returning = 0, return_started_at = NULL, return_distance_km = 0,
      return_duration_min = 0, return_eta = NULL, return_courier_lat = 0, return_courier_lng = 0,
      return_route_polyline = '' WHERE id = ?`)
      .run(req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-arrived', orderId: Number(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/website/orders', (req, res) => {
  try {
    const { items, subtotal, total, discount, promoCode, address, comment, paymentMethod, type, userName, userPhone, userId, pickupPointId, bonusUsed, source } = req.body;
    if (!userName || !userPhone) return res.status(400).json({ error: 'Имя и телефон обязательны' });

    let finalTotal = total || subtotal || 0;
    let appliedBonus = 0;

    if (bonusUsed && bonusUsed > 0 && userId) {
      try {
        const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
        if (bonus && bonus.balance >= bonusUsed) {
          const info = getGuestBonusInfo(userId);
          const maxWriteOff = finalTotal * (info.maxWriteOffPercent / 100);
          const canUse = Math.min(bonusUsed, bonus.balance, maxWriteOff);
          if (canUse > 0) { appliedBonus = canUse; finalTotal = Math.max(0, finalTotal - canUse); }
        }
      } catch (e) {}
    }

    const itemsJson = JSON.stringify(items || []);
    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, address, items, subtotal, total, discount, payment_method, type, comment, status, bonus_used, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 'website')`)
      .run(userId || 0, userName, userPhone, address || '', itemsJson, subtotal || 0, finalTotal, discount || 0, paymentMethod || 'cash', type || 'delivery', comment || '', appliedBonus);
    const orderId = info.lastInsertRowid;
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', 'Заказ с сайта');

    if (appliedBonus > 0 && userId) {
      try {
        const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
        if (bonus) {
          db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(appliedBonus, appliedBonus, bonus.id);
          db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'spend', appliedBonus, `Списание за заказ #${orderId} (сайт)`, 'order', orderId);
        }
      } catch (e) { console.error('[Website] Bonus spend error:', e.message); }
    }

    io.emit('order:new', getOrderFull(orderId));
    emitOrderUpdate(orderId);
    broadcast({ type: 'order:new', orderId: Number(orderId), source: 'website' });
    res.status(201).json({ orderId, id: orderId, ...getOrderFull(orderId) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/website/orders', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? AND source = 'website' ORDER BY created_at DESC LIMIT 50").all(userId);
    res.json(toCamelCaseArray(rows));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/website/orders/:id/tracking', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(toCamelCase({ ...order, statusHistory: toCamelCaseArray(history) }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/orders/multi-status', (req, res) => {
  try {
    const { statuses } = req.body;
    if (!Array.isArray(statuses) || statuses.length === 0) return res.status(400).json({ error: 'Укажите статусы' });
    const placeholders = statuses.map(() => '?').join(',');
    const orders = db.prepare(`SELECT * FROM orders WHERE status IN (${placeholders}) ORDER BY created_at DESC`).all(...statuses);
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      let courierPhone = null;
      if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/bulk-status', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { ids, status, note } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) return res.status(400).json({ error: 'ids и status обязательны' });
    if (!STATUS_CHAIN[status]) return res.status(400).json({ error: `Неизвестный статус: ${status}` });
    const results = [];
    for (const id of ids) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      if (!order) { results.push({ id, error: 'Заказ не найден' }); continue; }
      if (status !== order.status) {
        const validation = validateTransition(order.id, order.status, status);
        if (!validation.valid) { results.push({ id, error: validation.error }); continue; }
      }

      const bulkTr = db.transaction(() => {
        if (status === 'ready' && order.status !== 'ready') {
          const items = JSON.parse(order.items || '[]');
          for (const item of items) {
            const dishId = item.dishId;
            const qty = item.quantity || 1;
            const techCard = db.prepare('SELECT * FROM tech_cards WHERE dish_id = ? ORDER BY created_at DESC').get(dishId);
            if (!techCard) continue;
            let ingredients = [];
            try { ingredients = JSON.parse(techCard.ingredients || '[]'); } catch {}
            for (const ing of ingredients) {
              const invItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?').get(ing.name);
              if (!invItem) continue;
              const needQty = ing.quantity * qty;
              const actualStock = invItem.current_balance ?? invItem.current_stock ?? 0;
              if (actualStock < needQty) {
                throw new Error(`Недостаточно ингредиента "${ing.name}" на складе: нужно ${needQty} ${ing.unit}, осталось ${actualStock} ${invItem.unit}`);
              }
            }
            for (const ing of ingredients) {
              const invItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?').get(ing.name);
              if (!invItem) continue;
              const needQty = ing.quantity * qty;
              db.prepare("UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?").run(needQty, invItem.id);
              db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(invItem.id, 'write_off', needQty, `Списание по техкарте: заказ #${id}`);
            }
          }
        }
        db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
        const noteText = note || STATUS_LABELS[status] || status;
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(id, status, noteText);
        broadcast({ type: 'order:update', orderId: id, status, note: noteText });
        if (status === 'delivered') {
          db.prepare('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?').run(order.courier_id);
          db.prepare('UPDATE users SET total_spent = total_spent + ? WHERE id = ?').run(order.total, order.user_id);
        }
      });

      try {
        bulkTr();
        emitOrderUpdate(id);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, error: safeError(e.message) });
      }
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/orders/:id/serve', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (order.status !== 'ready') return res.status(400).json({ error: 'Заказ ещё не готов' });

    db.prepare("UPDATE orders SET status = 'served', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'served', 'Подано официантом');
    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'served' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/:id/split', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { items: splitItemIds } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const orderItems = JSON.parse(order.items || '[]');
    const splitItems = orderItems.filter((_, i) => splitItemIds.includes(i));
    const remainingItems = orderItems.filter((_, i) => !splitItemIds.includes(i));
    if (!splitItems.length) return res.status(400).json({ error: 'Нет позиций для разделения' });
    if (!remainingItems.length) return res.status(400).json({ error: 'Нельзя разделить все позиции, создайте новый заказ' });

    const splitTotal = splitItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    const remainingTotal = remainingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);

    db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(remainingItems), remainingTotal, remainingTotal, req.params.id);

    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, check_id, payment_method, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(order.user_id, order.user_name, order.user_phone, JSON.stringify(splitItems), splitTotal, splitTotal,
        order.type, 'new', order.table_number, order.waiter_id, order.waiter_name, order.check_id, order.payment_method,
        `Разделён из заказа #${req.params.id}`);

    const newOrderId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(newOrderId, 'new', `Разделён из заказа #${req.params.id}`);

    broadcast({ type: 'order:update', orderId: Number(req.params.id) });
    io.emit('order:update', getOrderFull(req.params.id));
    const newOrder = getOrderFull(newOrderId);
    io.emit('order:new', newOrder);

    res.json({ original: getOrderFull(req.params.id), split: newOrder });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/merge', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || orderIds.length < 2) return res.status(400).json({ error: 'Need at least 2 order IDs' });

    const orders = orderIds.map((id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id)).filter(Boolean);
    if (orders.length < 2) return res.status(400).json({ error: 'Не удалось найти заказы для объединения' });

    const allItems = [];
    let totalMerged = 0;

    const keep = orders[0];
    for (let i = 1; i < orders.length; i++) {
      const mergeOrder = orders[i];
      const items = JSON.parse(mergeOrder.items || '[]');
      allItems.push(...items);
      totalMerged += items.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(mergeOrder.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(mergeOrder.id, 'cancelled', `Объединён с заказом #${keep.id}`);
    }

    const existingItems = JSON.parse(keep.items || '[]');
    const mergedItems = [...existingItems, ...allItems];
    const mergedTotal = existingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0) + totalMerged;

    db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(mergedItems), mergedTotal, mergedTotal, keep.id);

    broadcast({ type: 'order:update', orderId: keep.id });
    io.emit('order:update', getOrderFull(keep.id));
    res.json(getOrderFull(keep.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/orders/:id/payment', authenticateToken, requireRole('waiter'), (req, res) => {
  try {
    const { paymentMethod, amount, isPaid, bonusUsed } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const paidAmount = amount || order.total;
    // Associate with open shift if any
    const activeShift = db.prepare("SELECT id FROM cashier_shifts WHERE status = 'open' AND tenant_id = 1 LIMIT 1").get();
    const shiftId = activeShift ? activeShift.id : 0;
    db.prepare("UPDATE orders SET payment_method = ?, total = ?, is_paid = ?, status = 'paid', bonus_used = ?, shift_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(paymentMethod || order.payment_method, paidAmount, isPaid !== false ? 1 : 0, bonusUsed || 0, shiftId, req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'paid', `Оплачено: ${paidAmount}₽`);

    // If order has a check, update check total
    if (order.check_id) {
      const otherOrders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND id != ? AND status NOT IN ('closed','cancelled')").all(order.check_id, req.params.id);
      const otherTotal = otherOrders.reduce((s, o) => s + o.total, 0);
      if (otherTotal === 0) {
        db.prepare("UPDATE dine_in_checks SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(order.check_id);
      }
    }

    // Auto-create fiscal receipt
    try {
      const fiscalKkt = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").get();
      if (fiscalKkt) {
        const receiptId = fiscalization.createReceipt(db, { ...order, total: paidAmount }, paymentMethod || order.payment_method);
        // Async print - don't block response
        setImmediate(async () => {
          try {
            const activeKkt = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").all();
            if (activeKkt.length > 0) {
              await fiscalization.printReceiptById(db, receiptId);
            }
          } catch (e) { console.error('[Fiscal] Auto-print error:', e.message); }
        });
      }
    } catch (e) { console.error('[Fiscal] Auto-receipt creation error:', e.message); }

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'paid' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.patch('/api/orders/:id/items/:dishId/status', authenticateToken, requireRole('waiter', 'kitchen'), (req, res) => {
  try {
    const { status, chefId } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const now = new Date().toISOString();
    let extraSet = '';
    const params = [status];

    if (status === 'preparing') {
      const tc = db.prepare('SELECT cooking_time FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1').get(req.params.dishId);
      const cookTime = tc?.cooking_time || 10;
      const readyAt = new Date(Date.now() + cookTime * 60 * 1000).toISOString();
      extraSet = ', started_at = ?, expected_ready_at = ?';
      params.push(now, readyAt);
    }
    if (status === 'ready') { extraSet = ', completed_at = ?'; params.push(now); }

    const existing = db.prepare('SELECT * FROM order_item_statuses WHERE order_id = ? AND dish_id = ?').get(req.params.id, req.params.dishId);
    if (existing) {
      params.push(req.params.id, req.params.dishId);
      db.prepare(`UPDATE order_item_statuses SET status = ?${extraSet}${chefId ? ', prepared_by = ?' : ''} WHERE order_id = ? AND dish_id = ?`).run(...params, ...(chefId ? [chefId] : []));
    } else {
      const insReadyAt = status === 'preparing' ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
      db.prepare(`INSERT INTO order_item_statuses (status, started_at, expected_ready_at, order_id, dish_id, prepared_by) VALUES (?, ?, ?, ?, ?, ?)`).run(status, status === 'preparing' ? now : null, insReadyAt, req.params.id, req.params.dishId, chefId || null);
    }

    // Update item status in order's JSON items
    const items = JSON.parse(order.items || '[]');
    const updated = items.map((item) => {
      if (item.dishId === Number(req.params.dishId)) {
        return { ...item, itemStatus: status };
      }
      return item;
    });
    db.prepare('UPDATE orders SET items = ? WHERE id = ?').run(JSON.stringify(updated), req.params.id);

    broadcast({ type: 'order:item:update', orderId: Number(req.params.id), dishId: Number(req.params.dishId), status });
    io.emit('order:item:update', { orderId: Number(req.params.id), dishId: Number(req.params.dishId), status });

    // Check if all items are ready -> auto-complete order
    if (status === 'ready') {
      const remaining = db.prepare("SELECT COUNT(*) as cnt FROM order_item_statuses WHERE order_id = ? AND status != 'ready' AND status != 'served'").get(req.params.id);
      if (remaining.cnt === 0) {
        db.prepare("UPDATE orders SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Все блюда готовы');
        broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready' });
        io.emit('order:update', getOrderFull(req.params.id));
      }
    }

    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};