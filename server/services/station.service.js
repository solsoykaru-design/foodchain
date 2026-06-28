/**
 * Kitchen Station Service
 * Управление станциями кухни и разбиение заказов по станциям.
 */

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      printer_id INTEGER,
      printer_name TEXT,
      sort_order INTEGER DEFAULT 0,
      color TEXT DEFAULT '#f97316',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_station_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      order_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      station_name TEXT,
      items TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      printed INTEGER DEFAULT 0,
      ready_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure dishes has station_id
  try { db.exec(`ALTER TABLE dishes ADD COLUMN station_id INTEGER`); } catch (e) {}
  try { db.exec(`ALTER TABLE menu_items ADD COLUMN station_id INTEGER`); } catch (e) {}
  // Ensure orders has station_items JSON
  try { db.exec(`ALTER TABLE orders ADD COLUMN station_items TEXT DEFAULT '[]'`); } catch (e) {}
}

function getStations(db, tenantId) {
  initTables(db);
  return db.prepare('SELECT * FROM stations WHERE tenant_id = ? ORDER BY sort_order, id').all(tenantId);
}

function getStation(db, tenantId, id) {
  initTables(db);
  return db.prepare('SELECT * FROM stations WHERE id = ? AND tenant_id = ?').get(id, tenantId);
}

function saveStation(db, tenantId, data) {
  initTables(db);
  const { id, name, description, printerId, printerName, sortOrder, color } = data;
  if (id) {
    db.prepare(`
      UPDATE stations SET name = ?, description = ?, printer_id = ?, printer_name = ?, sort_order = ?, color = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).run(name, description || '', printerId || null, printerName || '', sortOrder || 0, color || '#f97316', id, tenantId);
    return getStation(db, tenantId, id);
  }
  const result = db.prepare(`
    INSERT INTO stations (tenant_id, name, description, printer_id, printer_name, sort_order, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, name, description || '', printerId || null, printerName || '', sortOrder || 0, color || '#f97316');
  return getStation(db, tenantId, result.lastInsertRowid);
}

function deleteStation(db, tenantId, id) {
  initTables(db);
  db.prepare('DELETE FROM stations WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { success: true };
}

function splitOrderByStations(db, tenantId, orderId) {
  initTables(db);
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(orderId, tenantId);
  if (!order) throw new Error('Заказ не найден');

  const items = JSON.parse(order.items || '[]');
  const groups = {};
  const unassigned = [];

  for (const item of items) {
    const dishId = item.dishId || item.dish_id;
    const dish = db.prepare('SELECT station_id FROM dishes WHERE id = ?').get(dishId);
    const stationId = dish?.station_id || item.stationId || null;
    if (stationId) {
      if (!groups[stationId]) groups[stationId] = [];
      groups[stationId].push(item);
    } else {
      unassigned.push(item);
    }
  }

  // Delete old splits
  db.prepare('DELETE FROM order_station_items WHERE order_id = ? AND tenant_id = ?').run(orderId, tenantId);

  const result = [];
  for (const [stationId, stationItems] of Object.entries(groups)) {
    const station = db.prepare('SELECT * FROM stations WHERE id = ? AND tenant_id = ?').get(stationId, tenantId);
    const stationName = station?.name || `Станция #${stationId}`;
    const info = db.prepare(`
      INSERT INTO order_station_items (tenant_id, order_id, station_id, station_name, items, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(tenantId, orderId, stationId, stationName, JSON.stringify(stationItems));
    result.push({ id: info.lastInsertRowid, stationId, stationName, items: stationItems, status: 'pending' });
  }

  if (unassigned.length > 0) {
    const info = db.prepare(`
      INSERT INTO order_station_items (tenant_id, order_id, station_id, station_name, items, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(tenantId, orderId, null, 'Без станции', JSON.stringify(unassigned));
    result.push({ id: info.lastInsertRowid, stationId: null, stationName: 'Без станции', items: unassigned, status: 'pending' });
  }

  // Update order station_items JSON
  db.prepare('UPDATE orders SET station_items = ? WHERE id = ?').run(JSON.stringify(result), orderId);

  return result;
}

function getOrderStationItems(db, tenantId, orderId) {
  initTables(db);
  return db.prepare('SELECT * FROM order_station_items WHERE order_id = ? AND tenant_id = ? ORDER BY station_id').all(orderId, tenantId);
}

function markStationReady(db, tenantId, orderId, stationItemId) {
  initTables(db);
  const row = db.prepare('SELECT * FROM order_station_items WHERE id = ? AND order_id = ? AND tenant_id = ?').get(stationItemId, orderId, tenantId);
  if (!row) throw new Error('Часть заказа не найдена');

  db.prepare(`UPDATE order_station_items SET status = 'ready', ready_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(stationItemId);

  // Check if all stations ready
  const pending = db.prepare(`SELECT COUNT(*) as cnt FROM order_station_items WHERE order_id = ? AND status != 'ready'`).get(orderId);
  const allReady = pending && pending.cnt === 0;

  return { success: true, allReady, stationItem: db.prepare('SELECT * FROM order_station_items WHERE id = ?').get(stationItemId) };
}

function getPendingStationOrders(db, tenantId, stationId) {
  initTables(db);
  let sql = 'SELECT * FROM order_station_items WHERE tenant_id = ? AND status = "pending"';
  const args = [tenantId];
  if (stationId) { sql += ' AND station_id = ?'; args.push(stationId); }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...args);
}

function setDishStation(db, tenantId, dishId, stationId) {
  initTables(db);
  db.prepare('UPDATE dishes SET station_id = ? WHERE id = ? AND tenant_id = ?').run(stationId || null, dishId, tenantId);
  return { success: true };
}

module.exports = {
  initTables,
  getStations,
  getStation,
  saveStation,
  deleteStation,
  splitOrderByStations,
  getOrderStationItems,
  markStationReady,
  getPendingStationOrders,
  setDishStation,
};
