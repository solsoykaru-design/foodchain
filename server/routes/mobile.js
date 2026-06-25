const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'mobile-app-secret-change-in-production';
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const TARIFFS = {
  free: { name: 'Демо', price: 0, maxCards: 5, voice: false, pdf: false, api: false },
  pro: { name: 'Профессиональный', price: 990, maxCards: -1, voice: true, pdf: true, api: false },
  business: { name: 'Бизнес', price: 2990, maxCards: -1, voice: true, pdf: true, api: true },
};

function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

module.exports = function(app, db, config) {
  const { safeError } = config;

  // Ensure mobile tables
  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    tariff TEXT DEFAULT 'free',
    tariff_until TEXT,
    trial_used INTEGER DEFAULT 0,
    cards_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    tariff TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sbp_qr TEXT,
    sbp_payload TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT
  )`); } catch(e) {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_tech_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dish_name TEXT NOT NULL,
    ingredients TEXT DEFAULT '[]',
    kbju TEXT DEFAULT '{}',
    output REAL DEFAULT 0,
    technology TEXT DEFAULT '',
    cooking_time INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}

  // ─── Auth: send SMS code ─────────────────────────────
  app.post('/api/mobile/auth/send-code', (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || phone.length < 10) return res.status(400).json({ error: 'Некорректный номер телефона' });

      const code = generateCode();
      db.prepare('INSERT INTO mobile_codes (phone, code) VALUES (?, ?)').run(phone, code);

      // In production: send SMS via provider API
      // For demo: log to console and return in response
      console.log(`[SMS] Код для ${phone}: ${code}`);

      res.json({ success: true, message: 'Код отправлен', code: process.env.NODE_ENV === 'development' ? code : undefined });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: verify code & login/register ──────────────
  app.post('/api/mobile/auth/verify', (req, res) => {
    try {
      const { phone, code, name } = req.body;
      if (!phone || !code) return res.status(400).json({ error: 'Телефон и код обязательны' });

      const valid = db.prepare('SELECT * FROM mobile_codes WHERE phone = ? AND code = ? AND datetime(created_at) > datetime(\'now\', \'-10 minutes\')').get(phone, code);
      if (!valid) return res.status(400).json({ error: 'Неверный или просроченный код' });

      // Cleanup used codes
      db.prepare('DELETE FROM mobile_codes WHERE phone = ?').run(phone);

      // Find or create user
      let user = db.prepare('SELECT * FROM mobile_users WHERE phone = ?').get(phone);
      if (!user) {
        const info = db.prepare('INSERT INTO mobile_users (phone, name) VALUES (?, ?)').run(phone, name || '');
        user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(info.lastInsertRowid);
      }

      const token = generateToken({ userId: user.id, phone: user.phone, tariff: user.tariff });

      res.json({
        token,
        user: {
          id: user.id, phone: user.phone, name: user.name, email: user.email,
          tariff: user.tariff, tariffUntil: user.tariff_until,
          trialUsed: !!user.trial_used, cardsUsed: user.cards_used,
        },
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: refresh token ─────────────────────────────
  app.post('/api/mobile/auth/refresh', (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth) return res.status(401).json({ error: 'Требуется авторизация' });
      const payload = verifyToken(auth.replace('Bearer ', ''));
      if (!payload) return res.status(401).json({ error: 'Недействительный токен' });
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(payload.userId);
      if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
      const token = generateToken({ userId: user.id, phone: user.phone, tariff: user.tariff });
      res.json({ token });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Middleware: require auth ─────────────────────────
  function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Требуется авторизация' });
    const payload = verifyToken(auth.replace('Bearer ', ''));
    if (!payload) return res.status(401).json({ error: 'Недействительный токен' });
    req.mobileUser = payload;
    next();
  }

  // ─── Profile ─────────────────────────────────────────
  app.get('/api/mobile/profile', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({
        id: user.id, phone: user.phone, name: user.name, email: user.email,
        tariff: user.tariff, tariffUntil: user.tariff_until,
        trialUsed: !!user.trial_used, cardsUsed: user.cards_used,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/mobile/profile', requireAuth, (req, res) => {
    try {
      const { name, email } = req.body;
      const sets = []; const params = [];
      if (name !== undefined) { sets.push('name = ?'); params.push(name); }
      if (email !== undefined) { sets.push('email = ?'); params.push(email); }
      if (sets.length > 0) {
        params.push(req.mobileUser.userId);
        db.prepare(`UPDATE mobile_users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
      }
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      res.json({ id: user.id, phone: user.phone, name: user.name, email: user.email, tariff: user.tariff, tariffUntil: user.tariff_until });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Tariffs ──────────────────────────────────────────
  app.get('/api/mobile/tariffs', (req, res) => {
    res.json(TARIFFS);
  });

  // ─── Check access (rate limit) ───────────────────────
  app.get('/api/mobile/check-access', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      const tariff = TARIFFS[user.tariff] || TARIFFS.free;
      const maxCards = tariff.maxCards;
      const canCreate = maxCards === -1 || user.cards_used < maxCards;
      res.json({ tariff: user.tariff, tariffName: tariff.name, cardsUsed: user.cards_used, maxCards, canCreate, voice: tariff.voice, pdf: tariff.pdf, api: tariff.api, tariffUntil: user.tariff_until });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Activate trial ──────────────────────────────────
  app.post('/api/mobile/trial', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (user.trial_used) return res.status(400).json({ error: 'Пробный период уже использован' });
      const until = new Date(Date.now() + 7 * 86400000).toISOString();
      db.prepare("UPDATE mobile_users SET tariff = 'pro', trial_used = 1, tariff_until = ?, updated_at = datetime('now') WHERE id = ?").run(until, req.mobileUser.userId);
      res.json({ success: true, tariffUntil: until });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── SBP: Create payment ─────────────────────────────
  app.post('/api/mobile/payments/create', requireAuth, (req, res) => {
    try {
      const { tariff } = req.body;
      if (!tariff || !TARIFFS[tariff]) return res.status(400).json({ error: 'Некорректный тариф' });
      const amount = TARIFFS[tariff].price;
      if (amount <= 0) return res.status(400).json({ error: 'Бесплатный тариф не требует оплаты' });

      // Сбербанк реквизиты для СБП
      const SBERBANK_PHONE = process.env.SBERBANK_PHONE || '79779475605';
      const SBERBANK_BIC = process.env.SBERBANK_BIC || '100000000111';

      // Ссылка на оплату через Сбербанк Онлайн
      const paymentUrl = `https://www.sberbank.ru/ru/choise_bank?requisiteNumber=${SBERBANK_PHONE}&bankCode=${SBERBANK_BIC}&amount=${amount}`;

      // SBP QR payload для генерации QR-кода
      const sbpPayload = `https://qr.nspk.ru/PAYLOAD?amount=${amount}&purpose=Подписка+${tariff}&redirect=false`;

      const paymentId = crypto.randomUUID();

      db.prepare('INSERT INTO mobile_payments (user_id, amount, tariff, sbp_payload, status) VALUES (?, ?, ?, ?, \'pending\')').run(
        req.mobileUser.userId, amount, tariff, sbpPayload
      );

      // Генерируем QR-код как base64 (в продакшене через API банка)
      const qrBase64 = null; // TODO: generate via Sberbank API or qrexpress

      res.json({
        paymentId,
        amount,
        tariff,
        paymentUrl,
        sbpPayload,
        sbpQr: qrBase64,
        qrData: sbpPayload,
        recipientPhone: `+${SBERBANK_PHONE}`,
        recipientBank: 'Сбербанк',
        purpose: `Подписка ${TARIFFS[tariff].name}`,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── SBP: Check payment status ───────────────────────
  app.get('/api/mobile/payments/:id/status', requireAuth, (req, res) => {
    try {
      const payment = db.prepare('SELECT * FROM mobile_payments WHERE id = ? AND user_id = ?').get(req.params.id, req.mobileUser.userId);
      if (!payment) return res.status(404).json({ error: 'Платёж не найден' });
      res.json({ id: payment.id, status: payment.status, amount: payment.amount, tariff: payment.tariff, createdAt: payment.created_at, paidAt: payment.paid_at });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── SBP: Webhook (called by bank after payment) ─────
  app.post('/api/mobile/payments/webhook', (req, res) => {
    try {
      const { paymentId, status } = req.body;
      if (!paymentId || !status) return res.status(400).json({ error: 'Invalid webhook' });
      const payment = db.prepare('SELECT * FROM mobile_payments WHERE id = ?').get(paymentId);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (status === 'success') {
        db.prepare("UPDATE mobile_payments SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(paymentId);
        const until = new Date(Date.now() + 30 * 86400000).toISOString();
        db.prepare("UPDATE mobile_users SET tariff = ?, tariff_until = ?, updated_at = datetime('now') WHERE id = ?").run(payment.tariff, until, payment.user_id);
      } else {
        db.prepare("UPDATE mobile_payments SET status = ? WHERE id = ?").run(status, paymentId);
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Payment history ─────────────────────────────────
  app.get('/api/mobile/payments', requireAuth, (req, res) => {
    try {
      const payments = db.prepare('SELECT * FROM mobile_payments WHERE user_id = ? ORDER BY created_at DESC').all(req.mobileUser.userId);
      res.json(payments);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Tech cards CRUD ────────────────────────────────
  app.get('/api/mobile/tech-cards', requireAuth, (req, res) => {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      let sql = 'SELECT * FROM mobile_tech_cards WHERE user_id = ?';
      const params = [req.mobileUser.userId];
      if (search) { sql += ' AND dish_name LIKE ?'; params.push(`%${search}%`); }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
      params.push(Number(limit), offset);
      const items = db.prepare(sql).all(...params).map(c => ({ ...c, ingredients: JSON.parse(c.ingredients || '[]'), kbju: JSON.parse(c.kbju || '{}') }));
      const total = db.prepare('SELECT COUNT(*) as cnt FROM mobile_tech_cards WHERE user_id = ?').get(req.mobileUser.userId)?.cnt || 0;
      res.json({ items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/mobile/tech-cards', requireAuth, (req, res) => {
    try {
      const { dish_name, ingredients, kbju, output, technology, cooking_time, source } = req.body;
      if (!dish_name) return res.status(400).json({ error: 'Название блюда обязательно' });

      // Check limit for free users
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      const tariff = TARIFFS[user.tariff] || TARIFFS.free;
      if (tariff.maxCards !== -1 && (user.cards_used || 0) >= tariff.maxCards) {
        return res.status(403).json({ error: 'Лимит бесплатных техкарт исчерпан. Оформите подписку.' });
      }

      const info = db.prepare(`INSERT INTO mobile_tech_cards (user_id, dish_name, ingredients, kbju, output, technology, cooking_time, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.mobileUser.userId, dish_name, JSON.stringify(ingredients || []), JSON.stringify(kbju || {}), output || 0, technology || '', cooking_time || 0, source || 'manual'
      );
      db.prepare('UPDATE mobile_users SET cards_used = cards_used + 1 WHERE id = ?').run(req.mobileUser.userId);

      res.json({ id: info.lastInsertRowid, dish_name });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/mobile/tech-cards/:id', requireAuth, (req, res) => {
    try {
      const card = db.prepare('SELECT * FROM mobile_tech_cards WHERE id = ? AND user_id = ?').get(req.params.id, req.mobileUser.userId);
      if (!card) return res.status(404).json({ error: 'Техкарта не найдена' });
      res.json({ ...card, ingredients: JSON.parse(card.ingredients || '[]'), kbju: JSON.parse(card.kbju || '{}') });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/mobile/tech-cards/:id', requireAuth, (req, res) => {
    try {
      const { dish_name, ingredients, kbju, output, technology, cooking_time } = req.body;
      const sets = []; const params = [];
      if (dish_name !== undefined) { sets.push('dish_name = ?'); params.push(dish_name); }
      if (ingredients !== undefined) { sets.push('ingredients = ?'); params.push(JSON.stringify(ingredients)); }
      if (kbju !== undefined) { sets.push('kbju = ?'); params.push(JSON.stringify(kbju)); }
      if (output !== undefined) { sets.push('output = ?'); params.push(output); }
      if (technology !== undefined) { sets.push('technology = ?'); params.push(technology); }
      if (cooking_time !== undefined) { sets.push('cooking_time = ?'); params.push(cooking_time); }
      if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
      params.push(req.params.id, req.mobileUser.userId);
      db.prepare(`UPDATE mobile_tech_cards SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
      const card = db.prepare('SELECT * FROM mobile_tech_cards WHERE id = ? AND user_id = ?').get(req.params.id, req.mobileUser.userId);
      res.json({ ...card, ingredients: JSON.parse(card.ingredients || '[]'), kbju: JSON.parse(card.kbju || '{}') });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.delete('/api/mobile/tech-cards/:id', requireAuth, (req, res) => {
    try {
      db.prepare('DELETE FROM mobile_tech_cards WHERE id = ? AND user_id = ?').run(req.params.id, req.mobileUser.userId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── AI Generate (proxy to existing AI) ──────────────
  app.post('/api/mobile/ai-generate', requireAuth, async (req, res) => {
    try {
      const { dish_name } = req.body;
      if (!dish_name) return res.status(400).json({ error: 'Название блюда обязательно' });

      const aiService = require('../services/ai-tech-card.service');
      const result = await aiService.generateTechCard(dish_name);

      // Match ingredients with stock
      const tenantId = req.mobileUser.userId;
      const { matched, unmatched } = aiService.matchIngredientsWithStock(result.ingredients, db, tenantId);

      aiService.logAIRequest(db, 'mobile-generate', dish_name, result, null);

      res.json({
        dish_name,
        ingredients: result.ingredients,
        matched_ingredients: matched,
        unmatched_ingredients: unmatched,
        kbju_per_100g: result.kbju_per_100g || {},
        output: result.output || 300,
        technology: result.technology || '',
        cooking_time: result.cooking_time || 0,
        source: result.source || 'ai',
      });
    } catch (e) {
      const aiService = require('../services/ai-tech-card.service');
      aiService.logAIRequest(db, 'mobile-generate', req.body?.dish_name, null, e.message);
      res.status(500).json({ error: 'Не удалось сгенерировать техкарту. Попробуйте ещё раз или введите вручную.' });
    }
  });

  // ─── Apply promo code ────────────────────────────────
  app.post('/api/mobile/promo', requireAuth, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Введите промокод' });
      const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime(\'now\')) AND (max_uses IS NULL OR used < max_uses)').get(code);
      if (!promo) return res.status(400).json({ error: 'Промокод недействителен' });

      db.prepare('UPDATE promo_codes SET used = used + 1 WHERE id = ?').run(promo.id);
      const extraDays = promo.discount_days || 3;
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      const currentUntil = user.tariff_until ? new Date(user.tariff_until) : new Date();
      const newUntil = new Date(currentUntil.getTime() + extraDays * 86400000).toISOString();
      db.prepare("UPDATE mobile_users SET tariff = 'pro', tariff_until = ?, updated_at = datetime('now') WHERE id = ?").run(newUntil, req.mobileUser.userId);

      res.json({ success: true, extraDays, tariffUntil: newUntil });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });
};
