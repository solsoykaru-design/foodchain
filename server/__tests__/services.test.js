const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-services-foodchain.db');

const referral = require('../services/referral.service');
const pricing = require('../services/pricing.service');

function createTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, bonus_balance REAL DEFAULT 0);
    CREATE TABLE user_bonuses (id INTEGER PRIMARY KEY, user_id INTEGER, balance REAL DEFAULT 0, lifetime_earned REAL DEFAULT 0);
    CREATE TABLE bonus_transactions (id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT, amount REAL, description TEXT);
    CREATE TABLE referral_settings (id INTEGER PRIMARY KEY, tenant_id INTEGER, enabled INTEGER DEFAULT 0, referrer_bonus INTEGER DEFAULT 100, referee_bonus INTEGER DEFAULT 100, min_order_amount INTEGER DEFAULT 500, bonus_type TEXT DEFAULT 'points');
    CREATE TABLE referral_codes (id INTEGER PRIMARY KEY, tenant_id INTEGER, user_id INTEGER, code TEXT, used_count INTEGER DEFAULT 0);
    CREATE TABLE referrals (id INTEGER PRIMARY KEY, tenant_id INTEGER, referrer_id INTEGER, referee_id INTEGER, code TEXT, status TEXT, completed_at DATETIME, order_amount REAL);
    CREATE TABLE dynamic_pricing_rules (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, type TEXT, config TEXT, priority INTEGER, is_active INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  return db;
}

function cleanup() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch (e) {}
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch (e) {}
}

describe('Services', () => {
  let db;

  before(() => {
    cleanup();
    db = createTestDb();
    db.prepare("INSERT INTO users (id, name, phone) VALUES (1, 'Alice', '+1'), (2, 'Bob', '+2'), (3, 'Carol', '+3')").run();
  });

  after(() => {
    if (db) db.close();
    cleanup();
  });

  describe('Referral service', () => {
    it('should generate a referral code', () => {
      const code = referral.generateCode();
      assert.ok(code.startsWith('FC-'));
      assert.strictEqual(code.length > 4, true);
    });

    it('should create and return user referral code', () => {
      const row = referral.getUserReferralCode(db, 1, 1);
      assert.ok(row.code);
      assert.strictEqual(row.user_id, 1);
      assert.strictEqual(row.tenant_id, 1);
    });

    it('should enable referral settings', () => {
      referral.updateSettings(db, 1, { enabled: true, referrer_bonus: 200, referee_bonus: 150, min_order_amount: 300, bonus_type: 'points' });
      const settings = referral.getSettings(db, 1);
      assert.strictEqual(settings.enabled, 1);
      assert.strictEqual(settings.referrer_bonus, 200);
      assert.strictEqual(settings.referee_bonus, 150);
    });

    it('should apply referral code and credit referee', () => {
      const referrer = referral.getUserReferralCode(db, 1, 1);
      const result = referral.applyReferralCode(db, 1, 2, referrer.code);
      assert.ok(result.id);
      assert.strictEqual(result.referrer_id, 1);

      const bob = db.prepare('SELECT bonus_balance FROM users WHERE id = 2').get();
      assert.strictEqual(bob.bonus_balance, 150);
    });

    it('should complete referral and credit referrer', () => {
      referral.completeReferral(db, 1, 2, 500);
      const alice = db.prepare('SELECT bonus_balance FROM users WHERE id = 1').get();
      assert.strictEqual(alice.bonus_balance, 200);
    });

    it('should return referral stats', () => {
      const stats = referral.getStats(db, 1);
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.completed, 1);
      assert.strictEqual(stats.pending, 0);
    });
  });

  describe('Pricing service', () => {
    it('should create and list pricing rules', () => {
      pricing.createRule(db, 1, { name: 'Happy Hour', type: 'happy_hour', config: { percent: -10, start_time: '15:00', end_time: '18:00', days: [1, 2, 3, 4, 5] }, priority: 10, is_active: true });
      const rules = pricing.getRules(db, 1);
      assert.strictEqual(rules.length, 1);
      assert.strictEqual(rules[0].type, 'happy_hour');
    });

    it('should apply percent discount to price', () => {
      const price = pricing.applyRulesToPrice(100, [{ type: 'happy_hour', config: '{"percent": -10}' }]);
      assert.strictEqual(price, 90);
    });

    it('should apply fixed price rule', () => {
      const price = pricing.applyRulesToPrice(100, [{ type: 'event', config: '{"fixed_price": 75}' }]);
      assert.strictEqual(price, 75);
    });

    it('should keep price positive', () => {
      const price = pricing.applyRulesToPrice(10, [{ type: 'event', config: '{"percent": -200}' }]);
      assert.strictEqual(price, 0);
    });
  });
});
