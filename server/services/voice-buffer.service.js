const EventEmitter = require('events');

/**
 * Voice Buffer Service
 * Управляет персональными буферами заказов для каждого официанта
 * Использует in-memory Map с TTL (10 минут бездействия)
 */
class VoiceBufferService extends EventEmitter {
  constructor() {
    super();
    this.buffers = new Map(); // waiterId -> buffer
    this.ttlMs = 10 * 60 * 1000; // 10 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000); // каждую минуту
  }

  /**
   * Получить или создать буфер для официанта
   */
  getBuffer(waiterId, waiterNick) {
    if (!this.buffers.has(waiterId)) {
      this.buffers.set(waiterId, {
        waiterId,
        waiterNick,
        table: null,
        zone: null,
        items: [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const buffer = this.buffers.get(waiterId);
    buffer.updatedAt = new Date().toISOString();
    return buffer;
  }

  /**
   * Добавить блюдо в буфер
   */
  addItem(waiterId, item) {
    const buffer = this.getBuffer(waiterId);
    buffer.items.push({
      ...item,
      id: Date.now() + Math.random(),
      addedAt: new Date().toISOString(),
    });
    buffer.updatedAt = new Date().toISOString();
    this.emit('bufferUpdated', { waiterId, buffer });
    return buffer;
  }

  /**
   * Удалить блюдо из буфера
   */
  removeItem(waiterId, itemId) {
    const buffer = this.buffers.get(waiterId);
    if (!buffer) return null;
    buffer.items = buffer.items.filter(i => i.id !== itemId);
    buffer.updatedAt = new Date().toISOString();
    this.emit('bufferUpdated', { waiterId, buffer });
    return buffer;
  }

  /**
   * Установить стол
   */
  setTable(waiterId, table) {
    const buffer = this.getBuffer(waiterId);
    buffer.table = table;
    buffer.updatedAt = new Date().toISOString();
    this.emit('bufferUpdated', { waiterId, buffer });
    return buffer;
  }

  /**
   * Установить зону для последующих блюд
   */
  setZone(waiterId, zone) {
    const buffer = this.getBuffer(waiterId);
    buffer.zone = zone;
    buffer.updatedAt = new Date().toISOString();
    this.emit('bufferUpdated', { waiterId, buffer });
    return buffer;
  }

  /**
   * Очистить буфер
   */
  clearBuffer(waiterId) {
    const buffer = this.buffers.get(waiterId);
    if (buffer) {
      buffer.items = [];
      buffer.table = null;
      buffer.zone = null;
      buffer.status = 'pending';
      buffer.updatedAt = new Date().toISOString();
      this.emit('bufferCleared', { waiterId });
    }
    return buffer;
  }

  /**
   * Получить все активные буферы
   */
  getActiveBuffers() {
    return Array.from(this.buffers.values()).filter(b => b.items.length > 0 || b.table);
  }

  /**
   * Получить буфер по waiterId
   */
  getBufferByWaiterId(waiterId) {
    return this.buffers.get(waiterId);
  }

  /**
   * Очистка устаревших буферов
   */
  cleanup() {
    const now = Date.now();
    for (const [waiterId, buffer] of this.buffers.entries()) {
      const updatedAt = new Date(buffer.updatedAt).getTime();
      if (now - updatedAt > this.ttlMs) {
        this.buffers.delete(waiterId);
        this.emit('bufferExpired', { waiterId });
        console.log(`[VoiceBuffer] Buffer expired for waiter ${waiterId}`);
      }
    }
  }

  /**
   * Остановить сервис
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = new VoiceBufferService();
