const WebSocket = require('ws');
const voiceRecognition = require('./voice-recognition.service');
const voiceBuffer = require('./voice-buffer.service');
const VoiceParserService = require('./voice-parser.service');

/**
 * Voice WebSocket Server
 * Принимает аудио-потоки от Bluetooth-гарнитур, идентифицирует официантов,
 * ведёт персональные буферы и голосовые команды.
 */
class VoiceWebSocketServer {
  constructor(httpServer, db, headsetService, io) {
    this.db = db;
    this.headsetService = headsetService;
    this.io = io || null;
    this.parser = new VoiceParserService(db);

    this.wss = new WebSocket.Server({
      server: httpServer,
      path: '/ws/voice',
    });

    this.connections = new Map(); // ws -> { waiterId, sessionId, deviceMac, ... }
    this.pendingClarifications = new Map(); // waiterId -> { itemName, awaitingZone }

    this.setupHandlers();
    this.setupRecognitionListeners();
    this.setupBufferListeners();

    console.log('[VoiceWS] WebSocket server initialized at /ws/voice');
  }

  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      console.log('[VoiceWS] New connection from', req.socket.remoteAddress);

      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', (err) => {
        console.error('[VoiceWS] Connection error:', err.message);
        this.handleDisconnect(ws);
      });
    });
  }

  setupRecognitionListeners() {
    voiceRecognition.on('transcription', async ({ sessionId, waiterId, text, isFinal }) => {
      if (!isFinal) return;

      console.log(`[VoiceWS] Transcription for waiter ${waiterId}: "${text}"`);
      const ws = this.findConnectionByWaiterId(waiterId);
      if (!ws) return;

      const conn = this.connections.get(ws);
      if (!conn) return;

      // Проверяем, не ждём ли уточнение зоны
      const clarification = this.pendingClarifications.get(waiterId);
      if (clarification && clarification.awaitingZone) {
        const zone = this.parser.extractZone(text);
        if (zone) {
          voiceBuffer.addItem(waiterId, { ...clarification.item, zone });
          this.pendingClarifications.delete(waiterId);
          this.sendToClient(ws, {
            type: 'dishesAdded',
            dishes: [{ ...clarification.item, zone }],
            buffer: voiceBuffer.getBuffer(waiterId),
            tts: `${clarification.item.name} добавлено в зону ${this.parser.getZoneLabel(zone)}`,
          });
        } else {
          this.sendToClient(ws, {
            type: 'clarification',
            question: `Уточните зону для блюда "${clarification.item.name}": кухня, бар или кальянная?`,
          });
        }
        return;
      }

      const parsed = await this.parser.parse(text, conn.tenantId);
      this.processCommand(ws, conn, parsed);
    });

    voiceRecognition.on('sessionError', ({ sessionId, waiterId, error }) => {
      const ws = this.findConnectionByWaiterId(waiterId);
      if (ws) {
        this.sendToClient(ws, {
          type: 'error',
          message: `Ошибка распознавания: ${error}`,
        });
      }
    });
  }

  setupBufferListeners() {
    voiceBuffer.on('bufferExpired', ({ waiterId }) => {
      const ws = this.findConnectionByWaiterId(waiterId);
      if (ws) {
        this.sendToClient(ws, {
          type: 'bufferExpired',
          message: 'Буфер очищен из-за неактивности',
        });
      }
    });
  }

  async handleMessage(ws, data) {
    try {
      if (!this.connections.has(ws)) {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'register') {
          this.handleRegister(ws, msg);
          return;
        }
      }

      const conn = this.connections.get(ws);
      if (conn && conn.sessionId) {
        voiceRecognition.sendAudio(conn.sessionId, data);
      }
    } catch (e) {
      console.error('[VoiceWS] Message error:', e.message);
    }
  }

  handleRegister(ws, msg) {
    const { deviceMac, deviceName, tenantId } = msg;

    const waiter = this.headsetService.identifyWaiter(deviceMac);
    if (!waiter) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Гарнитура не привязана к официанту. Обратитесь к администратору.',
      });
      ws.close();
      return;
    }

    const { sessionId } = voiceRecognition.startSession(waiter.waiterId, deviceMac);

    this.connections.set(ws, {
      waiterId: waiter.waiterId,
      waiterNick: waiter.waiterNick,
      deviceMac,
      deviceName,
      sessionId,
      tenantId: tenantId || 1,
    });

    this.sendToClient(ws, {
      type: 'registered',
      waiterId: waiter.waiterId,
      waiterNick: waiter.waiterNick,
      sessionId,
    });

    console.log(`[VoiceWS] Registered: ${waiter.waiterNick} (${deviceMac})`);
  }

  handleDisconnect(ws) {
    const conn = this.connections.get(ws);
    if (conn && conn.sessionId) {
      voiceRecognition.endSession(conn.sessionId);
      console.log(`[VoiceWS] Disconnected: ${conn.waiterNick}`);
    }
    this.connections.delete(ws);
  }

  async processCommand(ws, conn, parsed) {
    const { waiterId } = conn;
    const buffer = voiceBuffer.getBuffer(waiterId, conn.waiterNick);

    // Установить стол
    if (parsed.table) {
      voiceBuffer.setTable(waiterId, parsed.table);
      this.sendToClient(ws, {
        type: 'tableSet',
        table: parsed.table,
        tts: `Стол ${parsed.table}`,
      });
    }

    // Установить зону по команде
    if (parsed.zone) {
      voiceBuffer.setZone(waiterId, parsed.zone);
      this.sendToClient(ws, {
        type: 'zoneSet',
        zone: parsed.zone,
        tts: `Зона ${this.parser.getZoneLabel(parsed.zone)}`,
      });
    }

    // Обработка команд без блюд
    switch (parsed.command) {
      case 'SUBMIT':
        return this.handleSubmitOrder(ws, conn, buffer);
      case 'CANCEL':
        voiceBuffer.clearBuffer(waiterId);
        return this.sendToClient(ws, {
          type: 'bufferCleared',
          message: 'Буфер очищен',
          tts: 'Буфер очищен',
        });
      case 'SHOW':
        return this.sendToClient(ws, {
          type: 'bufferStatus',
          buffer,
          tts: this.describeBuffer(buffer),
        });
      case 'PAID':
        return this.handleStatusCommand(ws, conn, buffer, 'paid', 'Оплачено');
      case 'REFUND':
        return this.handleStatusCommand(ws, conn, buffer, 'refunded', 'Возврат выполнен');
      case 'CLOSED':
        return this.handleStatusCommand(ws, conn, buffer, 'closed', 'Заказ закрыт');
    }

    // Удаление блюда
    if (parsed.command === 'DELETE') {
      return this.handleDelete(ws, conn, buffer, parsed);
    }

    // Добавление блюд
    if (parsed.dishes.length > 0) {
      const added = [];
      const needClarification = [];

      for (const dish of parsed.dishes) {
        if (!dish.zone) {
          dish.zone = this.parser.inferZone(dish, conn.tenantId);
        }
        if (buffer.zone && !dish.zone) {
          dish.zone = buffer.zone;
        }

        // Если блюдо не найдено в меню и зона не определена — запросить уточнение
        if (!dish.dishId && !dish.zone) {
          needClarification.push(dish);
          continue;
        }

        voiceBuffer.addItem(waiterId, dish);
        added.push(dish);
      }

      if (added.length > 0) {
        this.sendToClient(ws, {
          type: 'dishesAdded',
          dishes: added,
          buffer: voiceBuffer.getBuffer(waiterId),
          tts: `Добавлено: ${added.map(d => `${d.name} ${d.quantity > 1 ? '×' + d.quantity : ''}`).join(', ')}`,
        });
      }

      if (needClarification.length > 0) {
        const item = needClarification[0];
        this.pendingClarifications.set(waiterId, { item, awaitingZone: true });
        this.sendToClient(ws, {
          type: 'clarification',
          question: `Уточните зону для блюда "${item.name}": кухня, бар или кальянная?`,
          tts: `Уточните зону для блюда ${item.name}`,
        });
      }
      return;
    }

    // Команда ADD без распознанных блюд — добавляем текст как есть
    if (parsed.command === 'ADD' && parsed.dishes.length === 0) {
      const rawName = parsed.rawText.replace(/добавить|плюс|добавь/gi, '').trim();
      if (rawName) {
        this.pendingClarifications.set(waiterId, {
          item: { name: rawName, quantity: 1, modifiers: [], price: 0 },
          awaitingZone: true,
        });
        return this.sendToClient(ws, {
          type: 'clarification',
          question: `Уточните зону для блюда "${rawName}": кухня, бар или кальянная?`,
          tts: `Уточните зону для блюда ${rawName}`,
        });
      }
    }

    // Если ничего не распознано
    if (!parsed.command && parsed.dishes.length === 0 && !parsed.table && !parsed.zone) {
      this.sendToClient(ws, {
        type: 'notRecognized',
        message: 'Не удалось распознать заказ. Повторите.',
        tts: 'Не удалось распознать заказ. Повторите.',
      });
    }
  }

  describeBuffer(buffer) {
    if (!buffer.items.length) return 'Буфер пуст';
    const items = buffer.items.map(i => `${i.name} ${i.quantity > 1 ? '×' + i.quantity : ''}`).join(', ');
    const tableStr = buffer.table ? `, стол ${buffer.table}` : '';
    return `В заказе${tableStr}: ${items}`;
  }

  handleDelete(ws, conn, buffer, parsed) {
    const { waiterId } = conn;
    if (!parsed.deleteTarget && buffer.items.length > 0) {
      // Удаляем последнее добавленное
      const last = buffer.items[buffer.items.length - 1];
      voiceBuffer.removeItem(waiterId, last.id);
      return this.sendToClient(ws, {
        type: 'itemRemoved',
        item: last,
        buffer: voiceBuffer.getBuffer(waiterId),
        tts: `Убрано: ${last.name}`,
      });
    }

    if (parsed.deleteTarget && parsed.deleteTarget.startsWith('#')) {
      const idx = parseInt(parsed.deleteTarget.slice(1), 10) - 1;
      if (buffer.items[idx]) {
        const item = buffer.items[idx];
        voiceBuffer.removeItem(waiterId, item.id);
        return this.sendToClient(ws, {
          type: 'itemRemoved',
          item,
          buffer: voiceBuffer.getBuffer(waiterId),
          tts: `Убрано: ${item.name}`,
        });
      }
    }

    if (parsed.deleteTarget) {
      const item = buffer.items.find(i => this.parser.normalize(i.name).includes(this.parser.normalize(parsed.deleteTarget)));
      if (item) {
        voiceBuffer.removeItem(waiterId, item.id);
        return this.sendToClient(ws, {
          type: 'itemRemoved',
          item,
          buffer: voiceBuffer.getBuffer(waiterId),
          tts: `Убрано: ${item.name}`,
        });
      }
    }

    this.sendToClient(ws, {
      type: 'error',
      message: 'Не удалось найти блюдо для удаления',
      tts: 'Не удалось найти блюдо для удаления',
    });
  }

  handleSubmitOrder(ws, conn, buffer) {
    if (!buffer.table) {
      return this.sendToClient(ws, {
        type: 'error',
        message: 'Укажите номер стола перед оформлением заказа',
        tts: 'Укажите номер стола',
      });
    }

    if (buffer.items.length === 0) {
      return this.sendToClient(ws, {
        type: 'error',
        message: 'Заказ пуст. Добавьте блюда перед оформлением',
        tts: 'Заказ пуст',
      });
    }

    const zones = { kitchen: [], bar: [], hookah: [] };
    for (const item of buffer.items) {
      const zone = item.zone || 'kitchen';
      if (!zones[zone]) zones[zone] = [];
      zones[zone].push(item);
    }

    const createdOrders = [];
    for (const [zone, items] of Object.entries(zones)) {
      if (items.length === 0) continue;
      const order = this.createOrder(conn, buffer.table, items, zone);
      if (order) createdOrders.push({ ...order, zone });
    }

    voiceBuffer.clearBuffer(conn.waiterId);

    this.sendToClient(ws, {
      type: 'orderCreated',
      orders: createdOrders,
      message: `Заказ оформлен: ${createdOrders.length} ${this.pluralize(createdOrders.length, 'заказ', 'заказа', 'заказов')}`,
      tts: `Заказ оформлен, отправлен в ${createdOrders.map(o => this.parser.getZoneLabel(o.zone)).join(', ')}`,
    });

    this.broadcastOrderUpdate(createdOrders);
  }

  handleStatusCommand(ws, conn, buffer, status, label) {
    // Если в буфере есть активный заказ — обновляем последние заказы официанта
    const orders = this.findWaiterOrders(conn.waiterId, status === 'paid' ? ['new', 'preparing', 'ready'] : ['paid']);
    if (orders.length === 0) {
      return this.sendToClient(ws, {
        type: 'error',
        message: 'Нет подходящих заказов для изменения статуса',
        tts: 'Нет подходящих заказов',
      });
    }

    const updated = [];
    for (const order of orders.slice(0, 5)) {
      this.updateOrderStatus(order.id, status, label);
      updated.push(order.id);
    }

    this.sendToClient(ws, {
      type: 'statusUpdated',
      orderIds: updated,
      status,
      tts: label,
    });
  }

  findWaiterOrders(waiterId, statuses) {
    try {
      const placeholders = statuses.map(() => '?').join(',');
      return this.db.prepare(`
        SELECT * FROM orders
        WHERE user_id = ? AND status IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT 10
      `).all(waiterId, ...statuses);
    } catch (e) {
      console.error('[VoiceWS] findWaiterOrders error:', e.message);
      return [];
    }
  }

  updateOrderStatus(orderId, status, note) {
    try {
      this.db.prepare(`
        UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, orderId);

      this.db.prepare(`
        INSERT INTO order_status_history (order_id, status, note, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(orderId, status, note);

      if (this.io) {
        this.io.emit('order:status', { orderId, status });
        this.io.emit('order:update', this.getOrderFull(orderId));
      }
    } catch (e) {
      console.error('[VoiceWS] updateOrderStatus error:', e.message);
    }
  }

  getOrderFull(orderId) {
    try {
      const order = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return null;
      const history = this.db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
      return { ...order, statusHistory: history };
    } catch (e) {
      console.error('[VoiceWS] getOrderFull error:', e.message);
      return null;
    }
  }

  createOrder(conn, table, items, zone) {
    try {
      const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

      const result = this.db.prepare(`
        INSERT INTO orders (
          user_id, user_name, user_phone, address, items, subtotal,
          delivery_fee, discount, total, payment_method, type, status,
          tenant_id, created_at, updated_at, source
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'cash', 'dine_in', 'new', ?, datetime('now'), datetime('now'), 'voice')
      `).run(
        conn.waiterId,
        conn.waiterNick,
        '',
        `Стол ${table}`,
        JSON.stringify(items),
        subtotal,
        subtotal,
        conn.tenantId
      );

      const orderId = result.lastInsertRowid;

      this.db.prepare(`
        INSERT INTO order_status_history (order_id, status, note, created_at)
        VALUES (?, 'new', ?, datetime('now'))
      `).run(orderId, `Создан через голосовой ввод (${zone})`);

      if (this.io) {
        this.io.emit('order:new', { id: orderId, table, zone, waiterId: conn.waiterId });
      }

      return {
        id: orderId,
        table,
        items,
        subtotal,
        zone,
        waiterNick: conn.waiterNick,
      };
    } catch (e) {
      console.error('[VoiceWS] Create order error:', e.message);
      return null;
    }
  }

  broadcastOrderUpdate(orders) {
    const message = JSON.stringify({
      type: 'ordersUpdated',
      orders,
    });

    for (const ws of this.wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  findConnectionByWaiterId(waiterId) {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.waiterId === waiterId) return ws;
    }
    return null;
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  getStats() {
    return {
      activeConnections: this.connections.size,
      activeSessions: voiceRecognition.getActiveSessions().length,
      activeBuffers: voiceBuffer.getActiveBuffers().length,
    };
  }

  stop() {
    voiceRecognition.stopAll();
    voiceBuffer.stop();
    this.wss.close();
  }
}

module.exports = VoiceWebSocketServer;
