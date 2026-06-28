/**
 * Voice AI Parser Service
 * Использует OpenCode AI (DeepSeek) для извлечения структуры заказа из текста.
 * Резервный режим: если API недоступен — возвращает null, и вызывающий код
 * переключается на rule-based парсер.
 */

const API_URL = process.env.OPENCODE_API_URL || 'https://opencode.ai/zen/v1/chat/completions';
const API_KEY = process.env.OPENCODE_API_KEY || '';
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

const SYSTEM_PROMPT = `Ты — AI-помощник ресторана. Извлеки из голосовой команды официанта структурированные данные.

Верни ТОЛЬКО JSON объект, без markdown и пояснений:
{
  "command": "order|confirm|cancel|pay|close|refund|delete|add|show|zone|unknown",
  "waiter_nick": "имя официанта, если названо",
  "table_number": число или null,
  "zone": "kitchen|bar|hookah" или null,
  "items": [
    {
      "name": "название блюда",
      "quantity": число,
      "modifiers": ["модификатор 1", "модификатор 2"],
      "zone": "kitchen|bar|hookah" или null
    }
  ],
  "delete_target": "название блюда для удаления" или null,
  "unrecognized": ["фраза, которую не удалось распознать"]
}

Правила команд:
- "оформляй заказ", "принимай заказ", "отправляй" → confirm
- "отмена", "сбросить" → cancel
- "оплачено", "оплата" → pay
- "закрыт", "закрыть" → close
- "возврат" → refund
- "удалить [блюдо]" → delete
- "добавить [блюдо]" → add
- "показать заказ", "что в заказе" → show
- "кухня"/"бар"/"кальянная" как отдельная команда → zone
- если просто перечислены блюда → order

Зоны: kitchen=кухня, bar=бар, hookah=кальянная.
Если блюдо явно привязано к зоне в тексте ("на кухню ...", "бар ..."), укажи zone.
Если зона не указана, оставь zone=null (не угадывай).

Модификаторы: фразы типа "без лука", "добавить бекон", "с сыром", "0.5 л", "без льда".
Количество: число перед блюдом или после ("2 пасты", "паста x2"). Если не указано — 1.

Если не удалось распознать команду или блюда — верни command "unknown" и unrecognized.`;

class VoiceAIParserService {
  constructor() {
    this.enabled = Boolean(API_KEY);
  }

  async parse(text, tenantId, menuNames = []) {
    if (!this.enabled) return null;

    const menuHint = menuNames.length > 0
      ? `\nИзвестные блюда меню (используй для сопоставления): ${menuNames.slice(0, 200).join(', ')}`
      : '';

    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Команда официанта: "${text}"${menuHint}` },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.error('[VoiceAIParser] HTTP error:', res.status);
        return null;
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || '';
      const parsed = this.extractJson(content);
      if (!parsed) return null;

      return this.normalize(parsed);
    } catch (e) {
      console.error('[VoiceAIParser] Error:', e.message);
      return null;
    }
  }

  extractJson(content) {
    const trimmed = content.trim();
    let start = trimmed.indexOf('{');
    let end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {}
    }
    // иногда JSON обёрнут в ```json ... ```
    const codeBlock = /```json\s*([\s\S]*?)```/i.exec(trimmed);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1]);
      } catch {}
    }
    return null;
  }

  normalize(parsed) {
    const zoneMap = {
      'кухня': 'kitchen', 'kitchen': 'kitchen', 'кухню': 'kitchen',
      'бар': 'bar', 'в бар': 'bar', 'на бар': 'bar',
      'кальянная': 'hookah', 'кальянную': 'hookah', 'hookah': 'hookah', 'кальян': 'hookah',
    };

    const normalizeZone = (z) => {
      if (!z) return null;
      const key = String(z).toLowerCase().trim();
      return zoneMap[key] || null;
    };

    return {
      command: parsed.command || 'unknown',
      waiterNick: parsed.waiter_nick || null,
      table: parsed.table_number || null,
      zone: normalizeZone(parsed.zone),
      dishes: (parsed.items || []).map(item => ({
        name: item.name || '',
        quantity: Number(item.quantity) || 1,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        zone: normalizeZone(item.zone),
      })).filter(i => i.name),
      deleteTarget: parsed.delete_target || null,
      unrecognized: Array.isArray(parsed.unrecognized) ? parsed.unrecognized : [],
      rawText: '',
      parsedAt: new Date().toISOString(),
    };
  }
}

module.exports = new VoiceAIParserService();
