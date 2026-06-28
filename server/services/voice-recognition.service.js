const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Voice Recognition Service
 * Интеграция с Yandex SpeechKit для распознавания речи
 * Поддерживает потоковое распознавание аудио
 */
class VoiceRecognitionService extends EventEmitter {
  constructor() {
    super();
    this.yandexApiKey = process.env.YANDEX_SPEECH_KIT_KEY || '';
    this.yandexFolderId = process.env.YANDEX_FOLDER_ID || '';
    this.sessions = new Map(); // sessionId -> { ws, waiterId, buffer }
  }

  /**
   * Начать сессию распознавания для официанта
   */
  startSession(waiterId, deviceMac) {
    const sessionId = `${waiterId}_${Date.now()}`;
    
    if (!this.yandexApiKey) {
      console.log('[VoiceRecognition] Yandex SpeechKit not configured, using mock mode');
      return this.createMockSession(sessionId, waiterId);
    }

    const ws = new WebSocket(
      `wss://stt.api.cloud.yandex.net/speech/v1/stt:realtimeRecognition`,
      {
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`,
        },
      }
    );

    const session = {
      sessionId,
      waiterId,
      deviceMac,
      ws,
      buffer: Buffer.alloc(0),
      startedAt: new Date().toISOString(),
    };

    ws.on('open', () => {
      console.log(`[VoiceRecognition] Session started: ${sessionId} for waiter ${waiterId}`);
      ws.send(JSON.stringify({
        config: {
          specification: {
            audioEncoding: 'LINEAR16_PCM',
            sampleRateHertz: 16000,
            languageCode: 'ru-RU',
          },
        },
      }));
      this.sessions.set(sessionId, session);
      this.emit('sessionStarted', { sessionId, waiterId });
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.event_type === 'PARTIAL_TRANSCRIPTION' || response.event_type === 'FINAL_TRANSCRIPTION') {
          const text = response.partial?.alternatives?.[0]?.text || response.final?.alternatives?.[0]?.text;
          if (text) {
            this.emit('transcription', {
              sessionId,
              waiterId,
              text,
              isFinal: response.event_type === 'FINAL_TRANSCRIPTION',
            });
          }
        }
      } catch (e) {
        console.error('[VoiceRecognition] Parse error:', e.message);
      }
    });

    ws.on('error', (err) => {
      console.error(`[VoiceRecognition] Session error ${sessionId}:`, err.message);
      this.emit('sessionError', { sessionId, waiterId, error: err.message });
    });

    ws.on('close', () => {
      console.log(`[VoiceRecognition] Session closed: ${sessionId}`);
      this.sessions.delete(sessionId);
      this.emit('sessionClosed', { sessionId, waiterId });
    });

    return { sessionId, waiterId };
  }

  /**
   * Отправить аудио-чанк в сессию
   */
  sendAudio(sessionId, audioChunk) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.ws || session.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    session.ws.send(audioChunk);
    return true;
  }

  /**
   * Завершить сессию
   */
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.ws) {
      session.ws.close();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Mock сессия для тестирования без Yandex API
   */
  createMockSession(sessionId, waiterId) {
    console.log(`[VoiceRecognition] Mock session created: ${sessionId}`);
    const session = {
      sessionId,
      waiterId,
      mock: true,
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    this.emit('sessionStarted', { sessionId, waiterId });
    return { sessionId, waiterId };
  }

  /**
   * Mock транскрипция для тестирования
   */
  mockTranscription(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this.emit('transcription', {
      sessionId,
      waiterId: session.waiterId,
      text,
      isFinal: true,
    });
  }

  /**
   * Получить активные сессии
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      sessionId: s.sessionId,
      waiterId: s.waiterId,
      deviceMac: s.deviceMac,
      startedAt: s.startedAt,
      mock: s.mock || false,
    }));
  }

  /**
   * Остановить все сессии
   */
  stopAll() {
    for (const sessionId of this.sessions.keys()) {
      this.endSession(sessionId);
    }
  }
}

module.exports = new VoiceRecognitionService();
