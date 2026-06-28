/**
 * Voice Parser Service
 * Извлекает команды, стол, блюда и зоны из распознанного текста.
 * Использует комбинацию правил и AI (OpenCode / DeepSeek).
 */

const aiParser = require('./voice-ai-parser.service');

const COMMANDS = {
  SUBMIT: ['оформляй заказ', 'принимай заказ', 'оформи заказ', 'отправь заказ', 'оформить', 'отправляй'],
  CANCEL: ['отмена', 'отменить', 'сбросить', 'очистить'],
  PAID: ['оплачено', 'оплатил', 'оплата прошла', 'оплата'],
  REFUND: ['возврат', 'вернуть оплату', 'вернуть'],
  CLOSED: ['закрыт', 'закрыть заказ', 'завершить'],
  ZONE_KITCHEN: ['кухня', 'на кухню', 'в кухню'],
  ZONE_BAR: ['бар', 'на бар', 'в бар'],
  ZONE_HOOKAH: ['кальянная', 'на кальянную', 'в кальянную', 'кальян'],
  ADD: ['добавить', 'плюс', 'добавь'],
  SHOW: ['показать заказ', 'что в заказе', 'текущий заказ'],
  DELETE: ['удалить', 'убрать', 'убери'],
};

const ZONES = {
  kitchen: 'kitchen',
  bar: 'bar',
  hookah: 'hookah',
};

const ZONE_LABELS = {
  kitchen: 'кухня',
  bar: 'бар',
  hookah: 'кальянная',
};

class VoiceParserService {
  constructor(db) {
    this.db = db;
    this.menuCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheTtl = 60000; // 1 минута
  }

  /**
   * Загрузить меню из БД
   */
  loadMenu(tenantId) {
    const now = Date.now();
    if (this.menuCache.has(tenantId) && now - this.lastCacheUpdate < this.cacheTtl) {
      return this.menuCache.get(tenantId);
    }

    const dishes = this.db.prepare(
      'SELECT id, name, price, zone FROM dishes WHERE tenant_id = ? AND is_active = 1'
    ).all(tenantId);

    const menuMap = new Map();
    const nameIndex = new Map();

    for (const dish of dishes) {
      menuMap.set(dish.id, dish);
      const normalizedName = this.normalize(dish.name);
      nameIndex.set(normalizedName, dish);
    }

    this.menuCache.set(tenantId, { menuMap, nameIndex, dishes });
    this.lastCacheUpdate = now;
    return { menuMap, nameIndex, dishes };
  }

  /**
   * Нормализовать текст
   */
  normalize(text) {
    return String(text || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Извлечь номер стола
   */
  extractTable(text) {
    const normalized = this.normalize(text);
    const patterns = [
      /стол[а-я]*\s+(\d+)/i,
      /(\d+)\s+стол/i,
      /столик[а-я]*\s+(\d+)/i,
      /(\d+)\s+столик/i,
      /на\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > 0 && num < 1000) return num;
      }
    }
    return null;
  }

  /**
   * Извлечь зону из текста
   */
  extractZone(text) {
    const normalized = this.normalize(text);
    for (const [key, phrases] of Object.entries(COMMANDS)) {
      if (key.startsWith('ZONE_')) {
        for (const phrase of phrases) {
          if (normalized.includes(phrase)) {
            return ZONES[key.replace('ZONE_', '').toLowerCase()];
          }
        }
      }
    }
    return null;
  }

  /**
   * Извлечь команду
   */
  extractCommand(text) {
    const normalized = this.normalize(text);
    for (const [cmd, phrases] of Object.entries(COMMANDS)) {
      if (cmd.startsWith('ZONE_')) continue;
      for (const phrase of phrases) {
        if (normalized.includes(phrase)) {
          return cmd;
        }
      }
    }
    return null;
  }

