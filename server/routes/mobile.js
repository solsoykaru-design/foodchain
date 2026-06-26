const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'mobile-app-secret-change-in-production';
const SMS_API_KEY = process.env.SMS_API_KEY || '';

const TARIFFS = {
  free: { name: 'Бесплатный', price: 0, freeAttempts: 3, voice: false, pdfWatermark: true },
  month: { name: '1 месяц', price: 299, freeAttempts: -1, voice: true, pdfWatermark: false, popular: false },
  quarter: { name: '3 месяца', price: 599, freeAttempts: -1, voice: true, pdfWatermark: false, popular: true },
  year: { name: '12 месяцев', price: 1499, freeAttempts: -1, voice: true, pdfWatermark: false, popular: false },
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

  // Middleware для мобильных API - правильная обработка ответов
  app.use('/api/mobile', (req, res, next) => {
    // Устанавливаем правильные заголовки
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=120');
    
    // Переопределяем json метод для гарантии завершения ответа
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      const jsonStr = JSON.stringify(data);
      res.setHeader('Content-Length', Buffer.byteLength(jsonStr));
      return originalJson(data);
    };
    
    next();
  });

  // ─── Init tables ─────────────────────────────────────
  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    free_attempts INTEGER DEFAULT 3,
    tariff TEXT DEFAULT 'free',
    tariff_until TEXT,
    is_subscribed INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}

  // ─── Seed owner account (unlimited) ───────────────────
  const ownerPhone = '+79779475605';
  const ownerPass = '6218396';
  try {
    const existing = db.prepare('SELECT id FROM mobile_users WHERE phone = ?').get(ownerPhone);
    if (!existing) {
      const hash = bcrypt.hashSync(ownerPass, 10);
      const refCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      db.prepare("INSERT INTO mobile_users (phone, name, password_hash, free_attempts, tariff, tariff_until, is_subscribed, referral_code) VALUES (?, ?, ?, -1, 'year', '2099-12-31', 1, ?)").run(ownerPhone, 'Владелец', hash, refCode);
      console.log('[OWNER] Owner account created:', ownerPhone);
    }
  } catch(e) { console.error('[OWNER] Seed error:', e.message); }

  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT DEFAULT 'register',
    created_at TEXT DEFAULT (datetime('now'))
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
    cost REAL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS mobile_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    tariff TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sbp_payload TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT
  )`); } catch(e) {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT DEFAULT 'days',
    discount_value INTEGER DEFAULT 7,
    max_uses INTEGER DEFAULT 100,
    used INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS support_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    reply TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`); } catch(e) {}

  // ─── Auth: Register with phone + password ────────────
  app.post('/api/mobile/auth/register', (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || phone.length < 10) return res.status(400).json({ error: 'Некорректный номер телефона' });
      if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

      const existing = db.prepare('SELECT id FROM mobile_users WHERE phone = ?').get(phone);
      if (existing) return res.status(400).json({ error: 'Пользователь уже зарегистрирован' });

      const code = generateCode();
      db.prepare('INSERT INTO mobile_codes (phone, code, purpose) VALUES (?, ?, ?)').run(phone, code, 'register');
      console.log(`[SMS] Код для ${phone}: ${code}`);

      res.json({ success: true, message: 'Код отправлен', code });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: Verify code & create user ─────────────────
  app.post('/api/mobile/auth/verify-register', (req, res) => {
    try {
      const { phone, code, password } = req.body;
      if (!phone || !code || !password) return res.status(400).json({ error: 'Все поля обязательны' });

      const valid = db.prepare("SELECT * FROM mobile_codes WHERE phone = ? AND code = ? AND purpose = 'register' AND datetime(created_at) > datetime('now', '-10 minutes')").get(phone, code);
      if (!valid) return res.status(400).json({ error: 'Неверный или просроченный код' });

      db.prepare('DELETE FROM mobile_codes WHERE phone = ?').run(phone);

      const passwordHash = bcrypt.hashSync(password, 10);
      const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const info = db.prepare('INSERT INTO mobile_users (phone, password_hash, free_attempts, referral_code) VALUES (?, ?, 3, ?)').run(phone, passwordHash, referralCode);
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(info.lastInsertRowid);

      const token = generateToken({ userId: user.id, phone: user.phone });

      res.json({
        token,
        user: {
          id: user.id, phone: user.phone, name: user.name,
          freeAttempts: user.free_attempts, tariff: user.tariff,
          isSubscribed: !!user.is_subscribed, tariffUntil: user.tariff_until,
          referralCode: user.referral_code,
        },
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: Login with phone + password ───────────────
  app.post('/api/mobile/auth/login', (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) return res.status(400).json({ error: 'Телефон и пароль обязательны' });

      const user = db.prepare('SELECT * FROM mobile_users WHERE phone = ?').get(phone);
      if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

      if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(400).json({ error: 'Неверный пароль' });
      }

      const token = generateToken({ userId: user.id, phone: user.phone });

      res.json({
        token,
        user: {
          id: user.id, phone: user.phone, name: user.name,
          freeAttempts: user.free_attempts, tariff: user.tariff,
          isSubscribed: !!user.is_subscribed, tariffUntil: user.tariff_until,
          referralCode: user.referral_code,
        },
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: Password reset ────────────────────────────
  app.post('/api/mobile/auth/forgot-password', (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

      const user = db.prepare('SELECT id FROM mobile_users WHERE phone = ?').get(phone);
      if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

      const code = generateCode();
      db.prepare('INSERT INTO mobile_codes (phone, code, purpose) VALUES (?, ?, ?)').run(phone, code, 'reset');
      console.log(`[SMS] Код сброса для ${phone}: ${code}`);

      res.json({ success: true, code: process.env.NODE_ENV !== 'production' ? code : undefined });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/mobile/auth/reset-password', (req, res) => {
    try {
      const { phone, code, newPassword } = req.body;
      if (!phone || !code || !newPassword) return res.status(400).json({ error: 'Все поля обязательны' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

      const valid = db.prepare("SELECT * FROM mobile_codes WHERE phone = ? AND code = ? AND purpose = 'reset' AND datetime(created_at) > datetime('now', '-10 minutes')").get(phone, code);
      if (!valid) return res.status(400).json({ error: 'Неверный или просроченный код' });

      db.prepare('DELETE FROM mobile_codes WHERE phone = ?').run(phone);
      const passwordHash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE mobile_users SET password_hash = ?, updated_at = datetime(\'now\') WHERE phone = ?').run(passwordHash, phone);

      res.json({ success: true, message: 'Пароль изменён' });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Auth: Refresh token ─────────────────────────────
  app.post('/api/mobile/auth/refresh', (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth) return res.status(401).json({ error: 'Требуется авторизация' });
      const payload = verifyToken(auth.replace('Bearer ', ''));
      if (!payload) return res.status(401).json({ error: 'Недействительный токен' });
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(payload.userId);
      if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
      const token = generateToken({ userId: user.id, phone: user.phone });
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
      
      let tariffUntil = user.tariff_until;
      if (user.is_subscribed && tariffUntil && new Date(tariffUntil) < new Date()) {
        db.prepare("UPDATE mobile_users SET is_subscribed = 0, tariff = 'free', updated_at = datetime('now') WHERE id = ?").run(user.id);
        user.is_subscribed = 0;
        user.tariff = 'free';
      }

      res.json({
        id: user.id, phone: user.phone, name: user.name,
        freeAttempts: user.free_attempts, tariff: user.tariff,
        isSubscribed: !!user.is_subscribed, tariffUntil: user.tariff_until,
        referralCode: user.referral_code,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.put('/api/mobile/profile', requireAuth, (req, res) => {
    try {
      const { name } = req.body;
      if (name !== undefined) {
        db.prepare("UPDATE mobile_users SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, req.mobileUser.userId);
      }
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      res.json({ id: user.id, phone: user.phone, name: user.name, freeAttempts: user.free_attempts, tariff: user.tariff, isSubscribed: !!user.is_subscribed, tariffUntil: user.tariff_until });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Tariffs ─────────────────────────────────────────
  app.get('/api/mobile/tariffs', (req, res) => {
    res.json(TARIFFS);
  });

  // ─── Check access ────────────────────────────────────
  app.get('/api/mobile/check-access', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      const tariff = TARIFFS[user.tariff] || TARIFFS.free;
      
      let canCreate = false;
      if (user.is_subscribed && user.tariff_until && new Date(user.tariff_until) > new Date()) {
        canCreate = true;
      } else if (user.free_attempts > 0) {
        canCreate = true;
      }

      res.json({
        tariff: user.tariff,
        tariffName: tariff.name,
        freeAttempts: user.free_attempts,
        isSubscribed: !!user.is_subscribed,
        tariffUntil: user.tariff_until,
        canCreate,
        voice: tariff.voice,
        pdfWatermark: tariff.pdfWatermark,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── SBP Payment ─────────────────────────────────────
  app.post('/api/mobile/payments/create', requireAuth, (req, res) => {
    try {
      const { tariff } = req.body;
      if (!tariff || !TARIFFS[tariff]) return res.status(400).json({ error: 'Некорректный тариф' });
      const amount = TARIFFS[tariff].price;
      if (amount <= 0) return res.status(400).json({ error: 'Бесплатный тариф' });

      const SBERBANK_PHONE = process.env.SBERBANK_PHONE || '79779475605';
      const sbpPayload = `https://qr.nspk.ru/PAYLOAD?amount=${amount}&purpose=Подписка+${encodeURIComponent(TARIFFS[tariff].name)}&redirect=false`;

      db.prepare('INSERT INTO mobile_payments (user_id, amount, tariff, sbp_payload, status) VALUES (?, ?, ?, ?, ?)').run(
        req.mobileUser.userId, amount, tariff, sbpPayload, 'pending'
      );

      res.json({
        amount,
        tariff,
        tariffName: TARIFFS[tariff].name,
        sbpPayload,
        qrData: sbpPayload,
        recipientPhone: `+${SBERBANK_PHONE}`,
        recipientBank: 'Сбербанк',
        purpose: `Подписка ${TARIFFS[tariff].name}`,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/mobile/payments/confirm', requireAuth, (req, res) => {
    try {
      const { tariff } = req.body;
      const payment = db.prepare('SELECT * FROM mobile_payments WHERE user_id = ? AND tariff = ? AND status = ? ORDER BY created_at DESC LIMIT 1').get(
        req.mobileUser.userId, tariff, 'pending'
      );
      if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

      let days = 30;
      if (tariff === 'quarter') days = 90;
      if (tariff === 'year') days = 365;

      const until = new Date(Date.now() + days * 86400000).toISOString();
      db.prepare("UPDATE mobile_payments SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(payment.id);
      db.prepare("UPDATE mobile_users SET tariff = ?, is_subscribed = 1, tariff_until = ?, updated_at = datetime('now') WHERE id = ?").run(
        tariff, until, req.mobileUser.userId
      );

      res.json({ success: true, tariffUntil: until });
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

      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      
      let canCreate = false;
      if (user.is_subscribed && user.tariff_until && new Date(user.tariff_until) > new Date()) {
        canCreate = true;
      } else if (user.free_attempts > 0) {
        canCreate = true;
      }

      if (!canCreate) {
        return res.status(403).json({ error: 'Лимит бесплатных техкарт исчерпан. Оформите подписку.' });
      }

      if (!user.is_subscribed) {
        db.prepare('UPDATE mobile_users SET free_attempts = free_attempts - 1 WHERE id = ?').run(req.mobileUser.userId);
      }

      const info = db.prepare(`INSERT INTO mobile_tech_cards (user_id, dish_name, ingredients, kbju, output, technology, cooking_time, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.mobileUser.userId, dish_name, JSON.stringify(ingredients || []), JSON.stringify(kbju || {}), output || 0, technology || '', cooking_time || 0, source || 'manual'
      );

      const card = db.prepare('SELECT * FROM mobile_tech_cards WHERE id = ?').get(info.lastInsertRowid);
      const updatedUser = db.prepare('SELECT free_attempts FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);

      res.json({ 
        id: info.lastInsertRowid, 
        dish_name,
        freeAttemptsLeft: updatedUser.free_attempts,
        card: { ...card, ingredients: JSON.parse(card.ingredients || '[]'), kbju: JSON.parse(card.kbju || '{}') }
      });
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

  // ─── AI Generate ─────────────────────────────────────
  app.post('/api/mobile/ai-generate', requireAuth, async (req, res) => {
    try {
      const { dish_name } = req.body;
      if (!dish_name) return res.status(400).json({ error: 'Название блюда обязательно' });

      const aiService = require('../services/ai-tech-card.service');
      const result = await aiService.generateTechCard(dish_name);

      res.json({
        dish_name,
        ingredients: result.ingredients,
        kbju_per_100g: result.kbju_per_100g || {},
        output: result.output || 300,
        technology: result.technology || '',
        cooking_time: result.cooking_time || 0,
        source: result.source || 'ai',
      });
    } catch (e) {
      res.status(500).json({ error: 'Не удалось сгенерировать. Попробуйте ещё раз.' });
    }
  });

  // ─── Promo codes ─────────────────────────────────────
  app.post('/api/mobile/promo', requireAuth, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Введите промокод' });
      
      const promo = db.prepare("SELECT * FROM promo_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now')) AND (max_uses IS NULL OR used < max_uses)").get(code.toUpperCase());
      if (!promo) return res.status(400).json({ error: 'Промокод недействителен' });

      db.prepare('UPDATE promo_codes SET used = used + 1 WHERE id = ?').run(promo.id);
      
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      
      if (promo.discount_type === 'attempts') {
        db.prepare('UPDATE mobile_users SET free_attempts = free_attempts + ?, updated_at = datetime(\'now\') WHERE id = ?').run(promo.discount_value, req.mobileUser.userId);
        const updated = db.prepare('SELECT free_attempts FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
        res.json({ success: true, freeAttempts: updated.free_attempts });
      } else {
        const currentUntil = user.tariff_until ? new Date(user.tariff_until) : new Date();
        const newUntil = new Date(currentUntil.getTime() + promo.discount_value * 86400000).toISOString();
        db.prepare("UPDATE mobile_users SET tariff = 'month', is_subscribed = 1, tariff_until = ?, updated_at = datetime('now') WHERE id = ?").run(newUntil, req.mobileUser.userId);
        res.json({ success: true, tariffUntil: newUntil });
      }
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Referral ────────────────────────────────────────
  app.post('/api/mobile/referral', requireAuth, (req, res) => {
    try {
      const { referralCode } = req.body;
      if (!referralCode) return res.status(400).json({ error: 'Введите реферальный код' });

      const referrer = db.prepare('SELECT * FROM mobile_users WHERE referral_code = ?').get(referralCode.toUpperCase());
      if (!referrer) return res.status(400).json({ error: 'Неверный реферальный код' });
      if (referrer.id === req.mobileUser.userId) return res.status(400).json({ error: 'Нельзя использовать свой код' });

      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (user.referred_by) return res.status(400).json({ error: 'Реферальный код уже использован' });

      db.prepare('UPDATE mobile_users SET referred_by = ?, free_attempts = free_attempts + 3, updated_at = datetime(\'now\') WHERE id = ?').run(referrer.id, req.mobileUser.userId);
      db.prepare('UPDATE mobile_users SET free_attempts = free_attempts + 3, updated_at = datetime(\'now\') WHERE id = ?').run(referrer.id);

      res.json({ success: true, message: '+3 попытки вам и другу!' });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Support chat ────────────────────────────────────
  app.post('/api/mobile/support', requireAuth, (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Введите сообщение' });
      
      db.prepare('INSERT INTO support_chats (user_id, message) VALUES (?, ?)').run(req.mobileUser.userId, message);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/mobile/support', requireAuth, (req, res) => {
    try {
      const chats = db.prepare('SELECT * FROM support_chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.mobileUser.userId);
      res.json(chats);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Admin: Analytics ────────────────────────────────
  app.get('/api/mobile/admin/analytics', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (!user || user.phone !== '+79779475605') return res.status(403).json({ error: 'Доступ запрещён' });

      const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM mobile_users').get()?.cnt || 0;
      const subscribedUsers = db.prepare("SELECT COUNT(*) as cnt FROM mobile_users WHERE is_subscribed = 1").get()?.cnt || 0;
      const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM mobile_payments WHERE status = 'paid'").get()?.total || 0;
      const freeAttemptsUsed = db.prepare('SELECT COALESCE(SUM(3 - free_attempts), 0) as total FROM mobile_users WHERE free_attempts < 3').get()?.total || 0;
      
      const topDishes = db.prepare(`
        SELECT dish_name, COUNT(*) as count 
        FROM mobile_tech_cards 
        GROUP BY dish_name 
        ORDER BY count DESC 
        LIMIT 10
      `).all();

      const recentPayments = db.prepare(`
        SELECT mp.*, mu.phone 
        FROM mobile_payments mp 
        JOIN mobile_users mu ON mu.id = mp.user_id 
        WHERE mp.status = 'paid'
        ORDER BY mp.paid_at DESC 
        LIMIT 20
      `).all();

      res.json({
        totalUsers,
        subscribedUsers,
        totalRevenue,
        freeAttemptsUsed,
        topDishes,
        recentPayments,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Admin: Support chats ────────────────────────────
  app.get('/api/mobile/admin/support', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (!user || user.phone !== '+79779475605') return res.status(403).json({ error: 'Доступ запрещён' });

      const chats = db.prepare(`
        SELECT sc.*, mu.phone, mu.name
        FROM support_chats sc
        JOIN mobile_users mu ON mu.id = sc.user_id
        ORDER BY sc.created_at DESC
        LIMIT 100
      `).all();

      res.json(chats);
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.post('/api/mobile/admin/support/:id/reply', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (!user || user.phone !== '+79779475605') return res.status(403).json({ error: 'Доступ запрещён' });

      const { reply } = req.body;
      db.prepare('UPDATE support_chats SET reply = ?, is_read = 1 WHERE id = ?').run(reply, req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Admin: Create promo code ────────────────────────
  app.post('/api/mobile/admin/promo', requireAuth, (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM mobile_users WHERE id = ?').get(req.mobileUser.userId);
      if (!user || user.phone !== '+79779475605') return res.status(403).json({ error: 'Доступ запрещён' });

      const { code, discountType, discountValue, maxUses, expiresAt } = req.body;
      if (!code) return res.status(400).json({ error: 'Укажите код' });

      db.prepare('INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        code.toUpperCase(), discountType || 'days', discountValue || 7, maxUses || 100, expiresAt || null
      );

      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── Set unlimited access (admin) ─────────────────────
  app.post('/api/mobile/admin/set-unlimited', (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: 'Телефон обязателен' });
      const info = db.prepare("UPDATE mobile_users SET is_subscribed = 1, tariff = 'year', tariff_until = '2099-12-31', free_attempts = -1, updated_at = datetime('now') WHERE phone = ?").run(phone);
      if (info.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ success: true, message: 'Безлимит активирован' });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });
};
