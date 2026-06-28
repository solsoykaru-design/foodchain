const VoiceHeadsetService = require('../services/voice-headset.service');
const voiceBuffer = require('../services/voice-buffer.service');
const VoiceParserService = require('../services/voice-parser.service');

module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, toCamelCase } = config;
  
  const headsetService = new VoiceHeadsetService(db);
  const parser = new VoiceParserService(db);

  // ─── Гарнитуры ───────────────────────────────────────────────
  
  /**
   * GET /api/voice/headsets
   * Получить все гарнитуры
   */
  app.get('/api/voice/headsets', authenticateToken, (req, res) => {
    try {
      const headsets = headsetService.getAll(req.tenant_id);
      res.json(headsets.map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/voice/headsets/active
   * Получить активные гарнитуры (с привязанными официантами)
   */
  app.get('/api/voice/headsets/active', authenticateToken, (req, res) => {
    try {
      const headsets = headsetService.getActiveHeadsets(req.tenant_id);
      res.json(headsets.map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/voice/headsets
   * Привязать гарнитуру к официанту
   */
  app.post('/api/voice/headsets', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const { deviceMac, deviceName, waiterId, waiterNick } = req.body;
      
      if (!deviceMac || !waiterId) {
        return res.status(400).json({ error: 'deviceMac и waiterId обязательны' });
      }

      const headset = headsetService.bindHeadset(
        deviceMac,
        deviceName || 'Unknown Device',
        waiterId,
        waiterNick || `Официант ${waiterId}`,
        req.tenant_id
      );

      res.json(toCamelCase(headset));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /api/voice/headsets/:mac
   * Отвязать гарнитуру
   */
  app.delete('/api/voice/headsets/:mac', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const headset = headsetService.unbindHeadset(req.params.mac);
      res.json(toCamelCase(headset));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /api/voice/headsets/:mac/remove
   * Удалить гарнитуру
   */
  app.delete('/api/voice/headsets/:mac/remove', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      headsetService.deleteHeadset(req.params.mac);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Буферы заказов ──────────────────────────────────────────

  /**
   * GET /api/voice/buffer/:waiterId
   * Получить буфер официанта
   */
  app.get('/api/voice/buffer/:waiterId', authenticateToken, (req, res) => {
    try {
      const buffer = voiceBuffer.getBufferByWaiterId(Number(req.params.waiterId));
      if (!buffer) {
        return res.json({ items: [], table: null, zone: null });
      }
      res.json(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/voice/buffers
   * Получить все активные буферы
   */
  app.get('/api/voice/buffers', authenticateToken, (req, res) => {
    try {
      const buffers = voiceBuffer.getActiveBuffers();
      res.json(buffers);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/voice/buffer/:waiterId/clear
   * Очистить буфер
   */
  app.post('/api/voice/buffer/:waiterId/clear', authenticateToken, (req, res) => {
    try {
      voiceBuffer.clearBuffer(Number(req.params.waiterId));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Парсинг команд ──────────────────────────────────────────

  /**
   * POST /api/voice/parse
   * Распарсить текстовую команду
   */
  app.post('/api/voice/parse', authenticateToken, (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'text обязателен' });
      }

      const parsed = parser.parse(text, req.tenant_id);
      res.json(parsed);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/voice/command
   * Обработать голосовую команду (добавить в буфер)
   */
  app.post('/api/voice/command', authenticateToken, (req, res) => {
    try {
      const { waiterId, waiterNick, text } = req.body;
      
      if (!waiterId || !text) {
        return res.status(400).json({ error: 'waiterId и text обязательны' });
      }

      const parsed = parser.parse(text, req.tenant_id);
      const buffer = voiceBuffer.getBuffer(waiterId, waiterNick);

      // Установить стол
      if (parsed.table) {
        voiceBuffer.setTable(waiterId, parsed.table);
      }

      // Установить зону
      if (parsed.zone) {
        voiceBuffer.setZone(waiterId, parsed.zone);
      }

      // Добавить блюда
      if (parsed.dishes.length > 0) {
        for (const dish of parsed.dishes) {
          if (!dish.zone) {
            dish.zone = parser.inferZone(dish, req.tenant_id);
          }
          if (buffer.zone && !dish.zone) {
            dish.zone = buffer.zone;
          }
          voiceBuffer.addItem(waiterId, dish);
        }
      }

      // Обработать команды
      if (parsed.command === 'CANCEL') {
        voiceBuffer.clearBuffer(waiterId);
        return res.json({ 
          success: true, 
          command: 'CANCEL',
          message: 'Буфер очищен',
        });
      }

      res.json({
        success: true,
        parsed,
        buffer: voiceBuffer.getBuffer(waiterId),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Блюда и зоны ────────────────────────────────────────────

  /**
   * GET /api/voice/dishes
   * Получить все блюда с зонами
   */
  app.get('/api/voice/dishes', authenticateToken, (req, res) => {
    try {
      const dishes = headsetService.getDishesWithZones(req.tenant_id);
      res.json(dishes.map(toCamelCase));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * PUT /api/voice/dishes/:id/zone
   * Установить зону для блюда
   */
  app.put('/api/voice/dishes/:id/zone', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const { zone } = req.body;
      if (!zone || !['kitchen', 'bar', 'hookah'].includes(zone)) {
        return res.status(400).json({ error: 'zone должен быть kitchen, bar или hookah' });
      }

      headsetService.setDishZone(Number(req.params.id), zone);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/voice/dishes/bulk-zones
   * Массовое обновление зон
   */
  app.post('/api/voice/dishes/bulk-zones', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'updates должен быть массивом' });
      }

      headsetService.bulkUpdateZones(updates);
      parser.clearCache();
      res.json({ success: true, updated: updates.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Статистика ──────────────────────────────────────────────

  /**
   * GET /api/voice/stats
   * Получить статистику голосовой системы
   */
  app.get('/api/voice/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        activeBuffers: voiceBuffer.getActiveBuffers().length,
        totalHeadsets: headsetService.getAll(req.tenant_id).length,
        activeHeadsets: headsetService.getActiveHeadsets(req.tenant_id).length,
      };
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log('[VoiceAPI] Routes registered');
};