  /**
   * Найти блюда в тексте (fuzzy matching)
   */
  extractDishes(text, tenantId) {
    const { dishes } = this.loadMenu(tenantId);
    const normalized = this.normalize(text);
    const found = [];
    const usedRanges = []; // чтобы не дублировать перекрывающиеся совпадения

    const sortedDishes = [...dishes].sort((a, b) => b.name.length - a.name.length);

    for (const dish of sortedDishes) {
      const normalizedName = this.normalize(dish.name);
      if (!normalizedName) continue;

      const idx = normalized.indexOf(normalizedName);
      if (idx !== -1 && !this.overlaps(idx, normalizedName.length, usedRanges)) {
        found.push(this.makeFoundDish(dish));
        usedRanges.push({ start: idx, end: idx + normalizedName.length });
        continue;
      }

      // Fuzzy matching по значимым словам и префиксам (учёт склонений)
      const words = normalizedName.split(' ').filter(w => w.length > 2);
      if (words.length > 0) {
        const mainWords = words.filter(w => w.length > 3);
        const matchCount = mainWords.filter(w => normalized.includes(w)).length;
        const firstWordMatches = words[0] && normalized.includes(words[0]);

        // Префиксное совпадение всех значимых слов подряд
        const prefixMatch = this.matchPrefixSequence(normalized, words);

        if (matchCount >= Math.ceil(mainWords.length * 0.6) ||
            (firstWordMatches && words[0].length > 3) ||
            prefixMatch) {
          const start = prefixMatch || (firstWordMatches ? normalized.indexOf(words[0]) : normalized.indexOf(mainWords.find(w => normalized.includes(w)) || words[0]));
          found.push(this.makeFoundDish(dish));
          usedRanges.push({ start, end: start + 1 });
        }
      }
    }

    return found;
  }

  makeFoundDish(dish) {
    return {
      dishId: dish.id,
      name: dish.name,
      price: dish.price,
      zone: dish.zone || null,
      quantity: 1,
      modifiers: [],
    };
  }

  matchPrefixSequence(text, words) {
    // Проверяем, что префиксы значимых слов блюда идут в тексте подряд
    const significant = words.filter(w => w.length > 3);
    if (significant.length === 0) return false;
    const minPrefixLen = 4;
    let pos = 0;
    for (const word of significant) {
      const prefix = word.slice(0, minPrefixLen);
      const re = new RegExp(`(?:^|\\s)${this.escapeRegex(prefix)}[а-яё]*`, 'i');
      const match = text.slice(pos).match(re);
      if (!match) return false;
      pos += (match.index || 0) + match[0].length;
    }
    return pos > 0 ? pos - 1 : false;
  }

  overlaps(start, length, ranges) {
    const end = start + length;
    return ranges.some(r => start < r.end && end > r.start);
  }

  /**
   * Извлечь количество
   */
  extractQuantity(text, dishName) {
    const normalized = this.normalize(text);
    const normalizedName = this.normalize(dishName);
    const escaped = this.escapeRegex(normalizedName);

    const patterns = [
      new RegExp(`(\\d+)\\s+${escaped}`, 'i'),
      new RegExp(`${escaped}\\s*[xх×]\\s*(\\d+)`, 'i'),
      new RegExp(`${escaped}\\s+(\\d+)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > 0 && num < 1000) return num;
      }
    }

    // "2 пасты Карбонара" / "кола x3" — учёт склонений и сокращений
    const firstWord = this.normalize(dishName).split(' ')[0];
    if (firstWord && firstWord.length > 2) {
      const prefix = firstWord.slice(0, Math.max(3, firstWord.length - 1));

      const beforePattern = new RegExp(`(\\d+)\\s+${this.escapeRegex(prefix)}[а-яё]*`, 'i');
      const beforeMatch = normalized.match(beforePattern);
      if (beforeMatch) {
        const num = parseInt(beforeMatch[1], 10);
        if (num > 0 && num < 1000) return num;
      }

      const afterPattern = new RegExp(`${this.escapeRegex(prefix)}[а-яё]*\\s*[xх×]\\s*(\\d+)`, 'i');
      const afterMatch = normalized.match(afterPattern);
      if (afterMatch) {
        const num = parseInt(afterMatch[1], 10);
        if (num > 0 && num < 1000) return num;
      }
    }

    // Слова "две", "три" и т.д.
    const wordNums = {
      'одна': 1, 'один': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4,
      'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10,
    };
    const before = normalized.slice(0, normalized.indexOf(normalizedName)).trim();
    const words = before.split(' ');
    for (let i = words.length - 1; i >= Math.max(0, words.length - 3); i--) {
      if (wordNums[words[i]]) return wordNums[words[i]];
    }

    return 1;
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Извлечь модификаторы рядом с блюдом
   */
  extractModifiers(text, dishName) {
    const normalized = this.normalize(text);
    const idx = normalized.indexOf(this.normalize(dishName));
    if (idx === -1) return [];

    // Берём часть после блюда до следующего блюда или конца
    const rest = normalized.slice(idx + this.normalize(dishName).length);
    const modifiers = [];

    // "без X", "добавить X", "с X", "X л", "0.5 л"
    const patterns = [
      /без\s+([а-яё\s]+?)(?=,|;|\s+(?:и|с|без|добавить|плюс|или|$))/gi,
      /добавить\s+([а-яё\s]+?)(?=,|;|\s+(?:и|с|без|добавить|плюс|или|$))/gi,
      /добавь\s+([а-яё\s]+?)(?=,|;|\s+(?:и|с|без|добавить|плюс|или|$))/gi,
      /плюс\s+([а-яё\s]+?)(?=,|;|\s+(?:и|с|без|добавить|плюс|или|$))/gi,
      /с\s+([а-яё\s]+?)(?=,|;|\s+(?:и|с|без|добавить|плюс|или|$))/gi,
      /(\d+(?:\.\d+)?\s*(?:л|литр|мл|г|кг|шт|порци[яй]))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(rest)) !== null) {
        const mod = match[1].trim();
        if (mod && mod.length > 1) modifiers.push(mod);
      }
    }

    return modifiers;
  }

  /**
   * Правиловой парсинг
   */
  ruleParse(text, tenantId) {
    const command = this.extractCommand(text);
    const table = this.extractTable(text);
    const zone = this.extractZone(text);
    const dishes = this.extractDishes(text, tenantId);

    for (const dish of dishes) {
      dish.quantity = this.extractQuantity(text, dish.name);
      dish.modifiers = this.extractModifiers(text, dish.name);
      if (!dish.zone && zone) {
        dish.zone = zone;
      }
    }

    // Для команд удаления — попытка найти цель
    let deleteTarget = null;
    if (command === 'DELETE') {
      const normalized = this.normalize(text);
      const { dishes: allDishes } = this.loadMenu(tenantId);
      for (const d of allDishes.sort((a, b) => b.name.length - a.name.length)) {
        if (normalized.includes(this.normalize(d.name))) {
          deleteTarget = d.name;
          break;
        }
      }
      if (!deleteTarget) {
        // удалить последнее добавленное или по индексу
        const numMatch = normalized.match(/(\d+)/);
        if (numMatch) deleteTarget = `#${numMatch[1]}`;
      }
    }

    return {
      command,
      table,
      zone,
      dishes,
      deleteTarget,
      unrecognized: [],
      rawText: text,
      parsedAt: new Date().toISOString(),
    };
  }

