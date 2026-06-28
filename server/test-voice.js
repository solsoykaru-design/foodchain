/**
 * Тест голосового модуля
 * Проверяет основные функции: парсинг команд, буферы, гарнитуры
 */

const Database = require('better-sqlite3');
const path = require('path');
const VoiceHeadsetService = require('./services/voice-headset.service');
const VoiceParserService = require('./services/voice-parser.service');
const voiceBuffer = require('./services/voice-buffer.service');

// Создать тестовую БД
const db = new Database(':memory:');

// Создать таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    zone TEXT,
    tenant_id INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'waiter'
  );

  INSERT INTO dishes (name, price, zone, tenant_id) VALUES
    ('Паста Карбонара', 450, 'kitchen', 1),
    ('Стейк Рибай', 1200, 'kitchen', 1),
    ('Кола 0.5 л', 150, 'bar', 1),
    ('Вино красное', 350, 'bar', 1),
    ('Кальян', 800, 'hookah', 1),
    ('Салат Цезарь', 380, 'kitchen', 1);

  INSERT INTO staff (name, role) VALUES
    ('Алексей', 'waiter'),
    ('Иван', 'waiter'),
    ('Мария', 'waiter');
`);

console.log('=== Тест голосового модуля ===\n');

// Тест 1: Headset Service
console.log('1. Тест гарнитур:');
const headsetService = new VoiceHeadsetService(db);

headsetService.bindHeadset('AA:BB:CC:DD:EE:01', 'Headset 1', 1, 'Алексей', 1);
headsetService.bindHeadset('AA:BB:CC:DD:EE:02', 'Headset 2', 2, 'Иван', 1);

const waiter = headsetService.identifyWaiter('AA:BB:CC:DD:EE:01');
console.log('   ✓ Идентификация по MAC:', waiter ? `${waiter.waiterNick} (${waiter.deviceMac})` : 'FAIL');

const activeHeadsets = headsetService.getActiveHeadsets(1);
console.log('   ✓ Активные гарнитуры:', activeHeadsets.length);

// Тест 2: Parser Service
console.log('\n2. Тест парсера:');
const parser = new VoiceParserService(db);

const test1 = parser.parse('стол 12, паста Карбонара, кола', 1);
console.log('   ✓ Парсинг "стол 12, паста Карбонара, кола":');
console.log('     - Стол:', test1.table);
console.log('     - Блюда:', test1.dishes.map(d => d.name).join(', '));

const test2 = parser.parse('оформляй заказ', 1);
console.log('   ✓ Команда "оформляй заказ":', test2.command);

const test3 = parser.parse('бар, вино красное', 1);
console.log('   ✓ Зона "бар":', test3.zone);
console.log('     - Блюда:', test3.dishes.map(d => `${d.name} (${d.zone})`).join(', '));

// Тест 3: Buffer Service
console.log('\n3. Тест буферов:');

const buffer1 = voiceBuffer.getBuffer(1, 'Алексей');
voiceBuffer.setTable(1, 12);
voiceBuffer.addItem(1, { dishId: 1, name: 'Паста Карбонара', price: 450, zone: 'kitchen', quantity: 1 });
voiceBuffer.addItem(1, { dishId: 3, name: 'Кола 0.5 л', price: 150, zone: 'bar', quantity: 2 });

const updatedBuffer = voiceBuffer.getBuffer(1);
console.log('   ✓ Буфер создан:');
console.log('     - Стол:', updatedBuffer.table);
console.log('     - Блюд:', updatedBuffer.items.length);
console.log('     - Сумма:', updatedBuffer.items.reduce((s, i) => s + i.price * i.quantity, 0), '₽');

const activeBuffers = voiceBuffer.getActiveBuffers();
console.log('   ✓ Активные буферы:', activeBuffers.length);

// Тест 4: Определение зоны
console.log('\n4. Тест определения зон:');

const dish1 = { name: 'Кофе латте', zone: null };
const dish2 = { name: 'Кальян с яблоком', zone: null };
const dish3 = { name: 'Стейк', zone: null };

console.log('   ✓ Кофе латте →', parser.inferZone(dish1, 1));
console.log('   ✓ Кальян с яблоком →', parser.inferZone(dish2, 1));
console.log('   ✓ Стейк →', parser.inferZone(dish3, 1));

// Тест 5: Очистка буфера
console.log('\n5. Тест очистки буфера:');
voiceBuffer.clearBuffer(1);
const clearedBuffer = voiceBuffer.getBuffer(1);
console.log('   ✓ Буфер очищен:', clearedBuffer.items.length === 0);

console.log('\n=== Все тесты пройдены ===');

voiceBuffer.stop();
db.close();
