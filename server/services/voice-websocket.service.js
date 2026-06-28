const WebSocket = require('ws');
const voiceRecognition = require('./voice-recognition.service');
const voiceBuffer = require('./voice-buffer.service');
const VoiceParserService = require('./voice-parser.service');

/**
 * Voice WebSocket Server
 * Принимает аудио-потоки от Bluetooth-гарнитур
 * Идентифицирует официантов и передает аудио в распознавание
 */
class VoiceWebSocketServer {
  constructor(httpServer, db, headsetService) {
    this.db = db;
    this.headsetService = headsetService;
    this.parser = new VoiceParserService(db);
    
    this.wss = new WebSocket.Server({
      server: httpServer,
      path: '/ws/voice',
    });

    this.connections = new Map(); // ws -> { waiterId, sessionId, deviceMac }
    
    this.setupHandlers();
    this.setupRecognitionListeners();
    
    console.log('[VoiceWS] WebSocket server initialized at /ws/voice');
  }

  /**
   * Настроить обработчики WebSocket
   */
  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      console.log('[VoiceWS] New connection from', req.socket.remoteAddress);
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[VoiceWS] Connection error:', err.message);
        this.handleDisconnect(ws);
      });
    });
  }

  /**
   * Настроить слушатели распознавания
   */
  setupRecognitionListeners() {
    voiceRecognition.on('transcription', ({ sessionId, waiterId, text, isFinal }) => {
      if (!isFinal) return; // Обрабатываем только финальные результаты
      
      console.log(`[VoiceWS] Transcription for waiter ${waiterId}: "${text}"`);
      
      // Найти WebSocket соединение для этого официанта
      const ws = this.findConnectionByWaiterId(waiterId);
      if (!ws) return;

      const conn = this.connections.get(ws);
      if (!conn) return;

      // Парсить текст
      const parsed = this.parser.parse(text, conn.tenantId);
      
      // Обработать команду
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

  /**
   * Обработать входящее сообщение
   */
  handleMessage(ws, data) {
    try {
      // Первое сообщение — регистрация (JSON)
      if (!this.connections.has(ws)) {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'register') {
          this.handleRegister(ws, msg);
          return;
        }
      }

      // Последующие сообщения — аудио (binary)
      const conn = this.connections.get(ws);
      if (conn && conn.sessionId) {
        voiceRecognition.sendAudio(conn.sessionId, data);
      }
    } catch (e) {
      console.error('[VoiceWS] Message error:', e.message);
    }
  }

  /**
   * Обработать регистрацию гарнитуры
   */
  handleRegister(ws, msg) {
    const { deviceMac, deviceName, tenantId } = msg;
    
    // Идентифицировать официанта по MAC
    const waiter = this.headsetService.identifyWaiter(deviceMac);
    
    if (!waiter) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Гарнитура не привязана к официанту. Обратитесь к администратору.',
      });
      ws.close();
      return;
    }

    // Начать сессию распознавания
    const { sessionId } = voiceRecognition.startSession(waiter.waiterId, deviceMac);
    
    // Сохранить соединение
    this.connections.set(ws, {
      waiterId: waiter.waiterId,
      waiterNick: waiter.waiterNick,
      deviceMac,
      deviceName,
      sessionId,
      tenantId,
    });

    this.sendToClient(ws, {
      type: 'registered',
      waiterId: waiter.waiterId,
      waiterNick: waiter.waiterNick,
      sessionId,
    });

    console.log(`[VoiceWS] Registered: ${waiter.waiterNick} (${deviceMac})`);
  }

  /**
   * Обработать отключение
   */
  handleDisconnect(ws) {
    const conn = this.connections.get(ws);
    if (conn && conn.sessionId) {
      voiceRecognition.endSession(conn.sessionId);
      console.log(`[VoiceWS] Disconnected: ${conn.waiterNick}`);
    }
    this.connections.delete(ws);
  }

  /**
   * Обработать распознанную команду
   */
  processCommand(ws, conn, parsed) {
    const { waiterId } = conn;
    const buffer = voiceBuffer.getBuffer(waiterId, conn.waiterNick);

    // Обработать команду
    if (parsed.command === 'SUBMIT') {
      this.handleSubmitOrder(ws, conn, buffer);
      return;
    }

    if (parsed.command === 'CANCEL') {
      voiceBuffer.clearBuffer(waiterId);
      this.sendToClient(ws, {
        type: 'bufferCleared',
        message: 'Буфер очищен',
      });
      return;
    }

    if (parsed.command === 'SHOW') {
      this.sendToClient(ws, {
        type: 'bufferStatus',
        buffer,
      });
      return;
    }

    // Установить стол
    if (parsed.table) {
      voiceBuffer.setTable(waiterId, parsed.table);
      this.sendToClient(ws, {
        type: 'tableSet',
        table: parsed.table,
      });
    }

    // Установить зону
    if (parsed.zone) {
      voiceBuffer.setZone(waiterId, parsed.zone);
      this.sendToClient(ws, {
        type: 'zoneSet',
        zone: parsed.zone,
      });
    }

    // Добавить блюда
    if (parsed.dishes.length > 0) {
      for (const dish of parsed.dishes) {
        // Если зона не указана, определить автоматически
        if (!dish.zone) {
          dish.zone = this.parser.inferZone(dish, conn.tenantId);
        }
        
        // Если буфер имеет установленную зону, использовать её
        if (buffer.zone && !dish.zone) {
          dish.zone = buffer.zone;
        }

        voiceBuffer.addItem(waiterId, dish);
      }

      this.sendToClient(ws, {
        type: 'dishesAdded',
        dishes: parsed.dishes,
        buffer: voiceBuffer.getBuffer(waiterId),
      });
    }
  }

  /**
   * Оформить заказ
   */
  handleSubmitOrder(ws, conn, buffer) {
    if (!buffer.table) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Укажите номер стола перед оформлением заказа',
      });
      return;
    }

    if (buffer.items.length === 0) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Заказ пуст. Добавьте блюда перед оформлением',
      });
      return;
    }

    // Разбить по зонам
    const zones = {
      kitchen: [],
      bar: [],
      hookah: [],
    };

    for (const item of buffer.items) {
      const zone = item.zone || 'kitchen';
      if (!zones[zone]) zones[zone] = [];
      zones[zone].push(item);
    }

    // Создать заказы для каждой зоны
    const createdOrders = [];
    
    for (const [zone, items] of Object.entries(zones)) {
      if (items.length === 0) continue;

      const order = this.createOrder(conn, buffer.table, items, zone);
      if (order) {
        createdOrders.push({ ...order, zone });
      }
    }

    // Очистить буфер
    voiceBuffer.clearBuffer(conn.waiterId);

    this.sendToClient(ws, {
      type: 'orderCreated',
      orders: createdOrders,
      message: `Заказ оформлен: ${createdOrders.length} ${this.pluralize(createdOrders.length, 'заказ', 'заказа', 'заказов')}`,
    });

    // Broadcast всем клиентам об обновлении заказов
    this.broadcastOrderUpdate(createdOrders);
  }

  /**
   * Создать заказ в БД
   */
  createOrder(conn, table, items, zone) {
    try {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      const result = this.db.prepare(`
        INSERT INTO orders (
          user_id, user_name, user_phone, address, items, subtotal,
          delivery_fee, discount, total, payment_method, type, status,
          tenant_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'cash', 'dine_in', 'new', ?, datetime('now'), datetime('now'))
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
      
      // Добавить в историю статусов
      this.db.prepare(`
        INSERT INTO order_status_history (order_id, status, note, created_at)
        VALUES (?, 'new', ?, datetime('now'))
      `).run(orderId, `Создан через голосовой ввод (${zone})`);

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

  /**
   * Broadcast обновления заказов
   */
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

  /**
   * Найти соединение по waiterId
   */
  findConnectionByWaiterId(waiterId) {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.waiterId === waiterId) return ws;
    }
    return null;
  }

  /**
   * Отправить сообщение клиенту
   */
  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Склонение слов
   */
  pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      activeSessions: voiceRecognition.getActiveSessions().length,
      activeBuffers: voiceBuffer.getActiveBuffers().length,
    };
  }

  /**
   * Остановить сервер
   */
  stop() {
    voiceRecognition.stopAll();
    voiceBuffer.stop();
    this.wss.close();
  }
}

module.exports = VoiceWebSocketServer;