  /**
   * Основной метод парсинга.
   * Сначала правила, затем AI (если включен и правила не дали результат / неуверенность).
   */
  async parse(text, tenantId) {
    const ruleResult = this.ruleParse(text, tenantId);

    // Если правила уверенно распознали команду и блюда — используем их
    const hasCommand = ruleResult.command && ruleResult.command !== 'ADD';
    const hasDishes = ruleResult.dishes.length > 0;
    if (hasCommand && (hasDishes || ['CANCEL', 'SHOW', 'PAID', 'REFUND', 'CLOSED'].includes(ruleResult.command))) {
      return ruleResult;
    }

    // Пробуем AI
    if (aiParser.enabled) {
      const { dishes: menuDishes } = this.loadMenu(tenantId);
      const menuNames = menuDishes.map(d => d.name);
      const aiResult = await aiParser.parse(text, tenantId, menuNames);

      if (aiResult) {
        // Сопоставляем названия из AI с блюдами меню
        const { nameIndex } = this.loadMenu(tenantId);
        for (const item of aiResult.dishes) {
          const normalizedName = this.normalize(item.name);
          const matched = nameIndex.get(normalizedName);
          if (matched) {
            item.dishId = matched.id;
            item.price = matched.price;
            if (!item.zone) item.zone = matched.zone || null;
          }
        }

        // Если AI дал команду — используем её
        if (aiResult.command && aiResult.command !== 'unknown') {
          return aiResult;
        }
      }
    }

    return ruleResult;
  }

  /**
   * Определить зону для блюда по базе / эвристикам
   */
  inferZone(dish, tenantId) {
    if (dish.zone) return dish.zone;

    const { menuMap } = this.loadMenu(tenantId);
    if (dish.dishId && menuMap.has(dish.dishId)) {
      const dbZone = menuMap.get(dish.dishId).zone;
      if (dbZone) return dbZone;
    }

    const name = this.normalize(dish.name);
    if (name.includes('кальян') || name.includes('табак') || name.includes('уголь')) {
      return ZONES.hookah;
    }
    if (name.includes('кофе') || name.includes('чай') || name.includes('сок') ||
        name.includes('вода') || name.includes('вино') || name.includes('пиво') ||
        name.includes('коктейль') || name.includes('лимонад') || name.includes('пиво')) {
      return ZONES.bar;
    }

    return ZONES.kitchen;
  }

  getZoneLabel(zone) {
    return ZONE_LABELS[zone] || zone || 'не определена';
  }

  clearCache() {
    this.menuCache.clear();
    this.lastCacheUpdate = 0;
  }
}

module.exports = VoiceParserService;
