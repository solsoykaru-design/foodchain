/**
 * Voice Parser Service
 * Извлекает команды, стол, блюда и зоны из распознанного текста
 * Использует комбинацию правил и AI (опционально DeepSeek/Kimi)
 */

const COMMANDS = {
  SUBMIT: ['оформляй заказ', 'принимай заказ', 'оформи заказ', 'отправь заказ', 'оформить'],
  CANCEL: ['отмена', 'отменить', 'сбросить', 'очистить'],
  PAID: ['оплачено', 'оплатил', 'оплата прошла'],
  REFUND: ['возврат', 'вернуть оплату'],
  CLOSED: ['закрыт', 'закрыть заказ', 'завершить'],
  ZONE_KITCHEN: ['кухня', 'на кухню', 'в кухню'],
  ZONE_BAR: ['бар', 'на бар', 'в бар'],
  ZONE_HOOKAH: ['кальянная', 'на кальянную', 'в кальянную', 'кальян'],
  ADD: ['добавить', 'плюс'],
  SHOW: ['показать заказ', 'что в заказе', 'текущий заказ'],
  DELETE: ['удалить', 'убрать'],
};

const ZONES = {
  kitchen: 'kitchen',
  bar: 'bar',
  hookah: 'hookah',
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
   * Нормализовать текст (lowercase, убрать лишние пробелы)
   */
  normalize(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Извлечь номер стола
   */
  extractTable(text) {
    const normalized = this.normalize(text);
    
    // "стол 12", "на 12 стол", "столик 5"
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
        if (num > 0 && num < 100) return num;
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
    const { nameIndex, dishes } = this.loadMenu(tenantId);
    const normalized = this.normalize(text);
    const found = [];

    // Сортируем по длине названия (длинные сначала для приоритета)
    const sortedDishes = [...dishes].sort((a, b) => b.name.length - a.name.length);

    for (const dish of sortedDishes) {
      const normalizedName = this.normalize(dish.name);
      
      // Точное совпадение
      if (normalized.includes(normalizedName)) {
        found.push({
          dishId: dish.id,
          name: dish.name,
          price: dish.price,
          zone: dish.zone || null,
          quantity: 1,
          modifiers: [],
        });
        continue;
      }

      // Fuzzy matching (проверка подстрок)
      const words = normalizedName.split(' ');
      if (words.length > 1) {
        const mainWords = words.filter(w => w.length > 3);
        const matchCount = mainWords.filter(w => normalized.includes(w)).length;
        if (matchCount >= Math.ceil(mainWords.length * 0.6)) {
          found.push({
            dishId: dish.id,
            name: dish.name,
            price: dish.price,
            zone: dish.zone || null,
            quantity: 1,
            modifiers: [],
          });
        }
      }
    }

    return found;
  }

  /**
   * Извлечь количество ("2 пасты", "паста ×2", "две пасты")
   */
  extractQuantity(text, dishName) {
    const normalized = this.normalize(text);
    const normalizedName = this.normalize(dishName);
    
    // "2 пасты", "3 колы"
    const pattern1 = new RegExp(`(\\d+)\\s+${this.escapeRegex(normalizedName)}`, 'i');
    const match1 = normalized.match(pattern1);
    if (match1) return parseInt(match1[1], 10);

    // "паста ×2", "кола x3"
    const pattern2 = new RegExp(`${this.escapeRegex(normalizedName)}\\s*[xх×]\\s*(\\d+)`, 'i');
    const match2 = normalized.match(pattern2);
    if (match2) return parseInt(match2[1], 10);

    return 1;
  }

  /**
   * Экранировать спецсимволы regex
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Основной метод парсинга
   */
  parse(text, tenantId) {
    const command = this.extractCommand(text);
    const table = this.extractTable(text);
    const zone = this.extractZone(text);
    const dishes = this.extractDishes(text, tenantId);

    // Уточнить количество для каждого блюда
    for (const dish of dishes) {
      dish.quantity = this.extractQuantity(text, dish.name);
      // Если зона не указана в блюде, использовать указанную в команде
      if (!dish.zone && zone) {
        dish.zone = zone;
      }
    }

    return {
      command,
      table,
      zone,
      dishes,
      rawText: text,
      parsedAt: new Date().toISOString(),
    };
  }

  /**
   * Определить зону для блюда по его категории
   */
  inferZone(dish, tenantId) {
    if (dish.zone) return dish.zone;

    // Эвристики на основе названия
    const name = this.normalize(dish.name);
    
    if (name.includes('кальян') || name.includes('табак') || name.includes('уголь')) {
      return ZONES.hookah;
    }
    
    if (name.includes('кофе') || name.includes('чай') || name.includes('сок') || 
        name.includes('вода') || name.includes('вино') || name.includes('пиво') ||
        name.includes('коктейль') || name.includes('лимонад')) {
      return ZONES.bar;
    }

    // По умолчанию — кухня
    return ZONES.kitchen;
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this.menuCache.clear();
    this.lastCacheUpdate = 0;
  }
}

module.exports = VoiceParserService;
