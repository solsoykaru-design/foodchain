/**
 * Voice Headset Service
 * Управление Bluetooth-гарнитурами и привязка к официантам
 */

class VoiceHeadsetService {
  constructor(db) {
    this.db = db;
    this.initTable();
  }

  /**
   * Создать таблицу гарнитур
   */
  initTable() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS voice_headsets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_mac TEXT NOT NULL UNIQUE,
          device_name TEXT,
          waiter_id INTEGER,
          waiter_nick TEXT,
          is_active INTEGER DEFAULT 1,
          last_connected_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          tenant_id INTEGER DEFAULT 1,
          FOREIGN KEY (waiter_id) REFERENCES staff(id)
        )
      `);

      // Добавить поле zone в таблицу dishes, если его нет
      try {
        this.db.exec('ALTER TABLE dishes ADD COLUMN zone TEXT DEFAULT NULL');
        console.log('[VoiceHeadset] Added zone column to dishes table');
      } catch (e) {
        // Колонка уже существует
      }

      console.log('[VoiceHeadset] Tables initialized');
    } catch (e) {
      console.error('[VoiceHeadset] Init error:', e.message);
    }
  }

  /**
   * Получить все гарнитуры
   */
  getAll(tenantId) {
    return this.db.prepare(
      'SELECT * FROM voice_headsets WHERE tenant_id = ? ORDER BY created_at DESC'
    ).all(tenantId);
  }

  /**
   * Получить гарнитуру по MAC
   */
  getByMac(mac) {
    return this.db.prepare(
      'SELECT * FROM voice_headsets WHERE device_mac = ?'
    ).get(mac);
  }

  /**
   * Получить гарнитуру по waiterId
   */
  getByWaiterId(waiterId) {
    return this.db.prepare(
      'SELECT * FROM voice_headsets WHERE waiter_id = ? AND is_active = 1'
    ).get(waiterId);
  }

  /**
   * Привязать гарнитуру к официанту
   */
  bindHeadset(deviceMac, deviceName, waiterId, waiterNick, tenantId) {
    const existing = this.getByMac(deviceMac);
    
    if (existing) {
      this.db.prepare(`
        UPDATE voice_headsets 
        SET waiter_id = ?, waiter_nick = ?, device_name = ?, updated_at = datetime('now')
        WHERE device_mac = ?
      `).run(waiterId, waiterNick, deviceName, deviceMac);
    } else {
      this.db.prepare(`
        INSERT INTO voice_headsets (device_mac, device_name, waiter_id, waiter_nick, tenant_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(deviceMac, deviceName, waiterId, waiterNick, tenantId);
    }

    return this.getByMac(deviceMac);
  }

  /**
   * Отвязать гарнитуру
   */
  unbindHeadset(deviceMac) {
    this.db.prepare(`
      UPDATE voice_headsets 
      SET waiter_id = NULL, waiter_nick = NULL, updated_at = datetime('now')
      WHERE device_mac = ?
    `).run(deviceMac);
    return this.getByMac(deviceMac);
  }

  /**
   * Удалить гарнитуру
   */
  deleteHeadset(deviceMac) {
    this.db.prepare('DELETE FROM voice_headsets WHERE device_mac = ?').run(deviceMac);
  }

  /**
   * Обновить время последнего подключения
   */
  updateLastConnected(deviceMac) {
    this.db.prepare(`
      UPDATE voice_headsets 
      SET last_connected_at = datetime('now'), updated_at = datetime('now')
      WHERE device_mac = ?
    `).run(deviceMac);
  }

  /**
   * Определить официанта по MAC-адресу
   */
  identifyWaiter(deviceMac) {
    const headset = this.getByMac(deviceMac);
    if (headset && headset.waiter_id) {
      this.updateLastConnected(deviceMac);
      return {
        waiterId: headset.waiter_id,
        waiterNick: headset.waiter_nick,
        deviceMac: headset.device_mac,
        deviceName: headset.device_name,
      };
    }
    return null;
  }

  /**
   * Получить активные гарнитуры (с привязанными официантами)
   */
  getActiveHeadsets(tenantId) {
    return this.db.prepare(`
      SELECT vh.*, s.name as staff_name, s.role as staff_role
      FROM voice_headsets vh
      LEFT JOIN staff s ON vh.waiter_id = s.id
      WHERE vh.tenant_id = ? AND vh.waiter_id IS NOT NULL AND vh.is_active = 1
      ORDER BY vh.updated_at DESC
    `).all(tenantId);
  }

  /**
   * Установить зону для блюда
   */
  setDishZone(dishId, zone) {
    this.db.prepare('UPDATE dishes SET zone = ? WHERE id = ?').run(zone, dishId);
  }

  /**
   * Получить все блюда с зонами
   */
  getDishesWithZones(tenantId) {
    return this.db.prepare(`
      SELECT id, name, price, zone, category_id
      FROM dishes
      WHERE tenant_id = ? AND is_active = 1
      ORDER BY name
    `).all(tenantId);
  }

  /**
   * Массовое обновление зон для блюд
   */
  bulkUpdateZones(updates) {
    const stmt = this.db.prepare('UPDATE dishes SET zone = ? WHERE id = ?');
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        stmt.run(item.zone, item.dishId);
      }
    });
    transaction(updates);
  }
}

module.exports = VoiceHeadsetService;
