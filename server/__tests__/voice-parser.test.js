const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { createTestDb, cleanupTestDb } = require('./helpers/setup');
const VoiceParserService = require('../services/voice-parser.service');

describe('Voice Parser — сценарии из промта', () => {
  let db;
  let parser;

  before(() => {
    cleanupTestDb();
    db = createTestDb();

    // Добавляем нужные колонки, которых нет в базовой схеме тестов
    try { db.exec('ALTER TABLE dishes ADD COLUMN zone TEXT'); } catch (e) {}
    try { db.exec('ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (e) {}

    db.prepare(`INSERT INTO dishes (id, name, category_id, tenant_id, price, zone, is_active) VALUES
      (10, 'Паста Карбонара', 1, 1, 450, 'kitchen', 1),
      (11, 'Кола 0.5 л', 1, 1, 150, 'bar', 1),
      (12, 'Кальян', 1, 1, 1200, 'hookah', 1),
      (13, 'Стейк Рибай', 1, 1, 1200, 'kitchen', 1),
      (14, 'Вино красное', 1, 1, 600, 'bar', 1),
      (15, 'Борщ', 1, 1, 350, 'kitchen', 1)
    `).run();

    parser = new VoiceParserService(db);
  });

  after(() => {
    if (db) db.close();
    cleanupTestDb();
  });

  it('Сценарий 1: один официант, стол + блюда + оформление', async () => {
    const r = await parser.parse('Алексей, стол 12, паста Карбонара, добавить бекон, кола 0.5 л, без льда', 1);
    assert.strictEqual(r.table, 12);
    assert.strictEqual(r.dishes.length, 2);
    assert.ok(r.dishes.some(d => d.name === 'Паста Карбонара' && d.zone === 'kitchen'));
    assert.ok(r.dishes.some(d => d.name === 'Кола 0.5 л' && d.zone === 'bar'));
  });

  it('Сценарий 3: заказ с несколькими зонами', async () => {
    const r = await parser.parse('стол 5, кухня — стейк, бар — вино, кальянная — кальян', 1);
    assert.strictEqual(r.table, 5);
    assert.ok(r.dishes.some(d => d.name === 'Стейк Рибай' && d.zone === 'kitchen'));
    assert.ok(r.dishes.some(d => d.name === 'Вино красное' && d.zone === 'bar'));
    assert.ok(r.dishes.some(d => d.name === 'Кальян' && d.zone === 'hookah'));
  });

  it('Сценарий 4: автоматическое определение зоны из базы', async () => {
    const r = await parser.parse('стол 8, паста Карбонара, кола 0.5 л, кальян', 1);
    assert.ok(r.dishes.some(d => d.name === 'Паста Карбонара' && d.zone === 'kitchen'));
    assert.ok(r.dishes.some(d => d.name === 'Кола 0.5 л' && d.zone === 'bar'));
    assert.ok(r.dishes.some(d => d.name === 'Кальян' && d.zone === 'hookah'));
  });

  it('Команды: оплачено, возврат, закрыт, отмена', async () => {
    assert.strictEqual((await parser.parse('оплачено', 1)).command, 'PAID');
    assert.strictEqual((await parser.parse('возврат', 1)).command, 'REFUND');
    assert.strictEqual((await parser.parse('закрыт', 1)).command, 'CLOSED');
    assert.strictEqual((await parser.parse('отмена', 1)).command, 'CANCEL');
  });

  it('Команды: показать, удалить, добавить, оформить', async () => {
    assert.strictEqual((await parser.parse('показать заказ', 1)).command, 'SHOW');
    assert.strictEqual((await parser.parse('удалить пасту', 1)).command, 'DELETE');
    assert.strictEqual((await parser.parse('добавить борщ', 1)).command, 'ADD');
    assert.strictEqual((await parser.parse('оформляй заказ', 1)).command, 'SUBMIT');
  });

  it('Извлечение количества', async () => {
    const r = await parser.parse('стол 3, 2 пасты Карбонара, кола x3', 1);
    const pasta = r.dishes.find(d => d.name === 'Паста Карбонара');
    const cola = r.dishes.find(d => d.name === 'Кола 0.5 л');
    assert.strictEqual(pasta?.quantity, 2);
    assert.strictEqual(cola?.quantity, 3);
  });

  it('inferZone: напитки → бар, кальян → кальянная, остальное → кухня', () => {
    assert.strictEqual(parser.inferZone({ name: 'Кофе' }, 1), 'bar');
    assert.strictEqual(parser.inferZone({ name: 'Кальян яблоко' }, 1), 'hookah');
    assert.strictEqual(parser.inferZone({ name: 'Борщ' }, 1), 'kitchen');
  });
});
