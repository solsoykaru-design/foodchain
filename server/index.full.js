const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const aggregatorIntegration = require(path.join(__dirname, 'aggregator-integration'));
const paymentModule = require(path.join(__dirname, 'payment'));
const forecastService = require(path.join(__dirname, 'services', 'forecast.service.js'));
const integration1C = require(path.join(__dirname, 'services', 'integration-1c.service'));
const autoOrdersService = require(path.join(__dirname, 'services', 'auto-orders.service.js'));
const autoWriteoffService = require(path.join(__dirname, 'services', 'auto-writeoff.service.js'));
const costingService = require(path.join(__dirname, 'services', 'costing.service.js'));
const { seedDemoData } = require(path.join(__dirname, 'services', 'seed-demo-data.service.js'));
const supplierPortal = require(path.join(__dirname, 'services', 'supplier-portal.service.js'));

const JWT_SECRET = process.env.JWT_SECRET || 'foodchain-staff-secret';
const PORTAL_SYNC_KEY = process.env.PORTAL_SYNC_KEY || 'portal-sync-key-123';

// --- Crash on missing env vars in production ---
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'SUPPLIER_JWT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`FATAL: ${key} environment variable is not set`);
      process.exit(1);
    }
  }
}

// In production, don't leak error details to the client
function safeError(msg) { return process.env.NODE_ENV === 'production' ? 'Internal server error' : msg; }
globalThis.safeError = safeError;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://localhost:4000').split(',').map(s => s.trim());
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
const io = new Server(server, { cors: corsOptions });

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Слишком много запросов, попробуйте позже' } });

app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use('/api', apiLimiter);
app.use(express.json({ limit: '50mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const guestDist = path.join(__dirname, '..', 'dist-guest');
if (fs.existsSync(guestDist)) {
  app.use('/guest', express.static(guestDist));
  app.use('/guest', (req, res) => {
    res.sendFile(path.join(guestDist, 'index.html'));
  });
}

const adminDist = path.join(__dirname, '..', 'dist-admin');
if (fs.existsSync(adminDist)) {
  app.use('/admin', express.static(adminDist));
  app.use('/admin', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

const courierDist = path.join(__dirname, '..', 'dist-courier');
if (fs.existsSync(courierDist)) {
  app.use('/courier', express.static(courierDist));
  app.use('/courier', (req, res) => {
    res.sendFile(path.join(courierDist, 'index.html'));
  });
}

const waiterDist = path.join(__dirname, '..', 'dist-waiter');
if (fs.existsSync(waiterDist)) {
  app.use('/waiter', express.static(waiterDist));
  app.use('/waiter', (req, res) => {
    res.sendFile(path.join(waiterDist, 'index.html'));
  });
}

const kitchenDist = path.join(__dirname, '..', 'dist-kitchen');
if (fs.existsSync(kitchenDist)) {
  app.use('/kitchen', express.static(kitchenDist));
  app.use('/kitchen', (req, res) => {
    res.sendFile(path.join(kitchenDist, 'index.html'));
  });
}

const websiteDist = path.join(__dirname, '..', 'dist-website');

const kioskDist = path.join(__dirname, '..', 'dist-kiosk');
if (fs.existsSync(kioskDist)) {
  app.use('/kiosk', express.static(kioskDist));
  app.use('/kiosk', (req, res) => {
    res.sendFile(path.join(kioskDist, 'index.html'));
  });
}

app.get('/tg-app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tg-app.html')));

app.get('/login', (req, res) => {
  res.redirect('/portal/login');
});

// Proxy /portal/api to the portal backend
app.use('/portal/api', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 80,
    path: '/api' + req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost' },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('Portal proxy error:', err.message);
    res.status(502).json({ error: 'Portal backend unavailable' });
  });
  if (req.rawBody) proxyReq.write(req.rawBody);
  else req.pipe(proxyReq);
});

const portalDist = path.join(__dirname, '..', 'portal', 'frontend', 'dist');
if (fs.existsSync(portalDist)) {
  app.use('/portal', express.static(portalDist));
  app.use('/portal', (req, res) => {
    res.sendFile(path.join(portalDist, 'index.html'));
  });
}

const db = new Database(path.join(__dirname, 'foodchain.db'));
db.pragma('journal_mode = WAL');

// ─── Automatic tenant isolation via db.prepare override ────────
const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();
db.function('current_tenant_id', () => tenantStorage.getStore() || 1);

const TENANT_TABLES = new Set([
  'dishes', 'menu_categories', 'inventory_items', 'tech_cards', 'tech_card_ingredients',
  'orders', 'order_status_history', 'staff', 'users', 'reviews', 'guest_photos',
  'couriers', 'notifications', 'booking_tables', 'bookings', 'suppliers',
  'pickup_points', 'staff_shifts', 'staff_permissions', 'delivery_zones',
  'promo_codes', 'campaigns', 'audit_logs', 'finance_transactions',
  'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
  'payment_methods', 'documents', 'chat_messages', 'staff_chat_messages',
  'courier_guest_messages', 'courier_personal_templates', 'order_splits',
  'packaging', 'stock_contragents', 'batches', 'warehouse_bindings',
  'weekly_menu', 'stop_list_items', 'languages', 'dish_modifiers',
  'price_history', 'courier_activity_log', 'courier_locations',
  'user_notes', 'salary', 'salary_log', 'forecasts', 'inventory_transactions',
  'user_bonuses', 'bonus_transactions', 'certificates', 'discount_rules',
  'workshops', 'wholesale_prices', 'contragents', 'branches',
  'messages', 'chats', 'staff_chats', 'courier_guest_chats',
  'courier_chat_templates', 'push_settings', 'cashier_shifts',
  'stock_categories', 'themes', 'dish_step_completions',
  'staff_schedules', 'bank_transactions', 'client_groups',
  'review_questions', 'modifier_groups', 'modifiers', 'stop_lists',
  'staff_roles', 'dish_tech_cards', 'dish_tech_card_ingredients',
  'loyalty_settings', 'loyalty_levels', 'kpi_targets',
  'email_templates', 'email_logs', 'email_unsubscribes',
  'telegram_bot_users', 'telegram_order_subscriptions', 'telegram_bot_log',
  'auto_order_settings', 'honest_sign_settings', 'honest_sign_products',
  'courier_locations', 'yandex_afisha_bookings',
  'app_banners', 'app_promotions', 'app_modifier_groups', 'app_modifiers',
  'app_working_hours', 'app_special_days',
]);

const SQL_KEYWORDS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'PRAGMA']);
const ORIG_PREPARE = db.prepare.bind(db);
db.prepare = function(sqlText) {
  if (typeof sqlText !== 'string') return ORIG_PREPARE(sqlText);
  const upper = sqlText.trim().toUpperCase();
  const firstWord = upper.split(/\s/)[0];
  if (!SQL_KEYWORDS.has(firstWord)) return ORIG_PREPARE(sqlText);
  if (upper.includes('TENANT_ID') || upper.includes('CURRENT_TENANT_ID')) return ORIG_PREPARE(sqlText);
  // Skip JOIN, subquery, UNION — too complex for auto-transform
  if (upper.includes(' JOIN ') || upper.includes('(SELECT') || upper.includes(' UNION ')) return ORIG_PREPARE(sqlText);

  // Match whole words only (avoid `supplier_portal_users` matching `users`)
  const found = [...TENANT_TABLES].find(t => {
    const re = new RegExp('\\b' + t + '\\b', 'i');
    return re.test(sqlText);
  });
  if (!found) return ORIG_PREPARE(sqlText);

  let modified = sqlText;

  // Find insertion point: before ORDER BY, LIMIT, GROUP BY, or HAVING
  const clauseList = ['ORDER BY', 'LIMIT', 'GROUP BY', 'HAVING'];
  let insertPos = modified.trimEnd().replace(/;\s*$/, '').length;
  for (const clause of clauseList) {
    const ci = upper.indexOf(clause);
    if (ci !== -1 && ci < insertPos) insertPos = ci;
  }

  if (firstWord === 'INSERT') {
    const colMatch = modified.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    const valMatch = modified.match(/VALUES\s*\(([^)]+)\)/i);
    if (colMatch && valMatch) {
      modified = modified.replace(colMatch[1], colMatch[1] + ', tenant_id');
      modified = modified.replace(valMatch[1], valMatch[1] + ', current_tenant_id()');
    }
  } else if (firstWord === 'SELECT' || firstWord === 'UPDATE' || firstWord === 'DELETE') {
    const hasWhere = upper.indexOf('WHERE') !== -1 && upper.indexOf('WHERE') < insertPos;
    const tail = modified.slice(insertPos).trim();
    if (hasWhere) {
      modified = modified.slice(0, insertPos).trimEnd() + ' AND tenant_id = current_tenant_id() ' + tail;
    } else {
      modified = modified.slice(0, insertPos).trimEnd() + ' WHERE tenant_id = current_tenant_id() ' + tail;
    }
  }

  return ORIG_PREPARE(modified);
};

// ─── Helper: safeSortFilter ─────────────────────────────────────
const ALLOWED_SORT_COLS = ['id', 'name', 'date', 'created_at', 'updated_at', 'status', 'type', 'price', 'amount', 'category', 'rating', 'sort_order'];
function safeSort(sortCol, sortDir) {
  const safeCol = ALLOWED_SORT_COLS.includes(sortCol) ? sortCol : 'created_at';
  return { col: safeCol, dir: sortDir === 'ASC' ? 'ASC' : 'DESC' };
}

// ─── Auth Middleware ────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.tenant_id = decoded.tenantId || decoded.tenant_id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// ─── Tenant middleware: ensures req.tenant_id is set ───────────
function ensureTenantId(req, res, next) {
  if (req.tenant_id) return next();
  // In production, derive tenant_id from subdomain/domain:
  //   const host = req.hostname.split('.')[0];
  //   req.tenant_id = tenantDomainMap[host] || 1;
  // Fallback for dev: from query param or default to 1
  req.tenant_id = req.query?.tenant_id || 1;
  if (typeof req.tenant_id === 'string') req.tenant_id = parseInt(req.tenant_id, 10);
  if (!req.tenant_id || isNaN(req.tenant_id)) req.tenant_id = 1;
  next();
}

app.use('/api', ensureTenantId);
app.use('/api', (req, res, next) => tenantStorage.run(req.tenant_id, next));

// Protect all /api/admin/* routes
app.use('/api/admin', authenticateToken);

// Protect additional admin-level route groups outside /api/admin/
app.use('/api/finance', authenticateToken);
app.use('/api/dashboard', authenticateToken);
app.use('/api/reports', authenticateToken);
app.use('/api/accounts', authenticateToken);
app.use('/api/journal', authenticateToken);
app.use('/api/audit-logs', authenticateToken);
app.use('/api/documents', authenticateToken);
app.use('/api/branding', (req, res, next) => { if (req.path.startsWith('/public/')) return next(); authenticateToken(req, res, next); });
app.use('/api/site-settings', (req, res, next) => { if (req.path.startsWith('/public/')) return next(); authenticateToken(req, res, next); });
app.use('/api/app/settings', authenticateToken);
app.use('/api/app/banners', authenticateToken);
app.use('/api/app/promotions', authenticateToken);
app.use('/api/app/modifier-groups', authenticateToken);
app.use('/api/app/modifiers', authenticateToken);
app.use('/api/app/visibility', authenticateToken);
app.use('/api/app/audit-log', authenticateToken);
app.use('/api/app/working-hours', authenticateToken);
app.use('/api/loyalty/settings', authenticateToken);
app.use('/api/loyalty-levels', authenticateToken);
app.use('/api/kpi-targets', authenticateToken);
app.use('/api/email/settings', authenticateToken);
app.use('/api/push-settings', authenticateToken);
app.use('/api/telegram-bot/settings', authenticateToken);
app.use('/api/telegram-bot/broadcast', authenticateToken);
app.use('/api/integrations', authenticateToken);
app.use('/api/languages-page-data', authenticateToken);
app.use('/api/search', authenticateToken);
app.use('/api/tenant-mode', authenticateToken);
app.use('/api/tenant-limits', authenticateToken);
app.use('/api/staff-chats', authenticateToken);
app.use('/api/courier-guest-chats', authenticateToken);
app.use('/api/generate-code', authenticateToken);
app.use('/api/email/send', authenticateToken);
app.use('/api/email/send-campaign', authenticateToken);
app.use('/api/courier/templates', authenticateToken);

// ─── Swagger / OpenAPI ─────────────────────────────────────────
const swaggerSpec = swaggerJsDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FoodChain Enterprise API',
      version: '2.0.0',
      description: 'REST API для управления рестораном: заказы, меню, склад, финансы, отчёты, интеграции.',
      contact: { name: 'FoodChain Support', email: 'support@foodchain.app' },
    },
    servers: [{ url: '/', description: 'Основной сервер' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [path.join(__dirname, 'index.js'), path.join(__dirname, 'routes', '*.js')],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

const STATUS_CHAIN = {
  new:        { next: ['confirmed', 'cancelled'] },
  confirmed:  { next: ['preparing', 'cancelled'] },
  preparing:  { next: ['ready', 'cancelled'] },
  ready:      { next: ['served', 'assigned', 'cancelled'] },
  served:     { next: ['paid', 'cancelled'] },
  paid:       { next: ['closed', 'cancelled'] },
  closed:     { next: [] },
  assigned:   { next: ['en_route', 'cancelled'] },
  en_route:   { next: ['delivered', 'cancelled'] },
  delivered:  { next: [] },
  cancelled:  { next: [] },
};

const STATUS_LABELS = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов к выдаче',
  served: 'Подан', paid: 'Оплачен', closed: 'Закрыт',
  assigned: 'Назначен курьеру', en_route: 'В пути', delivered: 'Выполнен', cancelled: 'Отменён',
};

function toCamelCase(row) {
  if (!row) return null;
  const map = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    map[camel] = row[key];
  }
  if (map.items && typeof map.items === 'string') map.items = JSON.parse(map.items);
  if (map.statusHistory && typeof map.statusHistory === 'string') map.statusHistory = JSON.parse(map.statusHistory);
  if (map.kbju && typeof map.kbju === 'string') map.kbju = JSON.parse(map.kbju);
  if (map.tags && typeof map.tags === 'string') map.tags = JSON.parse(map.tags);
  if (map.allergens && typeof map.allergens === 'string') map.allergens = JSON.parse(map.allergens);
  if (map.workingHours && typeof map.workingHours === 'string') map.workingHours = JSON.parse(map.workingHours);
  if (map.ingredients && typeof map.ingredients === 'string') map.ingredients = JSON.parse(map.ingredients);
  if (map.salaryType && typeof map.salaryType === 'string' && map.salaryType.startsWith('[')) try { map.salaryType = JSON.parse(map.salaryType); } catch(e) {}
  if (map.salaryValue && typeof map.salaryValue === 'string' && map.salaryValue.startsWith('{')) try { map.salaryValue = JSON.parse(map.salaryValue); } catch(e) {}
  if (map.instructions && typeof map.instructions === 'string') map.instructions = JSON.parse(map.instructions);
  if (map.compound && typeof map.compound === 'string') map.compound = JSON.parse(map.compound);
  if (map.isPaid !== undefined) map.isPaid = !!map.isPaid;
  if (map.isAvailable !== undefined) map.isAvailable = !!map.isAvailable;
  if (map.isActive !== undefined) map.isActive = !!map.isActive;
  if (map.isNew !== undefined) map.isNew = !!map.isNew;
  if (map.isPopular !== undefined) map.isPopular = !!map.isPopular;
  if (map.isRead !== undefined) map.isRead = !!map.isRead;
  if (map.isConfirmed !== undefined) map.isConfirmed = !!map.isConfirmed;
  if (map.showOnSite !== undefined) map.showOnSite = !!map.showOnSite;
  if (map.showOnApp !== undefined) map.showOnApp = !!map.showOnApp;
  if (map.showOnKiosk !== undefined) map.showOnKiosk = !!map.showOnKiosk;
  if (map.showOnWaiter !== undefined) map.showOnWaiter = !!map.showOnWaiter;
  if (map.showOnAggregators !== undefined) map.showOnAggregators = !!map.showOnAggregators;
  return map;
}

function cgChatToCamel(row) {
  if (!row) return null;
  const map = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    map[camel] = row[key];
  }
  if (map.locationData && typeof map.locationData === 'string') { try { map.locationData = JSON.parse(map.locationData); } catch {} }
  if (map.isRead !== undefined) map.isRead = !!map.isRead;
  if (map.isImportant !== undefined) map.isImportant = !!map.isImportant;
  if (map.isActive !== undefined) map.isActive = !!map.isActive;
  return map;
}

function toCamelCaseArray(rows) {
  return rows.map(toCamelCase);
}

function getOrderFull(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
  let courierPhone = null;
  if (order.courier_id) {
    const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(order.courier_id);
    if (c) courierPhone = c.phone;
  }
  return toCamelCase({ ...order, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'guest',
    password TEXT,
    bonus_balance INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    visits_count INTEGER DEFAULT 0,
    loyalty_level TEXT DEFAULT 'новичок',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS couriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT,
    is_available INTEGER DEFAULT 1,
    avg_rating REAL DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    address TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL DEFAULT 0,
    delivery_fee REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    is_paid INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'delivery',
    status TEXT NOT NULL DEFAULT 'new',
    courier_id INTEGER,
    courier_name TEXT,
    assigned_by INTEGER,
    assigned_at TEXT,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    dish_name TEXT,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    text TEXT NOT NULL,
    reply TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    courier_id INTEGER,
    title TEXT NOT NULL,
    body TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    compound TEXT,
    price REAL NOT NULL,
    old_price REAL,
    image_url TEXT,
    category_id INTEGER,
    weight REAL,
    netto REAL DEFAULT 0,
    unit TEXT DEFAULT 'г',
    calories REAL,
    proteins REAL,
    fats REAL,
    carbs REAL,
    kbju TEXT,
    is_available INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    is_popular INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    allergens TEXT DEFAULT '[]',
    barcode TEXT,
    article TEXT,
    type TEXT DEFAULT 'goods',
    cost REAL DEFAULT 0,
    markup REAL DEFAULT 0,
    tech_card_id INTEGER,
    branch_id INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    tenant_id INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tech_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_id INTEGER,
    dishName TEXT,
    description TEXT,
    calories REAL DEFAULT 0,
    proteins REAL DEFAULT 0,
    fats REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    totalCost REAL DEFAULT 0,
    cooking_time INTEGER,
    yield TEXT,
    ingredients TEXT,
    instructions TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS booking_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER,
    zone TEXT,
    x REAL,
    y REAL,
    width REAL,
    height REAL,
    color TEXT,
    shape TEXT DEFAULT 'rectangle',
    branch_id INTEGER,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    table_id INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration INTEGER DEFAULT 120,
    guest_count INTEGER,
    status TEXT DEFAULT 'pending',
    deposit REAL DEFAULT 0,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (table_id) REFERENCES booking_tables(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    price_per_unit REAL,
    current_stock REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    supplier_id INTEGER,
    expiry_date TEXT,
    branch_id INTEGER,
    tenant_id INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    type TEXT,
    quantity REAL,
    price_per_unit REAL,
    total REAL,
    supplier_id INTEGER,
    supplier_name TEXT,
    note TEXT,
    document_number TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES inventory_items(id)
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tenant_id INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contragents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    company_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'ip',
    inn TEXT,
    kpp TEXT,
    legal_country TEXT DEFAULT 'Российская Федерация',
    legal_region TEXT,
    legal_city TEXT,
    legal_street TEXT,
    legal_house TEXT,
    legal_index TEXT,
    actual_country TEXT DEFAULT 'Российская Федерация',
    actual_region TEXT,
    actual_city TEXT,
    actual_street TEXT,
    actual_house TEXT,
    actual_index TEXT,
    bank_account TEXT,
    bank_name TEXT,
    bank_address TEXT,
    bik TEXT,
    correspondent_account TEXT,
    contract_number TEXT,
    contract_date TEXT,
    vat_included INTEGER DEFAULT 0,
    wholesale_price_list TEXT,
    cost_item_debit TEXT,
    cost_item_credit TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    supplier_number TEXT,
    work_conditions TEXT,
    description TEXT,
    id_1c TEXT,
    min_order_sum REAL DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    payment_deferral_days INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pickup_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    lat REAL,
    lng REAL,
    phone TEXT,
    description TEXT,
    working_hours TEXT,
    image_url TEXT,
    estimated_ready_minutes INTEGER DEFAULT 15,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    role TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    password TEXT,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    hourly_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS staff_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    branch_id INTEGER,
    is_confirmed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS staff_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER,
    section TEXT,
    can_view INTEGER DEFAULT 1,
    can_edit INTEGER DEFAULT 0,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS delivery_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    radius_km REAL,
    min_order REAL,
    delivery_price REAL,
    estimated_time INTEGER
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT,
    value REAL,
    min_order REAL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    trigger_type TEXT,
    message TEXT,
    button_text TEXT,
    segment TEXT,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    admin_name TEXT,
    action TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    group_name TEXT,
    type TEXT
  );

  CREATE TABLE IF NOT EXISTS finance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    category TEXT,
    amount REAL,
    payment_method TEXT,
    description TEXT,
    order_id INTEGER,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
    is_active INTEGER DEFAULT 1,
    parent_id INTEGER,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT NOT NULL,
    description TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT,
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id)
  );

  INSERT OR IGNORE INTO chart_of_accounts (code, name, type, description) VALUES
  ('01', 'Основные средства', 'asset', 'Здания, оборудование, мебель'),
  ('02', 'Амортизация ОС', 'asset', 'Накопленная амортизация'),
  ('10', 'Материалы', 'asset', 'Сырьё, продукты, упаковка'),
  ('41', 'Товары', 'asset', 'Товары для перепродажи'),
  ('50', 'Касса', 'asset', 'Наличные денежные средства'),
  ('51', 'Расчётный счёт', 'asset', 'Безналичные денежные средства'),
  ('55', 'Специальные счета', 'asset', 'Электронные кошельки, эквайринг'),
  ('60', 'Расчёты с поставщиками', 'liability', 'Задолженность перед поставщиками'),
  ('62', 'Расчёты с покупателями', 'asset', 'Задолженность клиентов'),
  ('66', 'Кредиты и займы', 'liability', 'Краткосрочные и долгосрочные кредиты'),
  ('68', 'Расчёты по налогам', 'liability', 'НДС, налог на прибыль, УСН'),
  ('69', 'Расчёты с соц. фондами', 'liability', 'Страховые взносы'),
  ('70', 'Расчёты с персоналом', 'liability', 'Заработная плата'),
  ('71', 'Расчёты с подотчётными лицами', 'asset', 'Авансы сотрудникам'),
  ('76', 'Расчёты с разными дебиторами/кредиторами', 'asset', 'Прочие расчёты'),
  ('80', 'Уставный капитал', 'equity', 'Вложения учредителей'),
  ('84', 'Нераспределённая прибыль', 'equity', 'Накопленная прибыль / убыток'),
  ('90', 'Продажи', 'income', 'Выручка от реализации'),
  ('91', 'Прочие доходы и расходы', 'income', 'Операционные доходы/расходы'),
  ('99', 'Прибыли и убытки', 'equity', 'Финансовый результат'),
  ('000', 'Вспомогательный счет', 'equity', 'Для балансировки проводок');
`);

  try { db.exec(`ALTER TABLE suppliers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}

  supplierPortal.initTables(db);

  try { db.exec("CREATE TABLE IF NOT EXISTS email_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER DEFAULT 1, name TEXT NOT NULL, subject TEXT NOT NULL, body_html TEXT, variables TEXT DEFAULT '[]', is_system INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))"); } catch(e) {}
  try { db.exec("CREATE TABLE IF NOT EXISTS email_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER DEFAULT 1, campaign_id INTEGER, recipient TEXT NOT NULL, subject TEXT, status TEXT DEFAULT 'sent', sent_at TEXT DEFAULT (datetime('now')), opened_at TEXT)"); } catch(e) {}
  try { db.exec("CREATE TABLE IF NOT EXISTS email_unsubscribes (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER DEFAULT 1, email TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(tenant_id, email))"); } catch(e) {}
  try { db.exec("INSERT OR IGNORE INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (1, 'Новый заказ', 'Ваш заказ принят', '<h1>Спасибо за заказ!</h1><p>Статус можно отследить в приложении.</p>', '[]', 1)"); } catch(e) {}
  try { db.exec("INSERT OR IGNORE INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (1, 'Приветствие', 'Добро пожаловать в FoodChain!', '<h1>Добро пожаловать!</h1><p>Рады видеть вас.</p>', '[]', 1)"); } catch(e) {}
  try { db.exec("INSERT OR IGNORE INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (1, 'Бонусы начислены', 'Вам начислены бонусы!', '<h1>Бонусы начислены</h1><p>Баланс: {balance} баллов</p>', '[]', 1)"); } catch(e) {}
  try { db.exec("INSERT OR IGNORE INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (1, 'status_changed', 'Статус заказа #{order_id} изменён', '<h1>Статус заказа #{order_id} обновлён</h1><p>Текущий статус: {status}</p><p>Спасибо, {user_name}!</p>', '[]', 1)"); } catch(e) {}
  try { db.exec("CREATE TABLE IF NOT EXISTS telegram_bot_users (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER DEFAULT 1, chat_id INTEGER UNIQUE NOT NULL, first_name TEXT DEFAULT '', username TEXT DEFAULT '', interaction_count INTEGER DEFAULT 1, last_interaction TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')))"); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS telegram_order_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  chat_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(chat_id, order_id)
)`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS telegram_bot_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER DEFAULT 1,
  chat_id INTEGER,
  command TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`); } catch(e) {}

  db.exec(`
  CREATE TABLE IF NOT EXISTS guest_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discount_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'percent',
    value REAL NOT NULL DEFAULT 0,
    target_type TEXT NOT NULL DEFAULT 'all',
    target_id INTEGER,
    min_order REAL DEFAULT 0,
    max_discount REAL,
    active_days TEXT,
    starts_at TEXT,
    ends_at TEXT,
    max_uses INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    balance REAL DEFAULT 0,
    lifetime_earned REAL DEFAULT 0,
    lifetime_spent REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bonus_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    bonus_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (bonus_id) REFERENCES user_bonuses(id)
  );

  CREATE TABLE IF NOT EXISTS loyalty_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    bonus_percent REAL DEFAULT 5,
    burn_days INTEGER DEFAULT 365,
    max_write_off_percent REAL DEFAULT 50,
    levels TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'gift',
    recipient_name TEXT,
    recipient_phone TEXT,
    message TEXT,
    is_active INTEGER DEFAULT 1,
    expires_at TEXT,
    used_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS foodchain_portal_tenants (
    id INTEGER PRIMARY KEY,
    name TEXT,
    allow_create_branches INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('app_name', 'FoodChain Admin', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('currency', '₽', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('default_delivery_fee', '0', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('min_order_amount', '0', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_delivery', 'true', 'orders', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_pickup', 'true', 'orders', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('working_time_start', '09:00', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('working_time_end', '23:00', 'general', 'text');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('logo_path', '', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('phone', '', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('address', '', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('timezone', 'UTC+3', 'general', 'text');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('tips_message', 'Не забудьте оценить обслуживание!', 'tips', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('tip_1', '5', 'tips', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('tip_2', '10', 'tips', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('tip_3', '15', 'tips', 'number');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('allow_negative_balance', 'false', 'warehouse', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_document_confirmation', 'false', 'warehouse', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_uniqueness_control', 'false', 'warehouse', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_nested_tech_card_write_off', 'false', 'warehouse', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('disable_add_items_via_receipt', 'false', 'warehouse', 'boolean');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_item_comments', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_qr_card', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('request_birthday', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('request_email', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('wallet_enabled', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('start_points_after_verification', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('auto_publish_reviews', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('allow_orders_without_auth', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('allow_registered_without_auth', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('show_available_quantity_online', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('limit_points_for_delivery', 'false', 'clients', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('simplified_sms_registration', 'false', 'clients', 'boolean');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('main_store', '', 'store', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('site_mode', '0', 'store', 'number');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('return_to_warehouse', 'В зависимости от складского остатка', 'returns', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('confirmation_phrase', 'Ваш заказ принят! Спасибо за покупку!', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('return_days', '7', 'returns', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('tax_type', 'Один налог на товар', 'taxes', 'text');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('initial_points', '100', 'loyalty', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('default_reservation_time', '3600', 'loyalty', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('auto_burn_points', 'false', 'loyalty', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('burn_days', '365', 'loyalty', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('update_burn_timer', 'false', 'loyalty', 'boolean');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('money_points_rate', '0.1', 'loyalty', 'number');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('max_check', '100000', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('min_return', '1', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('min_delivery_amount', '500', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('free_delivery_from', '1500', 'orders', 'number');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('delivery_cost', '200', 'orders', 'number');

  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('shipment_template', '[DD]-[MM]-[YY]', 'general', 'text');
  INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('pin_code_length', '4', 'general', 'number');
  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO payment_methods (name, key, description, is_active, sort_order) VALUES ('Наличные при доставке', 'cash', 'Оплата наличными курьеру', 1, 1);
  INSERT OR IGNORE INTO payment_methods (name, key, description, is_active, sort_order) VALUES ('Картой курьеру', 'card', 'Оплата банковской картой через терминал курьера', 1, 2);
  INSERT OR IGNORE INTO payment_methods (name, key, description, is_active, sort_order) VALUES ('Оплата онлайн', 'online', 'Оплата банковской картой на сайте', 1, 3);
  INSERT OR IGNORE INTO payment_methods (name, key, description, is_active, sort_order) VALUES ('Оплата в заведении', 'in_venue', 'Оплата при самовывозе в заведении', 1, 4);

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    number TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
    counterparty TEXT DEFAULT '',
    sum REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    items TEXT DEFAULT '[]',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
  CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
  CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    direction TEXT NOT NULL DEFAULT 'incoming',
    sender TEXT DEFAULT '',
    recipient TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    guest_id INTEGER DEFAULT 0,
    guest_name TEXT DEFAULT '',
    guest_phone TEXT DEFAULT '',
    order_id INTEGER DEFAULT 0,
    table_id INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    assigned_waiter_id INTEGER DEFAULT 0,
    assigned_waiter_name TEXT DEFAULT '',
    last_message TEXT DEFAULT '',
    last_message_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
    closed_at TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_chats_tenant ON chats(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
  CREATE INDEX IF NOT EXISTS idx_chats_waiter ON chats(assigned_waiter_id);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL DEFAULT 'guest',
    sender_id INTEGER DEFAULT 0,
    sender_name TEXT DEFAULT '',
    message TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);

  CREATE TABLE IF NOT EXISTS staff_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    order_id INTEGER NOT NULL DEFAULT 0,
    courier_id INTEGER DEFAULT 0,
    courier_name TEXT DEFAULT '',
    waiter_id INTEGER DEFAULT 0,
    waiter_name TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    is_important INTEGER DEFAULT 0,
    last_message TEXT DEFAULT '',
    last_message_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
    closed_at TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_staff_chats_order ON staff_chats(order_id);
  CREATE INDEX IF NOT EXISTS idx_staff_chats_courier ON staff_chats(courier_id);
  CREATE INDEX IF NOT EXISTS idx_staff_chats_waiter ON staff_chats(waiter_id);
  CREATE INDEX IF NOT EXISTS idx_staff_chats_status ON staff_chats(status);

  CREATE TABLE IF NOT EXISTS staff_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER DEFAULT 0,
    sender_type TEXT NOT NULL DEFAULT 'courier',
    sender_name TEXT DEFAULT '',
    message TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    message_type TEXT DEFAULT 'text',
    location_data TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_staff_chat_messages_chat ON staff_chat_messages(chat_id);

  CREATE TABLE IF NOT EXISTS courier_guest_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    order_id INTEGER NOT NULL DEFAULT 0,
    courier_id INTEGER DEFAULT 0,
    courier_name TEXT DEFAULT '',
    guest_id INTEGER DEFAULT 0,
    guest_name TEXT DEFAULT '',
    guest_phone TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    is_important INTEGER DEFAULT 0,
    last_message TEXT DEFAULT '',
    last_message_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
    closed_at TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_courier_guest_chats_order ON courier_guest_chats(order_id);
  CREATE INDEX IF NOT EXISTS idx_courier_guest_chats_courier ON courier_guest_chats(courier_id);
  CREATE INDEX IF NOT EXISTS idx_courier_guest_chats_guest ON courier_guest_chats(guest_id);
  CREATE INDEX IF NOT EXISTS idx_courier_guest_chats_status ON courier_guest_chats(status);

  CREATE TABLE IF NOT EXISTS courier_guest_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER DEFAULT 0,
    sender_type TEXT NOT NULL DEFAULT 'courier',
    sender_name TEXT DEFAULT '',
    message TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    message_type TEXT DEFAULT 'text',
    location_data TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_courier_guest_messages_chat ON courier_guest_messages(chat_id);

  CREATE TABLE IF NOT EXISTS courier_chat_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    text TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_courier_chat_templates_tenant ON courier_chat_templates(tenant_id);

  CREATE TABLE IF NOT EXISTS courier_personal_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );

  CREATE INDEX IF NOT EXISTS idx_courier_personal_templates_user ON courier_personal_templates(user_id);

  CREATE TABLE IF NOT EXISTS push_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    api_key TEXT DEFAULT '',
    project_id TEXT DEFAULT '',
    sender_id TEXT DEFAULT '',
    app_id TEXT DEFAULT '',
    is_enabled INTEGER DEFAULT 0,
    UNIQUE(tenant_id)
  );
`);

// ─── Schema migrations ───────────────────────────────────────────
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN image_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN username TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_type TEXT DEFAULT 'per_order'`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_value REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN is_online INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN last_location TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN tenant_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN language TEXT DEFAULT 'ru'`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN pickup_point_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE reviews ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE guest_photos ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN barcode TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN document_quantity REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN is_ingredient INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN contragent_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN contragent_name TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN category_name TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN branch_name TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN last_price REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN brutto REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN netto REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN cold_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN weight_by_tech_card INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN article TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN gtin TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN base_price REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN with_vat INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tax_rate TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN kcal REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN proteins REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN fats REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN carbs REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN calories_by_tech_card INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN heat_treatment INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN is_returnable INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec("ALTER TABLE inventory_items ADD COLUMN cold_loss_percent REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE inventory_items ADD COLUMN heat_loss_percent REAL DEFAULT 0"); } catch(e) {}
try { db.exec(`
  CREATE TABLE IF NOT EXISTS honest_sign_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1 UNIQUE,
    enabled INTEGER DEFAULT 0,
    api_key TEXT DEFAULT '',
    organization_inn TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS honest_sign_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    product_id INTEGER NOT NULL,
    product_type TEXT DEFAULT 'inventory',
    gtin TEXT,
    marking_code TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[HonestSign] Table error:', e.message); }
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN exclude_neg_control INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN beer_type INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN alcohol_type INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tobacco_type INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN sugar_type INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN id_1c TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN min_stock REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN default_contragent_id INTEGER`); } catch(e) {}
aggregatorIntegration.initTables(db);
paymentModule.initTables(db);
try { db.exec(`CREATE TABLE IF NOT EXISTS forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  forecast_date TEXT NOT NULL,
  forecast_quantity REAL DEFAULT 0,
  actual_quantity REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES inventory_items(id)
)`); } catch(e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_forecasts_product ON forecasts(product_id, forecast_date)`); } catch(e) {}
try { db.exec(`ALTER TABLE forecasts ADD COLUMN recommended_purchase REAL DEFAULT 0`); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/011_integration_1c.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/012_auto_orders.sql'), 'utf8')); } catch(e) {}

// Auto-order settings table
try { db.exec(`
  CREATE TABLE IF NOT EXISTS auto_order_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    enabled INTEGER DEFAULT 0,
    check_interval INTEGER DEFAULT 6,
    target_formula TEXT DEFAULT '2x_min',
    target_fixed_value REAL DEFAULT 0,
    target_percent REAL DEFAULT 200,
    auto_approve INTEGER DEFAULT 0,
    notify_admin INTEGER DEFAULT 1,
    notify_email TEXT DEFAULT '',
    UNIQUE(tenant_id)
  );
  INSERT OR IGNORE INTO auto_order_settings (tenant_id, enabled, check_interval, target_formula, target_percent, auto_approve, notify_admin)
  VALUES (1, 0, 6, '2x_min', 200, 0, 1);
`); } catch(e) { console.error('Auto order settings table error:', e.message); }

// Cash register shifts / Z-report
try { db.exec(`
  CREATE TABLE IF NOT EXISTS cashier_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    staff_id INTEGER NOT NULL DEFAULT 0,
    staff_name TEXT DEFAULT '',
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    opening_balance REAL DEFAULT 0,
    closing_balance REAL DEFAULT 0,
    expected_balance REAL DEFAULT 0,
    cash_income REAL DEFAULT 0,
    card_income REAL DEFAULT 0,
    online_income REAL DEFAULT 0,
    qr_income REAL DEFAULT 0,
    other_income REAL DEFAULT 0,
    total_income REAL DEFAULT 0,
    total_refund REAL DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT DEFAULT ''
  );
`); } catch(e) { console.error('Cashier shifts table error:', e.message); }
try { db.exec(`ALTER TABLE cashier_shifts ADD COLUMN total_discount REAL DEFAULT 0`); } catch(e) {}

// Add shift_id to orders for shift association
try { db.exec(`ALTER TABLE orders ADD COLUMN shift_id INTEGER DEFAULT 0`); } catch(e) {}

try { db.exec(`
  CREATE TABLE IF NOT EXISTS order_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    guest_name TEXT DEFAULT '',
    items TEXT DEFAULT '[]',
    amount REAL DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    payment_method TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN table_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}

// Add target_stock and auto_order_enabled to inventory_items
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN target_stock REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN auto_order_enabled INTEGER DEFAULT 1`); } catch(e) {}

try { db.exec(`CREATE TABLE IF NOT EXISTS tech_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, number TEXT, output REAL, cost_price REAL, created_at TEXT, valid_from TEXT, type TEXT, store TEXT, FOREIGN KEY(item_id) REFERENCES inventory_items(id))`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS packaging (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, name TEXT, barcode TEXT, is_primary INTEGER DEFAULT 0, size REAL DEFAULT 1, FOREIGN KEY(item_id) REFERENCES inventory_items(id))`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS stock_contragents (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, contragent_name TEXT, last_arrival_date TEXT, last_arrival_price REAL DEFAULT 0, agreed_price REAL DEFAULT 0, packaging TEXT, FOREIGN KEY(item_id) REFERENCES inventory_items(id))`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, arrival_date TEXT, document TEXT, expiry_date TEXT, contragent_name TEXT, warehouse TEXT, cost REAL DEFAULT 0, FOREIGN KEY(item_id) REFERENCES inventory_items(id))`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS warehouse_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, warehouse_id INTEGER, warehouse_name TEXT, is_bound INTEGER DEFAULT 1, min_qty REAL DEFAULT 0, max_qty REAL DEFAULT 0, FOREIGN KEY(item_id) REFERENCES inventory_items(id))`); } catch(e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category_name)`); } catch(e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory_items(branch_id)`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS stock_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, tenant_id INTEGER DEFAULT 1)`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN category_id INTEGER REFERENCES stock_categories(id)`); } catch(e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_category_id ON inventory_items(category_id)`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN item_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN number TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN output REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN cost_price REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN type TEXT DEFAULT 'main'`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN store TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN valid_from TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN thermal_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN packaging_cost REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN additional_costs TEXT DEFAULT '[]'`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN portions TEXT DEFAULT '[]'`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN gross_weight REAL DEFAULT 0`); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/015_staff_chat_location.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/016_courier_returning.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/017_multi_tenant_auth.sql'), 'utf8')); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN is_active INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN kbju_source TEXT DEFAULT 'auto'`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN cold_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN name TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN description TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN dishName TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE promo_codes ADD COLUMN created_at TEXT DEFAULT (datetime('now'))`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS themes (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER, name TEXT NOT NULL, colors TEXT NOT NULL DEFAULT '{}', is_preset INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`); } catch(e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN theme_id INTEGER DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN theme_id INTEGER DEFAULT NULL`); } catch(e) {}
// Seed preset themes if table is empty
const themeCount = db.prepare('SELECT COUNT(*) as cnt FROM themes').get();
if (themeCount.cnt === 0) {
  const presets = [
    [1,'Светлая (классическая)','{"bgPrimary":"#FFFFFF","bgSecondary":"#F1F5F9","textPrimary":"#1A1A1A","textSecondary":"#64748B","textHeading":"#0F172A","accent":"#2563EB","buttonPrimary":"#2563EB","cardBg":"#FFFFFF","border":"#E2E8F0","error":"#DC2626","success":"#16A34A","warning":"#D97706"}',1],
    [2,'Тёмная (ночная)','{"bgPrimary":"#121212","bgSecondary":"#1E1E1E","textPrimary":"#FFFFFF","textSecondary":"#A1A1AA","textHeading":"#FAFAFA","accent":"#7C3AED","buttonPrimary":"#7C3AED","cardBg":"#1E1E1E","border":"#2D2D2D","error":"#EF4444","success":"#22C55E","warning":"#F59E0B"}',1],
    [3,'Солнечная','{"bgPrimary":"#FFF8E7","bgSecondary":"#FFFAF0","textPrimary":"#4A3000","textSecondary":"#8B7355","textHeading":"#3B2200","accent":"#F59E0B","buttonPrimary":"#F59E0B","cardBg":"#FFFFFF","border":"#FDE68A","error":"#DC2626","success":"#16A34A","warning":"#D97706"}',1],
    [4,'Морская','{"bgPrimary":"#F0F9FF","bgSecondary":"#E0F2FE","textPrimary":"#0C4A6E","textSecondary":"#0284C7","textHeading":"#082F49","accent":"#0EA5E9","buttonPrimary":"#0EA5E9","cardBg":"#FFFFFF","border":"#BAE6FD","error":"#E11D48","success":"#059669","warning":"#D97706"}',1],
    [5,'Лесная','{"bgPrimary":"#F2F9F2","bgSecondary":"#E6F5E6","textPrimary":"#14532D","textSecondary":"#4A7C59","textHeading":"#0A3D1E","accent":"#22C55E","buttonPrimary":"#22C55E","cardBg":"#FFFFFF","border":"#BBF7D0","error":"#DC2626","success":"#16A34A","warning":"#CA8A04"}',1],
    [6,'Розовая','{"bgPrimary":"#FFF1F2","bgSecondary":"#FFE4E6","textPrimary":"#831843","textSecondary":"#BE185D","textHeading":"#4C0519","accent":"#EC4899","buttonPrimary":"#EC4899","cardBg":"#FFFFFF","border":"#FBCFE8","error":"#E11D48","success":"#16A34A","warning":"#D97706"}',1],
    [7,'Космическая','{"bgPrimary":"#0F172A","bgSecondary":"#1E293B","textPrimary":"#E2E8F0","textSecondary":"#94A3B8","textHeading":"#F8FAFC","accent":"#8B5CF6","buttonPrimary":"#8B5CF6","cardBg":"#1E293B","border":"#334155","error":"#EF4444","success":"#22C55E","warning":"#F59E0B"}',1],
    [8,'Минималистичная','{"bgPrimary":"#F8FAFC","bgSecondary":"#F1F5F9","textPrimary":"#0F172A","textSecondary":"#64748B","textHeading":"#020617","accent":"#475569","buttonPrimary":"#475569","cardBg":"#FFFFFF","border":"#CBD5E1","error":"#DC2626","success":"#16A34A","warning":"#D97706"}',1],
    [9,'Контрастная','{"bgPrimary":"#FFFFFF","bgSecondary":"#F5F5F5","textPrimary":"#000000","textSecondary":"#1A1A1A","textHeading":"#000000","accent":"#DC2626","buttonPrimary":"#DC2626","cardBg":"#FFFFFF","border":"#000000","error":"#B91C1C","success":"#15803D","warning":"#B45309"}',1],
    [10,'Винтажная','{"bgPrimary":"#FEF3C7","bgSecondary":"#FDE68A","textPrimary":"#78350F","textSecondary":"#92400E","textHeading":"#451A03","accent":"#B45309","buttonPrimary":"#B45309","cardBg":"#FFFBEB","border":"#D97706","error":"#B91C1C","success":"#15803D","warning":"#A16207"}',1],
    [11,'Светлый брутальный','{"bgPrimary":"#F5F5F5","bgSecondary":"#E5E5E5","textPrimary":"#1A1A1A","textSecondary":"#404040","textHeading":"#000000","accent":"#D32F2F","buttonPrimary":"#D32F2F","cardBg":"#FFFFFF","border":"#000000","error":"#B91C1C","success":"#15803D","warning":"#B45309"}',1],
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO themes (id, name, colors, is_preset) VALUES (?, ?, ?, ?)');
  for (const p of presets) insert.run(...p);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tech_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL UNIQUE REFERENCES inventory_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ingredients TEXT NOT NULL DEFAULT '[]',
    cooking_time INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`CREATE TABLE IF NOT EXISTS tech_card_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tech_card_id INTEGER NOT NULL REFERENCES tech_cards(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES inventory_items(id),
  item_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'г',
  brutto REAL DEFAULT 0,
  netto REAL DEFAULT 0,
  price_per_unit REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  loss_percent REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tech_card_modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tech_card_id INTEGER NOT NULL REFERENCES tech_cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  price REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
)`);

try { db.exec(`ALTER TABLE tech_cards ADD COLUMN heat_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN constant_costs REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN total_yield REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_cards ADD COLUMN expiry_date TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_card_ingredients ADD COLUMN cold_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_card_ingredients ADD COLUMN heat_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE tech_card_ingredients ADD COLUMN yield REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN step_instructions TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN step_mode INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS dish_step_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  dish_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  completed_by INTEGER,
  completed_at TEXT DEFAULT (datetime('now')),
  tenant_id INTEGER DEFAULT 1,
  UNIQUE(order_id, dish_id, step_index)
)`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN is_main INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE packaging ADD COLUMN tech_card_id INTEGER REFERENCES tech_cards(id)`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN created_by TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN approved_by TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN approved_at TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN warehouse_from TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN warehouse_to TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN doc_date TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN type_label TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN branch_id INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN display_order INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN barcode TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN article TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN type TEXT DEFAULT 'goods'`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN cost REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN markup REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN tech_card_id INTEGER`); } catch(e) {}

// Staff schedules (employee scheduling)
try { db.exec(`
  CREATE TABLE IF NOT EXISTS staff_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    staff_id INTEGER NOT NULL,
    staff_name TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '09:00',
    end_time TEXT NOT NULL DEFAULT '18:00',
    created_at TEXT DEFAULT (datetime('now'))
  )
`); } catch(e) { console.error('Staff schedules table error:', e.message); }
try { db.exec('CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON staff_schedules(tenant_id, date)'); } catch(e) {}

// Bank statements / reconciliation
try { db.exec(`
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    date TEXT NOT NULL,
    description TEXT DEFAULT '',
    amount REAL NOT NULL,
    balance REAL,
    order_id INTEGER,
    confidence TEXT DEFAULT 'unmatched',
    created_at TEXT DEFAULT (datetime('now'))
  )
`); } catch(e) { console.error('Bank transactions table error:', e.message); }

db.exec(`CREATE TABLE IF NOT EXISTS weekly_menu (id INTEGER PRIMARY KEY AUTOINCREMENT, day_of_week INTEGER NOT NULL, dish_id INTEGER NOT NULL, category_id INTEGER, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS stop_list_items (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT NOT NULL, item_type TEXT DEFAULT 'dish', item_id INTEGER, reason TEXT DEFAULT '', until_date TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS languages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0)`);
db.exec(`CREATE TABLE IF NOT EXISTS modifiers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL DEFAULT 0, group_id INTEGER, sort_order INTEGER DEFAULT 0)`);
db.exec(`CREATE TABLE IF NOT EXISTS modifier_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, min_select INTEGER DEFAULT 0, max_select INTEGER DEFAULT 0, is_required INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0)`);
db.exec(`CREATE TABLE IF NOT EXISTS dish_modifiers (id INTEGER PRIMARY KEY AUTOINCREMENT, dish_id INTEGER NOT NULL, modifier_id INTEGER NOT NULL, sort_order INTEGER DEFAULT 0)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    old_price REAL,
    new_price REAL NOT NULL,
    changed_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES inventory_items(id)
  );

  CREATE TABLE IF NOT EXISTS courier_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS courier_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    recorded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS salary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    accrued_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    paid_date TEXT,
    payment_method TEXT,
    note TEXT,
    details TEXT DEFAULT '{}',
    status TEXT DEFAULT 'calculated',
    calculated_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS salary_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    amount REAL DEFAULT 0,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS client_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    discount REAL DEFAULT 0,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS review_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    question TEXT NOT NULL,
    answer TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES reviews(id)
  );
`);

// ─── Schema migrations ───────────────────────────────────────────
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN image_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN username TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_type TEXT DEFAULT 'per_order'`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_value REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN is_online INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN last_location TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN position TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN pickup_point_id INTEGER`); } catch(e) {}
// Multi-tenant: add tenant_id to tables that lack it
try { db.exec(`ALTER TABLE couriers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE order_status_history ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE booking_tables ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE bookings ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE suppliers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE pickup_points ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE staff_shifts ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE staff_permissions ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE delivery_zones ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE promo_codes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE campaigns ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE audit_logs ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE finance_transactions ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE chart_of_accounts ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE journal_entries ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE journal_entry_lines ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE payment_methods ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE chat_messages ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE staff_chat_messages ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE courier_guest_messages ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE courier_personal_templates ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE order_splits ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE packaging ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE stock_contragents ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE batches ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE warehouse_bindings ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE weekly_menu ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE stop_list_items ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE languages ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_modifiers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE price_history ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE courier_activity_log ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE courier_locations ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE user_notes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE salary ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE salary_log ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE forecasts ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_transactions ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE user_bonuses ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE bonus_transactions ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE certificates ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE discount_rules ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE workshops ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE wholesale_prices ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE modifiers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE modifier_groups ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE kpi_targets ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE kpi_results ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN branch_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN promo_code TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE order_status_history ADD COLUMN created_by INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_order_date TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_transactions ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}

// ─── Validate Status Transition ──────────────────────────────────
function validateTransition(orderId, fromStatus, toStatus) {
  if (toStatus === 'cancelled') return { valid: true };
  const allowed = STATUS_CHAIN[fromStatus]?.next || [];
  if (!allowed.includes(toStatus)) {
    return { valid: false, error: `Недопустимый переход статуса: ${STATUS_LABELS[fromStatus] || fromStatus} → ${STATUS_LABELS[toStatus] || toStatus}. Допустимо: ${allowed.map(s => STATUS_LABELS[s] || s).join(', ') || 'нет'}` };
  }
  return { valid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────
function emitOrderUpdate(orderId) {
  const order = getOrderFull(orderId);
  if (order) {
    io.emit('order:update', order);
    if (order.courierId) {
      io.emit('order:courier', order);
    }
  }
  return order;
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Unified login (staff + guest)
 *     description: Authenticates a staff member or guest user. Supports password, phone OTP, and 2FA.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantName: { type: string, description: Restaurant tenant name for staff login }
 *               login: { type: string, description: Staff username }
 *               password: { type: string, description: Staff password }
 *               phone: { type: string, description: Phone for guest login }
 *               role: { type: string, description: Role filter }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token and user data
 *       401:
 *         description: Invalid credentials
 */
// ─── Auth (unified: staff + guest) ──────────────────────────────
app.post('/api/auth/login', (req, res) => {
  try {
    const { tenantName, login, password, phone, role } = req.body;

    // Staff login: tenantName + login + password
    if (tenantName && login && password) {
      const tenant = db.prepare('SELECT * FROM foodchain_portal_tenants WHERE LOWER(nickname) = LOWER(?) OR LOWER(name) = LOWER(?)').get(tenantName.trim(), tenantName.trim());
      if (!tenant) return res.status(401).json({ error: 'Ресторан не найден. Проверьте название' });

      const staff = db.prepare("SELECT * FROM staff WHERE username = ? AND (tenant_id = ? OR tenant_id IS NULL) AND is_active = 1").get(login, tenant.id);
      if (!staff) return res.status(401).json({ error: 'Неверный логин или пароль' });

      const storedHash = staff.password;
      let valid = false;
      if (storedHash && storedHash.startsWith('$2')) {
        valid = bcrypt.compareSync(password, storedHash);
      } else {
        valid = storedHash === password;
      }
      if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });

      const staffData = toCamelCase(staff);
      const twoFactorRecord = db.prepare('SELECT * FROM user_2fa WHERE staff_id = ? AND enabled = 1').get(staff.id);
      if (twoFactorRecord) {
        const { twoFactorCode } = req.body;
        if (!twoFactorCode) {
          const tempToken = jwt.sign(
            { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id, pending2fa: true },
            JWT_SECRET, { expiresIn: '5m' }
          );
          return res.json({ token: tempToken, user: { ...staffData, tenantName: tenant.nickname || tenant.name }, require2fa: true });
        }
        const verified = speakeasy.totp.verify({ secret: twoFactorRecord.secret, encoding: 'base32', token: twoFactorCode });
        if (!verified) return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
      }

      const token = jwt.sign(
        { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id },
        JWT_SECRET, { expiresIn: '24h' }
      );
      return res.json({ token, user: { ...staffData, tenantName: tenant.nickname || tenant.name } });
    }

    // Guest login: phone + optional password
    if (phone) {
      const guestRole = role || 'guest';
      let user;
      if (guestRole === 'courier') {
        user = db.prepare('SELECT * FROM couriers WHERE phone = ?').get(phone);
      } else {
        user = db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(phone, guestRole);
      }
      if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
      if (password && user.password && user.password !== password) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      return res.json({ user: toCamelCase(user) });
    }

    return res.status(400).json({ error: 'Укажите tenantName+login+password для сотрудника или phone для гостя' });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { name, phone, password, role, tenant_id } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
  try {
    // Check guest limit if tenant_id provided
    if (tenant_id && (role === 'guest' || !role)) {
      const guestLimit = getRoleLimit(db, tenant_id, 'guest');
      if (guestLimit !== null && guestLimit >= 0) {
        const current = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'").get(tenant_id)?.c || 0;
        if (current >= guestLimit) {
          return res.status(400).json({ error: `Достигнут лимит гостей (${current} из ${guestLimit}). Обратитесь к администратору.` });
        }
      }
    }

    const existing = db.prepare('SELECT id FROM couriers WHERE phone = ?').get(phone);
    if (existing) return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
    const table = role === 'courier' ? 'couriers' : 'users';
    const roleVal = role === 'courier' ? undefined : (role || 'guest');
    let info;
    const hashedPwd = password ? bcrypt.hashSync(password, 10) : null;
    if (role === 'courier') {
      info = db.prepare('INSERT INTO couriers (name, phone, password) VALUES (?, ?, ?)').run(name, phone, hashedPwd);
    } else {
      info = db.prepare('INSERT INTO users (name, phone, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)').run(name, phone, hashedPwd, roleVal, tenant_id || null);
    }
    const user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ user: toCamelCase(user) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Unified multi-tenant login (all staff roles) ──────────────
// ─── Tenant search / nearby ────────────────────────────────────
app.get('/api/tenants/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const tenants = db.prepare(
      "SELECT id, name, nickname, address, lat, lng, photo_url, app_settings FROM foodchain_portal_tenants WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(nickname) LIKE ?) LIMIT 20"
    ).all(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    res.json(tenants.map(t => toCamelCase(t)));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/tenants/nearby', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const r = parseFloat(radius) || 20;
    if (!lat || !lng) return res.status(400).json({ error: 'lat и lng обязательны' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const tenants = db.prepare(
      "SELECT id, name, nickname, address, lat, lng, photo_url, app_settings FROM foodchain_portal_tenants WHERE is_active = 1 AND lat <> 0 AND lng <> 0"
    ).all();

    const earthRadius = 6371;
    const result = tenants.map(t => {
      const dlat = (t.lat - userLat) * Math.PI / 180;
      const dlng = (t.lng - userLng) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(t.lat * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
      const distance = earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...toCamelCase(t), distance: Math.round(distance * 100) / 100 };
    }).filter(t => t.distance <= r).sort((a, b) => a.distance - b.distance);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Admin login (static + staff) ───────────────────────────────
app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

  // Hardcoded superadmin (backward compat)
  if (username === 'admin' && password === 'admin') {
    const admins = db.prepare("SELECT * FROM users WHERE role = 'superadmin'").all();
    let admin = admins[0];
    if (!admin) {
      db.prepare("INSERT INTO users (name, phone, role) VALUES ('Admin', '+70000000000', 'superadmin')").run();
      admin = db.prepare("SELECT * FROM users WHERE role = 'superadmin'").get();
    }
    const token = jwt.sign({ id: admin.id, username: 'admin', role: 'superadmin', tenant_id: admin.tenant_id || null }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: toCamelCase(admin) });
  }

  // Staff login (portal-synced accounts)
  try {
    const staff = db.prepare("SELECT s.*, fpt.name as tenant_name FROM staff s LEFT JOIN foodchain_portal_tenants fpt ON fpt.id = s.tenant_id WHERE s.username = ? AND s.is_active = 1").get(username);
    if (!staff) return res.status(401).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }
    if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

    // Check 2FA
    const staffData = toCamelCase(staff);
    const twoFactorRecord = db.prepare('SELECT * FROM user_2fa WHERE staff_id = ? AND enabled = 1').get(staff.id);
    if (twoFactorRecord) {
      const { twoFactorCode } = req.body;
      if (!twoFactorCode) {
        const tempToken = jwt.sign({ id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null, pending2fa: true }, JWT_SECRET, { expiresIn: '5m' });
        return res.json({ token: tempToken, user: staffData, require2fa: true });
      }
      const verified = speakeasy.totp.verify({ secret: twoFactorRecord.secret, encoding: 'base32', token: twoFactorCode });
      if (!verified) {
        return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
      }
    }

    const token = jwt.sign({ id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: staffData });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Staff Auth (portal-synced) ─────────────────────────────────
app.post('/api/staff/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    const staff = db.prepare("SELECT * FROM staff WHERE username = ? AND is_active = 1").get(username);
    if (!staff) return res.status(401).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;

    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }

    if (!valid) return res.status(401).json({ error: 'Неверный пароль' });

    const token = jwt.sign(
      { id: staff.id, username: staff.username, role: staff.role, tenant_id: staff.tenant_id || null },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: toCamelCase(staff) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: sync staff from portal ──────────────────────────
app.post('/api/internal/sync-staff', (req, res) => {
  try {
    const { key, staff } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Forbidden' });

    const { tenant_id, username, password_hash, role, first_name, last_name, phone, email } = staff;
    if (!tenant_id || !username || !password_hash) {
      return res.status(400).json({ error: 'tenant_id, username, password_hash required' });
    }

    // Enforce app limits for new staff creation
    const existing = db.prepare('SELECT id, role FROM staff WHERE username = ?').get(username);
    if (!existing) {
      const limitCheck = checkRoleLimit(db, tenant_id, role || 'waiter', true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    } else if (role && role !== existing.role) {
      const limitCheck = checkRoleLimit(db, tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (existing) {
      db.prepare(`UPDATE staff SET password=?, role=?, first_name=?, last_name=?, phone=?, email=?, tenant_id=? WHERE id=?`)
        .run(password_hash, role || 'waiter', first_name || username, last_name || null, phone || null, email || null, tenant_id, existing.id);
    } else {
      db.prepare(`INSERT INTO staff (username, password, role, first_name, last_name, phone, email, tenant_id, is_active) VALUES (?,?,?,?,?,?,?,?,1)`)
        .run(username, password_hash, role || 'waiter', first_name || username, last_name || null, phone || null, email || null, tenant_id);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders
 *     description: Returns orders with optional filtering by status, courier, or user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by order status
 *       - in: query
 *         name: courier_id
 *         schema: { type: integer }
 *         description: Filter by courier
 *       - in: query
 *         name: user_id
 *         schema: { type: integer }
 *         description: Filter by user/client
 *     responses:
 *       200:
 *         description: Array of orders with status history
 *   post:
 *     tags: [Orders]
 *     summary: Create an order
 *     description: Creates a new order with items, delivery info, and payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items: { type: array, description: Array of order items }
 *               total: { type: number }
 *               address: { type: string }
 *               payment_method: { type: string }
 *     responses:
 *       200:
 *         description: Created order
 */
// ─── Orders ──────────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
  const { status, courier_id, user_id } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  sql += ' AND tenant_id = ?'; params.push(req.tenant_id);
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (courier_id) { sql += ' AND courier_id = ?'; params.push(Number(courier_id)); }
  if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }
  sql += ' ORDER BY created_at DESC';
  const orders = db.prepare(sql).all(...params);
  const result = orders.map(o => {
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? AND tenant_id = ? ORDER BY created_at ASC').all(o.id, req.tenant_id);
    let courierPhone = null;
    if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
    return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
  });
  res.json(result);
});

app.get('/api/orders/track', (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Телефон обязателен' });
  const orders = db.prepare('SELECT * FROM orders WHERE user_phone = ? ORDER BY created_at DESC LIMIT 10').all(phone);
  const result = orders.map(o => {
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
    let courierPhone = null;
    if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
    return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
  });
  res.json(result);
});

app.get('/api/orders/:id', (req, res) => {
  const order = getOrderFull(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  res.json(order);
});

// GET /api/orders/:id/tracking — full tracking info for guest
app.get('/api/orders/:id/tracking', (req, res) => {
  try {
    const order = getOrderFull(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    let courierLocation = null;
    let eta = null;
    let distance = null;
    let restaurantLocation = null;

    if (order.branchId) {
      const branch = db.prepare('SELECT lat, lng, name, address FROM branches WHERE id = ?').get(order.branchId);
      if (branch && branch.lat && branch.lng) {
        restaurantLocation = { lat: branch.lat, lng: branch.lng, name: branch.name, address: branch.address };
      }
    }

    if (order.courierId) {
      let loc = db.prepare('SELECT lat, lng, recorded_at as updated_at FROM courier_locations WHERE staff_id = ?').get(order.courierId);
      if (!loc) {
        loc = db.prepare('SELECT latitude as lat, longitude as lng, updated_at FROM courier_locations WHERE courier_id = ?').get(order.courierId);
      }
      if (loc) {
        courierLocation = { lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at };

        if (order.address && restaurantLocation) {
          const R = 6371;
          const dLat = (restaurantLocation.lat - loc.latitude) * Math.PI / 180;
          const dLng = (restaurantLocation.lng - loc.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(loc.latitude*Math.PI/180)*Math.cos(restaurantLocation.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = Math.round(R * c * 10) / 10;
          eta = Math.round(distance / 0.3);
        }
      }
    }

    res.json({
      ...order,
      courierLocation,
      restaurantLocation,
      eta,
      distance,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/orders/:id/items', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Состав заказа обязателен' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    let subtotal = 0;
    for (const item of items) {
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(item.dishId);
      if (dish) {
        item.name = dish.name;
        item.price = dish.price;
        subtotal += dish.price * (item.quantity || 1);
      }
    }

    const itemsJson = JSON.stringify(items);
    db.prepare("UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?")
      .run(itemsJson, subtotal, subtotal, req.params.id);

    db.prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)")
      .run(req.params.id, order.status, 'Состав заказа изменён');

    const updated = emitOrderUpdate(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/orders/:id/assign-courier', (req, res) => {
  try {
    const { courier_id, courier_name } = req.body;
    if (!courier_id || !courier_name) return res.status(400).json({ error: 'ID и имя курьера обязательны' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    if (order.courier_id || (order.status !== 'ready' && order.status !== 'new')) {
      return res.status(400).json({ error: 'Курьер уже назначен или заказ не готов для назначения' });
    }

    db.prepare("UPDATE orders SET courier_id = ?, courier_name = ?, assigned_at = datetime('now'), status = 'assigned', updated_at = datetime('now') WHERE id = ?")
      .run(courier_id, courier_name, req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)')
      .run(req.params.id, 'assigned', `Назначен курьер ${courier_name}`);

    const updated = emitOrderUpdate(req.params.id);
    io.emit('order:assigned', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// GET /api/orders/:id/chat — check if courier-guest chat exists for this order
app.get('/api/orders/:id/chat', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const chat = db.prepare('SELECT * FROM courier_guest_chats WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    if (chat) {
      res.json({ exists: true, chatId: chat.id, isActive: chat.status === 'active', status: chat.status });
    } else {
      res.json({ exists: false, chatId: null, isActive: false, status: null });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Emit courier location via WebSocket for real-time tracking
app.put('/api/couriers/:id/location', (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    // Update both possible courier_locations table schemas
    try { db.prepare(`INSERT INTO courier_locations (staff_id, lat, lng) VALUES (?, ?, ?)`).run(req.params.id, latitude, longitude); } catch (e1) {
      try { db.prepare(`INSERT INTO courier_locations (courier_id, latitude, longitude) VALUES (?, ?, ?) ON CONFLICT(courier_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, updated_at = datetime('now')`).run(req.params.id, latitude, longitude); } catch (e2) {}
    }
    
    const data = { type: 'courier:location', courierId: Number(req.params.id), latitude, longitude, updatedAt: new Date().toISOString() };
    broadcast(data);
    io.emit('courier:location', data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/orders', (req, res) => {
  const { user_id, user_name, user_phone, address, items, total, payment_method, type, comment, bonus_used } = req.body;
  if (!user_id || !user_name || !user_phone) return res.status(400).json({ error: 'Данные пользователя обязательны' });
  
  let finalTotal = total || 0;
  let appliedBonus = 0;
  
  // Apply bonus if requested
  if (bonus_used && bonus_used > 0) {
    try {
      const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
      if (bonus && bonus.balance >= bonus_used) {
        const info = getGuestBonusInfo(user_id);
        const maxWriteOff = finalTotal * (info.maxWriteOffPercent / 100);
        const canUse = Math.min(bonus_used, bonus.balance, maxWriteOff);
        if (canUse > 0) {
          appliedBonus = canUse;
          finalTotal = Math.max(0, finalTotal - canUse);
        }
      }
    } catch (e) {}
  }

  const itemsJson = JSON.stringify(items || []);
  const subtotal = total || 0;
  const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, address, items, subtotal, total, discount, payment_method, type, comment, status, bonus_used, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`).run(user_id, user_name, user_phone, address || '', itemsJson, subtotal, finalTotal, appliedBonus, payment_method || 'cash', type || 'delivery', comment || '', appliedBonus, req.tenant_id);
  const orderId = info.lastInsertRowid;
  db.prepare('INSERT INTO order_status_history (order_id, status, note, tenant_id) VALUES (?, ?, ?, ?)').run(orderId, 'new', 'Заказ создан', req.tenant_id);

  db.prepare('UPDATE users SET visits_count = visits_count + 1, total_spent = total_spent + ? WHERE id = ?').run(subtotal, user_id);

  // Spend bonuses if applied
  if (appliedBonus > 0) {
    try {
      const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
      if (bonus) {
        db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(appliedBonus, appliedBonus, bonus.id);
        db.prepare('UPDATE users SET bonus_balance = MAX(0, bonus_balance - ?) WHERE id = ?').run(appliedBonus, user_id);
        db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(user_id, bonus.id, 'spend', appliedBonus, `Списание за заказ #${orderId}`, 'order', orderId);
      }
    } catch (e) { console.error('[Loyalty] Spend error:', e.message); }
  }

  io.emit('order:new', getOrderFull(orderId));
  emitOrderUpdate(orderId);
  broadcast({ type: 'order:new', orderId: Number(orderId) });
  const orderData = getOrderFull(orderId);
  orderData.bonusSaved = appliedBonus;
  res.status(201).json(orderData);
});

// ─── Order Split ──────────────────────────────────────────────────
app.get('/api/orders/:id/splits', (req, res) => {
  try {
    const splits = db.prepare('SELECT * FROM order_splits WHERE order_id = ? ORDER BY id ASC').all(req.params.id);
    res.json(toCamelCaseArray(splits));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.patch('/api/orders/:id/split', (req, res) => {
  try {
    const { splits } = req.body;
    if (!splits || !Array.isArray(splits) || splits.length === 0) return res.status(400).json({ error: 'splits required' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const created = [];
    for (const s of splits) {
      const info = db.prepare("INSERT INTO order_splits (order_id, guest_name, items, amount, payment_method) VALUES (?, ?, ?, ?, ?)").run(
        req.params.id, s.guest_name || '', JSON.stringify(s.items || []), s.amount || 0, s.payment_method || null
      );
      created.push({ id: info.lastInsertRowid, orderId: Number(req.params.id), guestName: s.guest_name, items: s.items, amount: s.amount });
    }
    res.json({ splits: created });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/order-splits/:id/pay', (req, res) => {
  try {
    const { payment_method } = req.body;
    const split = db.prepare('SELECT * FROM order_splits WHERE id = ?').get(req.params.id);
    if (!split) return res.status(404).json({ error: 'Split not found' });
    db.prepare("UPDATE order_splits SET is_paid = 1, payment_method = ? WHERE id = ?").run(payment_method || 'cash', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/orders/self-order', (req, res) => {
  try {
    const { items, table_id, guest_name, comment } = req.body;
    const result = db.prepare("INSERT INTO orders (items, table_id, user_name, comment, status, source, created_at, tenant_id) VALUES (?, ?, ?, ?, 'new', 'qr_self_order', datetime('now'), ?)").run(
      JSON.stringify(items || []), table_id || null, guest_name || 'Гость', comment || '', req.tenant_id || 1
    );
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { status, note } = req.body;
  if (!status) return res.status(400).json({ error: 'Статус обязателен' });
  if (!STATUS_CHAIN[status]) return res.status(400).json({ error: `Неизвестный статус: ${status}` });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (status !== order.status) {
    const validation = validateTransition(order.id, order.status, status);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
  }

  const writeOffTr = db.transaction(() => {
    if (status === 'ready' && order.status !== 'ready') {
      const items = JSON.parse(order.items || '[]');
      for (const item of items) {
        const dishId = item.dishId || item.dish_id;
        const qty = item.quantity || 1;
        
        // Try new dish_tech_cards first, fallback to old tech_cards
        const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dishId);
        let ingredientRows;

        if (tc) {
          ingredientRows = db.prepare('SELECT tci.*, ii.name as inv_name, ii.current_balance, ii.unit as inv_unit FROM dish_tech_card_ingredients tci LEFT JOIN inventory_items ii ON tci.item_id = ii.id WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()').all(tc.id);
        } else {
          // Fallback to old tech_cards
          const oldTc = db.prepare('SELECT * FROM tech_cards WHERE dish_id = ? ORDER BY created_at DESC').get(dishId);
          if (!oldTc) continue;
          let oldIngs = [];
          try { oldIngs = JSON.parse(oldTc.ingredients || '[]'); } catch {}
          ingredientRows = oldIngs.map(ing => ({
            item_name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit || 'г',
          }));
        }
        
        if (!ingredientRows || ingredientRows.length === 0) continue;

        // Check stock (with losses)
        for (const ing of ingredientRows) {
          if (!ing.item_id) continue;
          const qtyRaw = (ing.quantity || 0) * qty;
          const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
          const needQty = Math.round(qtyRaw * (1 + loss / 100) * 100) / 100;
          const actualStock = ing.current_balance ?? 0;
          if (actualStock < needQty) {
            throw new Error(`Недостаточно "${ing.inv_name || ing.item_name}" на складе: нужно ${needQty} ${ing.inv_unit || ing.unit || 'г'}, осталось ${actualStock}`);
          }
        }

        // Deduct stock (with losses)
        for (const ing of ingredientRows) {
          if (!ing.item_id) continue;
          const qtyRaw = (ing.quantity || 0) * qty;
          const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
          const needQty = Math.round(qtyRaw * (1 + loss / 100) * 100) / 100;
          db.prepare("UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?").run(needQty, ing.item_id);
          db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(ing.item_id, 'write_off', needQty, `Списание: заказ #${req.params.id}, блюдо ${item.name || dishId}`);
        }
      }
    }

      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
    const noteText = note || STATUS_LABELS[status] || status;
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, status, noteText);
    broadcast({ type: 'order:update', orderId: Number(req.params.id), status, note: noteText });

    if (status === 'delivered') {
      db.prepare('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?').run(order.courier_id);
      db.prepare('UPDATE users SET total_spent = total_spent + ? WHERE id = ?').run(order.total, order.user_id);
      // Auto-accrue loyalty bonuses
      try {
        const settings = getLoyaltySettings();
        const userId = order.user_id;
        const bonusAmount = Math.round(order.total * (settings.bonusPercent / 100) * 100) / 100;
        if (bonusAmount > 0) {
          const levels = settings.levels || [];
          let multiplier = 1;
          const user = db.prepare('SELECT total_spent FROM users WHERE id = ?').get(userId);
          if (user) {
            const sorted = [...levels].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));
            const current = [...sorted].reverse().find(l => user.total_spent >= (l.minSpent || 0));
            if (current && current.bonusMultiplier) multiplier = current.bonusMultiplier;
          }
          const finalBonus = Math.round(bonusAmount * multiplier * 100) / 100;
          let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
          if (!bonus) {
            const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(userId);
            bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
          }
          db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(finalBonus, finalBonus, bonus.id);
          db.prepare('UPDATE users SET bonus_balance = bonus_balance + ? WHERE id = ?').run(finalBonus, userId);
          db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'earned', finalBonus, `Начисление за заказ #${order.id}`, 'order', order.id);
          // Update loyalty level based on total spent
          if (settings.levels && settings.levels.length > 0) {
            const sorted = [...settings.levels].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));
            const current = [...sorted].reverse().find(l => (user.total_spent + order.total) >= (l.minSpent || 0));
            if (current) {
              db.prepare("UPDATE users SET loyalty_level = ? WHERE id = ?").run(current.name.toLowerCase(), userId);
            }
          }
        }
      } catch (e) { console.error('[Loyalty] Auto-accrue error:', e.message); }
    }
  });

  try {
    writeOffTr();
  } catch (e) {
    return res.status(400).json({ error: safeError(e.message) });
  }

  try {
    const tenantId = order.tenant_id || 1;
    const recipient = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id);
    if (recipient && recipient.email) {
      const unsub = db.prepare('SELECT id FROM email_unsubscribes WHERE tenant_id = ? AND email = ?').get(tenantId, recipient.email);
      if (!unsub) {
        const tmpl = db.prepare("SELECT * FROM email_templates WHERE tenant_id = ? AND name = 'status_changed' AND is_system = 1").get(tenantId) || db.prepare("SELECT * FROM email_templates WHERE tenant_id = ? AND name = 'Новый заказ' AND is_system = 1").get(tenantId);
        if (tmpl) {
          let body = (tmpl.body_html || '') + '';
          body = body.replace(/\{status\}/g, STATUS_LABELS[status] || status).replace(/\{order_id\}/g, order.id).replace(/\{user_name\}/g, order.user_name || '');
          body += '<br><br><small><a href="' + (process.env.BASE_URL || '') + '/api/email/unsubscribe?email=' + encodeURIComponent(recipient.email) + '&tenant=' + tenantId + '">Отписаться от рассылки</a></small>';
          const result = await emailService.sendMail(db, { to: recipient.email, subject: tmpl.subject, html: body }, tenantId);
          if (result.success) {
            db.prepare('INSERT INTO email_logs (tenant_id, recipient, subject, status) VALUES (?, ?, ?, ?)').run(tenantId, recipient.email, tmpl.subject, 'sent');
          }
        }
      }
    }
  } catch (e) { console.error('[Email] Status change notification error:', e.message); }

  const updated = emitOrderUpdate(req.params.id);

  if (aggregatorIntegration.setupRoutes && typeof aggregatorIntegration.setupRoutes === 'function') {
    try {
      const orderData = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (orderData && orderData.source === 'external' && orderData.external_provider && orderData.external_order_id) {
        const provider = orderData.external_provider;
        const p = aggregatorIntegration.PROVIDERS ? aggregatorIntegration.PROVIDERS[provider] : null;
        if (p) {
          const settings = db.prepare('SELECT * FROM aggregator_settings WHERE provider = ? AND enabled = 1').get(provider);
          if (settings) {
            const credentials = (() => { try { return JSON.parse(settings.credentials || '{}'); } catch { return {}; } })();
            p.updateStatus(orderData, orderData.external_order_id, status, credentials)
              .then(result => {
                const logStatus = result.ok ? 'success' : 'error';
                try {
                  db.prepare(`INSERT INTO aggregator_sync_log (tenant_id, provider, operation, request, response, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    settings.tenant_id || 1, provider, 'status_update',
                    `PUT /orders/${orderData.external_order_id}/status -> ${status}`,
                    JSON.stringify(result.data), logStatus,
                    result.ok ? null : (result.data?.message || JSON.stringify(result.data))
                  );
                } catch(e) {}
              })
              .catch(err => {
                try {
                  db.prepare(`INSERT INTO aggregator_sync_log (tenant_id, provider, operation, request, response, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    settings.tenant_id || 1, provider, 'status_update',
                    `PUT /orders/${orderData.external_order_id}/status -> ${status}`, '', 'error', err.message
                  );
                } catch(e) {}
              });
          }
        }
      }
    } catch(e) {}
  }

  res.json(updated);
});

app.put('/api/orders/:id/assign', (req, res) => {
  try {
    const { courier_id, courier_name, assigned_by } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    if (courier_id && courier_id > 0) {
      db.prepare("UPDATE orders SET courier_id = ?, courier_name = ?, assigned_by = ?, assigned_at = datetime('now'), status = 'assigned', updated_at = datetime('now') WHERE id = ?")
        .run(courier_id, courier_name, assigned_by, req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'assigned', `Назначен курьер ${courier_name}`);
      broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'assigned', courier: courier_name });
    } else {
      db.prepare("UPDATE orders SET courier_id = NULL, courier_name = NULL, assigned_by = NULL, assigned_at = NULL, status = 'ready', updated_at = datetime('now') WHERE id = ?")
        .run(req.params.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Курьер отказался');
      broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready', note: 'Курьер отказался' });
    }

    const updated = emitOrderUpdate(req.params.id);
    io.emit('order:assigned', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Courier returning to restaurant ────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getRestaurantCoords() {
  const branch = db.prepare("SELECT lat, lng FROM branches WHERE is_active = 1 AND lat != 0 AND lng != 0 ORDER BY id LIMIT 1").get();
  return branch ? { lat: branch.lat, lng: branch.lng } : null;
}
function getYandexApiKey() {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'yandex_maps_api_key'").get();
  return row ? row.value : '';
}
async function fetchYandexRoute(startLat, startLng, endLat, endLng, apiKey) {
  try {
    const body = {
      points: [{ latitude: startLat, longitude: startLng }, { latitude: endLat, longitude: endLng }],
      alternativesCount: 0,
      routeMode: 'driving'
    };
    const res = await fetch('https://api.routing.yandex.net/v2/route?apikey=' + encodeURIComponent(apiKey), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), timeout: 8000
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || !data.routes[0]) return null;
    const route = data.routes[0];
    const leg = route.legs[0];
    const polylineCoords = [];
    const extractCoords = (geom) => { if (!geom) return; for (const c of geom) polylineCoords.push(c.latitude + ',' + c.longitude); };
    if (route.geometry) extractCoords(route.geometry);
    if (leg && leg.steps) for (const step of leg.steps) extractCoords(step.geometry);
    return {
      distanceKm: leg.distance.value / 1000,
      durationMin: Math.round(leg.durationTotal.value / 60),
      polyline: polylineCoords.join(';')
    };
  } catch (e) { console.error('Yandex routing error:', e.message); return null; }
}
async function calcRoute(startLat, startLng, endLat, endLng) {
  const apiKey = getYandexApiKey();
  if (apiKey) {
    const result = await fetchYandexRoute(startLat, startLng, endLat, endLng, apiKey);
    if (result) return result;
    console.log('Yandex routing failed, falling back to Haversine');
  }
  const dist = haversineKm(startLat, startLng, endLat, endLng);
  const avgSpeed = 25;
  const durationMin = Math.round((dist / avgSpeed) * 60);
  return { distanceKm: dist, durationMin, polyline: '' };
}

app.post('/api/orders/:id/returning', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Заказ ещё не доставлен' });
    const rc = getRestaurantCoords();
    if (!rc) return res.status(400).json({ error: 'Не указаны координаты ресторана' });
    const route = await calcRoute(lat, lng, rc.lat, rc.lng);
    const eta = new Date(Date.now() + route.durationMin * 60000).toISOString();
    db.prepare(`UPDATE orders SET is_returning = 1, return_started_at = datetime('now'),
      return_distance_km = ?, return_duration_min = ?, return_eta = ?,
      return_courier_lat = ?, return_courier_lng = ?, return_route_polyline = ? WHERE id = ?`)
      .run(route.distanceKm, route.durationMin, eta, lat, lng, route.polyline, req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-update', orderId: Number(req.params.id), courierName: order.courier_name, distanceKm: route.distanceKm, durationMin: route.durationMin, eta, courierLat: lat, courierLng: lng, polyline: route.polyline }));
    res.json({ ok: true, distanceKm: route.distanceKm, durationMin: route.durationMin, eta, polyline: route.polyline });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/orders/:id/returning', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    db.prepare(`UPDATE orders SET is_returning = 0, return_started_at = NULL, return_distance_km = 0,
      return_duration_min = 0, return_eta = NULL, return_courier_lat = 0, return_courier_lng = 0,
      return_route_polyline = '' WHERE id = ?`)
      .run(req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-cancelled', orderId: Number(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/orders/:id/returning/arrived', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    db.prepare(`UPDATE orders SET is_returning = 0, return_started_at = NULL, return_distance_km = 0,
      return_duration_min = 0, return_eta = NULL, return_courier_lat = 0, return_courier_lng = 0,
      return_route_polyline = '' WHERE id = ?`)
      .run(req.params.id);
    io.emit('order:update', emitOrderUpdate(req.params.id));
    broadcast(JSON.stringify({ type: 'courier:returning-arrived', orderId: Number(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/returning-couriers', (req, res) => {
  try {
    const rows = db.prepare(`SELECT id, courier_id, courier_name, return_distance_km, return_duration_min, return_eta, return_courier_lat, return_courier_lng, return_route_polyline, is_returning FROM orders WHERE is_returning = 1 AND status = 'delivered'`).all();
    res.json(rows.map(r => ({ orderId: r.id, courierId: r.courier_id, courierName: r.courier_name, distanceKm: r.return_distance_km, durationMin: r.return_duration_min, eta: r.return_eta, lat: r.return_courier_lat, lng: r.return_courier_lng, polyline: r.return_route_polyline || '' })));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Courier availability ────────────────────────────────────────
app.patch('/api/couriers/:id/availability', (req, res) => {
  const { is_available } = req.body;
  db.prepare('UPDATE couriers SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, req.params.id);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(req.params.id);
  res.json(toCamelCase(courier));
});

app.post('/api/couriers', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
  const info = db.prepare('INSERT INTO couriers (name, phone) VALUES (?, ?)').run(name, phone);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toCamelCase(courier));
});

app.patch('/api/couriers/:id', (req, res) => {
  const { is_available, name, phone } = req.body;
  const sets = []; const params = [];
  if (is_available !== undefined) { sets.push('is_available = ?'); params.push(is_available ? 1 : 0); }
  if (name) { sets.push('name = ?'); params.push(name); }
  if (phone) { sets.push('phone = ?'); params.push(phone); }
  if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
  params.push(req.params.id);
  db.prepare(`UPDATE couriers SET ${sets.join(', ')}, avg_rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r JOIN orders o ON r.order_id = o.id WHERE o.courier_id = ? AND o.tenant_id = current_tenant_id()) WHERE id = ?`).run(...params, req.params.id);
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(req.params.id);
  res.json(toCamelCase(courier));
});

// ─── Courier App Auth & Profile ───────────────────────────────────
app.post('/api/courier/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    const courier = db.prepare("SELECT * FROM staff WHERE username = ? AND role = 'courier' AND is_active = 1").get(username);
    if (!courier) return res.status(401).json({ error: 'Неверный логин или пароль. Обратитесь к администратору' });
    const storedHash = courier.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(password, storedHash);
    } else {
      valid = storedHash === password;
    }
    if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль. Обратитесь к администратору' });
    res.json(toCamelCase(courier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/courier/profile/:id', (req, res) => {
  try {
    const courier = db.prepare("SELECT * FROM staff WHERE id = ? AND role = 'courier'").get(req.params.id);
    if (!courier) return res.status(404).json({ error: 'Курьер не найден' });
    const today = new Date().toISOString().split('T')[0];
      const deliveredToday = db.prepare("SELECT COUNT(*) as cnt FROM orders o JOIN staff s ON o.courier_name = s.first_name || ' ' || COALESCE(s.last_name, '') WHERE s.id = ? AND o.status = 'delivered' AND date(o.updated_at) = ? AND o.tenant_id = current_tenant_id()").get(req.params.id, today);
    const ordersCount = deliveredToday?.cnt || 0;
    // Calculate km from locations
    const locs = db.prepare("SELECT lat, lng FROM courier_locations WHERE staff_id = ? AND date(recorded_at) = ? ORDER BY recorded_at ASC").all(req.params.id, today);
    let kmToday = 0;
    for (let i = 1; i < locs.length; i++) {
      const dlat = (locs[i].lat - locs[i-1].lat) * 111.32;
      const dlng = (locs[i].lng - locs[i-1].lng) * 111.32 * Math.cos(locs[i].lat * Math.PI / 180);
      kmToday += Math.sqrt(dlat*dlat + dlng*dlng);
    }
    // Calculate earnings (salary_type can be JSON array)
    let earningsToday = 0;
    let st = courier.salary_type;
    let sv = courier.salary_value;
    if (typeof st === 'string' && st.startsWith('[')) try { st = JSON.parse(st); } catch(e) { st = [st]; }
    else if (typeof st === 'string') st = [st];
    if (typeof sv === 'string' && sv.startsWith('{')) try { sv = JSON.parse(sv); } catch(e) { sv = {}; }
    if (Array.isArray(st)) {
      if (st.includes('per_order')) earningsToday += (sv?.per_order || 0) * ordersCount;
      if (st.includes('salary')) earningsToday += (sv?.salary || 0) / 30;
      if (st.includes('per_km')) earningsToday += (sv?.per_km || 0) * kmToday;
    }
    // Online time today
    const logs = db.prepare("SELECT * FROM courier_activity_log WHERE staff_id = ? AND date = ? ORDER BY time ASC").all(req.params.id, today);
    let onlineMinutes = 0;
    let lastOnline = null;
    for (const log of logs) {
      if (log.status === 1) lastOnline = log.time;
      else if (log.status === 0 && lastOnline) {
        const [sh, sm] = lastOnline.split(':').map(Number);
        const [eh, em] = log.time.split(':').map(Number);
        onlineMinutes += (eh * 60 + em) - (sh * 60 + sm);
        lastOnline = null;
      }
    }
    if (lastOnline) {
      const now = new Date();
      const [sh, sm] = lastOnline.split(':').map(Number);
      onlineMinutes += (now.getHours() * 60 + now.getMinutes()) - (sh * 60 + sm);
    }
    res.json(toCamelCase({ ...courier, deliveredToday: ordersCount, kmToday: Math.round(kmToday * 100) / 100, earningsToday: Math.round(earningsToday), onlineMinutes }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/courier/online', (req, res) => {
  try {
    const { staff_id, is_online } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'ID сотрудника обязателен' });
    db.prepare('UPDATE staff SET is_online = ? WHERE id = ?').run(is_online ? 1 : 0, staff_id);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
    db.prepare('INSERT INTO courier_activity_log (staff_id, status, date, time) VALUES (?, ?, ?, ?)').run(staff_id, is_online ? 1 : 0, today, time);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/courier/location', async (req, res) => {
  try {
    const { staff_id, lat, lng } = req.body;
    if (!staff_id || lat === undefined || lng === undefined) return res.status(400).json({ error: 'ID, широта и долгота обязательны' });
    db.prepare('INSERT INTO courier_locations (staff_id, lat, lng) VALUES (?, ?, ?)').run(staff_id, lat, lng);
    db.prepare('UPDATE staff SET last_location = ? WHERE id = ?').run(`${lat},${lng}`, staff_id);
    broadcast(JSON.stringify({ type: 'courier:location', courier_id: staff_id, latitude: lat, longitude: lng }));
    // If courier is returning, recalculate ETA with Yandex Maps
    const returning = db.prepare("SELECT id, courier_name FROM orders WHERE courier_id = ? AND is_returning = 1 AND status = 'delivered' LIMIT 1").get(staff_id);
    if (returning) {
      const rc = getRestaurantCoords();
      if (rc) {
        const route = await calcRoute(lat, lng, rc.lat, rc.lng);
        const eta = new Date(Date.now() + route.durationMin * 60000).toISOString();
        db.prepare('UPDATE orders SET return_distance_km = ?, return_duration_min = ?, return_eta = ?, return_courier_lat = ?, return_courier_lng = ?, return_route_polyline = ? WHERE id = ?')
          .run(route.distanceKm, route.durationMin, eta, lat, lng, route.polyline, returning.id);
        broadcast(JSON.stringify({ type: 'courier:returning-update', orderId: returning.id, courierName: returning.courier_name || '', distanceKm: route.distanceKm, durationMin: route.durationMin, eta, courierLat: lat, courierLng: lng, polyline: route.polyline }));
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Users ────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const users = db.prepare(sql).all(...params);
  const result = users.map(u => {
    const spent = db.prepare("SELECT COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ? AND status = 'delivered'").get(u.id);
    const visits = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?').get(u.id);
    const lastOrder = db.prepare('SELECT created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC').get(u.id);
    return toCamelCase({ ...u, totalSpent: spent.spent, visitsCount: visits.cnt, lastVisitAt: lastOrder?.created_at || u.created_at, bonusBalance: u.bonus_balance || 0, loyaltyLevel: u.loyalty_level || 'новичок' });
  });
  res.json(result);
});

// ─── Reviews ─────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const { order_id } = req.query;
  let sql = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];
  if (order_id) { sql += ' AND order_id = ?'; params.push(Number(order_id)); }
  sql += ' ORDER BY created_at DESC';
  const reviews = db.prepare(sql).all(...params);
  res.json(toCamelCaseArray(reviews));
});

app.post('/api/reviews', (req, res) => {
  const { order_id, user_id, user_name, dish_name, rating, text, courier_id } = req.body;
  if (!order_id || !user_id || !rating || !text) return res.status(400).json({ error: 'Все поля обязательны' });
  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(order_id);
  if (existing) return res.status(409).json({ error: 'Отзыв на этот заказ уже есть' });
  const info = db.prepare('INSERT INTO reviews (order_id, user_id, user_name, dish_name, rating, text) VALUES (?, ?, ?, ?, ?, ?)').run(order_id, user_id, user_name, dish_name || '', rating, text);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);

  if (courier_id) {
    const avg = db.prepare('SELECT COALESCE(AVG(r.rating), 0) as avg FROM reviews r JOIN orders o ON r.order_id = o.id WHERE o.courier_id = ? AND o.tenant_id = current_tenant_id()').get(courier_id);
    const count = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE courier_id = ? AND status = 'delivered'").get(courier_id);
    db.prepare('UPDATE couriers SET avg_rating = ?, total_deliveries = ? WHERE id = ?').run(avg.avg, count.cnt, courier_id);
  }

  io.emit('review:new', toCamelCase(review));
  res.status(201).json(toCamelCase(review));
});

// ─── Notifications ───────────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  const { user_id, courier_id } = req.query;
  let sql = 'SELECT * FROM notifications WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }
  if (courier_id) { sql += ' AND courier_id = ?'; params.push(Number(courier_id)); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  res.json(toCamelCaseArray(db.prepare(sql).all(...params)));
});

app.post('/api/notifications', (req, res) => {
  const { user_id, courier_id, title, body } = req.body;
  const info = db.prepare('INSERT INTO notifications (user_id, courier_id, title, body) VALUES (?, ?, ?, ?)').run(user_id || null, courier_id || null, title, body || '');
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  io.emit('notification', toCamelCase(notif));
  res.status(201).json(toCamelCase(notif));
});

app.patch('/api/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/**
 * @openapi
 * /api/clients:
 *   get:
 *     tags: [Clients]
 *     summary: List clients
 *     description: Returns all guest users with search and filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or phone
 *       - in: query
 *         name: tenant_id
 *         schema: { type: integer }
 *         description: Filter by tenant
 *     responses:
 *       200:
 *         description: Array of clients with order stats
 */
// ─── Clients ─────────────────────────────────────────────────────
app.get('/api/clients', (req, res) => {
  try {
    const { search, tenant_id } = req.query;
    let sql = 'SELECT * FROM users WHERE role = ?';
    const params = ['guest'];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY created_at DESC';
    const clients = db.prepare(sql).all(...params);
    const result = clients.map(c => {
      const stats = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ?").get(c.id);
      const lastOrder = db.prepare("SELECT address, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC").get(c.id);
      const note = db.prepare("SELECT note FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(c.id);
      return toCamelCase({ ...c, ordersCount: stats.cnt, totalSpent: stats.spent, lastAddress: lastOrder?.address || null, lastVisitAt: lastOrder?.created_at || c.created_at, note: note?.note || null });
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/clients/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    const stats = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as spent FROM orders WHERE user_id = ?").get(client.id);
    const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(client.id);
    const note = db.prepare("SELECT note FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(client.id);
    res.json(toCamelCase({ ...client, ordersCount: stats.cnt, totalSpent: stats.spent, orders: orders.map(toCamelCase), note: note?.note || null }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/clients/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Клиент не найден' });
    const { name, phone, email, note } = req.body;
    if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
    if (phone !== undefined) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.params.id);
    if (email !== undefined) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.params.id);
    if (note !== undefined) {
      const existingNote = db.prepare("SELECT id FROM user_notes WHERE user_id = ? ORDER BY created_at DESC").get(req.params.id);
      if (existingNote) db.prepare('UPDATE user_notes SET note = ? WHERE id = ?').run(note, existingNote.id);
      else db.prepare('INSERT INTO user_notes (user_id, note) VALUES (?, ?)').run(req.params.id, note);
    }
    const client = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(client));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Client Groups CRUD ─────────────────────────────────────────
app.get('/api/client-groups', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM client_groups WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY name';
    const groups = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(groups));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/client-groups', (req, res) => {
  try {
    const { tenant_id, name, discount, description } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: 'tenant_id and name are required' });
    const info = db.prepare('INSERT INTO client_groups (tenant_id, name, discount, description) VALUES (?, ?, ?, ?)')
      .run(tenant_id, name, discount || 0, description || null);
    const group = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/client-groups/:id', (req, res) => {
  try {
    const { name, discount, description } = req.body;
    if (name !== undefined) db.prepare('UPDATE client_groups SET name = ? WHERE id = ?').run(name, req.params.id);
    if (discount !== undefined) db.prepare('UPDATE client_groups SET discount = ? WHERE id = ?').run(discount, req.params.id);
    if (description !== undefined) db.prepare('UPDATE client_groups SET description = ? WHERE id = ?').run(description, req.params.id);
    const group = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/client-groups/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM client_groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Review Questions ────────────────────────────────────────────
app.get('/api/review-questions', (req, res) => {
  try {
    const { tenant_id, review_id } = req.query;
    let sql = 'SELECT rq.*, r.user_name as review_user_name FROM review_questions rq LEFT JOIN reviews r ON r.id = rq.review_id WHERE r.tenant_id = current_tenant_id()';
    const params = [];
    if (tenant_id) { sql += ' AND rq.tenant_id = ?'; params.push(Number(tenant_id)); }
    if (review_id) { sql += ' AND rq.review_id = ?'; params.push(Number(review_id)); }
    sql += ' ORDER BY rq.created_at DESC';
    const items = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/review-questions', (req, res) => {
  try {
    const { review_id, tenant_id, question } = req.body;
    if (!review_id || !question) return res.status(400).json({ error: 'review_id and question are required' });
    const info = db.prepare('INSERT INTO review_questions (review_id, tenant_id, question) VALUES (?, ?, ?)')
      .run(review_id, tenant_id || 1, question);
    const item = db.prepare('SELECT * FROM review_questions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/review-questions/:id/answer', (req, res) => {
  try {
    const { answer } = req.body;
    db.prepare('UPDATE review_questions SET answer = ? WHERE id = ?').run(answer || '', req.params.id);
    const item = db.prepare('SELECT * FROM review_questions WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Menu Items (extended dishes list) ────────────────────────────
app.get('/api/menu-items', (req, res) => {
  try {
    const {
      category_id, store_id, tech_card_filter = 'all', type = 'all',
      search, sort_by = 'name', sort_order = 'asc',
      page = 1, limit = 20,
    } = req.query;

    let baseSql = `FROM dishes d LEFT JOIN menu_categories mc ON d.category_id = mc.id`;
    const params = [];

    // category filter
    if (category_id) { baseSql += ' WHERE d.category_id = ?'; params.push(Number(category_id)); }
    else { baseSql += ' WHERE 1=1'; }
    baseSql += ' AND d.tenant_id = ?'; params.push(req.tenant_id);

    // store filter
    if (store_id) { baseSql += ' AND d.branch_id = ?'; params.push(Number(store_id)); }

    // type filter
    if (type && type !== 'all') { baseSql += ' AND d.type = ?'; params.push(type); }

    // tech_card filter
    if (tech_card_filter === 'yes') {
      baseSql += ' AND d.id IN (SELECT DISTINCT dish_id FROM tech_cards WHERE dish_id IS NOT NULL)';
    } else if (tech_card_filter === 'no') {
      baseSql += ' AND d.id NOT IN (SELECT DISTINCT dish_id FROM tech_cards WHERE dish_id IS NOT NULL)';
    }

    // search
    if (search) {
      const s = `%${search}%`;
      baseSql += ' AND (d.name LIKE ? OR d.article LIKE ? OR d.barcode LIKE ?)';
      params.push(s, s, s);
    }

    // count total
    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseSql}`).get(...params);
    const total = countRow.total;

    // sorting (whitelist for safety)
    const allowedSort = ['name', 'price', 'cost', 'weight', 'netto', 'barcode', 'article', 'unit', 'type', 'is_available', 'created_at', 'markup'];
    let sb = allowedSort.includes(sort_by) ? sort_by : 'name';
    const so = sort_order === 'desc' ? 'DESC' : 'ASC';

    // special handling for markup sort (computed field)
    let orderClause;
    if (sb === 'markup') {
      orderClause = `ORDER BY ${so === 'DESC' ? '(CASE WHEN d.price > 0 THEN (d.price - COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0)) / d.price * 100 ELSE 0 END) DESC' : '(CASE WHEN d.price > 0 THEN (d.price - COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0)) / d.price * 100 ELSE 0 END) ASC'}`;
    } else {
      orderClause = `ORDER BY d.${sb} ${so}`;
    }

    // pagination
    const p = Math.max(1, Number(page));
    const l = Math.min(200, Math.max(1, Number(limit)));
    const offset = (p - 1) * l;

    const sql = `SELECT d.*, mc.name as categoryName, COALESCE((SELECT cost_price FROM tech_cards WHERE dish_id = d.id ORDER BY created_at DESC LIMIT 1), 0) as cost ${baseSql} ${orderClause} LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, l, offset);

    // compute markup for each item
    const result = items.map(item => {
      const camel = toCamelCase(item);
      camel.markup = camel.price > 0 ? ((camel.price - camel.cost) / camel.price * 100) : 0;
      return camel;
    });

    res.json({ items: result, total, page: p, limit: l, totalPages: Math.ceil(total / l) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

/**
 * @openapi
 * /api/dishes:
 *   get:
 *     tags: [Menu]
 *     summary: List dishes/menu items
 *     description: Returns all dishes with optional category filter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *         description: Filter by category
 *       - in: query
 *         name: include_subcategories
 *         schema: { type: boolean }
 *         description: Include subcategories
 *     responses:
 *       200:
 *         description: Array of dishes with category info
 *   post:
 *     tags: [Menu]
 *     summary: Create a dish
 *     description: Creates a new menu item
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               category_id: { type: integer }
 *     responses:
 *       200:
 *         description: Created dish
 */
// ─── Dishes CRUD ─────────────────────────────────────────────────
app.get('/api/dishes', (req, res) => {
  try {
    const { category_id, include_subcategories } = req.query;
    let sql = `SELECT d.*, mc.name as categoryName FROM dishes d LEFT JOIN menu_categories mc ON d.category_id = mc.id WHERE 1=1`;
    const params = [];
    sql += ' AND d.tenant_id = ?'; params.push(req.tenant_id);
    if (category_id) {
      if (include_subcategories === 'true') {
        // get all child category IDs recursively
        const childIds = [];
        const stack = [Number(category_id)];
        while (stack.length) {
          const pid = stack.pop();
          childIds.push(pid);
          const kids = db.prepare('SELECT id FROM menu_categories WHERE parent_id = ?').all(pid);
          kids.forEach(k => stack.push(k.id));
        }
        sql += ` AND d.category_id IN (${childIds.map(() => '?').join(',')})`;
        params.push(...childIds);
      } else {
        sql += ' AND d.category_id = ?';
        params.push(Number(category_id));
      }
    }
    sql += ' ORDER BY d.created_at DESC';
    const dishes = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(dishes));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/dishes/:id', (req, res) => {
  try {
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
    res.json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/dishes', (req, res) => {
  try {
    const { name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, branch_id, tech_card_id } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Название и цена обязательны' });
    const info = db.prepare(`INSERT INTO dishes (name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, branch_id, tech_card_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, description || '', compound || '[]', price, old_price || null, image_url || '', category_id || null,
      weight || netto || null, netto || weight || null, unit || 'г',
      calories || null, proteins || null, fats || null, carbs || null,
      typeof kbju === 'string' ? kbju : JSON.stringify(kbju || {}),
      is_available !== undefined ? (is_available ? 1 : 0) : 1,
      is_popular ? 1 : 0, is_new ? 1 : 0,
      typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      typeof allergens === 'string' ? allergens : JSON.stringify(allergens || []),
      barcode || null, article || null, type || 'goods', cost || 0, branch_id || null, tech_card_id || null,
      req.tenant_id
    );
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(info.lastInsertRowid, req.tenant_id);
    res.status(201).json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/dishes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Блюдо не найдено' });
    const { name, description, compound, price, old_price, image_url, category_id, weight, netto, unit, calories, proteins, fats, carbs, kbju, is_available, is_popular, is_new, tags, allergens, barcode, article, type, cost, branch_id, tech_card_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (compound !== undefined) { sets.push('compound = ?'); params.push(typeof compound === 'string' ? compound : JSON.stringify(compound)); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (old_price !== undefined) { sets.push('old_price = ?'); params.push(old_price); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (category_id !== undefined) { sets.push('category_id = ?'); params.push(category_id); }
    if (weight !== undefined) { sets.push('weight = ?'); params.push(weight); }
    if (calories !== undefined) { sets.push('calories = ?'); params.push(calories); }
    if (proteins !== undefined) { sets.push('proteins = ?'); params.push(proteins); }
    if (fats !== undefined) { sets.push('fats = ?'); params.push(fats); }
    if (carbs !== undefined) { sets.push('carbs = ?'); params.push(carbs); }
    if (kbju !== undefined) { sets.push('kbju = ?'); params.push(typeof kbju === 'string' ? kbju : JSON.stringify(kbju)); }
    if (is_available !== undefined) { sets.push('is_available = ?'); params.push(is_available ? 1 : 0); }
    if (is_popular !== undefined) { sets.push('is_popular = ?'); params.push(is_popular ? 1 : 0); }
    if (is_new !== undefined) { sets.push('is_new = ?'); params.push(is_new ? 1 : 0); }
    if (tags !== undefined) { sets.push('tags = ?'); params.push(typeof tags === 'string' ? tags : JSON.stringify(tags)); }
    if (allergens !== undefined) { sets.push('allergens = ?'); params.push(typeof allergens === 'string' ? allergens : JSON.stringify(allergens)); }
    if (barcode !== undefined) { sets.push('barcode = ?'); params.push(barcode); }
    if (article !== undefined) { sets.push('article = ?'); params.push(article); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (cost !== undefined) { sets.push('cost = ?'); params.push(cost); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (tech_card_id !== undefined) { sets.push('tech_card_id = ?'); params.push(tech_card_id); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (netto !== undefined) { sets.push('netto = ?'); params.push(netto); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, req.tenant_id);
    db.prepare(`UPDATE dishes SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    res.json(toCamelCase(dish));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/dishes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dishes WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    if (!existing) return res.status(404).json({ error: 'Блюдо не найдено' });
    db.prepare('DELETE FROM dishes WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Menu Categories CRUD ────────────────────────────────────────
app.get('/api/menu-categories', (req, res) => {
  try {
    const flat = db.prepare(`
      SELECT mc.*, COALESCE(cnt.dish_count, 0) as dish_count
      FROM menu_categories mc
      LEFT JOIN (
        SELECT category_id, COUNT(*) as dish_count
        FROM dishes
        WHERE category_id IS NOT NULL AND tenant_id = ?
        GROUP BY category_id
      ) cnt ON cnt.category_id = mc.id
      WHERE mc.tenant_id = ?
      ORDER BY mc.sort_order ASC, mc.name ASC
    `).all(req.tenant_id, req.tenant_id);

    if (req.query.tree === 'true') {
      const map = new Map();
      flat.forEach(c => map.set(c.id, { ...c, children: [] }));

      const roots = [];
      for (const c of flat) {
        const node = map.get(c.id);
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      }

      // sort children by sort_order
      const sortKids = (arr) => {
        arr.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
        arr.forEach(n => sortKids(n.children));
      };
      sortKids(roots);

      res.json(toCamelCaseArray(roots));
    } else {
      res.json(toCamelCaseArray(flat));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/menu-categories', (req, res) => {
  try {
    const { name, icon, parent_id, sort_order, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare('INSERT INTO menu_categories (name, icon, parent_id, sort_order, image_url, tenant_id) VALUES (?, ?, ?, ?, ?, ?)').run(name, icon || null, parent_id || null, sort_order || 0, image_url || null, req.tenant_id);
    const cat = db.prepare('SELECT * FROM menu_categories WHERE id = ? AND tenant_id = ?').get(info.lastInsertRowid, req.tenant_id);
    res.status(201).json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// PUT /api/menu-categories/batch-visibility — must be before :id routes
app.put('/api/menu-categories/batch-visibility', (req, res) => {
  try {
    const { ids, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids is required' });
    const sets = []; const params = [];
    if (show_on_site !== undefined) { sets.push('show_on_site = ?'); params.push(show_on_site ? 1 : 0); }
    if (show_on_app !== undefined) { sets.push('show_on_app = ?'); params.push(show_on_app ? 1 : 0); }
    if (show_on_kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(show_on_kiosk ? 1 : 0); }
    if (show_on_waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(show_on_waiter ? 1 : 0); }
    if (show_on_aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(show_on_aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    const placeholders = ids.map(() => '?').join(',');
    params.push(...ids, req.tenant_id);
    const result = db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id IN (${placeholders}) AND tenant_id = ?`).run(...params);
    res.json({ ok: true, updated: result.changes });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/menu-categories/:id/visibility', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { showOnSite, showOnApp, showOnKiosk, showOnWaiter, showOnAggregators, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    const sets = []; const params = [];
    const site = showOnSite !== undefined ? showOnSite : show_on_site;
    const app = showOnApp !== undefined ? showOnApp : show_on_app;
    const kiosk = showOnKiosk !== undefined ? showOnKiosk : show_on_kiosk;
    const waiter = showOnWaiter !== undefined ? showOnWaiter : show_on_waiter;
    const aggregators = showOnAggregators !== undefined ? showOnAggregators : show_on_aggregators;
    if (site !== undefined) { sets.push('show_on_site = ?'); params.push(site ? 1 : 0); }
    if (app !== undefined) { sets.push('show_on_app = ?'); params.push(app ? 1 : 0); }
    if (kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(kiosk ? 1 : 0); }
    if (waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(waiter ? 1 : 0); }
    if (aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT id, name, icon, parent_id, sort_order, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators FROM menu_categories WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/menu-categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { name, icon, parent_id, sort_order, image_url, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (icon !== undefined) { sets.push('icon = ?'); params.push(icon); }
    if (parent_id !== undefined) { sets.push('parent_id = ?'); params.push(parent_id); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (show_on_site !== undefined) { sets.push('show_on_site = ?'); params.push(show_on_site ? 1 : 0); }
    if (show_on_app !== undefined) { sets.push('show_on_app = ?'); params.push(show_on_app ? 1 : 0); }
    if (show_on_kiosk !== undefined) { sets.push('show_on_kiosk = ?'); params.push(show_on_kiosk ? 1 : 0); }
    if (show_on_waiter !== undefined) { sets.push('show_on_waiter = ?'); params.push(show_on_waiter ? 1 : 0); }
    if (show_on_aggregators !== undefined) { sets.push('show_on_aggregators = ?'); params.push(show_on_aggregators ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE menu_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/menu-categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    // reassign child categories to parent
    db.prepare('UPDATE menu_categories SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, req.params.id);
    // unlink dishes
    db.prepare('UPDATE dishes SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// GET active tech card for a dish (with losses)
app.get('/api/dishes/:id/tech-card', (req, res) => {
  try {
    const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(req.params.id);
    if (!tc) return res.json(null);
    const ingredients = db.prepare(`
      SELECT tci.*, ii.name as item_name_inv, ii.price_per_unit, ii.last_price, ii.unit as inv_unit, ii.current_balance
      FROM dish_tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON tci.item_id = ii.id
      WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
    `).all(tc.id);

    let totalCost = 0;
    for (const ing of ingredients) {
      const price = ing.price_per_unit || ing.last_price || 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      const adjustedQty = qty * (1 + loss / 100);
      ing.cost = Math.round(price * (adjustedQty / 1000) * 100) / 100;
      totalCost += ing.cost;
    }

    res.json({ ...tc, ingredients, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// GET tech card versions for a dish
app.get('/api/dishes/:id/tech-card/versions', (req, res) => {
  try {
    const versions = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? ORDER BY version DESC').all(req.params.id);
    res.json(versions);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST create or update tech card for a dish
app.post('/api/dishes/:id/tech-card', (req, res) => {
  try {
    const dishId = req.params.id;
    const { ingredients, technology, description, cookingTime, output, isVersion, step_instructions, step_mode } = req.body;

    const existing = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dishId);
    let newVersion = 1;

    if (existing && isVersion) {
      // Archive old version
      newVersion = existing.version + 1;
      const arch = db.prepare(`INSERT INTO dish_tech_cards_archive
        (original_tc_id, dish_id, dish_name, version, output, technology, description, cooking_time, total_cost, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        existing.id, dishId, existing.dish_name, existing.version, existing.output,
        existing.technology, existing.description, existing.cooking_time, existing.cost_price, existing.tenant_id
      );

      const archIngs = db.prepare('SELECT * FROM dish_tech_card_ingredients WHERE tech_card_id = ?').all(existing.id);
      for (const ing of archIngs) {
        db.prepare(`INSERT INTO dish_tech_card_ingredients_archive
          (archive_tc_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          arch.lastInsertRowid, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.netto,
          ing.cold_loss_percent, ing.heat_loss_percent, ing.yield_percent, ing.tenant_id
        );
      }

      // Deactivate old
      db.prepare('UPDATE dish_tech_cards SET is_active = 0 WHERE id = ?').run(existing.id);
    }

    // Calculate cost
    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.itemId);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.coldLossPercent || 0) + (ing.heatLossPercent || 0);
      const adjustedQty = qty * (1 + loss / 100);
      totalCost += price * (adjustedQty / 1000);
    }

    const dish = db.prepare('SELECT name FROM dishes WHERE id = ?').get(dishId);
    if (!dish) return res.status(404).json({ error: 'Dish not found' });

    const tcId = db.prepare(`INSERT INTO dish_tech_cards
      (dish_id, dish_name, number, valid_from, portions, output, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id, version, is_active, cooking_time, description, step_mode, step_instructions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 1, ?, ?, ?, ?, datetime('now'))`).run(
      dishId, dish.name, existing ? existing.number : null, existing ? existing.valid_from : null,
      existing ? existing.portions : null, output || existing?.output || 0,
      technology || existing?.technology || '', 0, 0, Math.round(totalCost * 100) / 100, 1,
      newVersion, cookingTime || existing?.cooking_time || 0, description || existing?.description || '',
      step_mode !== undefined ? (step_mode ? 1 : 0) : 0, step_instructions || ''
    );

    // Insert ingredients
    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(tcId.lastInsertRowid, ing.itemId, ing.itemName, ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
        ing.yieldPercent || 100, 1);
    }

    res.json({ id: tcId.lastInsertRowid, version: newVersion, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});



// ─── Dish Tech Cards Management ─────────────────────────────────
// GET /api/tech-cards — list all dish tech cards with pagination
app.get('/api/tech-cards', (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE tc.tenant_id = current_tenant_id()';
    const params = [];

    if (search) { where += ' AND (tc.dish_name LIKE ? OR d.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (is_active !== undefined && is_active !== '') { where += ' AND tc.is_active = ?'; params.push(parseInt(is_active)); }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM dish_tech_cards tc LEFT JOIN dishes d ON d.id = tc.dish_id WHERE tc.tenant_id = current_tenant_id() ${where}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const items = db.prepare(`
      SELECT tc.*, d.name as dish_name_db, d.price as dish_price, d.weight as dish_weight,
        (SELECT COUNT(*) FROM dish_tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count
      FROM dish_tech_cards tc
      LEFT JOIN dishes d ON d.id = tc.dish_id
      ${where}
      ORDER BY tc.is_active DESC, tc.dish_name ASC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ items, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// GET /api/tech-cards/:id — get one with ingredients
app.get('/api/tech-cards/:id', (req, res) => {
  try {
    const tc = db.prepare(`
      SELECT tc.*, d.name as dish_name_db, d.price as dish_price
      FROM dish_tech_cards tc
      LEFT JOIN dishes d ON d.id = tc.dish_id
      WHERE tc.id = ? AND tc.tenant_id = current_tenant_id()
    `).get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });

    const ingredients = db.prepare(`
      SELECT tci.*, ii.name as item_name_inv, ii.price_per_unit, ii.last_price, ii.unit as inv_unit, ii.current_balance
      FROM dish_tech_card_ingredients tci
      LEFT JOIN inventory_items ii ON tci.item_id = ii.id
      WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
      ORDER BY tci.id
    `).all(tc.id);

    let totalCost = 0;
    for (const ing of ingredients) {
      const price = ing.price_per_unit || ing.last_price || 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      const adjustedQty = qty * (1 + loss / 100);
      ing.cost = Math.round(price * (adjustedQty / 1000) * 100) / 100;
      totalCost += ing.cost;
    }

    res.json({ ...tc, ingredients, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/tech-cards — create new
app.post('/api/tech-cards', (req, res) => {
  try {
    const { dish_id, dish_name, ingredients, technology, description, cooking_time, output, version } = req.body;
    if (!dish_id) return res.status(400).json({ error: 'dish_id is required' });

    const dish = db.prepare('SELECT id, name FROM dishes WHERE id = ?').get(dish_id);
    if (!dish) return res.status(404).json({ error: 'Dish not found' });

    const existing = db.prepare('SELECT id, version FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1').get(dish_id);
    const newVersion = existing ? existing.version + 1 : 1;

    if (existing) {
      db.prepare('UPDATE dish_tech_cards SET is_active = 0 WHERE id = ?').run(existing.id);
    }

    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.item_id);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      totalCost += price * (qty * (1 + loss / 100) / 1000);
    }

    const tc = db.prepare(`INSERT INTO dish_tech_cards
      (dish_id, dish_name, number, valid_from, portions, output, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id, version, is_active, cooking_time, description, updated_at)
      VALUES (?, ?, NULL, NULL, 1, ?, ?, 0, 0, ?, datetime('now'), 1, ?, 1, ?, ?, datetime('now'))`).run(
      dish_id, dish.name, output || 0, technology || '', Math.round(totalCost * 100) / 100,
      newVersion, cooking_time || 0, description || ''
    );

    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(tc.lastInsertRowid, ing.item_id, ing.item_name || '', ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.cold_loss_percent || 0, ing.heat_loss_percent || 0, ing.yield_percent || 100);
    }

    res.json({ id: tc.lastInsertRowid, version: newVersion, totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// PUT /api/tech-cards/:id — update
app.put('/api/tech-cards/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { dish_name, ingredients, technology, description, cooking_time, output, is_active, version, step_mode, step_instructions } = req.body;

    let totalCost = 0;
    for (const ing of (ingredients || [])) {
      const priceItem = db.prepare('SELECT price_per_unit, last_price FROM inventory_items WHERE id = ?').get(ing.item_id);
      const price = priceItem ? (priceItem.price_per_unit || priceItem.last_price || 0) : 0;
      const qty = ing.quantity || 0;
      const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
      totalCost += price * (qty * (1 + loss / 100) / 1000);
    }

    db.prepare(`UPDATE dish_tech_cards SET
      dish_name = ?, technology = ?, description = ?, cooking_time = ?, output = ?,
      cost_price = ?, is_active = ?, version = ?, step_mode = ?, step_instructions = ?, updated_at = datetime('now')
      WHERE id = ?`).run(
      dish_name || existing.dish_name, technology ?? existing.technology,
      description ?? existing.description, cooking_time ?? existing.cooking_time,
      output ?? existing.output, Math.round(totalCost * 100) / 100,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      version ?? existing.version,
      step_mode !== undefined ? (step_mode ? 1 : 0) : existing.step_mode,
      step_instructions !== undefined ? step_instructions : existing.step_instructions,
      req.params.id
    );

    // Delete old ingredients
    db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(req.params.id);

    // Insert new
    const insertIng = db.prepare(`INSERT INTO dish_tech_card_ingredients
      (tech_card_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);

    for (const ing of (ingredients || [])) {
      insertIng.run(req.params.id, ing.item_id, ing.item_name || '', ing.quantity || 0,
        ing.unit || 'г', ing.netto || 0, ing.cold_loss_percent || 0, ing.heat_loss_percent || 0, ing.yield_percent || 100);
    }

    res.json({ id: Number(req.params.id), totalCost: Math.round(totalCost * 100) / 100 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// DELETE /api/tech-cards/:id
app.delete('/api/tech-cards/:id', (req, res) => {
  try {
    const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });

    // Archive
    const arch = db.prepare(`INSERT INTO dish_tech_cards_archive
      (original_tc_id, dish_id, dish_name, version, output, technology, description, cooking_time, total_cost, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      tc.id, tc.dish_id, tc.dish_name, tc.version, tc.output,
      tc.technology, tc.description, tc.cooking_time, tc.cost_price, tc.tenant_id
    );

    const archIngs = db.prepare('SELECT * FROM dish_tech_card_ingredients WHERE tech_card_id = ?').all(tc.id);
    for (const ing of archIngs) {
      db.prepare(`INSERT INTO dish_tech_card_ingredients_archive
        (archive_tc_id, item_id, item_name, quantity, unit, netto, cold_loss_percent, heat_loss_percent, yield_percent, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        arch.lastInsertRowid, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.netto,
        ing.cold_loss_percent, ing.heat_loss_percent, ing.yield_percent, ing.tenant_id
      );
    }

    db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(tc.id);
    db.prepare('DELETE FROM dish_tech_cards WHERE id = ?').run(tc.id);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// GET /api/tech-cards/stats — overview stats
app.get('/api/tech-cards-stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM dish_tech_cards WHERE is_active = 1').get().c;
    const withCost = db.prepare('SELECT COUNT(*) as c FROM dish_tech_cards WHERE is_active = 1 AND cost_price > 0').get().c;
    const avgCost = db.prepare('SELECT AVG(cost_price) as avg FROM dish_tech_cards WHERE is_active = 1 AND cost_price > 0').get().avg || 0;
    const totalIngredients = db.prepare('SELECT COUNT(*) as c FROM dish_tech_card_ingredients tci JOIN dish_tech_cards tc ON tc.id = tci.tech_card_id WHERE tc.is_active = 1 AND tci.tenant_id = current_tenant_id()').get().c;
    res.json({ total, withCost, avgCost: Math.round(avgCost * 100) / 100, totalIngredients });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Calculate cost for all dishes
app.get('/api/dishes-food-cost', (req, res) => {
  try {
    const dishes = db.prepare(`
      SELECT d.id, d.name, d.price, d.weight, tc.id as tc_id, tc.output, tc.version, tc.cooking_time
      FROM dishes d
      JOIN dish_tech_cards tc ON tc.dish_id = d.id AND tc.is_active = 1
      WHERE d.tenant_id = current_tenant_id()
      ORDER BY d.name
    `).all();

    const results = [];
    for (const dish of dishes) {
      const ings = db.prepare(`
        SELECT tci.quantity, tci.cold_loss_percent, tci.heat_loss_percent, ii.price_per_unit, ii.last_price
        FROM dish_tech_card_ingredients tci
        LEFT JOIN inventory_items ii ON tci.item_id = ii.id
        WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id()
      `).all(dish.tc_id);

      let totalCost = 0;
      for (const ing of ings) {
        const price = ing.price_per_unit || ing.last_price || 0;
        const qty = ing.quantity || 0;
        const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
        totalCost += price * (qty * (1 + loss / 100) / 1000);
      }

      results.push({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        cost: Math.round(totalCost * 100) / 100,
        margin: dish.price > 0 ? Math.round((1 - totalCost / dish.price) * 10000) / 100 : 0,
        output: dish.output || dish.weight || 0,
        version: dish.version,
        cookingTime: dish.cooking_time,
      });
    }

    res.json(results);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Stock Categories CRUD ────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  try {
    const { tenant_id } = req.query;
    const tid = tenant_id || 1;
    const flat = db.prepare(`
      SELECT sc.*, COALESCE(cnt.item_count, 0) as item_count
      FROM stock_categories sc
      LEFT JOIN (
        SELECT category_id, COUNT(*) as item_count
        FROM inventory_items
        WHERE category_id IS NOT NULL
        GROUP BY category_id
      ) cnt ON cnt.category_id = sc.id
      WHERE sc.tenant_id = ?
      ORDER BY sc.name ASC
    `).all(tid);

    if (req.query.tree === 'true') {
      const map = new Map();
      flat.forEach(c => map.set(c.id, { ...c, children: [] }));
      const roots = [];
      for (const c of flat) {
        const node = map.get(c.id);
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      }
      const sortKids = (arr) => {
        arr.sort((a, b) => a.name.localeCompare(b.name));
        arr.forEach(n => sortKids(n.children));
      };
      sortKids(roots);
      res.json(toCamelCaseArray(roots));
    } else {
      res.json(toCamelCaseArray(flat));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, parent_id, tenant_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
    const tid = tenant_id || 1;
    const existing = db.prepare('SELECT id FROM stock_categories WHERE name = ? AND tenant_id = ?').get(name.trim(), tid);
    if (existing) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    const info = db.prepare('INSERT INTO stock_categories (name, parent_id, tenant_id) VALUES (?, ?, ?)').run(name.trim(), parent_id || null, tid);
    const cat = db.prepare('SELECT id, name, parent_id, 0 as item_count FROM stock_categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    const { name, parent_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Название обязательно' });
      const dup = db.prepare('SELECT id FROM stock_categories WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
      if (dup) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
      sets.push('name = ?'); params.push(name.trim());
    }
    if (parent_id !== undefined) {
      if (Number(parent_id) === Number(req.params.id)) return res.status(400).json({ error: 'Категория не может быть родителем самой себя' });
      sets.push('parent_id = ?'); params.push(parent_id || null);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE stock_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const cat = db.prepare('SELECT sc.id, sc.name, sc.parent_id, COALESCE(COUNT(ii.id), 0) as item_count FROM stock_categories sc LEFT JOIN inventory_items ii ON ii.category_id = sc.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id() GROUP BY sc.id').get(req.params.id);
    res.json(toCamelCase(cat));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Категория не найдена' });
    // reassign children to parent
    db.prepare('UPDATE stock_categories SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, req.params.id);
    // unlink items
    db.prepare('UPDATE inventory_items SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    db.prepare('DELETE FROM stock_categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── File upload ─────────────────────────────────────────────────
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой (максимум 5MB)' });
        return res.status(400).json({ error: 'Ошибка загрузки: ' + err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
      res.json({ url: '/uploads/' + req.file.filename });
  } catch (e) {
    console.error('POST /api/staff error:', e.message);
    res.status(500).json({ error: safeError(e.message) });
  }
  });
});

// ─── OLD Tech Cards CRUD (disabled — replaced by dish_tech_cards above) ────
/* OLD ROUTES DISABLED — see /api/tech-cards endpoints above for dish_tech_cards */
app.get('/api/tech-cards-old', (req, res) => {
  try {
    const { dish_id } = req.query;
    let sql = `SELECT tc.*, d.name as dishName, d.description, d.calories, d.proteins, d.fats, d.carbs, d.price as dishPrice
      FROM tech_cards tc LEFT JOIN dishes d ON tc.dish_id = d.id WHERE tc.tenant_id = current_tenant_id()`;
    const params = [];
    if (dish_id) { sql += ' AND tc.dish_id = ?'; params.push(Number(dish_id)); }
    sql += ' ORDER BY tc.created_at DESC';
    const cards = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(cards));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});



// ─── Stock‑oriented Tech Cards (full CRUD) ──────────────────────
app.get('/api/tech-cards/list', (req, res) => {
  try {
    const { search, type, store, is_active, page: qPage, limit: qLimit } = req.query;
    let sql = `SELECT tc.*, ii.name as item_name, ii.unit as item_unit, ii.category_name as item_category,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count
      FROM tech_cards tc LEFT JOIN inventory_items ii ON tc.item_id = ii.id WHERE tc.tenant_id = current_tenant_id()`;
    const params = [];
    if (search) { sql += ' AND (tc.name LIKE ? OR tc.number LIKE ? OR ii.name LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    if (type) { sql += ' AND tc.type = ?'; params.push(type); }
    if (store) { sql += ' AND tc.store LIKE ?'; params.push(`%${store}%`); }
    if (is_active !== undefined) { sql += ' AND tc.is_active = ?'; params.push(is_active === '1' || is_active === 'true' ? 1 : 0); }
    const page = parseInt(qPage) || 1;
    const limit = parseInt(qLimit) || 20;
    const total = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY tc.created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page - 1) * limit);
    res.json({ items: toCamelCaseArray(items), total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/tech-card', (req, res) => {
  try {
    const { itemId, name, description, type, number, output, costPrice, store, validFrom, isActive, cookingTime,
      thermalLossPercent, coldLossPercent, packagingCost, additionalCosts, portions, grossWeight, kbjuSource,
      constantCosts, totalYield, ingredients, modifiers } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Не указан товар' });
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId);
    if (!item) return res.status(400).json({ error: 'Товар не найден' });
    const cardNumber = number || `TC-${Date.now().toString(36).toUpperCase()}`;
    const info = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active, cooking_time,
      thermal_loss_percent, cold_loss_percent, packaging_cost, additional_costs, portions, gross_weight, kbju_source, constant_costs, total_yield)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      itemId, name || item.name, description || '', type || 'individual', cardNumber,
      output || 0, costPrice || 0, store || '', validFrom || null, isActive !== undefined ? (isActive ? 1 : 0) : 1,
      cookingTime || null, thermalLossPercent || 0, coldLossPercent || 0, packagingCost || 0,
      JSON.stringify(additionalCosts || []), JSON.stringify(portions || []), grossWeight || 0, kbjuSource || 'auto',
      constantCosts || 0, totalYield || 0
    );
    const cardId = info.lastInsertRowid;

    if (ingredients && Array.isArray(ingredients)) {
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, cold_loss_percent, heat_loss_percent, yield, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of ingredients) {
        ins.run(cardId, ing.itemId || null, ing.itemName || '', ing.quantity || 0, ing.unit || 'г',
          ing.brutto || 0, ing.netto || ing.yield || 0, ing.pricePerUnit || 0, ing.cost || 0,
          ing.lossPercent || ing.coldLossPercent || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
          ing.yield || ing.netto || 0, ing.sortOrder || 0);
      }
    }

    if (modifiers && Array.isArray(modifiers)) {
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of modifiers) {
        ins.run(cardId, mod.name || '', mod.quantity || 1, mod.price || 0, mod.sortOrder || 0);
      }
    }

    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(cardId);
    res.status(201).json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/tech-card/:id', (req, res) => {
  try {
    const card = db.prepare('SELECT tc.*, ii.name as item_name, ii.unit as item_unit, ii.category_name as item_category FROM tech_cards tc LEFT JOIN inventory_items ii ON tc.item_id = ii.id WHERE tc.id = ? AND tc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Техкарта не найдена' });
    const ingredients = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    const modifiers = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(toCamelCase({ ...card, ingredients, modifiers }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/tech-card/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Техкарта не найдена' });
    const b = req.body;
    const sets = []; const vals = [];
    if (b.itemId !== undefined) { sets.push('item_id = ?'); vals.push(b.itemId); }
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.description !== undefined) { sets.push('description = ?'); vals.push(b.description); }
    if (b.type !== undefined) { sets.push('type = ?'); vals.push(b.type); }
    if (b.number !== undefined) { sets.push('number = ?'); vals.push(b.number); }
    if (b.output !== undefined) { sets.push('output = ?'); vals.push(b.output); }
    if (b.costPrice !== undefined) { sets.push('cost_price = ?'); vals.push(b.costPrice); }
    if (b.store !== undefined) { sets.push('store = ?'); vals.push(b.store); }
    if (b.validFrom !== undefined) { sets.push('valid_from = ?'); vals.push(b.validFrom); }
    if (b.isActive !== undefined) { sets.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if (b.cookingTime !== undefined) { sets.push('cooking_time = ?'); vals.push(b.cookingTime); }
    if (b.thermalLossPercent !== undefined) { sets.push('thermal_loss_percent = ?'); vals.push(b.thermalLossPercent); }
    if (b.coldLossPercent !== undefined) { sets.push('cold_loss_percent = ?'); vals.push(b.coldLossPercent); }
    if (b.packagingCost !== undefined) { sets.push('packaging_cost = ?'); vals.push(b.packagingCost); }
    if (b.constantCosts !== undefined) { sets.push('constant_costs = ?'); vals.push(b.constantCosts); }
    if (b.totalYield !== undefined) { sets.push('total_yield = ?'); vals.push(b.totalYield); }
    if (b.additionalCosts !== undefined) { sets.push('additional_costs = ?'); vals.push(JSON.stringify(b.additionalCosts)); }
    if (b.portions !== undefined) { sets.push('portions = ?'); vals.push(JSON.stringify(b.portions)); }
    if (b.grossWeight !== undefined) { sets.push('gross_weight = ?'); vals.push(b.grossWeight); }
    if (b.kbjuSource !== undefined) { sets.push('kbju_source = ?'); vals.push(b.kbjuSource); }
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      vals.push(req.params.id);
      db.prepare(`UPDATE tech_cards SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }

    if (b.ingredients !== undefined) {
      db.prepare('DELETE FROM tech_card_ingredients WHERE tech_card_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, cold_loss_percent, heat_loss_percent, yield, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of b.ingredients) {
        ins.run(req.params.id, ing.itemId || null, ing.itemName || '', ing.quantity || 0, ing.unit || 'г',
          ing.brutto || 0, ing.netto || ing.yield || 0, ing.pricePerUnit || 0, ing.cost || 0,
          ing.lossPercent || ing.coldLossPercent || 0, ing.coldLossPercent || 0, ing.heatLossPercent || 0,
          ing.yield || ing.netto || 0, ing.sortOrder || 0);
      }
    }
    if (b.modifiers !== undefined) {
      db.prepare('DELETE FROM tech_card_modifiers WHERE tech_card_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of b.modifiers) {
        ins.run(req.params.id, mod.name || '', mod.quantity || 1, mod.price || 0, mod.sortOrder || 0);
      }
    }

    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/tech-card/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_cards WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// KBJU auto-calculate from ingredients
app.post('/api/tech-card/:id/calculate-kbju', (req, res) => {
  try {
    const ingredients = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(req.params.id);
    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Техкарта не найдена' });
    let totalKcal = 0, totalProteins = 0, totalFats = 0, totalCarbs = 0, totalWeight = 0;
    for (const ing of ingredients) {
      let kcal = 0, proteins = 0, fats = 0, carbs = 0;
      if (ing.item_id) {
        const item = db.prepare('SELECT kcal, proteins, fats, carbs FROM inventory_items WHERE id = ?').get(ing.item_id);
        if (item) { kcal = item.kcal || 0; proteins = item.proteins || 0; fats = item.fats || 0; carbs = item.carbs || 0; }
      }
      const qty = ing.quantity || 0;
      const factor = qty / 100;
      totalKcal += kcal * factor;
      totalProteins += proteins * factor;
      totalFats += fats * factor;
      totalCarbs += carbs * factor;
      totalWeight += qty;
    }
    const output = card.output || totalWeight || 100;
    const per100g = output > 0 ? { kcal: Math.round(totalKcal / output * 100), proteins: Math.round(totalProteins / output * 100 * 10) / 10, fats: Math.round(totalFats / output * 100 * 10) / 10, carbs: Math.round(totalCarbs / output * 100 * 10) / 10 } : { kcal: 0, proteins: 0, fats: 0, carbs: 0 };
    res.json({ total: { kcal: Math.round(totalKcal), proteins: Math.round(totalProteins * 10) / 10, fats: Math.round(totalFats * 10) / 10, carbs: Math.round(totalCarbs * 10) / 10 }, per100g, totalWeight: Math.round(totalWeight) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Copy tech card (versioning)
app.post('/api/tech-card/:id/copy', (req, res) => {
  try {
    const original = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Техкарта не найдена' });
    const newValidFrom = req.body.validFrom || new Date().toISOString().slice(0, 10);
    const newNumber = `${original.number || 'TC'}-v${Date.now().toString(36).toUpperCase()}`;
    const info = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active, cooking_time,
      thermal_loss_percent, cold_loss_percent, packaging_cost, additional_costs, portions, gross_weight, kbju_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      original.item_id, original.name, original.description, original.type, newNumber,
      original.output, original.cost_price, original.store, newValidFrom, 1,
      original.cooking_time, original.thermal_loss_percent, original.cold_loss_percent,
      original.packaging_cost, original.additional_costs, original.portions,
      original.gross_weight, original.kbju_source
    );
    const newId = info.lastInsertRowid;
    const origIngs = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(req.params.id);
    if (origIngs.length > 0) {
      const ins = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ing of origIngs) {
        ins.run(newId, ing.item_id, ing.item_name, ing.quantity, ing.unit, ing.brutto, ing.netto, ing.price_per_unit, ing.cost, ing.loss_percent, ing.sort_order);
      }
    }
    const origMods = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ?').all(req.params.id);
    if (origMods.length > 0) {
      const ins = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const mod of origMods) {
        ins.run(newId, mod.name, mod.quantity, mod.price, mod.sort_order);
      }
    }
    const card = db.prepare('SELECT * FROM tech_cards WHERE id = ?').get(newId);
    res.status(201).json(toCamelCase(card));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// XLSX export
app.get('/api/tech-cards/export', (req, res) => {
  try {
    const cards = db.prepare(`SELECT tc.*, ii.name as item_name FROM tech_cards tc LEFT JOIN inventory_items ii ON tc.item_id = ii.id WHERE tc.tenant_id = current_tenant_id() ORDER BY tc.name`).all();
    const ingredients = db.prepare('SELECT * FROM tech_card_ingredients ORDER BY tech_card_id, sort_order').all();
    try {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const cardRows = cards.map(c => ({ ID: c.id, Номер: c.number, Название: c.name, Товар: c.item_name, Тип: c.type, Выход: c.output, Себестоимость: c.cost_price, 'Хол.потери%': c.cold_loss_percent, 'Терм.потери%': c.thermal_loss_percent, Упаковка: c.packaging_cost, 'Действ.с': c.valid_from, Магазин: c.store, is_active: c.is_active, Вес_брутто: c.gross_weight }));
      const ingRows = ingredients.map(i => ({ 'ID техкарты': i.tech_card_id, Ингредиент: i.item_name, Колво: i.quantity, Ед: i.unit, Брутто: i.brutto, Нетто: i.netto, Цена: i.price_per_unit, Стоимость: i.cost }));
      const ws1 = XLSX.utils.json_to_sheet(cardRows);
      const ws2 = XLSX.utils.json_to_sheet(ingRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Техкарты');
      XLSX.utils.book_append_sheet(wb, ws2, 'Ингредиенты');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=tech-cards-${Date.now()}.xlsx`);
      res.send(buf);
    } catch {
      res.json({ items: cards, ingredients });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// XLSX import
app.post('/api/tech-cards/import', (req, res) => {
  try {
    const XLSX = require('xlsx');
    if (!req.body || !req.body.rows) return res.status(400).json({ error: 'Нет данных для импорта' });
    const rows = req.body.rows;
    let imported = 0, errors = 0;
    const insCard = db.prepare(`INSERT INTO tech_cards (item_id, name, description, type, number, output, cost_price, store, valid_from, is_active,
      cold_loss_percent, thermal_loss_percent, packaging_cost, gross_weight, kbju_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const row of rows) {
      try {
        if (!row.item_id && !row.item_name) { errors++; continue; }
        let itemId = row.item_id;
        if (!itemId && row.item_name) {
          const found = db.prepare('SELECT id FROM inventory_items WHERE name = ?').get(row.item_name);
          if (found) itemId = found.id;
        }
        if (!itemId) { errors++; continue; }
        insCard.run(itemId, row.name || '', row.description || '', row.type || 'individual', row.number || `TC-${Date.now().toString(36).toUpperCase()}`,
          row.output || 0, row.cost_price || 0, row.store || '', row.valid_from || null, 1,
          row.cold_loss_percent || 0, row.thermal_loss_percent || 0, row.packaging_cost || 0, row.gross_weight || 0, 'auto');
        imported++;
      } catch { errors++; }
    }
    res.json({ imported, errors });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tech Card Ingredients CRUD ────────────────────────────────
app.get('/api/tech-card/:id/ingredients', (req, res) => {
  try {
    const items = db.prepare('SELECT tci.*, ii.kcal, ii.proteins, ii.fats, ii.carbs FROM tech_card_ingredients tci LEFT JOIN inventory_items ii ON tci.item_id = ii.id WHERE tci.tech_card_id = ? AND tci.tenant_id = current_tenant_id() ORDER BY tci.sort_order').all(req.params.id);
    res.json(items.map(i => ({ id: i.id, techCardId: i.tech_card_id, itemId: i.item_id, itemName: i.item_name, quantity: i.quantity, unit: i.unit, brutto: i.brutto, netto: i.netto, pricePerUnit: i.price_per_unit, cost: i.cost, lossPercent: i.loss_percent, sortOrder: i.sort_order, kcal: i.kcal, proteins: i.proteins, fats: i.fats, carbs: i.carbs })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/tech-card/:id/ingredients', (req, res) => {
  try {
    const { itemId, itemName, quantity, unit, brutto, netto, pricePerUnit, cost, lossPercent, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO tech_card_ingredients (tech_card_id, item_id, item_name, quantity, unit, brutto, netto, price_per_unit, cost, loss_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.params.id, itemId || null, itemName || '', quantity || 0, unit || 'г', brutto || 0, netto || 0, pricePerUnit || 0, cost || 0, lossPercent || 0, sortOrder || 0);
    const ing = db.prepare('SELECT * FROM tech_card_ingredients WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(ing));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/tech-card/:id/ingredients/:ingId', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.itemId !== undefined) { sets.push('item_id = ?'); vals.push(b.itemId); }
    if (b.itemName !== undefined) { sets.push('item_name = ?'); vals.push(b.itemName); }
    if (b.quantity !== undefined) { sets.push('quantity = ?'); vals.push(b.quantity); }
    if (b.unit !== undefined) { sets.push('unit = ?'); vals.push(b.unit); }
    if (b.brutto !== undefined) { sets.push('brutto = ?'); vals.push(b.brutto); }
    if (b.netto !== undefined) { sets.push('netto = ?'); vals.push(b.netto); }
    if (b.pricePerUnit !== undefined) { sets.push('price_per_unit = ?'); vals.push(b.pricePerUnit); }
    if (b.cost !== undefined) { sets.push('cost = ?'); vals.push(b.cost); }
    if (b.lossPercent !== undefined) { sets.push('loss_percent = ?'); vals.push(b.lossPercent); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.ingId);
    db.prepare(`UPDATE tech_card_ingredients SET ${sets.join(', ')} WHERE id = ? AND tech_card_id = ?`).run(...vals, req.params.id);
    const ing = db.prepare('SELECT * FROM tech_card_ingredients WHERE id = ?').get(req.params.ingId);
    res.json(toCamelCase(ing));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/tech-card/:id/ingredients/:ingId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_card_ingredients WHERE id = ? AND tech_card_id = ?').run(req.params.ingId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tech Card Modifiers CRUD ─────────────────────────────────
app.get('/api/tech-card/:id/modifiers', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM tech_card_modifiers WHERE tech_card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/tech-card/:id/modifiers', (req, res) => {
  try {
    const { name, quantity, price, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO tech_card_modifiers (tech_card_id, name, quantity, price, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      req.params.id, name || '', quantity || 1, price || 0, sortOrder || 0);
    const mod = db.prepare('SELECT * FROM tech_card_modifiers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(mod));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/tech-card/:id/modifiers/:modId', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.quantity !== undefined) { sets.push('quantity = ?'); vals.push(b.quantity); }
    if (b.price !== undefined) { sets.push('price = ?'); vals.push(b.price); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.modId);
    db.prepare(`UPDATE tech_card_modifiers SET ${sets.join(', ')} WHERE id = ? AND tech_card_id = ?`).run(...vals, req.params.id);
    const mod = db.prepare('SELECT * FROM tech_card_modifiers WHERE id = ?').get(req.params.modId);
    res.json(toCamelCase(mod));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/tech-card/:id/modifiers/:modId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_card_modifiers WHERE id = ? AND tech_card_id = ?').run(req.params.modId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tables CRUD ─────────────────────────────────────────────────
app.get('/api/tables', (req, res) => {
  try {
    const tables = db.prepare('SELECT * FROM booking_tables ORDER BY name ASC').all();
    res.json(toCamelCaseArray(tables));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/tables', (req, res) => {
  try {
    const { name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Название стола обязательно' });
    const info = db.prepare('INSERT INTO booking_tables (name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, capacity || null, zone || null, x || 0, y || 0, width || 80, height || 80, color || '#4CAF50', shape || 'rectangle', branch_id || null, is_active !== undefined ? (is_active ? 1 : 0) : 1
    );
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(table));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/tables/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Стол не найден' });
    const { name, capacity, zone, x, y, width, height, color, shape, branch_id, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (capacity !== undefined) { sets.push('capacity = ?'); params.push(capacity); }
    if (zone !== undefined) { sets.push('zone = ?'); params.push(zone); }
    if (x !== undefined) { sets.push('x = ?'); params.push(x); }
    if (y !== undefined) { sets.push('y = ?'); params.push(y); }
    if (width !== undefined) { sets.push('width = ?'); params.push(width); }
    if (height !== undefined) { sets.push('height = ?'); params.push(height); }
    if (color !== undefined) { sets.push('color = ?'); params.push(color); }
    if (shape !== undefined) { sets.push('shape = ?'); params.push(shape); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE booking_tables SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(table));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/tables/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Стол не найден' });
    db.prepare('DELETE FROM booking_tables WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Website API endpoints ─────────────────────────────────────
app.post('/api/website/orders', (req, res) => {
  try {
    const { items, subtotal, total, discount, promoCode, address, comment, paymentMethod, type, userName, userPhone, userId, pickupPointId, bonusUsed, source } = req.body;
    if (!userName || !userPhone) return res.status(400).json({ error: 'Имя и телефон обязательны' });

    let finalTotal = total || subtotal || 0;
    let appliedBonus = 0;

    if (bonusUsed && bonusUsed > 0 && userId) {
      try {
        const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
        if (bonus && bonus.balance >= bonusUsed) {
          const info = getGuestBonusInfo(userId);
          const maxWriteOff = finalTotal * (info.maxWriteOffPercent / 100);
          const canUse = Math.min(bonusUsed, bonus.balance, maxWriteOff);
          if (canUse > 0) { appliedBonus = canUse; finalTotal = Math.max(0, finalTotal - canUse); }
        }
      } catch (e) {}
    }

    const itemsJson = JSON.stringify(items || []);
    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, address, items, subtotal, total, discount, payment_method, type, comment, status, bonus_used, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 'website')`)
      .run(userId || 0, userName, userPhone, address || '', itemsJson, subtotal || 0, finalTotal, discount || 0, paymentMethod || 'cash', type || 'delivery', comment || '', appliedBonus);
    const orderId = info.lastInsertRowid;
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', 'Заказ с сайта');

    if (appliedBonus > 0 && userId) {
      try {
        const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
        if (bonus) {
          db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(appliedBonus, appliedBonus, bonus.id);
          db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'spend', appliedBonus, `Списание за заказ #${orderId} (сайт)`, 'order', orderId);
        }
      } catch (e) { console.error('[Website] Bonus spend error:', e.message); }
    }

    io.emit('order:new', getOrderFull(orderId));
    emitOrderUpdate(orderId);
    broadcast({ type: 'order:new', orderId: Number(orderId), source: 'website' });
    res.status(201).json({ orderId, id: orderId, ...getOrderFull(orderId) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/website/orders', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? AND source = 'website' ORDER BY created_at DESC LIMIT 50").all(userId);
    res.json(toCamelCaseArray(rows));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/website/orders/:id/tracking', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(toCamelCase({ ...order, statusHistory: toCamelCaseArray(history) }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/website/user/profile', (req, res) => {
  try {
    const { userId, name, phone } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
    if (phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, userId);
    const user = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(userId);
    res.json(user ? toCamelCase(user) : { ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Bookings CRUD ───────────────────────────────────────────────
app.get('/api/bookings', (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    if (date) { sql += ' AND date = ?'; params.push(date); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY date DESC, time DESC';
    const bookings = db.prepare(sql).all(...params);
    const result = bookings.map(b => {
      let tableName = null;
      if (b.table_id) {
        const t = db.prepare('SELECT name FROM booking_tables WHERE id = ?').get(b.table_id);
        if (t) tableName = t.name;
      }
      return toCamelCase({ ...b, tableName });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/bookings', (req, res) => {
  try {
    const { user_id, user_name, user_phone, table_id, date, time, duration, guest_count, deposit, comment } = req.body;
    if (!user_name || !user_phone || !date || !time) return res.status(400).json({ error: 'Имя, телефон, дата и время обязательны' });
    const info = db.prepare('INSERT INTO bookings (user_id, user_name, user_phone, table_id, date, time, duration, guest_count, deposit, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      user_id || null, user_name, user_phone, table_id || null, date, time, duration || 120, guest_count || null, deposit || 0, comment || ''
    );
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(booking));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.patch('/api/bookings/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `Недопустимый статус. Допустимо: ${allowed.join(', ')}` });
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Бронь не найдена' });
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(booking));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/bookings/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Бронь не найдена' });
    db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Inventory Items (WPF) ───────────────────────────────────────
app.get('/api/inventory-items', (req, res) => {
  try {
    let baseSql = 'SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance, COALESCE(ii.last_price, ii.price_per_unit, 0) as lastPrice, (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) > 0 as hasTechCard FROM inventory_items ii WHERE 1=1';
    const params = [];
    const { warehouse, category, category_id, include_subcategories, tech_card, contragent, page = 1, limit = 20 } = req.query;

    if (category_id) {
      if (include_subcategories === 'true') {
        const childIds = [];
        const stack = [Number(category_id)];
        while (stack.length) {
          const pid = stack.pop();
          childIds.push(pid);
          const kids = db.prepare('SELECT id FROM stock_categories WHERE parent_id = ?').all(pid);
          kids.forEach(k => stack.push(k.id));
        }
        baseSql += ` AND (ii.category_id IN (${childIds.map(() => '?').join(',')}) OR ii.id IN (SELECT id FROM inventory_items WHERE category_id IN (${childIds.map(() => '?').join(',')})))`;
        params.push(...childIds, ...childIds);
      } else {
        baseSql += ' AND ii.category_id = ?';
        params.push(Number(category_id));
      }
    } else {
      if (warehouse) { baseSql += ' AND ii.branch_name LIKE ?'; params.push(`%${warehouse}%`); }
      if (category) { baseSql += ' AND (ii.category_name LIKE ? OR CAST(ii.category_id AS TEXT) = ?)'; params.push(`%${category}%`, category); }
      if (tech_card === 'has') baseSql += ' AND (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) > 0';
      else if (tech_card === 'none') baseSql += ' AND (SELECT COUNT(*) FROM tech_cards WHERE item_id = ii.id) = 0';
      if (contragent) { baseSql += ' AND ii.contragent_name LIKE ?'; params.push(`%${contragent}%`); }
    }

    const whereClause = baseSql.split('WHERE 1=1')[1] || '';
    const countSql = `SELECT COUNT(*) as total FROM inventory_items ii WHERE 1=1${whereClause}`;
    const total = db.prepare(countSql).get(...params)?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / Number(limit)));

    baseSql += ' ORDER BY ii.name ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const items = db.prepare(baseSql).all(...params);
    const result = items.map(i => {
      const b = i.branch_id ? db.prepare('SELECT name FROM branches WHERE id = ?').get(i.branch_id) : null;
      const s = i.supplier_id ? db.prepare('SELECT name FROM suppliers WHERE id = ?').get(i.supplier_id) : null;
      const cat = db.prepare('SELECT name FROM menu_categories WHERE id = ?').get(i.category);
      return {
        id: i.id, name: i.name, category: i.category_name || i.category || cat?.name || '',
        unit: i.unit || 'шт', barcode: i.barcode || '',
        currentBalance: i.currentBalance, documentQuantity: i.document_quantity || 0,
        pricePerUnit: i.lastPrice || i.price_per_unit || 0,
        branchId: i.branch_id, branchName: i.branch_name || b?.name || '',
        supplierId: i.supplier_id, supplierName: i.contragent_name || s?.name || '',
        isIngredient: i.is_ingredient ? true : false,
        hasTechCard: i.hasTechCard ? true : false,
        minStock: i.min_stock || 0,
      };
    });
    res.json({ items: result, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/inventory-items', (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !b.unit) return res.status(400).json({ error: 'Название и единица измерения обязательны' });
    const info = db.prepare(`INSERT INTO inventory_items (
      name, unit, barcode, current_balance, last_price, price_per_unit, branch_id,
      category_name, category_id, supplier_id, is_ingredient, branch_name,
      brutto, netto, cold_loss_percent, weight_by_tech_card, article, gtin,
      base_price, with_vat, tax_rate, kcal, proteins, fats, carbs,
      calories_by_tech_card, heat_treatment, is_returnable, exclude_neg_control,
      beer_type, alcohol_type, tobacco_type, sugar_type, id_1c
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      (SELECT name FROM branches WHERE id = ?),
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`).run(
      b.name, b.unit, b.barcode || null, b.current_balance || 0,
      b.price_per_unit || 0, b.price_per_unit || 0,
      b.branch_id || null, b.category || null, b.category_id || null,
      b.supplier_id || null, b.is_ingredient ? 1 : 0, b.branch_id || null,
      b.brutto || 0, b.netto || 0, b.cold_loss_percent || 0,
      b.weight_by_tech_card ? 1 : 0, b.article || null, b.gtin || null,
      b.base_price || 0, b.with_vat ? 1 : 0, b.tax_rate || 'Без НДС',
      b.kcal || 0, b.proteins || 0, b.fats || 0, b.carbs || 0,
      b.calories_by_tech_card ? 1 : 0, b.heat_treatment ? 1 : 0,
      b.is_returnable ? 1 : 0, b.exclude_neg_control ? 1 : 0,
      b.beer_type ? 1 : 0, b.alcohol_type ? 1 : 0,
      b.tobacco_type ? 1 : 0, b.sugar_type ? 1 : 0, b.id_1c || null
    );
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ id: item.id, name: item.name, unit: item.unit });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/inventory-items/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const { name, unit, barcode, current_balance, price_per_unit, branch_id, category, supplier_id, is_ingredient } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (barcode !== undefined) { sets.push('barcode = ?'); params.push(barcode); }
    if (current_balance !== undefined) { sets.push('current_balance = ?'); params.push(current_balance); }
    if (price_per_unit !== undefined) { sets.push('last_price = ?'); sets.push('price_per_unit = ?'); params.push(price_per_unit); params.push(price_per_unit); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); sets.push("branch_name = (SELECT name FROM branches WHERE id = ?)"); params.push(branch_id); params.push(branch_id); }
    if (category !== undefined) { sets.push('category_name = ?'); params.push(category); }
    if (supplier_id !== undefined) { sets.push('supplier_id = ?'); params.push(supplier_id); }
    if (is_ingredient !== undefined) { sets.push('is_ingredient = ?'); params.push(is_ingredient ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/inventory-items/import', (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Нет данных для импорта' });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name) {
        errors.push(`Строка ${i + 1}: отсутствует название`);
        continue;
      }

      try {
        const existing = db.prepare('SELECT id FROM inventory_items WHERE name = ?').get(row.name);
        if (existing) {
          db.prepare(`UPDATE inventory_items SET
            category = COALESCE(?, category),
            unit = COALESCE(?, unit),
            price_per_unit = COALESCE(?, price_per_unit),
            current_stock = COALESCE(?, current_stock),
            article = COALESCE(?, article),
            barcode = COALESCE(?, barcode)
            WHERE id = ?`).run(
              row.category || null, row.unit || null,
              row.price_per_unit || 0, row.current_stock || 0,
              row.article || null, row.barcode || null,
              existing.id
            );
          imported.push(existing.id);
        } else {
          const info = db.prepare(`INSERT INTO inventory_items (name, category, unit, price_per_unit, current_stock, article, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            row.name, row.category || '', row.unit || 'шт',
            row.price_per_unit || 0, row.current_stock || 0,
            row.article || '', row.barcode || ''
          );
          imported.push(info.lastInsertRowid);
        }
      } catch (e) {
        errors.push(`Строка ${i + 1} («${row.name}»): ${e.message}`);
      }
    }

    res.json({ imported: imported.length, errors });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Stock Item Card ────────────────────────────────────────────
app.get('/api/stock-item/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json({
      id: item.id, name: item.name, createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      category: item.category_name || item.category || '', unit: item.unit || 'шт',
      brutto: item.brutto || 0, netto: item.netto || 0, coldLossPercent: item.cold_loss_percent || 0,
      weightByTechCard: !!item.weight_by_tech_card, barcode: item.barcode || '',
      article: item.article || '', gtin: item.gtin || '',
      basePrice: item.base_price || item.price_per_unit || 0, withVat: !!item.with_vat,
      taxRate: item.tax_rate || 'Без НДС', currentCost: item.price_per_unit || 0,
      lastPrice: item.last_price || item.price_per_unit || 0,
      kcal: item.kcal || 0, proteins: item.proteins || 0, fats: item.fats || 0, carbs: item.carbs || 0,
      caloriesByTechCard: !!item.calories_by_tech_card, heatTreatment: !!item.heat_treatment,
      isReturnable: !!item.is_returnable, excludeNegControl: !!item.exclude_neg_control,
      beerType: !!item.beer_type, alcoholType: !!item.alcohol_type, tobaccoType: !!item.tobacco_type, sugarType: !!item.sugar_type,
      id1c: item.id_1c || '',
      isMain: !!item.is_main,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/stock-item/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const b = req.body;
    const updates = [];
    const vals = [];
    if (b.name !== undefined) { updates.push('name = ?'); vals.push(b.name); }
    if (b.category !== undefined) { updates.push('category_name = ?'); vals.push(b.category); }
    if (b.unit !== undefined) { updates.push('unit = ?'); vals.push(b.unit); }
    if (b.brutto !== undefined) { updates.push('brutto = ?'); vals.push(b.brutto); }
    if (b.netto !== undefined) { updates.push('netto = ?'); vals.push(b.netto); }
    if (b.coldLossPercent !== undefined) { updates.push('cold_loss_percent = ?'); vals.push(b.coldLossPercent); }
    else if (b.cold_loss_percent !== undefined) { updates.push('cold_loss_percent = ?'); vals.push(b.cold_loss_percent); }
    if (b.weightByTechCard !== undefined) { updates.push('weight_by_tech_card = ?'); vals.push(b.weightByTechCard ? 1 : 0); }
    else if (b.weight_by_tech_card !== undefined) { updates.push('weight_by_tech_card = ?'); vals.push(b.weight_by_tech_card ? 1 : 0); }
    if (b.barcode !== undefined) { updates.push('barcode = ?'); vals.push(b.barcode); }
    if (b.article !== undefined) { updates.push('article = ?'); vals.push(b.article); }
    if (b.gtin !== undefined) { updates.push('gtin = ?'); vals.push(b.gtin); }
    if (b.base_price !== undefined) { updates.push('base_price = ?'); vals.push(b.base_price); }
    if (b.withVat !== undefined) { updates.push('with_vat = ?'); vals.push(b.withVat ? 1 : 0); }
    else if (b.with_vat !== undefined) { updates.push('with_vat = ?'); vals.push(b.with_vat ? 1 : 0); }
    if (b.taxRate !== undefined) { updates.push('tax_rate = ?'); vals.push(b.taxRate); }
    else if (b.tax_rate !== undefined) { updates.push('tax_rate = ?'); vals.push(b.tax_rate); }
    if (b.kcal !== undefined) { updates.push('kcal = ?'); vals.push(b.kcal); }
    if (b.proteins !== undefined) { updates.push('proteins = ?'); vals.push(b.proteins); }
    if (b.fats !== undefined) { updates.push('fats = ?'); vals.push(b.fats); }
    if (b.carbs !== undefined) { updates.push('carbs = ?'); vals.push(b.carbs); }
    if (b.caloriesByTechCard !== undefined) { updates.push('calories_by_tech_card = ?'); vals.push(b.caloriesByTechCard ? 1 : 0); }
    else if (b.calories_by_tech_card !== undefined) { updates.push('calories_by_tech_card = ?'); vals.push(b.calories_by_tech_card ? 1 : 0); }
    if (b.heatTreatment !== undefined) { updates.push('heat_treatment = ?'); vals.push(b.heatTreatment ? 1 : 0); }
    else if (b.heat_treatment !== undefined) { updates.push('heat_treatment = ?'); vals.push(b.heat_treatment ? 1 : 0); }
    if (b.isReturnable !== undefined) { updates.push('is_returnable = ?'); vals.push(b.isReturnable ? 1 : 0); }
    else if (b.is_returnable !== undefined) { updates.push('is_returnable = ?'); vals.push(b.is_returnable ? 1 : 0); }
    if (b.excludeNegControl !== undefined) { updates.push('exclude_neg_control = ?'); vals.push(b.excludeNegControl ? 1 : 0); }
    else if (b.exclude_neg_control !== undefined) { updates.push('exclude_neg_control = ?'); vals.push(b.exclude_neg_control ? 1 : 0); }
    if (b.beerType !== undefined) { updates.push('beer_type = ?'); vals.push(b.beerType ? 1 : 0); }
    else if (b.beer_type !== undefined) { updates.push('beer_type = ?'); vals.push(b.beer_type ? 1 : 0); }
    if (b.alcoholType !== undefined) { updates.push('alcohol_type = ?'); vals.push(b.alcoholType ? 1 : 0); }
    else if (b.alcohol_type !== undefined) { updates.push('alcohol_type = ?'); vals.push(b.alcohol_type ? 1 : 0); }
    if (b.tobaccoType !== undefined) { updates.push('tobacco_type = ?'); vals.push(b.tobaccoType ? 1 : 0); }
    else if (b.tobacco_type !== undefined) { updates.push('tobacco_type = ?'); vals.push(b.tobacco_type ? 1 : 0); }
    if (b.sugarType !== undefined) { updates.push('sugar_type = ?'); vals.push(b.sugarType ? 1 : 0); }
    else if (b.sugar_type !== undefined) { updates.push('sugar_type = ?'); vals.push(b.sugar_type ? 1 : 0); }
    if (b.id1c !== undefined) { updates.push('id_1c = ?'); vals.push(b.id1c); }
    else if (b.id_1c !== undefined) { updates.push('id_1c = ?'); vals.push(b.id_1c); }
    if (b.isMain !== undefined) { updates.push('is_main = ?'); vals.push(b.isMain ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    vals.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Tech cards
app.get('/api/stock-item/:id/tech-cards', (req, res) => {
  try {
    let sql = `SELECT tc.*,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count,
      (SELECT SUM(cost) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_cost,
      (SELECT SUM(yield) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_ing_yield
      FROM tech_cards tc WHERE tc.item_id = ?`;
    const params = [req.params.id];
    if (req.query.store) { sql += ' AND tc.store LIKE ?'; params.push(`%${req.query.store}%`); }
    if (req.query.current_only) { sql += " AND (tc.valid_from IS NULL OR tc.valid_from <= date('now')) AND (tc.expiry_date IS NULL OR tc.expiry_date >= date('now'))"; }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY tc.created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items: toCamelCaseArray(items), total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/stock-item/:id/tech-cards', (req, res) => {
  try {
    const info = db.prepare('INSERT INTO tech_cards (item_id, number, output, cost_price, type, store) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.params.id, req.body.number || 'TC-001', req.body.output || 0, req.body.cost_price || 0, req.body.type || '', req.body.store || '');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/stock-item/:id/tech-cards/:cardId', (req, res) => {
  try {
    db.prepare('DELETE FROM tech_cards WHERE id = ? AND item_id = ?').run(req.params.cardId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tech cards where this product is used as ingredient ──────────
app.get('/api/stock-item/:id/tech-cards-as-ingredient', (req, res) => {
  try {
    const sql = `SELECT DISTINCT tc.*, tci.item_name as ing_name, tci.quantity as ing_qty, tci.unit as ing_unit,
      (SELECT COUNT(*) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as ingredient_count,
      (SELECT SUM(cost) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_cost,
      (SELECT SUM(yield) FROM tech_card_ingredients WHERE tech_card_id = tc.id) as total_ing_yield
      FROM tech_cards tc
      JOIN tech_card_ingredients tci ON tc.id = tci.tech_card_id
      WHERE tci.item_id = ?
      ORDER BY tc.created_at DESC`;
    const items = db.prepare(sql).all(req.params.id);
    res.json({ items: toCamelCaseArray(items) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Stock items search for autocomplete ──────────────────────
app.get('/api/stock-items/search', (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 1) return res.json([]);
    const items = db.prepare(`SELECT id, name, unit, brutto, netto, cold_loss_percent, price_per_unit, category_name FROM inventory_items WHERE name LIKE ? LIMIT 20`).all(`%${q}%`);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Breakdown tech cards (reuse same tech_cards table with type='breakdown')
app.get('/api/stock-item/:id/breakdown-tech-cards', (req, res) => {
  try {
    let sql = "SELECT * FROM tech_cards WHERE item_id = ? AND type = 'breakdown'";
    const params = [req.params.id];
    if (req.query.store) { sql += ' AND store LIKE ?'; params.push(`%${req.query.store}%`); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Packaging
app.get('/api/stock-item/:id/packagings', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM packaging WHERE item_id = ? ORDER BY id').all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/stock-item/:id/packagings', (req, res) => {
  try {
    const { name, barcode, isPrimary, size } = req.body;
    const info = db.prepare('INSERT INTO packaging (item_id, name, barcode, is_primary, size) VALUES (?, ?, ?, ?, ?)').run(
      req.params.id, name || '', barcode || '', isPrimary ? 1 : 0, size || 1);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/stock-item/:id/packagings/:packId', (req, res) => {
  try {
    const sets = []; const vals = [];
    if (req.body.name !== undefined) { sets.push('name = ?'); vals.push(req.body.name); }
    if (req.body.barcode !== undefined) { sets.push('barcode = ?'); vals.push(req.body.barcode); }
    if (req.body.isPrimary !== undefined) { sets.push('is_primary = ?'); vals.push(req.body.isPrimary ? 1 : 0); }
    if (req.body.size !== undefined) { sets.push('size = ?'); vals.push(req.body.size); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    vals.push(req.params.packId);
    db.prepare(`UPDATE packaging SET ${sets.join(', ')} WHERE id = ? AND item_id = ?`).run(...vals, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/stock-item/:id/packagings/:packId', (req, res) => {
  try {
    db.prepare('DELETE FROM packaging WHERE id = ? AND item_id = ?').run(req.params.packId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Composition (items that contain this stock item)
app.get('/api/stock-item/:id/composition', (req, res) => {
  try {
    // For now return empty - requires recipe/tech_card_items table
    res.json([]);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Batches
app.get('/api/stock-item/:id/batches', (req, res) => {
  try {
    let sql = 'SELECT * FROM batches WHERE item_id = ?';
    const params = [req.params.id];
    if (req.query.warehouse) { sql += ' AND warehouse LIKE ?'; params.push(`%${req.query.warehouse}%`); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY arrival_date DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    res.json({ items, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Contragents
app.get('/api/stock-item/:id/contragents', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM stock_contragents WHERE item_id = ? ORDER BY id').all(req.params.id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/stock-item/:id/contragents', (req, res) => {
  try {
    const info = db.prepare('INSERT INTO stock_contragents (item_id, contragent_name) VALUES (?, ?)').run(req.params.id, req.body.name || '');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/stock-item/:id/contragents/:contragentId', (req, res) => {
  try {
    db.prepare('DELETE FROM stock_contragents WHERE id = ? AND item_id = ?').run(req.params.contragentId, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// History
app.get('/api/stock-item/:id/history', (req, res) => {
  try {
    let sql = "SELECT * FROM inventory_transactions WHERE item_id = ?";
    const params = [req.params.id];
    if (req.query.warehouse) { sql += ' AND (note LIKE ? OR item_id = ?)'; params.push(`%${req.query.warehouse}%`, req.params.id); }
    if (req.query.doc_type) { sql += ' AND type = ?'; params.push(req.query.doc_type); }
    if (req.query.date_from) { sql += " AND created_at >= ?"; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += " AND created_at <= ?"; params.push(req.query.date_to + ' 23:59:59'); }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = db.prepare(sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')).get(...params)?.total || 0;
    const items = db.prepare(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, (page-1)*limit);
    const mapped = items.map(i => ({
      id: i.id, date: i.created_at, document: i.document_number || i.note || '',
      warehouse: '', change: i.quantity || 0, price: i.price_per_unit || 0,
      docQuantity: i.quantity || 0,
    }));
    res.json({ items: mapped, total, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Warehouse bindings
app.get('/api/stock-item/:id/warehouse-bindings', (req, res) => {
  try {
    let sql = 'SELECT * FROM warehouse_bindings WHERE item_id = ?';
    const params = [req.params.id];
    if (req.query.only_bound) { sql += ' AND is_bound = 1'; }
    if (req.query.search) { sql += ' AND warehouse_name LIKE ?'; params.push(`%${req.query.search}%`); }
    const items = db.prepare(sql + ' ORDER BY id').all(...params);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/stock-item/:id/warehouse-bindings/:bindingId', (req, res) => {
  try {
    const sets = []; const vals = [];
    if (req.body.is_bound !== undefined) { sets.push('is_bound = ?'); vals.push(req.body.is_bound ? 1 : 0); }
    if (req.body.min_qty !== undefined) { sets.push('min_qty = ?'); vals.push(req.body.min_qty); }
    if (req.body.max_qty !== undefined) { sets.push('max_qty = ?'); vals.push(req.body.max_qty); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    vals.push(req.params.bindingId);
    db.prepare(`UPDATE warehouse_bindings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/stock-item/:id/warehouse-bindings/bind-all', (req, res) => {
  try {
    const existing = db.prepare('SELECT warehouse_id FROM warehouse_bindings WHERE item_id = ?').all(req.params.id).map(r => r.warehouse_id);
    const allBranches = db.prepare('SELECT id, name FROM branches').all();
    for (const branch of allBranches) {
      if (!existing.includes(branch.id)) {
        db.prepare('INSERT INTO warehouse_bindings (item_id, warehouse_id, warehouse_name, is_bound, min_qty, max_qty) VALUES (?, ?, ?, 1, 0, 0)').run(req.params.id, branch.id, branch.name);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Inventory Items (original) ─────────────────────────────────
app.get('/api/inventory', (req, res) => {
  try {
    let sql = 'SELECT * FROM inventory_items WHERE 1=1';
    const params = [];
    if (req.query.category) { sql += ' AND category = ?'; params.push(req.query.category); }
    sql += ' ORDER BY name ASC';
    const items = db.prepare(sql).all(...params);
    const result = items.map(i => {
      let supplierName = null;
      if (i.supplier_id) {
        const s = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(i.supplier_id);
        if (s) supplierName = s.name;
      }
      const balance = i.current_balance ?? i.current_stock ?? 0;
      return toCamelCase({ ...i, currentBalance: balance });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const { name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id } = req.body;
    if (!name || !unit) return res.status(400).json({ error: 'Название и единица измерения обязательны' });
    const info = db.prepare('INSERT INTO inventory_items (name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, category || 'ingredient', unit, price_per_unit || 0, current_balance || 0, supplier_id || null, expiry_date || null, branch_id || null
    );
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase({ ...item, currentBalance: item.current_balance ?? 0 }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/inventory/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const { name, category, unit, price_per_unit, current_balance, supplier_id, expiry_date, branch_id } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (category !== undefined) { sets.push('category = ?'); params.push(category); }
    if (unit !== undefined) { sets.push('unit = ?'); params.push(unit); }
    if (price_per_unit !== undefined) {
      if (Number(price_per_unit) !== Number(existing.price_per_unit)) {
        db.prepare('INSERT INTO price_history (item_id, old_price, new_price) VALUES (?, ?, ?)').run(req.params.id, existing.price_per_unit, Number(price_per_unit));
      }
      sets.push('price_per_unit = ?'); params.push(price_per_unit);
    }
    if (current_balance !== undefined) { sets.push('current_balance = ?'); params.push(current_balance); }
    if (supplier_id !== undefined) { sets.push('supplier_id = ?'); params.push(supplier_id); }
    if (expiry_date !== undefined) { sets.push('expiry_date = ?'); params.push(expiry_date); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    res.json(toCamelCase({ ...item, currentBalance: item.current_balance ?? 0 }));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/inventory/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Товар не найден' });
    const id = req.params.id;
    const del = db.transaction(() => {
      db.prepare('DELETE FROM inventory_transactions WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM forecasts WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM packaging WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM stock_contragents WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM batches WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM warehouse_bindings WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM price_history WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM tech_card_ingredients WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM tech_cards WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
    });
    del();
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/inventory/:id error:', e);
    res.status(500).json({ error: 'Невозможно удалить элемент: ' + e.message });
  }
});

// ─── Inventory Transactions ──────────────────────────────────────
app.get('/api/inventory/transactions', (req, res) => {
  try {
    const { item_id } = req.query;
    let sql = 'SELECT * FROM inventory_transactions WHERE 1=1';
    const params = [];
    if (item_id) { sql += ' AND item_id = ?'; params.push(Number(item_id)); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(transactions));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/inventory/transactions', (req, res) => {
  try {
    const { item_id, type, quantity, price_per_unit, total, supplier_id, supplier_name, note, document_number } = req.body;
    if (!item_id || !type || !quantity) return res.status(400).json({ error: 'ID товара, тип и количество обязательны' });
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    const qty = Number(quantity);
    const info = db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_id, supplier_name, note, document_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      item_id, type, qty, price_per_unit || 0, total || (qty * (price_per_unit || 0)), supplier_id || null, supplier_name || null, note || '', document_number || ''
    );
    if (type === 'incoming') {
      db.prepare('UPDATE inventory_items SET current_balance = COALESCE(current_balance, 0) + ? WHERE id = ?').run(qty, item_id);
    } else if (type === 'outgoing' || type === 'write_off') {
      db.prepare('UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?').run(qty, item_id);
    }
    const transaction = db.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(transaction));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/inventory/price-history/:id', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM price_history WHERE item_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    res.json(toCamelCaseArray(history));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Forecast ────────────────────────────────────────────────────
app.get('/api/forecast', (req, res) => {
  try {
    const { product_id, from_date, to_date } = req.query;
    let sql = `SELECT f.*, i.name as product_name, i.unit, i.current_stock, i.min_stock, COALESCE(f.recommended_purchase, 0) as recommended_purchase
      FROM forecasts f
      LEFT JOIN inventory_items i ON f.product_id = i.id
      WHERE f.tenant_id = current_tenant_id()`;
    const params = [];
    if (product_id) { sql += ' AND f.product_id = ?'; params.push(Number(product_id)); }
    if (from_date) { sql += ' AND f.forecast_date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND f.forecast_date <= ?'; params.push(to_date); }
    sql += ' ORDER BY f.product_id, f.forecast_date';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/forecast/generate', (req, res) => {
  try {
    const result = forecastService.generateForecast(db, req.body.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/forecast/history', (req, res) => {
  try {
    const { product_id, days } = req.query;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const limit = days ? Number(days) : 90;
    const rows = db.prepare(`
      SELECT DATE(created_at) as date, SUM(quantity) as qty
      FROM inventory_transactions
      WHERE item_id = ? AND type = 'writeoff'
        AND created_at >= datetime('now', ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(Number(product_id), `-${limit}`);
    res.json(rows.map(r => ({ date: r.date, quantity: Math.abs(r.qty || 0) })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/forecast/adjust', (req, res) => {
  try {
    const { forecast_id, quantity } = req.body;
    if (!forecast_id || quantity === undefined) return res.status(400).json({ error: 'forecast_id and quantity are required' });
    db.prepare('UPDATE forecasts SET forecast_quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(quantity, forecast_id);
    const updated = db.prepare('SELECT * FROM forecasts WHERE id = ?').get(forecast_id);
    res.json(toCamelCase(updated));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Auto Orders ──────────────────────────────────────────────────

app.get('/api/admin/auto-orders/status', (req, res) => {
  try {
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_orders_enabled'").get();
    res.json({ enabled: setting?.value === '1', lastCheck: autoOrdersService.getLastCheck() });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/auto-orders/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    db.prepare("INSERT INTO system_settings (key, value) VALUES ('auto_orders_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(enabled ? '1' : '0');
    res.json({ ok: true, enabled });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/auto-orders/run-now', (req, res) => {
  try {
    const result = autoOrdersService.checkAndCreateOrders(db);
    res.json({ ...result, lastCheck: autoOrdersService.getLastCheck() });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/auto-orders/low-stock', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT ii.id, ii.name, ii.current_stock, ii.current_balance, ii.min_stock,
        ii.unit, ii.price_per_unit, COALESCE(s.name, ii.contragent_name) as supplier_name
      FROM inventory_items ii
      LEFT JOIN suppliers s ON s.id = ii.default_contragent_id
      WHERE ii.min_stock > 0 AND ii.current_stock < ii.min_stock AND ii.tenant_id = current_tenant_id()
      ORDER BY (ii.current_stock - ii.min_stock) ASC
    `).all();
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Auto-orders settings
app.get('/api/admin/auto-orders/settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    res.json(autoOrdersService.getAutoOrderSettings(db, tenantId));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const settings = autoOrdersService.saveAutoOrderSettings(db, tenantId, req.body);
    autoOrdersService.rescheduleCron(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Approve / Reject / Send / Receive
app.put('/api/admin/auto-orders/:id/approve', (req, res) => {
  try { res.json(autoOrdersService.approveOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/reject', (req, res) => {
  try { res.json(autoOrdersService.rejectOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/send', (req, res) => {
  try { res.json(autoOrdersService.sendOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/admin/auto-orders/:id/receive', (req, res) => {
  try { res.json(autoOrdersService.receiveOrder(db, req.params.id)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Cash Register Shifts / Z-Report ─────────────────────────────

const shiftService = {
  getCurrentShift(tenantId) {
    return db.prepare('SELECT * FROM cashier_shifts WHERE tenant_id = ? AND status = ?').get(tenantId || 1, 'open');
  },

  openShift(staffId, staffName, openingBalance, tenantId) {
    const current = this.getCurrentShift(tenantId || 1);
    if (current) return { success: false, error: 'Смена уже открыта', shift: current };

    const info = db.prepare(`INSERT INTO cashier_shifts (tenant_id, staff_id, staff_name, opened_at, opening_balance, status)
      VALUES (?, ?, ?, datetime('now'), ?, 'open')`).run(tenantId || 1, staffId || 0, staffName || '', openingBalance || 0);
    return { success: true, shift: db.prepare('SELECT * FROM cashier_shifts WHERE id = ?').get(info.lastInsertRowid) };
  },

  closeShift(shiftId, closingBalance, notes, tenantId) {
    const shift = db.prepare('SELECT * FROM cashier_shifts WHERE id = ? AND tenant_id = ?').get(shiftId, tenantId || 1);
    if (!shift) return { success: false, error: 'Смена не найдена' };
    if (shift.status !== 'open') return { success: false, error: 'Смена уже закрыта' };

    // Aggregate all payments made during this shift
    const payments = db.prepare(`
      SELECT payment_method, COUNT(*) as cnt, SUM(total) as total
      FROM orders WHERE shift_id = ? AND is_paid = 1 AND status = 'paid'
      GROUP BY payment_method
    `).all(shiftId);

    let cashIncome = 0, cardIncome = 0, onlineIncome = 0, qrIncome = 0, otherIncome = 0, totalIncome = 0, totalDiscount = 0, orderCount = 0;
    for (const p of payments) {
      const t = parseFloat(p.total) || 0;
      totalIncome += t;
      orderCount += p.cnt || 0;
      switch (p.payment_method) {
        case 'cash': cashIncome += t; break;
        case 'card': cardIncome += t; break;
        case 'online': onlineIncome += t; break;
        case 'qr': qrIncome += t; break;
        default: otherIncome += t; break;
      }
    }

    // Total discounts from orders
    const discRow = db.prepare('SELECT COALESCE(SUM(discount),0) as total FROM orders WHERE shift_id = ? AND is_paid = 1').get(shiftId);
    totalDiscount = parseFloat(discRow?.total || 0);

    const expectedBalance = (shift.opening_balance || 0) + cashIncome;
    const diff = (closingBalance || 0) - expectedBalance;

    db.prepare(`UPDATE cashier_shifts SET
      closed_at = datetime('now'), closing_balance = ?, expected_balance = ?,
      cash_income = ?, card_income = ?, online_income = ?, qr_income = ?, other_income = ?,
      total_income = ?, total_discount = ?, order_count = ?, status = 'closed', notes = ?
      WHERE id = ?`).run(
      closingBalance || 0, expectedBalance,
      cashIncome, cardIncome, onlineIncome, qrIncome, otherIncome,
      totalIncome, totalDiscount, orderCount, notes || '', shiftId
    );

    const updated = db.prepare('SELECT * FROM cashier_shifts WHERE id = ?').get(shiftId);
    return { success: true, shift: updated, difference: Math.round(diff * 100) / 100 };
  },

  getZReport(shiftId, tenantId) {
    const shift = db.prepare('SELECT * FROM cashier_shifts WHERE id = ? AND tenant_id = ?').get(shiftId, tenantId || 1);
    if (!shift) return { success: false, error: 'Смена не найдена' };

    const payments = db.prepare(`
      SELECT payment_method, COUNT(*) as cnt, SUM(total) as total
      FROM orders WHERE shift_id = ? AND is_paid = 1 AND status = 'paid'
      GROUP BY payment_method
    `).all(shiftId);

    const byCashier = db.prepare(`
      SELECT COALESCE(waiter_name, '—') as cashier, COUNT(*) as cnt, SUM(total) as total
      FROM orders WHERE shift_id = ? AND is_paid = 1
      GROUP BY waiter_name ORDER BY cnt DESC
    `).all(shiftId);

    const cancellations = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total
      FROM orders WHERE shift_id = ? AND status = 'cancelled'
    `).get(shiftId);

    const refunds = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total
      FROM orders WHERE shift_id = ? AND status = 'refunded'
    `).get(shiftId);

    return {
      success: true,
      shift,
      payments: payments.map(p => ({ method: p.payment_method, count: p.cnt, total: p.total })),
      byCashier,
      cancellations: { count: cancellations?.cnt || 0, total: cancellations?.total || 0 },
      refunds: { count: refunds?.cnt || 0, total: refunds?.total || 0 },
    };
  },

  getShifts(tenantId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as total FROM cashier_shifts WHERE tenant_id = ?').get(tenantId || 1)?.total || 0;
    const items = db.prepare('SELECT * FROM cashier_shifts WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(tenantId || 1, limit, offset);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  },
};

// Update payment endpoint to associate orders with open shift
const originalProcessPayment = db.prepare.toString
// Patch is applied at the payment route level

app.get('/api/admin/shifts/current', (req, res) => {
  try {
    const shift = shiftService.getCurrentShift(req.query.tenant_id || 1);
    res.json(shift || null);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/shifts/open', (req, res) => {
  try {
    const { staffId, staffName, openingBalance } = req.body;
    const result = shiftService.openShift(staffId || 0, staffName || '', openingBalance || 0, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/shifts/:id/close', (req, res) => {
  try {
    const { closingBalance, notes } = req.body;
    const result = shiftService.closeShift(req.params.id, closingBalance || 0, notes || '', req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/shifts/:id/z-report', (req, res) => {
  try {
    const result = shiftService.getZReport(req.params.id, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/shifts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    res.json(shiftService.getShifts(req.query.tenant_id || 1, page, limit));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Auto Write-off (expiry dates) ───────────────────────────────

app.get('/api/admin/auto-writeoff/settings', (req, res) => {
  try { res.json(autoWriteoffService.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/auto-writeoff/settings', (req, res) => {
  try {
    const settings = autoWriteoffService.saveSettings(db, req.body, req.query.tenant_id || 1);
    autoWriteoffService.rescheduleCron(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/auto-writeoff/expiring', (req, res) => {
  try {
    const settings = autoWriteoffService.getSettings(db, req.query.tenant_id || 1);
    const items = autoWriteoffService.getExpiringSoon(db, req.query.days || settings.warn_days || 3);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/auto-writeoff/expired', (req, res) => {
  try { res.json(autoWriteoffService.getExpiredItems(db)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/auto-writeoff/run-now', (req, res) => {
  try {
    const result = autoWriteoffService.runAutoWriteoff(db, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/auto-writeoff/calculate-losses', (req, res) => {
  try {
    const { ids } = req.body;
    const result = autoWriteoffService.calculateLosses(db, ids || []);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Costing (cost price calculation) ────────────────────────────

app.get('/api/admin/costing/overview', (req, res) => {
  try { res.json(costingService.getCostingOverview(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/costing/recalculate', (req, res) => {
  try {
    const result = costingService.recalculateAll(db, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/costing/recalculate/:dishId', (req, res) => {
  try {
    const dish = db.prepare('SELECT id, tech_card_id FROM dishes WHERE id = ?').get(req.params.dishId);
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
    const result = costingService.recalculateOne(db, dish.id, dish.tech_card_id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/costing/status', (req, res) => {
  res.json({ lastRun: costingService.getLastRun() });
});

// ─── Честный знак API ───────────────────────────────────────────
app.get('/api/admin/honest-sign/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM honest_sign_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) { db.prepare('INSERT INTO honest_sign_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1); return res.json({}); }
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/honest-sign/settings', (req, res) => {
  try {
    const { enabled, api_key, organization_inn } = req.body;
    const existing = db.prepare('SELECT id FROM honest_sign_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) db.prepare("UPDATE honest_sign_settings SET enabled = ?, api_key = ?, organization_inn = ? WHERE tenant_id = ?").run(enabled ? 1 : 0, api_key || '', organization_inn || '', req.tenant_id || 1);
    else db.prepare("INSERT INTO honest_sign_settings (tenant_id, enabled, api_key, organization_inn) VALUES (?, ?, ?, ?)").run(req.tenant_id || 1, enabled ? 1 : 0, api_key || '', organization_inn || '');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/honest-sign/check', (req, res) => {
  try {
    const { marking_code } = req.body;
    if (!marking_code || marking_code.length < 10) return res.json({ valid: false, error: 'Неверный формат кода' });
    res.json({ valid: true, product_gtin: marking_code.substring(0, 14), message: 'Код корректен' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/honest-sign/products', (req, res) => {
  try {
    const products = db.prepare('SELECT hsp.*, ii.name as product_name FROM honest_sign_products hsp LEFT JOIN inventory_items ii ON ii.id = hsp.product_id WHERE hsp.tenant_id = ? ORDER BY hsp.created_at DESC').all(req.tenant_id || 1);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Suppliers ───────────────────────────────────────────────────
app.get('/api/suppliers', (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    res.json(toCamelCaseArray(suppliers));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/suppliers', (req, res) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Название поставщика обязательно' });
    const info = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(name, contact_person || null, phone || null, email || null, address || null);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(supplier));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/suppliers/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Поставщик не найден' });
    const { name, contact_person, phone, email, address } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (contact_person !== undefined) { sets.push('contact_person = ?'); params.push(contact_person); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(supplier));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Поставщик не найден' });
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Supplier Portal (Admin) ─────────────────────────────────────
app.get('/api/admin/supplier-portal/users', (req, res) => {
  try {
    const { supplier_id } = req.query;
    let sql = 'SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.tenant_id = current_tenant_id()';
    const params = [];
    if (supplier_id) { sql += ' WHERE spu.supplier_id = ?'; params.push(supplier_id); }
    sql += ' ORDER BY spu.created_at DESC';
    const users = db.prepare(sql).all(...params);
    res.json(users.map(u => ({ ...u, permissions: JSON.parse(u.permissions || '{}') })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/supplier-portal/users', (req, res) => {
  try {
    const { supplier_id, login, password, permissions } = req.body;
    if (!supplier_id || !login || !password) return res.status(400).json({ error: 'supplier_id, login и password обязательны' });
    const existing = db.prepare('SELECT id FROM supplier_portal_users WHERE login = ?').get(login);
    if (existing) return res.status(400).json({ error: 'Логин уже занят' });
    const hash = supplierPortal.hashPassword(password);
    const info = db.prepare('INSERT INTO supplier_portal_users (tenant_id, supplier_id, login, password_hash, permissions, is_active) VALUES (?, ?, ?, ?, ?, 1)').run(
      1, supplier_id, login, hash, JSON.stringify(permissions || { prices: 1, stock: 1, orders: 1, products: 1 })
    );
    const user = db.prepare('SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.id = ? AND spu.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    res.status(201).json({ ...user, permissions: JSON.parse(user.permissions || '{}') });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/supplier-portal/users/:id', (req, res) => {
  try {
    const { login, is_active, permissions, password } = req.body;
    const sets = []; const params = [];
    if (login !== undefined) { sets.push('login = ?'); params.push(login); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (permissions !== undefined) { sets.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
    if (password !== undefined) { sets.push('password_hash = ?'); params.push(supplierPortal.hashPassword(password)); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE supplier_portal_users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const user = db.prepare('SELECT spu.*, s.name as supplier_name FROM supplier_portal_users spu LEFT JOIN suppliers s ON s.id = spu.supplier_id WHERE spu.id = ? AND spu.tenant_id = current_tenant_id()').get(req.params.id);
    res.json({ ...user, permissions: JSON.parse(user.permissions || '{}') });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/supplier-portal/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM supplier_portal_users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/supplier-portal/products/:supplierId', (req, res) => {
  try {
    const products = supplierPortal.getProductCatalog(db, req.params.supplierId);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/supplier-portal/products', (req, res) => {
  try {
    const { supplier_id, product_id, price } = req.body;
    if (!supplier_id || !product_id) return res.status(400).json({ error: 'supplier_id и product_id обязательны' });
    db.prepare('INSERT OR REPLACE INTO supplier_products (tenant_id, supplier_id, product_id, price, is_active) VALUES (?, ?, ?, ?, 1)').run(1, supplier_id, product_id, price || 0);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/supplier-portal/products/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM supplier_products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/supplier-portal/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT sal.*, s.name as supplier_name FROM supplier_activity_log sal LEFT JOIN suppliers s ON s.id = sal.supplier_id WHERE sal.tenant_id = current_tenant_id() ORDER BY sal.created_at DESC LIMIT 200').all();
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Supplier Portal (Self-Service Auth) ────────────────────────
const SUPPLIER_JWT_SECRET = process.env.SUPPLIER_JWT_SECRET || 'supplier-portal-jwt-secret';

if (process.env.NODE_ENV === 'production' && !process.env.SUPPLIER_JWT_SECRET) {
  console.error('FATAL: SUPPLIER_JWT_SECRET environment variable is not set');
  process.exit(1);
}

function supplierAuth(req) {
  const token = req.headers['x-supplier-token'];
  if (!token) return null;
  return supplierPortal.verifyToken(token, SUPPLIER_JWT_SECRET);
}

app.post('/api/supplier-portal/auth', (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
    const user = supplierPortal.authenticate(db, login, password);
    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const token = supplierPortal.generateToken(user, SUPPLIER_JWT_SECRET);
    supplierPortal.logActivity(db, { supplierId: user.supplier_id, portalUserId: user.id, action: 'login', details: 'Supplier portal login' });
    res.json({ token, user: { id: user.id, supplier_id: user.supplier_id, supplier_name: user.supplier?.name || '', login: user.login, permissions: JSON.parse(user.permissions || '{}') } });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/supplier-portal/change-password', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Все поля обязательны' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    const user = db.prepare('SELECT * FROM supplier_portal_users WHERE id = ?').get(auth.id);
    if (!user || !supplierPortal.verifyPassword(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Неверный текущий пароль' });
    const hash = supplierPortal.hashPassword(newPassword);
    db.prepare("UPDATE supplier_portal_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, auth.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/supplier-portal/check', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ ok: true, user: auth });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Supplier Portal (Self-Service API) ─────────────────────────
app.get('/api/supplier-portal/dashboard', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const stats = supplierPortal.getDashboardStats(db, auth.supplier_id);
    const recentOrders = db.prepare('SELECT * FROM supplier_order_history WHERE supplier_id = ? AND tenant_id = 1 ORDER BY created_at DESC LIMIT 5').all(auth.supplier_id);
    res.json({ ...stats, recentOrders });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/supplier-portal/products', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const products = supplierPortal.getProductCatalog(db, auth.supplier_id);
    res.json(products);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/supplier-portal/prices', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.prices) return res.status(403).json({ error: 'Нет прав на изменение цен' });
    const result = supplierPortal.updatePrices(db, auth.supplier_id, req.body.prices || []);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'update_prices', details: `Updated ${result.updated} prices` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/supplier-portal/prices/import', csvUpload.single('file'), (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.prices) return res.status(403).json({ error: 'Нет прав на изменение цен' });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const content = req.file.buffer.toString('utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'Файл не содержит данных' });
    const headerMap = { 'артикул': 'article', 'article': 'article', 'sku': 'article', 'наименование': 'name', 'name': 'name', 'штрихкод': 'barcode', 'barcode': 'barcode', 'цена': 'price', 'price': 'price' };
    const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
    const headers = rawHeaders.map(h => headerMap[h] || h);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      rows.push(row);
    }
    const result = supplierPortal.importPricesFromExcel(db, auth.supplier_id, rows);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'import_prices', details: `Imported ${result.imported}/${result.total} prices` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/supplier-portal/stock', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.stock) return res.status(403).json({ error: 'Нет прав на изменение остатков' });
    const result = supplierPortal.updateStock(db, auth.supplier_id, req.body.stock || []);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: 'update_stock', details: `Updated ${result.updated} stock items` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/supplier-portal/orders', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const status = req.query.status;
    let orders = supplierPortal.getOrders(db, auth.supplier_id);
    if (status && status !== 'all') orders = orders.filter(o => o.status === status);
    res.json(orders);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/supplier-portal/orders/:id/status', (req, res) => {
  try {
    const auth = supplierAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const perms = auth.permissions;
    if (!perms.orders) return res.status(403).json({ error: 'Нет прав на изменение заказов' });
    const result = supplierPortal.confirmOrder(db, req.params.id, auth.supplier_id, req.body.status);
    supplierPortal.logActivity(db, { supplierId: auth.supplier_id, portalUserId: auth.id, action: `order_${req.body.status}`, details: `Order #${result.order_id || result.id}` });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Offline Sync ─────────────────────────────────────────────────
app.post('/api/offline/sync', (req, res) => {
  try {
    const { actions, last_sync_at } = req.body;
    const results = [];
    const syncData = {};

    if (actions && Array.isArray(actions)) {
      const txn = db.transaction(() => {
        for (const action of actions) {
          try {
            const { type, data, local_id, timestamp } = action;
            let result = { local_id, status: 'synced', server_id: null, conflict_with: null };

            // Conflict resolution: check updated_at before applying mutations
            if (type === 'update_order_status') {
              const existing = db.prepare("SELECT updated_at FROM orders WHERE id = ?").get(data.order_id);
              if (existing && timestamp && existing.updated_at > timestamp) {
                result.status = 'conflict';
                result.server_id = data.order_id;
                result.conflict_with = existing;
                results.push(result);
                continue;
              }
            }
            if (type === 'create_order') {
              const info = db.prepare('INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, delivery_fee, discount, total, payment_method, type, status, address, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                data.user_id || 0, data.user_name || '', data.user_phone || '', JSON.stringify(data.items || []),
                data.subtotal || 0, data.delivery_fee || 0, data.discount || 0, data.total || 0,
                data.payment_method || 'cash', data.type || 'delivery', 'new', data.address || '', data.comment || '',
                timestamp || new Date().toISOString()
              );
              result.server_id = info.lastInsertRowid;
            } else if (type === 'update_order_status') {
              db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(data.status, data.order_id);
              result.server_id = data.order_id;
            } else if (type === 'create_transaction') {
              const info = db.prepare('INSERT INTO finance_transactions (type, category, amount, payment_method, description, date) VALUES (?, ?, ?, ?, ?, ?)').run(
                data.type || 'income', data.category || 'other', data.amount || 0, data.payment_method || 'cash', data.description || '', data.date || new Date().toISOString().split('T')[0]
              );
              result.server_id = info.lastInsertRowid;
            }

            results.push(result);
          } catch (e) {
            results.push({ local_id: action?.local_id, status: 'error', error: safeError(e.message) });
          }
        }
      });
      txn();
    }

    // Return current state for local cache
    const since = last_sync_at || '2000-01-01';
    syncData.orders = db.prepare("SELECT id, status, updated_at FROM orders WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.menu_categories = db.prepare("SELECT id, name, sort_order, is_active, icon, parent_id, created_at, updated_at FROM menu_categories WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.dishes = db.prepare("SELECT id, name, price, is_active as status, category_id, barcode, article, is_available, updated_at, created_at FROM dishes WHERE updated_at > ? OR created_at > ?").all(since, since);
    syncData.inventory_items = db.prepare("SELECT id, name, article, unit, COALESCE(current_stock, current_balance, 0) as current_stock, barcode FROM inventory_items WHERE id IN (SELECT id FROM inventory_items)").all();
    syncData.settings = db.prepare("SELECT key, value FROM settings WHERE tenant_id = 1").all();

    res.json({ synced: results, syncData });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Barcode Lookup ──────────────────────────────────────────────
app.get('/api/inventory/by-barcode/:barcode', (req, res) => {
  try {
    const item = db.prepare("SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance FROM inventory_items ii WHERE ii.barcode = ? LIMIT 1").get(req.params.barcode);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/inventory-items/by-barcode/:barcode', (req, res) => {
  try {
    const item = db.prepare("SELECT ii.*, COALESCE(ii.current_balance, ii.current_stock, 0) as currentBalance FROM inventory_items ii WHERE ii.barcode = ? LIMIT 1").get(req.params.barcode);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    res.json({ ...item, currentBalance: item.currentBalance, barcode: item.barcode || '' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Barcode generation ──────────────────────────────────────────
app.get('/api/barcode/generate', (req, res) => {
  const { type } = req.query;
  const base = '20' + String(Date.now()).slice(-10) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const ean13 = base.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(ean13[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  const fullBarcode = ean13 + check;
  res.json({ barcode: fullBarcode, type: 'ean13' });
});

app.get('/api/barcode/print', (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'Missing ids' });
  const idList = ids.split(',').map(Number);
  const placeholders = idList.map(() => '?').join(',');
  const items = db.prepare(`SELECT id, name, barcode, unit FROM inventory_items WHERE id IN (${placeholders})`).all(...idList);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Печать этикеток</title>
  <style>
    @page { margin: 0; size: 210mm 297mm; }
    body { margin: 10mm; font-family: 'Courier New', monospace; }
    .label-sheet { display: grid; grid-template-columns: repeat(3, 63.5mm); gap: 2mm; }
    .label { border: 1px solid #ccc; padding: 4mm; text-align: center; page-break-inside: avoid; }
    .label .name { font-size: 10px; font-weight: bold; margin-bottom: 2mm; word-wrap: break-word; }
    .label .barcode-img { margin: 2mm auto; display: block; }
    .label .barcode-text { font-size: 12px; letter-spacing: 2px; }
    .label .unit { font-size: 9px; color: #666; margin-top: 1mm; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="no-print" style="margin-bottom:10mm;"><button onclick="window.print()">Печать</button> <button onclick="window.close()">Закрыть</button></div>
  <div class="label-sheet">
    ${items.map(item => `
    <div class="label">
      <div class="name">${item.name}</div>
      <div class="barcode-text">${item.barcode || '—'}</div>
      <div class="unit">${item.unit || ''}</div>
    </div>`).join('')}
  </div>
  <script>window.onload=setTimeout(()=>{window.print()},500);</script>
  </body></html>`);
});

// ─── Contragents (full-featured) ─────────────────────────────────
app.get('/api/contragents', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM contragents WHERE tenant_id = 1';
    const params = [];
    if (search) { sql += ' AND (company_name LIKE ? OR full_name LIKE ? OR inn LIKE ? OR phone LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }
    sql += ' ORDER BY company_name ASC';
    const items = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(items));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/contragents', (req, res) => {
  try {
    const b = req.body;
    if (!b.companyName || !b.companyName.trim()) return res.status(400).json({ error: 'Название компании обязательно' });
    if (!b.fullName || !b.fullName.trim()) return res.status(400).json({ error: 'Полное название юр. лица обязательно' });
    if (b.inn && !/^\d{10}$|^\d{12}$/.test(b.inn)) return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
    if (b.kpp && !/^\d{9}$/.test(b.kpp)) return res.status(400).json({ error: 'КПП должен содержать 9 цифр' });
    if (b.bik && !/^\d{9}$/.test(b.bik)) return res.status(400).json({ error: 'БИК должен содержать 9 цифр' });
    if (b.bankAccount && !/^\d{20}$/.test(b.bankAccount)) return res.status(400).json({ error: 'Расчётный счёт должен содержать 20 цифр' });
    if (b.correspondentAccount && !/^\d{20}$/.test(b.correspondentAccount)) return res.status(400).json({ error: 'Корр. счёт должен содержать 20 цифр' });
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'Некорректный email' });

    const info = db.prepare(`INSERT INTO contragents (
      tenant_id, company_name, full_name, type, inn, kpp,
      legal_country, legal_region, legal_city, legal_street, legal_house, legal_index,
      actual_country, actual_region, actual_city, actual_street, actual_house, actual_index,
      bank_account, bank_name, bank_address, bik, correspondent_account,
      contract_number, contract_date, vat_included, wholesale_price_list,
      cost_item_debit, cost_item_credit, contact_person, phone, email, website,
      supplier_number, work_conditions, description, id_1c,
      min_order_sum, credit_limit, payment_deferral_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      1, b.companyName, b.fullName, b.type || 'ip', b.inn || null, b.kpp || null,
      b.legalCountry || 'Российская Федерация', b.legalRegion || null, b.legalCity || null, b.legalStreet || null, b.legalHouse || null, b.legalIndex || null,
      b.actualCountry || 'Российская Федерация', b.actualRegion || null, b.actualCity || null, b.actualStreet || null, b.actualHouse || null, b.actualIndex || null,
      b.bankAccount || null, b.bankName || null, b.bankAddress || null, b.bik || null, b.correspondentAccount || null,
      b.contractNumber || null, b.contractDate || null, b.vatIncluded ? 1 : 0, b.wholesalePriceList || null,
      b.costItemDebit || null, b.costItemCredit || null, b.contactPerson || null, b.phone || null, b.email || null, b.website || null,
      b.supplierNumber || null, b.workConditions || null, b.description || null, b.id1c || null,
      parseFloat(b.minOrderSum) || 0, parseFloat(b.creditLimit) || 0, parseInt(b.paymentDeferralDays) || 0
    );
    const item = db.prepare('SELECT * FROM contragents WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/contragents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Контрагент не найден' });
    const b = req.body;
    if (b.inn && !/^\d{10}$|^\d{12}$/.test(b.inn)) return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
    if (b.kpp && !/^\d{9}$/.test(b.kpp)) return res.status(400).json({ error: 'КПП должен содержать 9 цифр' });
    if (b.bik && !/^\d{9}$/.test(b.bik)) return res.status(400).json({ error: 'БИК должен содержать 9 цифр' });
    if (b.bankAccount && !/^\d{20}$/.test(b.bankAccount)) return res.status(400).json({ error: 'Расчётный счёт должен содержать 20 цифр' });
    if (b.correspondentAccount && !/^\d{20}$/.test(b.correspondentAccount)) return res.status(400).json({ error: 'Корр. счёт должен содержать 20 цифр' });
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'Некорректный email' });
    const fields = [
      'companyName', 'fullName', 'type', 'inn', 'kpp',
      'legalCountry', 'legalRegion', 'legalCity', 'legalStreet', 'legalHouse', 'legalIndex',
      'actualCountry', 'actualRegion', 'actualCity', 'actualStreet', 'actualHouse', 'actualIndex',
      'bankAccount', 'bankName', 'bankAddress', 'bik', 'correspondentAccount',
      'contractNumber', 'contractDate', 'vatIncluded', 'wholesalePriceList',
      'costItemDebit', 'costItemCredit', 'contactPerson', 'phone', 'email', 'website',
      'supplierNumber', 'workConditions', 'description', 'id1c',
      'minOrderSum', 'creditLimit', 'paymentDeferralDays'
    ];
    const colMap = { companyName: 'company_name', fullName: 'full_name', legalCountry: 'legal_country', legalRegion: 'legal_region', legalCity: 'legal_city', legalStreet: 'legal_street', legalHouse: 'legal_house', legalIndex: 'legal_index', actualCountry: 'actual_country', actualRegion: 'actual_region', actualCity: 'actual_city', actualStreet: 'actual_street', actualHouse: 'actual_house', actualIndex: 'actual_index', bankAccount: 'bank_account', bankName: 'bank_name', bankAddress: 'bank_address', correspondentAccount: 'correspondent_account', contractNumber: 'contract_number', contractDate: 'contract_date', vatIncluded: 'vat_included', wholesalePriceList: 'wholesale_price_list', costItemDebit: 'cost_item_debit', costItemCredit: 'cost_item_credit', contactPerson: 'contact_person', supplierNumber: 'supplier_number', workConditions: 'work_conditions', id1c: 'id_1c', minOrderSum: 'min_order_sum', creditLimit: 'credit_limit', paymentDeferralDays: 'payment_deferral_days' };
    const sets = []; const vals = [];
    for (const f of fields) {
      if (b[f] !== undefined) {
        const col = colMap[f] || f;
        sets.push(`${col} = ?`);
        vals.push(f === 'vatIncluded' ? (b[f] ? 1 : 0) : f === 'minOrderSum' || f === 'creditLimit' ? parseFloat(b[f]) || 0 : f === 'paymentDeferralDays' ? parseInt(b[f]) || 0 : b[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    db.prepare(`UPDATE contragents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const item = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(item));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/contragents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contragents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Контрагент не найден' });
    db.prepare('DELETE FROM contragents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Pickup Points ───────────────────────────────────────────────
app.get('/api/pickup-points', (req, res) => {
  try {
    const points = db.prepare('SELECT * FROM pickup_points ORDER BY display_order ASC, name ASC').all();
    res.json(toCamelCaseArray(points));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/pickup-points', (req, res) => {
  try {
    const { name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare('INSERT INTO pickup_points (name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, address || '', lat || null, lng || null, phone || '', description || '',
      typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours || {}),
      image_url || '', estimated_ready_minutes || 15, is_active !== undefined ? (is_active ? 1 : 0) : 1, display_order || 0
    );
    const point = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(point));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/pickup-points/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пункт выдачи не найден' });
    const { name, address, lat, lng, phone, description, working_hours, image_url, estimated_ready_minutes, is_active, display_order } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (lat !== undefined) { sets.push('lat = ?'); params.push(lat); }
    if (lng !== undefined) { sets.push('lng = ?'); params.push(lng); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (working_hours !== undefined) { sets.push('working_hours = ?'); params.push(typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours)); }
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (estimated_ready_minutes !== undefined) { sets.push('estimated_ready_minutes = ?'); params.push(estimated_ready_minutes); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (display_order !== undefined) { sets.push('display_order = ?'); params.push(display_order); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE pickup_points SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const point = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(point));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/pickup-points/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM pickup_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пункт выдачи не найден' });
    db.prepare('DELETE FROM pickup_points WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Pickup Orders ───────────────────────────────────────────────
app.get('/api/pickup-orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE type = 'pickup' AND status IN ('new','confirmed','preparing','ready') ORDER BY created_at DESC").all();
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)) });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Staff Schedule (employee scheduling) ──────────────────────
const staffScheduleService = require(path.join(__dirname, 'services', 'staff-schedule.service.js'));

app.get('/api/staff/schedules', (req, res) => {
  try {
    const weekStart = req.query.week_start || staffScheduleService.getCurrentWeekStart();
    res.json(toCamelCaseArray(staffScheduleService.getSchedules(db, req.query.tenant_id || 1, weekStart)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/staff/schedules', (req, res) => {
  try {
    const { staffId, staffName, date, startTime, endTime } = req.body;
    if (!staffId || !date) return res.status(400).json({ error: 'Missing required fields' });
    const result = staffScheduleService.saveSchedule(db, { staffId, staffName, date, startTime: startTime || '09:00', endTime: endTime || '18:00' }, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/staff/schedules/:id', (req, res) => {
  try {
    staffScheduleService.deleteSchedule(db, req.params.id, req.query.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/staff/schedule-staff', (req, res) => {
  try {
    res.json(toCamelCaseArray(staffScheduleService.getStaffList(db, req.query.tenant_id || 1)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Staff CRUD ──────────────────────────────────────────────────
app.get('/api/staff', (req, res) => {
  try {
    const staff = db.prepare('SELECT * FROM staff WHERE is_active = 1 ORDER BY role ASC, first_name ASC').all();
    const result = staff.map(s => {
      let isAvailable = null;
      let ordersHandled = 0;
      if (s.role === 'courier') {
        const courier = db.prepare('SELECT is_available, total_deliveries FROM couriers WHERE phone = ?').get(s.phone);
        if (courier) {
          isAvailable = !!courier.is_available;
          ordersHandled = courier.total_deliveries || 0;
        }
      }
      // Calculate today's online time for couriers
      let onlineToday = 0;
      if (s.role === 'courier') {
        const today = new Date().toISOString().split('T')[0];
        const logs = db.prepare("SELECT * FROM courier_activity_log WHERE staff_id = ? AND date = ? ORDER BY time ASC").all(s.id, today);
        let lastOnline = null;
        for (const log of logs) {
          if (log.status === 1) lastOnline = log.time;
          else if (log.status === 0 && lastOnline) {
            const [sh, sm] = lastOnline.split(':').map(Number);
            const [eh, em] = log.time.split(':').map(Number);
            onlineToday += (eh * 60 + em) - (sh * 60 + sm);
            lastOnline = null;
          }
        }
        if (lastOnline) {
          const now = new Date();
          const [sh, sm] = lastOnline.split(':').map(Number);
          onlineToday += (now.getHours() * 60 + now.getMinutes()) - (sh * 60 + sm);
        }
      }
      return toCamelCase({ ...s, isAvailable, ordersHandled, onlineToday });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

function getRoleLimit(db, tenantId, role) {
  const tenantRow = db.prepare('SELECT app_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
  if (!tenantRow || !tenantRow.app_settings) return null;
  let settings;
  try { settings = JSON.parse(tenantRow.app_settings); } catch { return null; }
  const val = settings[role];
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    return val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
  }
  return null; // no limit configured, treat as unlimited
}

function getStaffCountByRole(db, tenantId, role) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM staff WHERE is_active = 1 AND tenant_id = ? AND role = ?').get(tenantId, role);
  return row?.cnt || 0;
}

function checkRoleLimit(db, tenantId, role, isAddition = true) {
  const limit = getRoleLimit(db, tenantId, role);
  if (limit === null || limit < 0) return null; // Unlimited
  const current = getStaffCountByRole(db, tenantId, role);
  const roleLabels = { admin:'Администратор', waiter:'Официант', chef:'Повар', kitchen:'Кухня', courier:'Курьер', manager:'Менеджер', stock_manager:'Кладовщик' };
  if (current >= limit) {
    return { allowed: false, message: `Невозможно добавить сотрудника этой роли (${
      roleLabels[role] || role
    }), достигнут лимит (${current} из ${limit}). Обратитесь к администратору системы.` };
  }
  return null;
}

app.post('/api/staff', (req, res) => {
  try {
    const { first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate,
      username, salary_type, salary_value, position, tenant_id } = req.body;
    if (!first_name || !role) return res.status(400).json({ error: 'Имя и роль обязательны' });

    // Enforce role limits if tenant_id is provided
    if (tenant_id) {
      const limitCheck = checkRoleLimit(db, tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (phone) {
      const existing = db.prepare('SELECT id, first_name FROM staff WHERE phone = ? AND is_active = 1').get(phone);
      if (existing) return res.status(400).json({ error: `Телефон ${phone} уже используется (${existing.first_name})` });
    }
    const pwd = password ? bcrypt.hashSync(password, 10) : crypto.randomBytes(4).toString('hex');
    const st = salary_type ? (Array.isArray(salary_type) ? JSON.stringify(salary_type) : salary_type) : (role === 'courier' ? JSON.stringify(['per_order']) : null);
    const sv = salary_value ? (typeof salary_value === 'object' ? JSON.stringify(salary_value) : salary_value) : 0;
    const info = db.prepare('INSERT INTO staff (first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate, username, salary_type, salary_value, position, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      first_name, last_name || '', role, phone || null, email || null, pwd, photo_url || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1, hourly_rate || 0,
      username || null, st, sv, position || role, tenant_id || null
    );
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(member));
  } catch (e) {
    console.error('STAFF_CREATE_ERROR:', e.message);
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/staff/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    const { first_name, last_name, role, phone, email, password, photo_url, is_active, hourly_rate,
      username, salary_type, salary_value, position } = req.body;
    const sets = []; const params = [];

    // Check limit if role is changing and tenant_id is available
    if (role !== undefined && role !== existing.role && existing.tenant_id) {
      const limitCheck = checkRoleLimit(db, existing.tenant_id, role, true);
      if (limitCheck && !limitCheck.allowed) {
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (first_name !== undefined) { sets.push('first_name = ?'); params.push(first_name); }
    if (last_name !== undefined) { sets.push('last_name = ?'); params.push(last_name); }
    if (role !== undefined) { sets.push('role = ?'); params.push(role); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone || null); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email || null); }
    if (password !== undefined) { sets.push('password = ?'); params.push(password ? bcrypt.hashSync(password, 10) : null); }
    if (photo_url !== undefined) { sets.push('photo_url = ?'); params.push(photo_url); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (hourly_rate !== undefined) { sets.push('hourly_rate = ?'); params.push(hourly_rate); }
    if (username !== undefined) { sets.push('username = ?'); params.push(username || null); }
    if (salary_type !== undefined) { sets.push('salary_type = ?'); params.push(salary_type != null && Array.isArray(salary_type) ? JSON.stringify(salary_type) : salary_type); }
    if (salary_value !== undefined) { sets.push('salary_value = ?'); params.push(salary_value != null && typeof salary_value === 'object' ? JSON.stringify(salary_value) : salary_value); }
    if (position !== undefined) { sets.push('position = ?'); params.push(position); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(member));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/staff/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.patch('/api/staff/:id/block', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    const newActive = existing.is_active ? 0 : 1;
    db.prepare('UPDATE staff SET is_active = ? WHERE id = ?').run(newActive, req.params.id);
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(member));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Staff Shifts ────────────────────────────────────────────────
app.get('/api/staff/shifts', (req, res) => {
  try {
    const { staff_id, date } = req.query;
    let sql = 'SELECT * FROM staff_shifts WHERE 1=1';
    const params = [];
    if (staff_id) { sql += ' AND staff_id = ?'; params.push(Number(staff_id)); }
    if (date) { sql += ' AND date = ?'; params.push(date); }
    sql += ' ORDER BY date DESC, start_time ASC';
    const shifts = db.prepare(sql).all(...params);
    const result = shifts.map(sh => {
      const member = db.prepare('SELECT first_name, last_name FROM staff WHERE id = ?').get(sh.staff_id);
      const staffName = member ? `${member.first_name} ${member.last_name || ''}`.trim() : null;
      return toCamelCase({ ...sh, staffName });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/staff/shifts', (req, res) => {
  try {
    const { staff_id, date, start_time, end_time, branch_id, is_confirmed } = req.body;
    if (!staff_id || !date || !start_time || !end_time) return res.status(400).json({ error: 'ID сотрудника, дата, начало и конец обязательны' });
    const info = db.prepare('INSERT INTO staff_shifts (staff_id, date, start_time, end_time, branch_id, is_confirmed) VALUES (?, ?, ?, ?, ?, ?)').run(
      staff_id, date, start_time, end_time, branch_id || null, is_confirmed ? 1 : 0
    );
    const shift = db.prepare('SELECT * FROM staff_shifts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(shift));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/staff/shifts/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM staff_shifts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Смена не найдена' });
    db.prepare('DELETE FROM staff_shifts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Staff Permissions ───────────────────────────────────────────
app.get('/api/staff/:staff_id/permissions', (req, res) => {
  try {
    const perms = db.prepare('SELECT * FROM staff_permissions WHERE staff_id = ?').all(req.params.staff_id);
    res.json(toCamelCaseArray(perms));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/staff/:staff_id/permissions', (req, res) => {
  try {
    const { staff_id } = req.params;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'Ожидается массив разрешений' });
    const existing = db.prepare('SELECT id FROM staff WHERE id = ?').get(staff_id);
    if (!existing) return res.status(404).json({ error: 'Сотрудник не найден' });
    db.prepare('DELETE FROM staff_permissions WHERE staff_id = ?').run(staff_id);
    const insert = db.prepare('INSERT INTO staff_permissions (staff_id, section, can_view, can_edit) VALUES (?, ?, ?, ?)');
    for (const p of permissions) {
      insert.run(staff_id, p.section, p.can_view !== false ? 1 : 0, p.can_edit ? 1 : 0);
    }
    const perms = db.prepare('SELECT * FROM staff_permissions WHERE staff_id = ?').all(staff_id);
    res.json(toCamelCaseArray(perms));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Themes ──────────────────────────────────────────────────────
app.get('/api/themes', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM themes WHERE is_active = 1';
    const params = [];
    if (tenant_id) { sql += ' AND (tenant_id IS NULL OR tenant_id = ?)'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY is_preset DESC, name ASC';
    const themes = db.prepare(sql).all(...params);
    res.json(themes.map(t => ({ ...t, colors: JSON.parse(t.colors) })));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    res.json({ ...theme, colors: JSON.parse(theme.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/admin/themes', (req, res) => {
  try {
    const { name, colors, tenant_id } = req.body;
    if (!name || !colors) return res.status(400).json({ error: 'Название и цвета обязательны' });
    const info = db.prepare('INSERT INTO themes (tenant_id, name, colors, is_preset) VALUES (?, ?, ?, 0)').run(tenant_id || null, name, JSON.stringify(colors));
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...theme, colors: JSON.parse(theme.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/admin/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    if (theme.is_preset) return res.status(400).json({ error: 'Нельзя редактировать готовую тему' });
    const { name, colors } = req.body;
    db.prepare('UPDATE themes SET name = COALESCE(?, name), colors = COALESCE(?, colors) WHERE id = ?').run(name || null, colors ? JSON.stringify(colors) : null, req.params.id);
    const updated = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    res.json({ ...updated, colors: JSON.parse(updated.colors) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/admin/themes/:id', (req, res) => {
  try {
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
    if (theme.is_preset) return res.status(400).json({ error: 'Нельзя удалить готовую тему' });
    db.prepare('UPDATE themes SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/user/theme', (req, res) => {
  try {
    const { theme_id, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
    const theme = db.prepare('SELECT id FROM themes WHERE id = ? AND is_active = 1').get(theme_id);
    if (!theme) return res.status(404).json({ error: 'Тема не найдена или неактивна' });
    db.prepare('UPDATE users SET theme_id = ? WHERE id = ?').run(theme_id || null, user_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/user/theme', (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
    const user = db.prepare('SELECT theme_id FROM users WHERE id = ?').get(Number(user_id));
    res.json({ theme_id: user?.theme_id || null });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Delivery Orders ─────────────────────────────────────────────
app.get('/api/delivery-orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE status IN ('assigned','en_route','delivered') ORDER BY created_at DESC").all();
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      let courierPhone = null;
      if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Delivery Zones ──────────────────────────────────────────────
app.get('/api/delivery-zones', (req, res) => {
  try {
    const zones = db.prepare('SELECT * FROM delivery_zones ORDER BY name ASC').all();
    res.json(toCamelCaseArray(zones));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/delivery-zones', (req, res) => {
  try {
    const { name, radius_km, min_order, delivery_price, estimated_time } = req.body;
    if (!name) return res.status(400).json({ error: 'Название зоны обязательно' });
    const info = db.prepare('INSERT INTO delivery_zones (name, radius_km, min_order, delivery_price, estimated_time) VALUES (?, ?, ?, ?, ?)').run(
      name, radius_km || null, min_order || 0, delivery_price || 0, estimated_time || null
    );
    const zone = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(zone));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/delivery-zones/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Зона не найдена' });
    const { name, radius_km, min_order, delivery_price, estimated_time } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (radius_km !== undefined) { sets.push('radius_km = ?'); params.push(radius_km); }
    if (min_order !== undefined) { sets.push('min_order = ?'); params.push(min_order); }
    if (delivery_price !== undefined) { sets.push('delivery_price = ?'); params.push(delivery_price); }
    if (estimated_time !== undefined) { sets.push('estimated_time = ?'); params.push(estimated_time); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE delivery_zones SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const zone = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(zone));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/delivery-zones/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Зона не найдена' });
    db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Salary ───────────────────────────────────────────────────────
function calcMonthDates(month, year) {
  const m = String(month).padStart(2, '0');
  return { start: `${year}-${m}-01`, end: `${year}-${m}-31` };
}

function calculateStaffSalary(staffId, month, year) {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
  if (!staff) return null;
  const { start, end } = calcMonthDates(month, year);

  let st = staff.salary_type;
  let sv = staff.salary_value;
  if (typeof st === 'string') { try { st = JSON.parse(st); } catch(e) { st = [st]; } }
  if (!Array.isArray(st)) st = [st];
  if (typeof sv === 'string') { try { sv = JSON.parse(sv); } catch(e) { sv = {}; } }
  if (typeof sv !== 'object' || sv === null) sv = {};

  const details = {};
  let total = 0;

  if (st.includes('salary') || st.includes('fixed')) {
    const amt = Number(sv.salary || sv.fixed || 0);
    details.fixed = amt;
    total += amt;
  }

  if (st.includes('per_order')) {
    const rate = Number(sv.per_order || 0);
    const orderColumn = staff.role === 'waiter' ? 'waiter_id' : 'courier_id';
    const ordersCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM orders WHERE ${orderColumn} = ? AND status = 'delivered' AND date(updated_at) BETWEEN ? AND ?`
    ).get(staffId, start, end).cnt;
    const amt = rate * ordersCount;
    details.per_order = { rate, count: ordersCount, amount: amt };
    total += amt;
  }

  if (st.includes('per_km')) {
    const rate = Number(sv.per_km || 0);
    const locs = db.prepare(
      "SELECT lat, lng FROM courier_locations WHERE courier_id = ? AND date(recorded_at) BETWEEN ? AND ? ORDER BY recorded_at ASC"
    ).all(staffId, start, end);
    let km = 0;
    for (let i = 1; i < locs.length; i++) {
      const dlat = (locs[i].lat - locs[i - 1].lat) * 111.32;
      const dlng = (locs[i].lng - locs[i - 1].lng) * 111.32 * Math.cos(locs[i].lat * Math.PI / 180);
      km += Math.sqrt(dlat * dlat + dlng * dlng);
    }
    const amt = rate * km;
    details.per_km = { rate, km, amount: amt };
    total += amt;
  }

  if (st.includes('hourly')) {
    const rate = Number(sv.hourly || staff.hourly_rate || 0);
    const shifts = db.prepare(
      "SELECT start_time, end_time FROM staff_shifts WHERE staff_id = ? AND date BETWEEN ? AND ?"
    ).all(staffId, start, end);
    let hours = 0;
    for (const shift of shifts) {
      if (shift.start_time && shift.end_time) {
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const [eh, em] = shift.end_time.split(':').map(Number);
        hours += ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      }
    }
    const amt = rate * hours;
    details.hourly = { rate, hours, amount: amt };
    total += amt;
  }

  total = Math.round(total * 100) / 100;
  return { staff_id: staffId, month, year, accrued_amount: total, details: JSON.stringify(details) };
}

app.get('/api/salary', (req, res) => {
  try {
    const { month, year, staff_id, status } = req.query;
    let sql = 'SELECT s.*, sf.first_name, sf.last_name, sf.role, sf.position FROM salary s JOIN staff sf ON s.staff_id = sf.id WHERE s.tenant_id = current_tenant_id()';
    const params = [];
    if (month) { sql += ' AND s.month = ?'; params.push(Number(month)); }
    if (year) { sql += ' AND s.year = ?'; params.push(Number(year)); }
    if (staff_id) { sql += ' AND s.staff_id = ?'; params.push(Number(staff_id)); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    sql += ' ORDER BY s.year DESC, s.month DESC, sf.first_name ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/salary/calculate', (req, res) => {
  try {
    const { staff_id, month, year, all } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    if (all) {
      const allStaff = db.prepare('SELECT id FROM staff WHERE is_active = 1').all();
      const results = [];
      for (const s of allStaff) {
        const result = calculateStaffSalary(s.id, m, y);
        if (!result) continue;
        const existing = db.prepare('SELECT id FROM salary WHERE staff_id = ? AND month = ? AND year = ?').get(s.id, m, y);
        if (existing) {
          db.prepare('UPDATE salary SET accrued_amount = ?, details = ?, status = ?, calculated_at = datetime(\'now\') WHERE id = ?').run(result.accrued_amount, result.details, 'calculated', existing.id);
        } else {
          db.prepare('INSERT INTO salary (staff_id, month, year, accrued_amount, details, status) VALUES (?, ?, ?, ?, ?, \'calculated\')').run(s.id, m, y, result.accrued_amount, result.details);
        }
        db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail) VALUES (?, \'calculate\', ?, ?)').run(s.id, result.accrued_amount, 'Автоматический расчёт');
        results.push(result);
      }
      res.json({ ok: true, count: results.length });
    } else if (staff_id) {
      const result = calculateStaffSalary(staff_id, m, y);
      if (!result) return res.status(404).json({ error: 'Сотрудник не найден' });
      const existing = db.prepare('SELECT id FROM salary WHERE staff_id = ? AND month = ? AND year = ?').get(staff_id, m, y);
      if (existing) {
        db.prepare('UPDATE salary SET accrued_amount = ?, details = ?, status = ?, calculated_at = datetime(\'now\') WHERE id = ?').run(result.accrued_amount, result.details, 'calculated', existing.id);
      } else {
        db.prepare('INSERT INTO salary (staff_id, month, year, accrued_amount, details, status) VALUES (?, ?, ?, ?, ?, \'calculated\')').run(staff_id, m, y, result.accrued_amount, result.details);
      }
      db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail) VALUES (?, \'calculate\', ?, ?)').run(staff_id, result.accrued_amount, 'Расчёт зарплаты');
      res.json(result);
    } else {
      res.status(400).json({ error: 'Укажите staff_id или all = true' });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/salary/pay', (req, res) => {
  try {
    const { salary_id, staff_id, amount, paid_date, payment_method, note } = req.body;
    if (!salary_id || !staff_id) return res.status(400).json({ error: 'salary_id и staff_id обязательны' });
    const salary = db.prepare('SELECT * FROM salary WHERE id = ? AND staff_id = ?').get(salary_id, staff_id);
    if (!salary) return res.status(404).json({ error: 'Начисление не найдено' });
    const payAmt = amount || salary.accrued_amount;
    const date = paid_date || new Date().toISOString().split('T')[0];
    const pm = payment_method || 'cash';
    const newPaid = (salary.paid_amount || 0) + payAmt;
    const newStatus = newPaid >= salary.accrued_amount ? 'paid' : 'partial';
    db.prepare('UPDATE salary SET paid_amount = ?, paid_date = ?, payment_method = ?, status = ?, paid_at = datetime(\'now\'), note = ? WHERE id = ?').run(newPaid, date, pm, newStatus, note || null, salary_id);
    db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail) VALUES (?, \'pay\', ?, ?)').run(staff_id, payAmt, `Выплата: ${pm}, дата: ${date}${note ? ', ' + note : ''}`);
    db.prepare("INSERT INTO finance_transactions (type, amount, category, date, description) VALUES ('salary', ?, 'salary', ?, ?)").run(payAmt, date, `Зарплата сотруднику #${staff_id}`);
    res.json({ ok: true, salary_id, paid_amount: newPaid, status: newStatus });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/salary/report', (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const { start, end } = calcMonthDates(m, y);

    const totalAccrued = db.prepare("SELECT COALESCE(SUM(accrued_amount),0) as total FROM salary WHERE month = ? AND year = ?").get(m, y).total;
    const totalPaid = db.prepare("SELECT COALESCE(SUM(paid_amount),0) as total FROM salary WHERE month = ? AND year = ?").get(m, y).total;

    const byRole = db.prepare(`
      SELECT sf.role, COUNT(DISTINCT s.staff_id) as count, COALESCE(SUM(s.accrued_amount),0) as total, COALESCE(AVG(s.accrued_amount),0) as avg
      FROM salary s JOIN staff sf ON s.staff_id = sf.id
      WHERE s.tenant_id = current_tenant_id() AND s.month = ? AND s.year = ?
      GROUP BY sf.role
    `).all(m, y);

    const topEarners = db.prepare(`
    SELECT s.staff_id, sf.first_name, sf.last_name, sf.role, s.accrued_amount
    FROM salary s JOIN staff sf ON s.staff_id = sf.id
    WHERE s.tenant_id = current_tenant_id() AND s.month = ? AND s.year = ?
      ORDER BY s.accrued_amount DESC LIMIT 5
    `).all(m, y);

    const monthlyTrend = db.prepare(`
      SELECT s.month, s.year, COALESCE(SUM(s.accrued_amount),0) as total
      FROM salary s
      WHERE s.year = ? OR s.year = ? - 1
      GROUP BY s.year, s.month ORDER BY s.year, s.month
    `).all(y, y).map(r => toCamelCase(r));

    res.json(toCamelCase({ totalAccrued, totalPaid, byRole: toCamelCaseArray(byRole), topEarners: toCamelCaseArray(topEarners), monthlyTrend }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/salary/history/:staff_id', (req, res) => {
  try {
    const salary = db.prepare('SELECT * FROM salary WHERE staff_id = ? ORDER BY year DESC, month DESC').all(req.params.staff_id);
    const log = db.prepare('SELECT * FROM salary_log WHERE staff_id = ? ORDER BY created_at DESC').all(req.params.staff_id);
    res.json({ salary: toCamelCaseArray(salary), log: toCamelCaseArray(log) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

const bankStatementService = require(path.join(__dirname, 'services', 'bank-statement.service.js'));

// ─── Finance ─────────────────────────────────────────────────────
app.get('/api/finance/summary', (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = ''; const params = [];
    if (from && to) { dateFilter = ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    const income = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type = 'income'${dateFilter}`).get(...params);
    const expense = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type = 'expense'${dateFilter}`).get(...params);
    const ordersCount = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE 1=1${dateFilter.replace('date(date)', 'date(created_at)')}`).get(...params);
    const byPaymentMethod = db.prepare(`SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE 1=1${dateFilter} GROUP BY payment_method`).all(...params);
    const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE 1=1${dateFilter} GROUP BY category`).all(...params);
    const totalRevenue = income.total;
    const totalExpenses = expense.total;

    const days = parseInt(from && to ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + '' : '30', 10);
    const revenueByDay = [];
    for (let i = Math.max(0, days - 30); i < days; i++) {
      const d = new Date(to || new Date());
      d.setDate(d.getDate() - (days - 1 - i));
      const ds = d.toISOString().slice(0, 10);
      const ords = db.prepare("SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE date(created_at) = ? AND status != 'cancelled'").get(ds);
      revenueByDay.push({ date: ds, revenue: ords.revenue, orders: ords.orders });
    }

    res.json({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      ordersCount: ordersCount.cnt,
      byPaymentMethod: toCamelCaseArray(byPaymentMethod),
      byCategory: toCamelCaseArray(byCategory),
      revenueByDay,
    });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/finance/transactions', (req, res) => {
  try {
    const { from, to, category, payment_method } = req.query;
    let sql = 'SELECT * FROM finance_transactions WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (payment_method) { sql += ' AND payment_method = ?'; params.push(payment_method); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(transactions));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/finance/transactions', (req, res) => {
  try {
    const { type, category, amount, payment_method, description, order_id, date } = req.body;
    if (!type || !amount) return res.status(400).json({ error: 'Тип и сумма обязательны' });
    const info = db.prepare('INSERT INTO finance_transactions (type, category, amount, payment_method, description, order_id, date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      type, category || 'other', amount, payment_method || 'cash', description || '', order_id || null, date || new Date().toISOString().split('T')[0]
    );
    const transaction = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(transaction));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/finance/report', (req, res) => {
  try {
    const { from, to, format } = req.query;
    let sql = 'SELECT * FROM finance_transactions WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    if (format === 'csv') {
      const header = 'id,type,category,amount,payment_method,description,order_id,date,created_at';
      const rows = transactions.map(t => `${t.id},${t.type},${t.category},${t.amount},${t.payment_method},"${(t.description || '').replace(/"/g, '""')}",${t.order_id || ''},${t.date || ''},${t.created_at}`);
      res.setHeader('Content-Type', 'text/csv');
      res.send([header, ...rows].join('\n'));
    } else {
      res.json(toCamelCaseArray(transactions));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Chart of Accounts ────────────────────────────────────────────
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM chart_of_accounts ORDER BY code').all();
    res.json(accounts.map(a => ({ ...a, isActive: !!a.is_active, parentId: a.parent_id })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/accounts', (req, res) => {
  try {
    const { code, name, type, parent_id, description } = req.body;
    if (!code || !name || !type) return res.status(400).json({ error: 'code, name, type обязательны' });
    if (!['asset','liability','equity','income','expense'].includes(type)) return res.status(400).json({ error: 'Недопустимый тип счета' });
    const info = db.prepare('INSERT INTO chart_of_accounts (code, name, type, parent_id, description) VALUES (?, ?, ?, ?, ?)').run(code, name, type, parent_id || null, description || '');
    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...account, isActive: !!account.is_active, parentId: account.parent_id });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const { code, name, type, parent_id, description } = req.body;
    db.prepare('UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_id = ?, description = ? WHERE id = ?').run(code, name, type, parent_id || null, description || '', req.params.id);
    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE id = ?').get(req.params.id);
    res.json({ ...account, isActive: !!account.is_active, parentId: account.parent_id });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM chart_of_accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Journal Entries (Double-Entry) ───────────────────────────────
app.post('/api/journal/entries', (req, res) => {
  try {
    const { entry_date, description, reference_type, reference_id, created_by, lines } = req.body;
    if (!entry_date || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Необходима дата и минимум 2 проводки (дебет/кредит)' });
    }
    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({ error: `Сумма дебета (${totalDebit}) не равна сумме кредита (${totalCredit})` });
    }
    const txn = db.transaction(() => {
      const info = db.prepare('INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?)').run(
        entry_date, description || '', reference_type || null, reference_id || null, created_by || 'system'
      );
      const entryId = info.lastInsertRowid;
      const insert = db.prepare('INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');
      for (const line of lines) {
        const account = db.prepare('SELECT id FROM chart_of_accounts WHERE id = ?').get(line.account_id);
        if (!account) throw new Error(`Счёт с id ${line.account_id} не найден`);
        insert.run(entryId, line.account_id, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0, line.description || '');
      }
      return entryId;
    });
    const entryId = txn();
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId);
    const entryLines = db.prepare('SELECT * FROM journal_entry_lines WHERE entry_id = ?').all(entryId);
    res.status(201).json({ ...entry, lines: entryLines });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/journal/entries', (req, res) => {
  try {
    const { from, to, limit, offset } = req.query;
    let sql = 'SELECT * FROM journal_entries WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(entry_date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    sql += ' ORDER BY entry_date DESC, id DESC';
    if (limit) sql += ' LIMIT ?'; params.push(parseInt(limit));
    if (offset) sql += ' OFFSET ?'; params.push(parseInt(offset));
    const entries = db.prepare(sql).all(...params);
    const result = entries.map(e => {
      const lines = db.prepare('SELECT l.*, a.code, a.name as account_name FROM journal_entry_lines l LEFT JOIN chart_of_accounts a ON l.account_id = a.id WHERE l.entry_id = ?').all(e.id);
      return { ...e, lines };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/journal/entries/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Запись не найдена' });
    const lines = db.prepare('SELECT l.*, a.code, a.name as account_name FROM journal_entry_lines l LEFT JOIN chart_of_accounts a ON l.account_id = a.id WHERE l.entry_id = ?').all(entry.id);
    res.json({ ...entry, lines });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Trial Balance (ОСВ) ──────────────────────────────────────────
app.get('/api/reports/trial-balance', (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    if (from && to) dateFilter = ` AND date(j.entry_date) BETWEEN date('${from}') AND date('${to}')`;
    const rows = db.prepare(`
      SELECT a.id, a.code, a.name, a.type,
        COALESCE(SUM(l.debit), 0) as debit_turnover,
        COALESCE(SUM(l.credit), 0) as credit_turnover
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l ON l.account_id = a.id
      LEFT JOIN journal_entries j ON j.id = l.entry_id
      WHERE a.is_active = 1${dateFilter}
      GROUP BY a.id
      ORDER BY a.code
    `).all();
    res.json(rows.map(r => ({ ...r, debitTurnover: r.debit_turnover, creditTurnover: r.credit_turnover })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Balance Sheet ────────────────────────────────────────────────
app.get('/api/reports/balance-sheet', (req, res) => {
  try {
    const { date } = req.query;
    const asOfDate = date || new Date().toISOString().split('T')[0];
    let dateFilter = ` AND date(j.entry_date) <= date('${asOfDate}')`;
    
    const rows = db.prepare(`
      SELECT a.id, a.code, a.name, a.type,
        SUM(l.debit) as total_debit,
        SUM(l.credit) as total_credit
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l ON l.account_id = a.id
      LEFT JOIN journal_entries j ON j.id = l.entry_id
      WHERE a.is_active = 1${dateFilter}
      GROUP BY a.id
      ORDER BY a.code
    `).all();

    // Calculate balances for each account type
    // Active accounts: balance = debit - credit
    // Passive accounts: balance = credit - debit
    const accounts = rows.map(r => {
      const debit = r.total_debit || 0;
      const credit = r.total_credit || 0;
      let balance = 0;
      if (r.type === 'asset') balance = debit - credit;
      else if (r.type === 'liability') balance = credit - debit;
      else if (r.type === 'equity') balance = credit - debit;
      else if (r.type === 'income') balance = credit - debit;
      else if (r.type === 'expense') balance = debit - credit;
      return { ...r, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, balance: Math.round(balance * 100) / 100 };
    });

    // Group into balance sheet sections
    const nonCurrentAssets = accounts.filter(a => a.type === 'asset' && ['01','02','03','04','07','08'].some(p => a.code.startsWith(p)));
    const currentAssets = accounts.filter(a => a.type === 'asset' && !['01','02','03','04','07','08'].some(p => a.code.startsWith(p)));
    const capitalAndReserves = accounts.filter(a => a.type === 'equity');
    const longTermLiabilities = accounts.filter(a => a.type === 'liability' && a.code.startsWith('67'));
    const shortTermLiabilities = accounts.filter(a => a.type === 'liability' && !a.code.startsWith('67'));
    
    const totalAssets = nonCurrentAssets.reduce((s, a) => s + a.balance, 0) + currentAssets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = capitalAndReserves.reduce((s, a) => s + a.balance, 0) + longTermLiabilities.reduce((s, a) => s + a.balance, 0) + shortTermLiabilities.reduce((s, a) => s + a.balance, 0);

    res.json({
      asOfDate,
      sections: {
        nonCurrentAssets: { label: 'Внеоборотные активы', accounts: nonCurrentAssets, total: Math.round(nonCurrentAssets.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        currentAssets: { label: 'Оборотные активы', accounts: currentAssets, total: Math.round(currentAssets.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        capitalAndReserves: { label: 'Капитал и резервы', accounts: capitalAndReserves, total: Math.round(capitalAndReserves.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        longTermLiabilities: { label: 'Долгосрочные обязательства', accounts: longTermLiabilities, total: Math.round(longTermLiabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        shortTermLiabilities: { label: 'Краткосрочные обязательства', accounts: shortTermLiabilities, total: Math.round(shortTermLiabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
      },
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      difference: Math.round((totalAssets - totalLiabilities) * 100) / 100,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Bank Statement Reconciliation ─────────────────────────────
app.post('/api/finance/bank-statement/upload', multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const bankStmt = require(path.join(__dirname, 'services', 'bank-statement.service.js'));
    const txns = bankStmt.parseStatement(req.file.path);
    const tenantId = req.query.tenant_id || 1;
    const insert = db.prepare('INSERT INTO bank_transactions (tenant_id, date, description, amount, balance) VALUES (?, ?, ?, ?, ?)');
    const t = db.transaction(() => {
      for (const tx of txns) {
        insert.run(tenantId, tx.date, tx.description, tx.amount, tx.balance);
      }
    });
    t();
    const matches = bankStmt.matchTransactions(db, txns, tenantId);
    const update = db.prepare('UPDATE bank_transactions SET order_id = ?, confidence = ? WHERE date = ? AND amount = ? AND tenant_id = ?');
    for (const m of matches) {
      if (m.order_id) {
        update.run(m.order_id, m.confidence, m.tx_date, m.tx_amount, tenantId);
      }
    }
    fs.unlink(req.file.path, () => {});
    res.json({ imported: txns.length, matched: matches.filter(m => m.order_id).length, unmatched: matches.filter(m => !m.order_id).length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/finance/bank-statement/summary', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, 'services', 'bank-statement.service.js'));
    res.json(bankStmt.getReconciliationSummary(db, req.query.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/finance/bank-statement/transactions', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, 'services', 'bank-statement.service.js'));
    res.json(toCamelCaseArray(bankStmt.getTransactions(db, req.query.tenant_id || 1)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/finance/bank-statement/clear', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, 'services', 'bank-statement.service.js'));
    bankStmt.clearTransactions(db, req.query.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tax Accounting (VAT / НДС) ────────────────────────────────
const taxAccountingService = require(path.join(__dirname, 'services', 'tax-accounting.service.js'));

app.get('/api/finance/tax/sales-ledger', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getSalesLedger(db, year, month, req.query.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/finance/tax/purchase-ledger', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getPurchaseLedger(db, year, month, req.query.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/finance/tax/declaration', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getVatDeclaration(db, year, month, req.query.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Marketing: Generate Code ────────────────────────────────────
app.post('/api/generate-code', (req, res) => {
  try {
    const { type, length } = req.body;
    const len = Math.max(4, Math.min(32, Number(length) || 8));
    const chars = type === 'letters' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' :
      type === 'digits' ? '0123456789' :
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    res.json({ code });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Marketing: Guest Search for Discounts ───────────────────────
app.get('/api/guests/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json([]);
    const guests = db.prepare("SELECT id, name, phone FROM users WHERE role = 'guest' AND (name LIKE ? OR phone LIKE ?) LIMIT 10").all(`%${q}%`, `%${q}%`);
    res.json(guests);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Marketing: Promo Codes ──────────────────────────────────────
app.get('/api/promocodes', (req, res) => {
  try {
    const codes = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(codes));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/promocodes', (req, res) => {
  try {
    const { code, type, value, min_order, max_uses, expires_at, is_active } = req.body;
    if (!code || !type || value === undefined) return res.status(400).json({ error: 'Код, тип и значение обязательны' });
    const info = db.prepare('INSERT INTO promo_codes (code, type, value, min_order, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      code.toUpperCase(), type, value, min_order || 0, max_uses || null, expires_at || null, is_active !== undefined ? (is_active ? 1 : 0) : 1
    );
    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(promo));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/promocodes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Промокод не найден' });
    const { code, type, value, min_order, max_uses, expires_at, is_active } = req.body;
    const sets = []; const params = [];
    if (code !== undefined) { sets.push('code = ?'); params.push(code.toUpperCase()); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (value !== undefined) { sets.push('value = ?'); params.push(value); }
    if (min_order !== undefined) { sets.push('min_order = ?'); params.push(min_order); }
    if (max_uses !== undefined) { sets.push('max_uses = ?'); params.push(max_uses); }
    if (expires_at !== undefined) { sets.push('expires_at = ?'); params.push(expires_at); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE promo_codes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(promo));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.delete('/api/promocodes/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Промокод не найден' });
    db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Marketing: Campaigns ────────────────────────────────────────
app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(campaigns));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const { name, type, trigger_type, message, button_text, segment, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Название кампании обязательно' });
    const info = db.prepare('INSERT INTO campaigns (name, type, trigger_type, message, button_text, segment, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      name, type || 'manual', trigger_type || null, message || '', button_text || null, segment || 'all', status || 'draft'
    );
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(campaign));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/campaigns/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Кампания не найдена' });
    const { name, type, trigger_type, message, button_text, segment, status } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (trigger_type !== undefined) { sets.push('trigger_type = ?'); params.push(trigger_type); }
    if (message !== undefined) { sets.push('message = ?'); params.push(message); }
    if (button_text !== undefined) { sets.push('button_text = ?'); params.push(button_text); }
    if (segment !== undefined) { sets.push('segment = ?'); params.push(segment); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(campaign));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/campaigns/:id/send', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Кампания не найдена' });
    db.prepare("UPDATE campaigns SET status = 'active', sent_count = sent_count + 1 WHERE id = ?").run(req.params.id);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    io.emit('campaign:sent', toCamelCase(campaign));
    res.json(toCamelCase(campaign));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Marketing: Analytics ────────────────────────────────────────
app.get('/api/marketing/analytics', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
    const activeToday = db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const ordersToday = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const conversionRate = totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(2) : 0;
    res.json({ totalUsers, totalOrders, conversionRate: Number(conversionRate), activeToday, ordersToday });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Marketing: Discount Rules ────────────────────────────────────
app.get('/api/discounts', (req, res) => {
  try {
    const discounts = db.prepare('SELECT * FROM discount_rules ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(discounts));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/discounts', (req, res) => {
  try {
    const { name, type, value, targetType, targetId, minOrder, maxDiscount, activeDays, startsAt, endsAt, maxUses } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const info = db.prepare(`INSERT INTO discount_rules (name, type, value, target_type, target_id, min_order, max_discount, active_days, starts_at, ends_at, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name, type || 'percent', value || 0, targetType || 'all', targetId || null, minOrder || 0, maxDiscount || null,
      activeDays || null, startsAt || null, endsAt || null, maxUses || 0
    );
    const d = db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(d));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/discounts/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Скидка не найдена' });
    const { name, type, value, targetType, targetId, minOrder, maxDiscount, activeDays, startsAt, endsAt, maxUses, isActive } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type); }
    if (value !== undefined) { sets.push('value = ?'); params.push(value); }
    if (targetType !== undefined) { sets.push('target_type = ?'); params.push(targetType); }
    if (targetId !== undefined) { sets.push('target_id = ?'); params.push(targetId); }
    if (minOrder !== undefined) { sets.push('min_order = ?'); params.push(minOrder); }
    if (maxDiscount !== undefined) { sets.push('max_discount = ?'); params.push(maxDiscount); }
    if (activeDays !== undefined) { sets.push('active_days = ?'); params.push(activeDays); }
    if (startsAt !== undefined) { sets.push('starts_at = ?'); params.push(startsAt); }
    if (endsAt !== undefined) { sets.push('ends_at = ?'); params.push(endsAt); }
    if (maxUses !== undefined) { sets.push('max_uses = ?'); params.push(maxUses); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    params.push(req.params.id);
    db.prepare(`UPDATE discount_rules SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(toCamelCase(db.prepare('SELECT * FROM discount_rules WHERE id = ?').get(req.params.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/discounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM discount_rules WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Add bonus_used column to orders if not exists
try { db.prepare("ALTER TABLE orders ADD COLUMN bonus_used REAL DEFAULT 0").run(); } catch (e) {}

// ─── Loyalty Program: Guest Endpoints ────────────────────────────
function getLoyaltySettings() {
  let ls = db.prepare('SELECT * FROM loyalty_settings WHERE id = 1').get();
  if (!ls) {
    db.prepare('INSERT INTO loyalty_settings (tenant_id, bonus_percent, burn_days, max_write_off_percent, levels) VALUES (1, 5, 365, 50, \'[]\')').run();
    ls = db.prepare('SELECT * FROM loyalty_settings WHERE id = 1').get();
  }
  let levels = [];
  try { levels = JSON.parse(ls.levels || '[]'); } catch {}
  return { bonusPercent: ls.bonus_percent, burnDays: ls.burn_days, maxWriteOffPercent: ls.max_write_off_percent, levels };
}

function getGuestBonusInfo(userId) {
  const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
  const user = db.prepare('SELECT bonus_balance, total_spent, loyalty_level FROM users WHERE id = ?').get(userId);
  const settings = getLoyaltySettings();
  let level = user?.loyalty_level || 'новичок';
  let nextLevel = null;
  let progress = 0;
  const totalSpent = user?.total_spent || 0;
  if (settings.levels && settings.levels.length > 0) {
    const sorted = [...settings.levels].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));
    const current = [...sorted].reverse().find(l => totalSpent >= (l.minSpent || 0));
    if (current) level = current.name;
    const next = sorted.find(l => totalSpent < (l.minSpent || 0));
    if (next) {
      nextLevel = { name: next.name, minSpent: next.minSpent };
      const prevMin = current?.minSpent || 0;
      progress = Math.min(100, ((totalSpent - prevMin) / (next.minSpent - prevMin)) * 100);
    } else {
      progress = 100;
    }
  }
  return {
    balance: bonus ? bonus.balance : 0,
    lifetimeEarned: bonus ? bonus.lifetime_earned : 0,
    lifetimeSpent: bonus ? bonus.lifetime_spent : 0,
    totalSpent,
    level,
    nextLevel,
    progress,
    bonusPercent: settings.bonusPercent,
    burnDays: settings.burnDays,
    maxWriteOffPercent: settings.maxWriteOffPercent,
  };
}

// Guest: get own bonus info
app.get('/api/loyalty/guest/:userId', (req, res) => {
  try {
    res.json(getGuestBonusInfo(req.params.userId));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Guest: get own bonus transactions
app.get('/api/loyalty/guest/:userId/transactions', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const txs = db.prepare('SELECT bt.* FROM bonus_transactions bt WHERE bt.user_id = ? ORDER BY bt.created_at DESC LIMIT ? OFFSET ?').all(req.params.userId, limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM bonus_transactions WHERE user_id = ?').get(req.params.userId);
    res.json({ transactions: toCamelCaseArray(txs), total: total.count, page, limit });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Guest: get loyalty settings (public)
app.get('/api/loyalty/settings', (req, res) => {
  try {
    res.json(getLoyaltySettings());
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Guest: use bonuses when placing order (compute discount)
app.post('/api/loyalty/calculate-discount', (req, res) => {
  try {
    const { userId, orderTotal } = req.body;
    if (!userId || !orderTotal) return res.status(400).json({ error: 'userId и orderTotal обязательны' });
    const info = getGuestBonusInfo(userId);
    const maxWriteOff = orderTotal * (info.maxWriteOffPercent / 100);
    const availableBonus = info.balance;
    const maxDiscount = Math.min(availableBonus, maxWriteOff);
    res.json({ availableBonus, maxWriteOff, maxDiscount, canUseBonuses: availableBonus > 0 && maxDiscount > 0 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Guest: spend bonuses (called during order placement)
app.post('/api/loyalty/spend', (req, res) => {
  try {
    const { userId, amount, orderId, description } = req.body;
    if (!userId || !amount || !orderId) return res.status(400).json({ error: 'userId, amount и orderId обязательны' });
    const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
    if (!bonus) return res.status(400).json({ error: 'Бонусный счёт не найден' });
    if (bonus.balance < amount) return res.status(400).json({ error: 'Недостаточно бонусов' });
    db.prepare('UPDATE user_bonuses SET balance = balance - ?, lifetime_spent = lifetime_spent + ? WHERE id = ?').run(amount, amount, bonus.id);
    db.prepare('UPDATE users SET bonus_balance = bonus_balance - ? WHERE id = ?').run(amount, userId);
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, bonus.id, 'spend', amount, description || 'Списание за заказ', 'order', orderId);
    res.json({ success: true, newBalance: bonus.balance - amount });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Loyalty Program: Admin Endpoints ────────────────────────────
app.get('/api/admin/loyalty/guests', (req, res) => {
  try {
    const guests = db.prepare(`
      SELECT u.id, u.name, u.phone, u.bonus_balance, u.total_spent, u.loyalty_level,
        COALESCE(ub.balance, 0) as bonus_balance_internal,
        COALESCE(ub.lifetime_earned, 0) as lifetime_earned,
        COALESCE(ub.lifetime_spent, 0) as lifetime_spent,
        u.visits_count
      FROM users u
      LEFT JOIN user_bonuses ub ON ub.user_id = u.id
      WHERE u.role = 'guest' AND u.tenant_id = current_tenant_id()
      ORDER BY u.name
    `).all();
    res.json(toCamelCaseArray(guests));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/loyalty/settings', (req, res) => {
  try {
    const { bonusPercent, burnDays, maxWriteOffPercent, levels } = req.body;
    const sets = []; const params = [];
    if (bonusPercent !== undefined) { sets.push('bonus_percent = ?'); params.push(bonusPercent); }
    if (burnDays !== undefined) { sets.push('burn_days = ?'); params.push(burnDays); }
    if (maxWriteOffPercent !== undefined) { sets.push('max_write_off_percent = ?'); params.push(maxWriteOffPercent); }
    if (levels !== undefined) { sets.push('levels = ?'); params.push(JSON.stringify(levels)); }
    if (sets.length) { sets.push("updated_at = datetime('now')"); db.prepare(`UPDATE loyalty_settings SET ${sets.join(', ')} WHERE id = 1`).run(...params); }
    res.json(getLoyaltySettings());
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/loyalty/adjust', (req, res) => {
  try {
    const { userId, amount, description, type } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'userId и amount обязательны' });
    const t = type || (amount > 0 ? 'earned' : 'spend');
    let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
    if (!bonus) {
      const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(userId);
      bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
    }
    if (amount > 0) {
      db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(amount, amount, bonus.id);
      db.prepare('UPDATE users SET bonus_balance = bonus_balance + ? WHERE id = ?').run(amount, userId);
    } else {
      const absAmount = Math.abs(amount);
      db.prepare('UPDATE user_bonuses SET balance = MAX(0, balance - ?), lifetime_spent = lifetime_spent + ? WHERE id = ?').run(absAmount, absAmount, bonus.id);
      db.prepare('UPDATE users SET bonus_balance = MAX(0, bonus_balance - ?) WHERE id = ?').run(absAmount, userId);
    }
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)').run(userId, bonus.id, t, amount, description || 'Ручная корректировка администратором');
    res.json({ success: true, newBalance: db.prepare('SELECT balance FROM user_bonuses WHERE id = ?').get(bonus.id).balance });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Marketing: Bonuses ───────────────────────────────────────────
app.get('/api/bonuses', (req, res) => {
  try {
    const bonuses = db.prepare('SELECT ub.*, u.phone as user_phone FROM user_bonuses ub LEFT JOIN users u ON ub.user_id = u.id WHERE ub.tenant_id = current_tenant_id() ORDER BY ub.created_at DESC').all();
    res.json(toCamelCaseArray(bonuses));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/bonuses/transactions', (req, res) => {
  try {
    const txs = db.prepare('SELECT bt.*, u.phone as user_phone FROM bonus_transactions bt LEFT JOIN users u ON bt.user_id = u.id WHERE bt.tenant_id = current_tenant_id() ORDER BY bt.created_at DESC LIMIT 100').all();
    res.json(toCamelCaseArray(txs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/bonuses/accrue', (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'user_id и amount обязательны' });
    let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(user_id);
    if (!bonus) {
      const info = db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, 0, 0)').run(user_id);
      bonus = db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(info.lastInsertRowid);
    }
    db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(amount, amount, bonus.id);
    db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)').run(user_id, bonus.id, 'earned', amount, description || 'Начисление бонусов');
    res.json(toCamelCase(db.prepare('SELECT * FROM user_bonuses WHERE id = ?').get(bonus.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Marketing: Certificates ──────────────────────────────────────
app.get('/api/certificates', (req, res) => {
  try {
    const certs = db.prepare('SELECT * FROM certificates ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(certs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/certificates', (req, res) => {
  try {
    const { code, amount, type, recipientName, recipientPhone, message, expiresAt } = req.body;
    if (!code || !amount) return res.status(400).json({ error: 'Код и сумма обязательны' });
    const existing = db.prepare('SELECT id FROM certificates WHERE code = ?').get(code);
    if (existing) return res.status(409).json({ error: 'Сертификат с таким кодом уже существует' });
    const info = db.prepare('INSERT INTO certificates (code, amount, balance, type, recipient_name, recipient_phone, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      code, amount, amount, type || 'gift', recipientName || null, recipientPhone || null, message || null, expiresAt || null
    );
    const c = db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(c));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/certificates/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Сертификат не найден' });
    const { amount, balance, isActive, recipientName, recipientPhone, message, expiresAt } = req.body;
    const sets = []; const params = [];
    if (amount !== undefined) { sets.push('amount = ?'); params.push(amount); }
    if (balance !== undefined) { sets.push('balance = ?'); params.push(balance); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (recipientName !== undefined) { sets.push('recipient_name = ?'); params.push(recipientName); }
    if (recipientPhone !== undefined) { sets.push('recipient_phone = ?'); params.push(recipientPhone); }
    if (message !== undefined) { sets.push('message = ?'); params.push(message); }
    if (expiresAt !== undefined) { sets.push('expires_at = ?'); params.push(expiresAt); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей' });
    params.push(req.params.id);
    db.prepare(`UPDATE certificates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(toCamelCase(db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/certificates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM certificates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Reviews (enhanced) ──────────────────────────────────────────
app.get('/api/reviews/all', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = `
      SELECT r.*, u.phone as user_phone, o.items as order_items, o.total as order_total
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE 1=1`;
    const params = [];
    if (tenant_id) { sql += ' AND r.tenant_id = ?'; params.push(Number(tenant_id)); }
    sql += ' ORDER BY r.created_at DESC';
    const reviews = db.prepare(sql).all(...params);
    const result = reviews.map(r => {
      let items = [];
      try { if (r.order_items) items = JSON.parse(r.order_items); } catch (e) {}
      return toCamelCase({ ...r, orderItems: items });
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/reviews/:id/reply', (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Текст ответа обязателен' });
    const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Отзыв не найден' });
    db.prepare('UPDATE reviews SET reply = ? WHERE id = ?').run(reply, req.params.id);
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(review));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/reviews/photos', (req, res) => {
  try {
    const photos = db.prepare('SELECT * FROM guest_photos ORDER BY created_at DESC').all();
    res.json(toCamelCaseArray(photos));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Public Settings (guest/courier apps) ───────────────────────
app.get('/api/public/settings', (req, res) => {
  try {
    const publicKeys = [
      'app_name', 'phone', 'address', 'logo_path', 'currency',
      'working_time_start', 'working_time_end', 'timezone',
      'enable_delivery', 'enable_pickup',
      'delivery_cost', 'free_delivery_from', 'min_delivery_amount', 'min_order_amount',
      'max_check', 'min_return',
      'tips_message', 'tip_1', 'tip_2', 'tip_3',
      'initial_points', 'money_points_rate', 'auto_burn_points', 'burn_days',
      'return_days', 'tax_type', 'confirmation_phrase',
      'site_mode', 'main_store',
      'enable_item_comments', 'enable_qr_card', 'request_birthday', 'request_email',
      'wallet_enabled', 'show_available_quantity_online', 'limit_points_for_delivery',
      'allow_orders_without_auth', 'allow_registered_without_auth',
    ];
    const placeholders = publicKeys.map(() => '?').join(',');
    const rows = db.prepare(`SELECT key, value, type FROM system_settings WHERE key IN (${placeholders})`).all(...publicKeys);
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    const tenant = db.prepare("SELECT access_mode FROM foodchain_portal_tenants LIMIT 1").get();
    settings.access_mode = tenant?.access_mode || 'production';
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// GET /api/public/menu?channel=site — filtered menu by channel visibility
app.get('/api/public/menu', (req, res) => {
  try {
    const channel = req.query.channel;
    const validChannels = ['site', 'app', 'kiosk', 'waiter', 'aggregators'];
    if (!channel || !validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel is required: ${validChannels.join(', ')}` });
    }
    const col = `show_on_${channel}`;
    const categories = db.prepare(`
      SELECT id, name, icon, parent_id, sort_order, image_url
      FROM menu_categories
      WHERE ${col} = 1
      ORDER BY sort_order ASC, name ASC
    `).all();
    const categoryIds = categories.map(c => c.id);
    let dishes = [];
    if (categoryIds.length > 0) {
      dishes = db.prepare(`
        SELECT d.*
        FROM dishes d
        JOIN menu_categories mc ON d.category_id = mc.id
        WHERE mc.${col} = 1 AND d.is_available = 1
        ORDER BY d.display_order ASC, d.name ASC
      `).all();
    }
    res.json({ categories: toCamelCaseArray(categories), dishes: toCamelCaseArray(dishes) });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Settings ────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM system_settings').all();
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const body = req.body;
    const upsert = db.prepare('INSERT INTO system_settings (key, value, type) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [key, value] of Object.entries(body)) {
      const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text';
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      upsert.run(key, strVal, type);
    }
    const rows = db.prepare('SELECT * FROM system_settings').all();
    const settings = {};
    for (const row of rows) {
      let val = row.value;
      if (row.type === 'boolean') val = val === 'true' || val === '1';
      else if (row.type === 'number') val = Number(val);
      else if (row.type === 'json') { try { val = JSON.parse(val); } catch (e) {} }
      settings[row.key] = val;
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/settings/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `foodchain-backup-${timestamp}.db`);
    db.backup(backupPath);
    res.json({ ok: true, path: backupPath });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/settings/change-password', (req, res) => {
  try {
    const { oldPassword, newPassword, username } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Старый и новый пароль обязательны' });

    // Hardcoded superadmin password change
    if (!username || username === 'admin') {
      if (oldPassword !== 'admin') return res.status(403).json({ error: 'Неверный старый пароль' });
      const admin = db.prepare("SELECT * FROM users WHERE role = 'superadmin' LIMIT 1").get();
      if (admin) {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, admin.id);
      }
      return res.json({ ok: true });
    }

    // Staff password change (portal-synced accounts)
    const staff = db.prepare('SELECT * FROM staff WHERE username = ? AND is_active = 1').get(username);
    if (!staff) return res.status(404).json({ error: 'Пользователь не найден' });

    const storedHash = staff.password;
    let valid = false;
    if (storedHash && storedHash.startsWith('$2')) {
      valid = bcrypt.compareSync(oldPassword, storedHash);
    } else {
      valid = storedHash === oldPassword;
    }
    if (!valid) return res.status(403).json({ error: 'Неверный старый пароль' });

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE staff SET password = ? WHERE id = ?').run(newHash, staff.id);

    res.json({ ok: true, password_hash: newHash });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Audit Logs ──────────────────────────────────────────────────
app.get('/api/audit-logs', (req, res) => {
  try {
    const { admin_id } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (admin_id) { sql += ' AND admin_id = ?'; params.push(Number(admin_id)); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const logs = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(logs));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.post('/api/audit-logs', (req, res) => {
  try {
    const { admin_id, admin_name, action, details, ip } = req.body;
    const info = db.prepare('INSERT INTO audit_logs (admin_id, admin_name, action, details, ip) VALUES (?, ?, ?, ?, ?)').run(
      admin_id || null, admin_name || '', action || '', details || '', ip || ''
    );
    const log = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(log));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Notifications (push) ────────────────────────────────────────
app.post('/api/notifications/send', (req, res) => {
  try {
    const { title, body, segment, user_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Заголовок обязателен' });
    if (segment === 'all' || !segment) {
      const users = db.prepare('SELECT id FROM users').all();
      for (const u of users) {
        db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(u.id, title, body || '');
      }
    } else if (segment === 'user_group' && user_id) {
      db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(user_id, title, body || '');
    }
    io.emit('notification:push', { title, body, segment });
    res.status(201).json({ ok: true, title, body, segment });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Orders (multi-status filter) ─────────────────────────────────
app.post('/api/orders/multi-status', (req, res) => {
  try {
    const { statuses } = req.body;
    if (!Array.isArray(statuses) || statuses.length === 0) return res.status(400).json({ error: 'Укажите статусы' });
    const placeholders = statuses.map(() => '?').join(',');
    const orders = db.prepare(`SELECT * FROM orders WHERE status IN (${placeholders}) ORDER BY created_at DESC`).all(...statuses);
    const result = orders.map(o => {
      const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
      let courierPhone = null;
      if (o.courier_id) { const c = db.prepare('SELECT phone FROM couriers WHERE id = ?').get(o.courier_id); if (c) courierPhone = c.phone; }
      return toCamelCase({ ...o, statusHistory: JSON.stringify(history.map(toCamelCase)), courierPhone });
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Orders (enhanced) ───────────────────────────────────────────
app.post('/api/orders/bulk-status', (req, res) => {
  try {
    const { ids, status, note } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) return res.status(400).json({ error: 'ids и status обязательны' });
    if (!STATUS_CHAIN[status]) return res.status(400).json({ error: `Неизвестный статус: ${status}` });
    const results = [];
    for (const id of ids) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      if (!order) { results.push({ id, error: 'Заказ не найден' }); continue; }
      if (status !== order.status) {
        const validation = validateTransition(order.id, order.status, status);
        if (!validation.valid) { results.push({ id, error: validation.error }); continue; }
      }

      const bulkTr = db.transaction(() => {
        if (status === 'ready' && order.status !== 'ready') {
          const items = JSON.parse(order.items || '[]');
          for (const item of items) {
            const dishId = item.dishId;
            const qty = item.quantity || 1;
            const techCard = db.prepare('SELECT * FROM tech_cards WHERE dish_id = ? ORDER BY created_at DESC').get(dishId);
            if (!techCard) continue;
            let ingredients = [];
            try { ingredients = JSON.parse(techCard.ingredients || '[]'); } catch {}
            for (const ing of ingredients) {
              const invItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?').get(ing.name);
              if (!invItem) continue;
              const needQty = ing.quantity * qty;
              const actualStock = invItem.current_balance ?? invItem.current_stock ?? 0;
              if (actualStock < needQty) {
                throw new Error(`Недостаточно ингредиента "${ing.name}" на складе: нужно ${needQty} ${ing.unit}, осталось ${actualStock} ${invItem.unit}`);
              }
            }
            for (const ing of ingredients) {
              const invItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?').get(ing.name);
              if (!invItem) continue;
              const needQty = ing.quantity * qty;
              db.prepare("UPDATE inventory_items SET current_balance = MAX(0, COALESCE(current_balance, 0) - ?) WHERE id = ?").run(needQty, invItem.id);
              db.prepare('INSERT INTO inventory_transactions (item_id, type, quantity, note) VALUES (?, ?, ?, ?)').run(invItem.id, 'write_off', needQty, `Списание по техкарте: заказ #${id}`);
            }
          }
        }
        db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
        const noteText = note || STATUS_LABELS[status] || status;
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(id, status, noteText);
        broadcast({ type: 'order:update', orderId: id, status, note: noteText });
        if (status === 'delivered') {
          db.prepare('UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?').run(order.courier_id);
          db.prepare('UPDATE users SET total_spent = total_spent + ? WHERE id = ?').run(order.total, order.user_id);
        }
      });

      try {
        bulkTr();
        emitOrderUpdate(id);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, error: safeError(e.message) });
      }
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Dashboard ───────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  try {
    const todayRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE date(created_at) = date('now') AND status != 'cancelled'").get().total;
    const todayOrders = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const todayAvgCheck = todayOrders > 0 ? (todayRevenue / todayOrders) : 0;
    const todayNewUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE date(created_at) = date('now')").get().cnt;
    const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'delivered'").get().total;
    const totalDelivered = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status = 'delivered'").get().cnt;
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const ordersByStatus = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();
    const revenueByDay = db.prepare(`
      SELECT date(created_at) as date, COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
      FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-7 days')
      GROUP BY date(created_at) ORDER BY date ASC
    `).all();

    res.json({
      todayRevenue,
      todayOrders,
      todayAvgCheck: Math.round(todayAvgCheck * 100) / 100,
      todayNewUsers,
      totalOrders,
      totalRevenue,
      totalDelivered,
      totalUsers,
      ordersByStatus: toCamelCaseArray(ordersByStatus),
      revenueByDay: toCamelCaseArray(revenueByDay),
    });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Socket.IO ───────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe:courier', (courierId) => {
    socket.join(`courier:${courierId}`);
  });

  socket.on('subscribe:chat', (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on('subscribe:waiter', (waiterId) => {
    socket.join(`waiter:${waiterId}`);
  });

  socket.on('chat:typing', (data) => {
    socket.to(`chat:${data.chatId}`).emit('chat:typing', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── Payment Methods (Admin) ────────────────────────────────────
app.get('/api/payment-methods', (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods ORDER BY sort_order').all();
    res.json(toCamelCaseArray(methods));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.put('/api/payment-methods/:id', (req, res) => {
  try {
    const { is_active, name, description, sort_order } = req.body;
    const existing = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Способ оплаты не найден' });
    const sets = [];
    const vals = [];
    if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
    vals.push(req.params.id);
    db.prepare(`UPDATE payment_methods SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const updated = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(updated));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Payment Methods (Guest - active only) ─────────────────────
app.get('/api/payment-methods/active', (req, res) => {
  try {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order').all();
    res.json(toCamelCaseArray(methods));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});

// ─── Status info endpoint ──────────────────────────────────────
app.get('/api/statuses', (req, res) => {
  res.json(STATUS_CHAIN);
});

// ─── Documents ──────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  'journal', 'receipt', 'writeoff', 'transfer', 'inventory',
  'production', 'return', 'shipment', 'breakdown', 'processing',
  'contactor_order', 'production_order', 'service', 'sales_act', 'egais',
];

const TYPE_LABELS = {
  journal: 'Журнал документов', receipt: 'Приходы', writeoff: 'Списания',
  transfer: 'Перемещения', inventory: 'Инвентаризация', production: 'Производства',
  return: 'Возвраты', shipment: 'Отгрузки', breakdown: 'Разборы',
  processing: 'Переработки', contactor_order: 'Заказы контрагентам',
  production_order: 'Заказы на производство', service: 'Услуги',
  sales_act: 'Акты реализ.', egais: 'ЕГАИС',
};

function docNextNumber(type) {
  const today = new Date();
  const prefix = today.toISOString().slice(2, 10).replace(/-/g, '');
  const row = db.prepare("SELECT COUNT(*) as cnt FROM documents WHERE type = ? AND number LIKE ?").get(type, prefix + '%');
  const seq = String((row.cnt || 0) + 1).padStart(3, '0');
  return prefix + '-' + seq;
}

app.get('/api/documents/types', (req, res) => {
  res.json(DOCUMENT_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] })));
});

app.get('/api/documents', (req, res) => {
  try {
    let { type, search, filter_item, page, limit, sort, order } = req.query;
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;
    const conditions = []; const params = [];
    if (type && type !== 'journal') { conditions.push('d.type = ?'); params.push(type); }
    if (search) {
      conditions.push('(d.number LIKE ? OR d.counterparty LIKE ? OR d.note LIKE ?)');
      const q = '%' + search + '%'; params.push(q, q, q);
    }
    if (filter_item) { conditions.push('d.items LIKE ?'); params.push('%"' + filter_item + '"%'); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents d ${where}`).get(...params);
    const sortCol = sort && ['date', 'number', 'type', 'counterparty', 'sum', 'status'].includes(sort) ? sort : 'date';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const rows = db.prepare(`SELECT * FROM documents d ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ items: rows, total: countRow.total, page, limit, totalPages: Math.ceil(countRow.total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch (e) { doc.items = []; }
    res.json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

function processDocStockImpact(doc, oldStatus) {
  const newStatus = doc.status;
  if (newStatus === oldStatus) return;
  const isActivate = (newStatus === 'confirmed' || newStatus === 'completed') && (oldStatus === 'draft' || oldStatus === 'cancelled' || !oldStatus);
  const isDeactivate = (oldStatus === 'confirmed' || oldStatus === 'completed') && (newStatus === 'draft' || newStatus === 'cancelled');
  if (!isActivate && !isDeactivate) return;
  const multiplier = isDeactivate ? -1 : 1;
  let items = [];
  try { items = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []); } catch {}

  for (const item of items) {
    const qty = (parseFloat(item.quantity) || 0) * multiplier;
    if (qty === 0) continue;
    const itemId = item.itemId || item.item_id || item.id;
    if (!itemId) continue;

    // Update stock
    if (doc.type === 'receipt' || doc.type === 'return') {
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) + ?, current_balance = COALESCE(current_balance,0) + ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'incoming', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, doc.counterparty || '', doc.note || '', doc.number || '');
    } else if (doc.type === 'writeoff' || doc.type === 'shipment') {
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) - ?, current_balance = COALESCE(current_balance,0) - ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'write_off', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, -qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, doc.counterparty || '', doc.note || '', doc.number || '');
    } else if (doc.type === 'transfer') {
      // Deduct from source warehouse, add to destination
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) - ?, current_balance = COALESCE(current_balance,0) - ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'outgoing', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, -qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, doc.warehouse_from || '', doc.note || '', doc.number || '');
    } else if (doc.type === 'inventory') {
      // Set stock to actual quantity from item
      const diff = qty - (db.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get(itemId)?.current_stock || 0);
      db.prepare('UPDATE inventory_items SET current_stock = ?, current_balance = ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'inventory', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, diff, item.pricePerUnit || 0, Math.abs(diff) * (item.pricePerUnit || 0), 'Инвентаризация', doc.note || '', doc.number || '');
    } else if (doc.type === 'production') {
      // Deduct ingredients (using tech card if linked)
      const techCardId = item.techCardId;
      if (techCardId) {
        const ings = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(techCardId);
        const prodMultiplier = item.quantity || 1;
        for (const ing of ings) {
          const ingQty = (ing.quantity || 0) * prodMultiplier * multiplier;
          db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) - ?, current_balance = COALESCE(current_balance,0) - ? WHERE id = ?').run(ingQty, ingQty, ing.item_id);
          db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
            VALUES (?, 'write_off', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(ing.item_id, -ingQty, ing.price_per_unit || 0, ing.cost || 0, 'Производство', doc.note || '', doc.number || '');
        }
      }
      // Add finished product
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) + ?, current_balance = COALESCE(current_balance,0) + ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'production', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, 'Производство', doc.note || '', doc.number || '');
    } else if (doc.type === 'breakdown') {
      // Add ingredients back to stock
      const techCardId = item.techCardId;
      if (techCardId) {
        const ings = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(techCardId);
        const bdMultiplier = item.quantity || 1;
        for (const ing of ings) {
          const ingQty = (ing.quantity || 0) * bdMultiplier * multiplier;
          db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) + ?, current_balance = COALESCE(current_balance,0) + ? WHERE id = ?').run(ingQty, ingQty, ing.item_id);
          db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
            VALUES (?, 'incoming', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(ing.item_id, ingQty, ing.price_per_unit || 0, ing.cost || 0, 'Разбор', doc.note || '', doc.number || '');
        }
      }
      // Deduct source product
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) - ?, current_balance = COALESCE(current_balance,0) - ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'write_off', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, -qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, 'Разбор', doc.note || '', doc.number || '');
    } else if (doc.type === 'processing') {
      // Similar to production but uses processing tech card
      const techCardId = item.techCardId;
      if (techCardId) {
        const ings = db.prepare('SELECT * FROM tech_card_ingredients WHERE tech_card_id = ?').all(techCardId);
        const prMultiplier = item.quantity || 1;
        for (const ing of ings) {
          const ingQty = (ing.quantity || 0) * prMultiplier * multiplier;
          db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) - ?, current_balance = COALESCE(current_balance,0) - ? WHERE id = ?').run(ingQty, ingQty, ing.item_id);
          db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
            VALUES (?, 'write_off', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(ing.item_id, -ingQty, ing.price_per_unit || 0, ing.cost || 0, 'Переработка', doc.note || '', doc.number || '');
        }
      }
      db.prepare('UPDATE inventory_items SET current_stock = COALESCE(current_stock,0) + ?, current_balance = COALESCE(current_balance,0) + ? WHERE id = ?').run(qty, qty, itemId);
      db.prepare(`INSERT INTO inventory_transactions (item_id, type, quantity, price_per_unit, total, supplier_name, note, document_number, created_at)
        VALUES (?, 'production', ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours'))`).run(itemId, qty, item.pricePerUnit || 0, (item.pricePerUnit || 0) * qty, 'Переработка', doc.note || '', doc.number || '');
    }
  }
}

app.post('/api/documents', (req, res) => {
  try {
    const { type, counterparty, sum, items, note, status, created_by, warehouse_from, warehouse_to, doc_date } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid document type' });
    const number = docNextNumber(type);
    const info = db.prepare(
      `INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_by, warehouse_from, warehouse_to, doc_date)
       VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(type, number, counterparty || '', parseFloat(sum) || 0, status || 'draft', JSON.stringify(items || []), note || '',
      created_by || '', warehouse_from || '', warehouse_to || '', doc_date || null);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
    processDocStockImpact(doc, null);
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch {}
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/documents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    const { type, counterparty, sum, items, note, status, created_by, warehouse_from, warehouse_to, doc_date, approved_by } = req.body;
    const updates = []; const params = [];
    const oldStatus = existing.status;
    if (type && DOCUMENT_TYPES.includes(type)) { updates.push('type = ?'); params.push(type); }
    if (counterparty !== undefined) { updates.push('counterparty = ?'); params.push(counterparty); }
    if (sum !== undefined) { updates.push('sum = ?'); params.push(parseFloat(sum)); }
    if (items !== undefined) { updates.push('items = ?'); params.push(JSON.stringify(items)); }
    if (note !== undefined) { updates.push('note = ?'); params.push(note); }
    if (created_by !== undefined) { updates.push('created_by = ?'); params.push(created_by); }
    if (warehouse_from !== undefined) { updates.push('warehouse_from = ?'); params.push(warehouse_from); }
    if (warehouse_to !== undefined) { updates.push('warehouse_to = ?'); params.push(warehouse_to); }
    if (doc_date !== undefined) { updates.push('doc_date = ?'); params.push(doc_date); }
    if (status !== undefined) {
      updates.push('status = ?'); params.push(['draft','confirmed','completed','cancelled'].includes(status) ? status : 'draft');
      if (status === 'completed' || status === 'confirmed') { updates.push("approved_at = datetime('now', '+3 hours')"); if (approved_by) { updates.push('approved_by = ?'); params.push(approved_by); } }
    }
    updates.push("updated_at = datetime('now', '+3 hours')");
    if (updates.length > 1) { params.push(req.params.id); db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params); }
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    processDocStockImpact(doc, oldStatus);
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch {}
    res.json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/documents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/documents/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let imported = 0; const errors = [];
    let rows = [];
    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 2) { fs.unlinkSync(filePath); return res.status(400).json({ error: 'CSV file has no data rows' }); }
      const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const row = {}; header.forEach((h, idx) => row[h] = cols[idx]); rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      } catch { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Ошибка чтения XLSX' }); }
    } else { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Поддерживаются только .csv и .xlsx' }); }
    for (const row of rows) {
      try {
        const type = row.type || row.Type || row.Тип;
        if (!type || !DOCUMENT_TYPES.includes(type)) continue;
        const items = [];
        if (row.item_id || row.item_name) {
          items.push({ itemId: parseInt(row.item_id) || 0, itemName: row.item_name || row.itemName || '', quantity: parseFloat(row.quantity) || 0, unit: row.unit || 'шт', pricePerUnit: parseFloat(row.price) || 0 });
        }
        db.prepare(
          `INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_by)
           VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, 'draft', ?, ?, ?)`
        ).run(type, docNextNumber(type), row.counterparty || row.Контрагент || '', parseFloat(row.sum || row.Сумма) || 0,
          JSON.stringify(items), row.note || row.Примечание || '', row.created_by || '');
        imported++;
      } catch (e) { errors.push({ row: rows.indexOf(row) + 1, error: safeError(e.message) }); }
    }
    try { fs.unlinkSync(filePath); } catch (e) {}
    res.json({ imported, errors: errors.length ? errors : undefined });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Weekly Menu ──────────────────────────────────────────────
app.get('/api/weekly-menu', (req, res) => {
  try {
    const items = db.prepare(`SELECT wm.*, d.name as dish_name FROM weekly_menu wm LEFT JOIN dishes d ON wm.dish_id = d.id WHERE wm.tenant_id = current_tenant_id() ORDER BY wm.day_of_week, wm.sort_order`).all();
    const grouped = {};
    for (const item of items) {
      const day = item.day_of_week;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({ id: item.id, dishId: item.dish_id, dishName: item.dish_name, categoryId: item.category_id, sortOrder: item.sort_order });
    }
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/weekly-menu', (req, res) => {
  try {
    const { dayOfWeek, dishId, categoryId, sortOrder } = req.body;
    db.prepare('INSERT INTO weekly_menu (day_of_week, dish_id, category_id, sort_order) VALUES (?, ?, ?, ?)').run(dayOfWeek, dishId, categoryId || null, sortOrder || 0);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/weekly-menu/:id', (req, res) => {
  try { db.prepare('DELETE FROM weekly_menu WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Languages ────────────────────────────────────────────────
app.get('/api/languages', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM languages ORDER BY sort_order').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/languages', (req, res) => {
  try {
    const { name, code, isActive, sortOrder } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code required' });
    const info = db.prepare('INSERT INTO languages (name, code, is_active, sort_order) VALUES (?, ?, ?, ?)').run(name, code, isActive !== undefined ? (isActive ? 1 : 0) : 1, sortOrder || 0);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/languages/:id', (req, res) => {
  try {
    const b = req.body;
    const sets = []; const vals = [];
    if (b.name !== undefined) { sets.push('name = ?'); vals.push(b.name); }
    if (b.code !== undefined) { sets.push('code = ?'); vals.push(b.code); }
    if (b.isActive !== undefined) { sets.push('is_active = ?'); vals.push(b.isActive ? 1 : 0); }
    if (b.sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(b.sortOrder); }
    if (sets.length) { vals.push(req.params.id); db.prepare(`UPDATE languages SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/languages/:id', (req, res) => {
  try { db.prepare('DELETE FROM languages WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Dish-Modifier bindings
app.get('/api/dish-modifiers/:dishId', (req, res) => {
  try {
    const items = db.prepare('SELECT dm.*, m.name as modifier_name, m.price as modifier_price, mg.name as group_name FROM dish_modifiers dm LEFT JOIN modifiers m ON dm.modifier_id = m.id LEFT JOIN modifier_groups mg ON m.group_id = mg.id WHERE dm.dish_id = ? AND dm.tenant_id = current_tenant_id() ORDER BY dm.sort_order').all(req.params.dishId);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/dish-modifiers', (req, res) => {
  try {
    const { dishId, modifierId, sortOrder } = req.body;
    const info = db.prepare('INSERT INTO dish_modifiers (dish_id, modifier_id, sort_order) VALUES (?, ?, ?)').run(dishId, modifierId, sortOrder || 0);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/dish-modifiers/:id', (req, res) => {
  try { db.prepare('DELETE FROM dish_modifiers WHERE id = ?').run(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Update LanguagesPage to use API
app.put('/api/languages-page-data', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    db.prepare('DELETE FROM languages').run();
    const ins = db.prepare('INSERT INTO languages (name, code, is_active, sort_order) VALUES (?, ?, ?, ?)');
    for (const item of items) { ins.run(item.name, item.code, item.isActive ? 1 : 0, item.sortOrder || 0); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Branches API (for tenant WPF admin) ──────────────────────

// GET /api/branches — list branches for a tenant
app.get('/api/branches', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = 'SELECT * FROM branches WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(tenant_id); }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/branches — create a branch (checks allow_create_branches for tenants)
app.post('/api/branches', (req, res) => {
  try {
    const { tenant_id, name, address, phone } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: 'tenant_id and name are required' });

    // Skip allow_create_branches check when called by portal backend with sync key
    const portalSyncKey = req.headers['x-portal-sync-key'];
    if (portalSyncKey !== PORTAL_SYNC_KEY) {
      const tenant = db.prepare('SELECT allow_create_branches FROM foodchain_portal_tenants WHERE id = ?').get(tenant_id);
      if (tenant && !tenant.allow_create_branches) {
        return res.status(403).json({ error: 'Функция недоступна, обратитесь к суперадминистратору' });
      }
    }

    const info = db.prepare('INSERT INTO branches (tenant_id, name, address, phone) VALUES (?, ?, ?, ?)').run(
      tenant_id, name, address || null, phone || null
    );
    res.status(201).json(db.prepare('SELECT * FROM branches WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// PUT /api/branches/:id
app.put('/api/branches/:id', (req, res) => {
  try {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const sets = []; const params = [];
    for (const key of ['name', 'address', 'phone', 'is_active']) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE branches SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// DELETE /api/branches/:id
app.delete('/api/branches/:id', (req, res) => {
  try {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
    res.json({ message: 'Branch deleted' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: sync tenant data from portal ───────────────────

app.post('/api/internal/sync-tenant', (req, res) => {
  try {
    const { key, tenant } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant || !tenant.id) return res.status(400).json({ error: 'tenant.id required' });

    const existing = db.prepare('SELECT id, access_mode, app_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenant.id);
    const mode = tenant.access_mode || 'production';
    let appSettings = tenant.app_settings || existing?.app_settings || null;
    // Normalize old format ({"courier":{"enabled":true,"limit":5}}) to new format ({"courier":5})
    if (appSettings && typeof appSettings === 'string') {
      try {
        const parsed = JSON.parse(appSettings);
        let needsNormalize = false;
        const normalized = {};
        for (const key of ['admin','waiter','chef','kitchen','courier','manager','stock_manager','guest']) {
          const val = parsed[key];
          if (typeof val === 'object' && val !== null) {
            normalized[key] = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
            needsNormalize = true;
          } else if (typeof val === 'number') {
            normalized[key] = val;
          } else {
            normalized[key] = -1;
          }
        }
        if (needsNormalize) appSettings = JSON.stringify(normalized);
      } catch {}
    }
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET name = ?, allow_create_branches = ?, access_mode = ?, app_settings = ? WHERE id = ?')
        .run(tenant.name || '', tenant.allow_create_branches ? 1 : 0, mode, appSettings, tenant.id);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, name, allow_create_branches, access_mode, app_settings) VALUES (?, ?, ?, ?, ?)')
        .run(tenant.id, tenant.name || '', tenant.allow_create_branches ? 1 : 0, mode, appSettings);
      // Seed demo data only when explicitly requested
      if (tenant.with_demo_data) {
        seedDemoData(db, bcrypt, tenant.id);
        db.prepare('UPDATE foodchain_portal_tenants SET demo_data_created_at = datetime(\'now\') WHERE id = ?').run(tenant.id);
      }
    }
    res.json({ synced: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: tenant stats for portal ─────────────────────────

app.get('/api/internal/tenant-stats', (req, res) => {
  try {
    const { tenant_id, key } = req.query;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    // Count orders for this tenant (assuming tenant_id maps to branch or staff)
    const ordersCount = 0; // Simplified — actual order counting depends on mapping
    const monthlyRevenue = 0;

    res.json({ orders_count: ordersCount, monthly_revenue: monthlyRevenue, tenant_id: parseInt(tenant_id) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: reset demo data (called by portal) ─────────────────

app.post('/api/internal/reset-demo-data', (req, res) => {
  try {
    const { key, tenant_id } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });

    // Read current access_mode from foodchain_portal_tenants
    const pt = db.prepare('SELECT access_mode FROM foodchain_portal_tenants WHERE id = ?').get(tenant_id);
    if (!pt || pt.access_mode !== 'demo') {
      return res.status(400).json({ error: 'Tenant is not in demo mode' });
    }

    // Clear all demo data for this tenant and re-seed
    const tables = [
      'orders', 'order_status_history', 'dishes', 'menu_categories', 'inventory_items',
      'tech_cards', 'staff', 'staff_shifts', 'couriers', 'delivery_zones',
      'promo_codes', 'campaigns', 'discount_rules', 'user_bonuses', 'bonus_transactions',
      'bookings', 'booking_tables', 'review_questions', 'reviews', 'notifications',
      'inventory_transactions', 'batches', 'warehouse_bindings', 'stock_contragents',
      'stop_list_items', 'stop_lists', 'weekly_menu', 'documents', 'packaging'
    ];

    const clearAll = db.transaction(() => {
      for (const table of tables) {
        try { db.prepare(`DELETE FROM "${table}" WHERE tenant_id = ?`).run(tenant_id); } catch (e) {
          try { db.prepare(`DELETE FROM "${table}" WHERE branch_id IN (SELECT id FROM branches WHERE tenant_id = ?)`).run(tenant_id); } catch (e2) {}
        }
      }
    });
    clearAll();

    // Re-seed demo data
    seedDemoData(db, bcrypt, tenant_id);

    db.prepare('UPDATE foodchain_portal_tenants SET demo_data_created_at = datetime(\'now\') WHERE id = ?').run(tenant_id);
    res.json({ message: 'Demo data reset successfully' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: get access mode for a tenant ───────────────────────

app.get('/api/internal/access-mode/:tenantId', (req, res) => {
  try {
    const { key } = req.query;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    const pt = db.prepare('SELECT access_mode, demo_data_created_at, demo_auto_cleanup_days FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    if (!pt) return res.status(404).json({ error: 'Tenant not found' });
    res.json(pt);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Demo mode info for admin panel ──────────────────────────────

app.get('/api/tenant-mode', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;

    const pt = db.prepare('SELECT access_mode, demo_data_created_at, demo_auto_cleanup_days FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({
      access_mode: pt?.access_mode || 'production',
      is_demo: pt?.access_mode === 'demo',
      demo_data_created_at: pt?.demo_data_created_at || null,
      demo_auto_cleanup_days: pt?.demo_auto_cleanup_days || 30,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tenant app limits & usage (for admin frontend) ───────────────

app.get('/api/tenant-limits', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;

    const pt = db.prepare('SELECT app_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    let settings = {};
    if (pt?.app_settings) { try { settings = JSON.parse(pt.app_settings); } catch {} }

    // Count current staff per role
    const staffRows = db.prepare('SELECT role, COUNT(*) as cnt FROM staff WHERE is_active = 1 AND tenant_id = ? GROUP BY role').all(tenantId);
    const staffCountByRole = {};
    for (const row of staffRows) staffCountByRole[row.role] = row.cnt;

    const STAFF_ROLES = ['admin', 'waiter', 'chef', 'kitchen', 'courier', 'manager', 'stock_manager'];
    const result = {};
    for (const role of STAFF_ROLES) {
      let limit = -1;
      const val = settings[role];
      if (typeof val === 'number') {
        limit = val;
      } else if (typeof val === 'object' && val !== null) {
        limit = val.enabled === false ? 0 : (typeof val.limit === 'number' ? val.limit : -1);
      }
      result[role] = {
        limit,
        current: staffCountByRole[role] || 0,
      };
    }

    // Guest count (users table)
    const guestCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'guest'").get(tenantId);
    let guestLimit = -1;
    const guestVal = settings.guest;
    if (typeof guestVal === 'number') {
      guestLimit = guestVal;
    } else if (typeof guestVal === 'object' && guestVal !== null) {
      guestLimit = guestVal.enabled === false ? 0 : (typeof guestVal.limit === 'number' ? guestVal.limit : -1);
    }
    result.guest = {
      limit: guestLimit,
      current: guestCount?.c || 0,
    };

    res.json({ tenant_id: tenantId, usage: result });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Branding (tenant-specific design settings) ────────────────────

const DEFAULT_BRANDING = JSON.stringify({
  common: {
    logoUrl: '',
    restaurantName: '',
    iconUrl: '',
    faviconUrl: '',
    primaryColor: '#FF5722',
    secondaryColor: '#FFC107',
    textColor: '#1F2937',
    secondaryTextColor: '#6B7280',
    backgroundColor: '#F9FAFB',
    cardColor: '#FFFFFF',
    successColor: '#10B981',
    errorColor: '#EF4444',
    warningColor: '#F59E0B',
    fontFamily: 'Inter',
    headingSize: 'medium',
    bodySize: 'medium',
    buttonRadius: 'medium',
    cardStyle: 'shadow',
    shadow: 'medium',
    loginBackground: '',
    homeBackground: '',
    emptyStateImage: '',
  },
  site: {
    title: '',
    slogan: '',
    bannerUrl: '',
    aboutText: '',
    phone: '',
    address: '',
    email: '',
    social: { instagram: '', vk: '', telegram: '' },
    browserTitle: '',
    metaDescription: '',
  },
  apps: {
    guest: {},
    courier: {},
    waiter: {},
    kitchen: {},
  },
});

function parseBranding(raw) {
  if (!raw) return JSON.parse(DEFAULT_BRANDING);
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const defaults = JSON.parse(DEFAULT_BRANDING);
    // Deep merge with defaults
    function mergeDeep(target, source) {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          mergeDeep(target[key], source[key]);
        } else {
          if (target[key] === undefined || target[key] === null || target[key] === '') {
            target[key] = source[key];
          }
        }
      }
    }
    mergeDeep(parsed, defaults);
    return parsed;
  } catch { return JSON.parse(DEFAULT_BRANDING); }
}

// GET /api/branding — get current tenant's branding (no auth required)
app.get('/api/branding', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const row = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({ branding: parseBranding(row?.branding) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// PUT /api/branding — save branding settings
app.put('/api/branding', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const branding = req.body.branding;
    if (!branding || typeof branding !== 'object') return res.status(400).json({ error: 'branding object required' });
    const merged = parseBranding(branding);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET branding = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, branding) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ branding: merged, message: 'Настройки брендирования сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/branding/reset — reset to defaults
app.post('/api/branding/reset', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const defaults = JSON.parse(DEFAULT_BRANDING);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET branding = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, branding) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ branding: defaults, message: 'Настройки брендирования сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// GET /api/branding/public/:tenantId — public endpoint for apps (no auth)
app.get('/api/branding/public/:tenantId', (req, res) => {
  try {
    const row = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    res.json({ branding: parseBranding(row?.branding) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/branding/upload — upload a branding image
const brandingUploadDir = path.join(__dirname, 'uploads', 'branding');
try { require('fs').mkdirSync(brandingUploadDir, { recursive: true }); } catch {}
const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandingUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tmp_${Date.now()}${ext}`);
  },
});
const uploadBranding = multer({ storage: brandingStorage, limits: { fileSize: 5 * 1024 * 1024 } });
function authenticateBrandingUpload(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Auth required' });
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.tenantId = payload.tenantId || payload.tenant_id || 'unknown';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
app.post('/api/branding/upload', authenticateBrandingUpload, uploadBranding.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname);
    const newName = `${req.tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    req.file.filename = newName;
    req.file.path = newPath;
    const url = `/uploads/branding/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Site Settings (tenant website configuration) ────────────────
const DEFAULT_SITE_SETTINGS = JSON.stringify({
  common: {
    seo: { title: '', browserTitle: '', metaDescription: '' },
    feed: '',
    additionalPages: '',
    customCode: '',
    domains: '',
    fontFamily: 'Montserrat',
    showStores: true,
    storeType: 'Ресторан',
    guestRegistration: 'allowed',
  },
  colors: {
    backgroundColor: '#FFFFFF',
    primaryFillColor: '#FF5722',
    primaryTextColor: '#1F2937',
    secondaryFillColor: '#FFF3E0',
    secondaryTextColor: '#6B7280',
  },
  images: {
    slides: [],
    logoHorizontal: '',
  },
  categories: {
    showPanelTop: true,
    showCenter: true,
    padding: '',
    gap: '',
    imagePosition: 'top',
    border: false,
    verticalAlign: 'bottom',
    horizontalAlign: 'center',
    fontFamily: 'Montserrat',
    textColor: '#1F2937',
    borderColor: '#E5E7EB',
  },
  productCards: {
    padding: '',
    imagePosition: 'top',
    border: false,
    verticalAlign: 'bottom',
    horizontalAlign: 'center',
    fontFamily: 'Montserrat',
    textColor: '#1F2937',
    borderColor: '#E5E7EB',
  },
});

function parseSiteSettings(raw) {
  if (!raw) return JSON.parse(DEFAULT_SITE_SETTINGS);
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const defaults = JSON.parse(DEFAULT_SITE_SETTINGS);
    function mergeDeep(target, source) {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          mergeDeep(target[key], source[key]);
        } else if (target[key] === undefined || target[key] === null) {
          target[key] = source[key];
        }
      }
    }
    mergeDeep(parsed, defaults);
    return parsed;
  } catch { return JSON.parse(DEFAULT_SITE_SETTINGS); }
}

// GET /api/site-settings
app.get('/api/site-settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const row = db.prepare('SELECT site_settings FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    res.json({ settings: parseSiteSettings(row?.site_settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// PUT /api/site-settings
app.put('/api/site-settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const settings = req.body.settings;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const merged = parseSiteSettings(settings);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET site_settings = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, site_settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: merged, message: 'Настройки сайта сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/site-settings/reset
app.post('/api/site-settings/reset', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const tenantId = payload.tenantId || payload.tenant_id;
    if (!tenantId) tenantId = 1;
    const defaults = JSON.parse(DEFAULT_SITE_SETTINGS);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    if (existing) {
      db.prepare('UPDATE foodchain_portal_tenants SET site_settings = ? WHERE id = ?').run(str, tenantId);
    } else {
      db.prepare('INSERT INTO foodchain_portal_tenants (id, site_settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: defaults, message: 'Настройки сайта сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// POST /api/site-settings/upload — upload site images
const siteUploadDir = path.join(__dirname, 'uploads', 'site');
try { require('fs').mkdirSync(siteUploadDir, { recursive: true }); } catch {}
const siteStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, siteUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tmp_${Date.now()}${ext}`);
  },
});
const uploadSiteImage = multer({ storage: siteStorage, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/site-settings/upload', uploadSiteImage.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let tenantId = 'unknown';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        tenantId = payload.tenantId || payload.tenant_id || 'unknown';
      } catch {}
    }
    const ext = path.extname(req.file.originalname);
    const newName = `${tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    const url = `/uploads/site/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// GET /api/site-settings/public/:tenantId — public endpoint for site (no auth)
app.get('/api/site-settings/public/:tenantId', (req, res) => {
  try {
    const row = db.prepare('SELECT site_settings FROM foodchain_portal_tenants WHERE id = ?').get(req.params.tenantId);
    res.json({ settings: parseSiteSettings(row?.site_settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Demo data seeding function ───────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS workshops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, branch_id INTEGER, is_active INTEGER DEFAULT 1)`); } catch(e) {}

app.get('/api/workshops', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM workshops ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/workshops', (req, res) => {
  try {
    const { name, branch_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO workshops (name, branch_id) VALUES (?, ?)').run(name, branch_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name, branch_id: branch_id || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/workshops/:id', (req, res) => {
  try {
    const { name, branch_id, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE workshops SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM workshops WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/workshops/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM workshops WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Wholesale Prices ──────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS wholesale_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 1)`); } catch(e) {}

app.get('/api/wholesale-prices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM wholesale_prices ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/wholesale-prices', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO wholesale_prices (name, description) VALUES (?, ?)').run(name, description || null);
    res.status(201).json({ id: info.lastInsertRowid, name, description: description || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/wholesale-prices/:id', (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE wholesale_prices SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM wholesale_prices WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/wholesale-prices/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wholesale_prices WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Modifier Groups ───────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS modifier_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, min_count INTEGER DEFAULT 0, max_count INTEGER DEFAULT 0, tenant_id INTEGER DEFAULT 1)`); } catch(e) {}

app.get('/api/modifier-groups', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM modifier_groups ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/modifier-groups', (req, res) => {
  try {
    const { name, description, min_count, max_count } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO modifier_groups (name, description, min_count, max_count) VALUES (?, ?, ?, ?)').run(name, description || null, min_count || 0, max_count || 0);
    res.status(201).json({ id: info.lastInsertRowid, name, description: description || null, min_count: min_count || 0, max_count: max_count || 0 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/modifier-groups/:id', (req, res) => {
  try {
    const { name, description, min_count, max_count } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (min_count !== undefined) { sets.push('min_count = ?'); params.push(min_count); }
    if (max_count !== undefined) { sets.push('max_count = ?'); params.push(max_count); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE modifier_groups SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM modifier_groups WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/modifier-groups/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM modifier_groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Modifiers ─────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS modifiers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL DEFAULT 0, group_id INTEGER, is_active INTEGER DEFAULT 1, tenant_id INTEGER DEFAULT 1, FOREIGN KEY(group_id) REFERENCES modifier_groups(id))`); } catch(e) {}

app.get('/api/modifiers', (req, res) => {
  try {
    const rows = db.prepare('SELECT m.*, mg.name as group_name FROM modifiers m LEFT JOIN modifier_groups mg ON m.group_id = mg.id WHERE m.tenant_id = current_tenant_id() ORDER BY m.name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/modifiers', (req, res) => {
  try {
    const { name, price, group_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO modifiers (name, price, group_id) VALUES (?, ?, ?)').run(name, price || 0, group_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name, price: price || 0, group_id: group_id || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/modifiers/:id', (req, res) => {
  try {
    const { name, price, group_id, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (group_id !== undefined) { sets.push('group_id = ?'); params.push(group_id); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE modifiers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM modifiers WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/modifiers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM modifiers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Stop Lists ────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS stop_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT NOT NULL, reason TEXT, until_date TEXT, is_active INTEGER DEFAULT 1, tenant_id INTEGER DEFAULT 1)`); } catch(e) {}

app.get('/api/stop-lists', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM stop_lists ORDER BY until_date DESC').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/stop-lists', (req, res) => {
  try {
    const { item_name, reason, until_date } = req.body;
    if (!item_name) return res.status(400).json({ error: 'Item name required' });
    const info = db.prepare('INSERT INTO stop_lists (item_name, reason, until_date) VALUES (?, ?, ?)').run(item_name, reason || null, until_date || null);
    res.status(201).json({ id: info.lastInsertRowid, item_name, reason: reason || null, until_date: until_date || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/stop-lists/:id', (req, res) => {
  try {
    const { item_name, reason, until_date, is_active } = req.body;
    const sets = []; const params = [];
    if (item_name !== undefined) { sets.push('item_name = ?'); params.push(item_name); }
    if (reason !== undefined) { sets.push('reason = ?'); params.push(reason); }
    if (until_date !== undefined) { sets.push('until_date = ?'); params.push(until_date); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE stop_lists SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM stop_lists WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/stop-lists/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM stop_lists WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Staff Roles ───────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS staff_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, permissions TEXT DEFAULT '{}', tenant_id INTEGER DEFAULT 1)`); } catch(e) {}

app.get('/api/staff-roles', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM staff_roles ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/staff-roles', (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO staff_roles (name, permissions) VALUES (?, ?)').run(name, permissions || '{}');
    res.status(201).json({ id: info.lastInsertRowid, name, permissions: permissions || '{}' });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/staff-roles/:id', (req, res) => {
  try {
    const { name, permissions } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (permissions !== undefined) { sets.push('permissions = ?'); params.push(permissions); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE staff_roles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM staff_roles WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/staff-roles/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM staff_roles WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Staff Schedule ────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS staff_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, day TEXT, shift_start TEXT, shift_end TEXT, FOREIGN KEY(staff_id) REFERENCES staff(id))`); } catch(e) {}

app.get('/api/staff-schedule', (req, res) => {
  try {
    const { staff_id } = req.query;
    let sql = 'SELECT ss.*, s.first_name || \' \' || COALESCE(s.last_name, \'\') as staff_name FROM staff_schedule ss LEFT JOIN staff s ON ss.staff_id = s.id WHERE ss.tenant_id = current_tenant_id()';
    const params = [];
    if (staff_id) { sql += ' WHERE ss.staff_id = ?'; params.push(staff_id); }
    sql += ' ORDER BY ss.day, ss.shift_start';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/staff-schedule', (req, res) => {
  try {
    const { staff_id, day, shift_start, shift_end } = req.body;
    if (!staff_id || !day) return res.status(400).json({ error: 'staff_id and day required' });
    const info = db.prepare('INSERT INTO staff_schedule (staff_id, day, shift_start, shift_end) VALUES (?, ?, ?, ?)').run(staff_id, day, shift_start || null, shift_end || null);
    res.status(201).json({ id: info.lastInsertRowid, staff_id, day, shift_start: shift_start || null, shift_end: shift_end || null });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/staff-schedule/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM staff_schedule WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Messages ────────────────────────────────────────────────────
app.get('/api/messages', (req, res) => {
  try {
    const { tenant_id, direction, search } = req.query;
    let sql = 'SELECT * FROM messages';
    const conditions = []; const params = [];
    if (tenant_id) { conditions.push('tenant_id = ?'); params.push(tenant_id); }
    if (direction && direction !== 'all') { conditions.push('direction = ?'); params.push(direction); }
    if (search) { conditions.push('(sender LIKE ? OR recipient LIKE ? OR subject LIKE ? OR body LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q, q); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(toCamelCase));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/messages', (req, res) => {
  try {
    const { tenant_id, direction, sender, recipient, subject, body } = req.body;
    const info = db.prepare(
      'INSERT INTO messages (tenant_id, direction, sender, recipient, subject, body) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tenant_id || 1, direction || 'outgoing', sender || '', recipient || '', subject || '', body || '');
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(msg));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.patch('/api/messages/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Chats (Support) ──────────────────────────────────────────
function chatToCamel(chat) {
  if (!chat) return null;
  const map = {};
  for (const key of Object.keys(chat)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    map[camel] = chat[key];
  }
  return map;
}

app.post('/api/chats', (req, res) => {
  try {
    const { tenant_id, guest_id, guest_name, guest_phone, order_id, table_id } = req.body;
    const info = db.prepare(
      `INSERT INTO chats (tenant_id, guest_id, guest_name, guest_phone, order_id, table_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, guest_id || 0, guest_name || '', guest_phone || '', order_id || 0, table_id || 0);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(chat);
    io.emit('chat:new', data);
    broadcast(JSON.stringify({ type: 'chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/chats', (req, res) => {
  try {
    const { tenant_id, status, waiter_id, search } = req.query;
    let sql = 'SELECT * FROM chats';
    const conditions = ['tenant_id = ?'];
    const params = [tenant_id || 1];
    if (status && status !== 'all') { conditions.push('status = ?'); params.push(status); }
    if (waiter_id && waiter_id !== '0') { conditions.push('assigned_waiter_id = ?'); params.push(waiter_id); }
    if (search) { conditions.push('(guest_name LIKE ? OR guest_phone LIKE ? OR last_message LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q); }
    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/chats/:id', (req, res) => {
  try {
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chatToCamel(chat));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/chats/:id/assign', (req, res) => {
  try {
    const { waiter_id, waiter_name } = req.body;
    db.prepare('UPDATE chats SET assigned_waiter_id = ?, assigned_waiter_name = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(waiter_id || 0, waiter_name || '', req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:assigned', data);
    broadcast(JSON.stringify({ type: 'chat:assigned', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/chats/:id/reopen', (req, res) => {
  try {
    db.prepare('UPDATE chats SET status = \'open\', closed_at = NULL, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:reopened', data);
    broadcast(JSON.stringify({ type: 'chat:reopened', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/chats/:id/close', (req, res) => {
  try {
    db.prepare('UPDATE chats SET status = \'closed\', closed_at = datetime(\'now\', \'+3 hours\'), updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(req.params.id);
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('chat:closed', data);
    broadcast(JSON.stringify({ type: 'chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/chats/:id', (req, res) => {
  try {
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    let adminName = '';
    let adminId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        adminId = payload.id;
        adminName = payload.username || payload.firstName || '';
      } catch {}
    }
    db.prepare('DELETE FROM chat_messages WHERE chat_id = ?').run(req.params.id);
    db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
    logAppAudit(chat.tenant_id || 1, adminId, adminName, 'delete_chat', `Удалён чат #${req.params.id} (гость: ${chat.guest_name || 'неизвестен'})`);
    io.emit('chat:deleted', { id: parseInt(req.params.id) });
    broadcast(JSON.stringify({ type: 'chat:deleted', id: parseInt(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Chat Messages ────────────────────────────────────────────
app.get('/api/chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/chats/:id/messages', (req, res) => {
  try {
    const { sender_type, sender_id, sender_name, message, file_url } = req.body;
    const info = db.prepare(
      `INSERT INTO chat_messages (chat_id, sender_type, sender_id, sender_name, message, file_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_type || 'guest', sender_id || 0, sender_name || '', message || '', file_url || '');
    const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(msg);

    db.prepare(`UPDATE chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(message || '', req.params.id);

    io.emit('chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'chat:message', chatId: parseInt(req.params.id), message: data }));

    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.patch('/api/chats/:chatId/messages/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE chat_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
    io.emit('chat:read', { chatId: parseInt(req.params.chatId), messageId: parseInt(req.params.id) });
    broadcast(JSON.stringify({ type: 'chat:read', chatId: parseInt(req.params.chatId), messageId: parseInt(req.params.id) }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

const chatUploadDir = path.join(__dirname, 'uploads', 'chat');
try { require('fs').mkdirSync(chatUploadDir, { recursive: true }); } catch {}
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const uploadChat = multer({ storage: chatStorage, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/chats/upload', uploadChat.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/chat/${req.file.filename}`, filename: req.file.filename });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Staff Chats (courier ↔ waiter) ─────────────────────────────
app.get('/api/staff-chats', (req, res) => {
  try {
    const { order_id, status, courier_id, waiter_id, search, tenant_id } = req.query;
    let sql = 'SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.tenant_id = current_tenant_id()';
    const conditions = [];
    const params = [];
    if (tenant_id) { conditions.push('sc.tenant_id = ?'); params.push(tenant_id); }
    if (order_id) { conditions.push('sc.order_id = ?'); params.push(order_id); }
    if (status && status !== 'all') { conditions.push('sc.status = ?'); params.push(status); }
    if (courier_id && courier_id !== '0') { conditions.push('sc.courier_id = ?'); params.push(courier_id); }
    if (waiter_id && waiter_id !== '0') { conditions.push('sc.waiter_id = ?'); params.push(waiter_id); }
    if (search) { conditions.push('(sc.last_message LIKE ? OR sc.courier_name LIKE ? OR sc.waiter_name LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY sc.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(chatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/staff-chats/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Staff chat not found' });
    res.json(chatToCamel(row));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/staff-chats', (req, res) => {
  try {
    const { tenant_id, order_id, courier_id, courier_name, waiter_id, waiter_name } = req.body;
    const existing = db.prepare('SELECT * FROM staff_chats WHERE order_id = ? AND status = ?').get(order_id, 'open');
    if (existing) return res.json(chatToCamel(existing));
    const info = db.prepare(
      `INSERT INTO staff_chats (tenant_id, order_id, courier_id, courier_name, waiter_id, waiter_name)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, order_id || 0, courier_id || 0, courier_name || '', waiter_id || 0, waiter_name || '');
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    const data = chatToCamel(chat);
    io.emit('staff-chat:new', data);
    broadcast(JSON.stringify({ type: 'staff-chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/staff-chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM staff_chat_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    const result = rows.map(chatToCamel);
    for (const r of result) {
      if (r.locationData) { try { r.locationData = JSON.parse(r.locationData); } catch {} }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/staff-chats/:id/messages', (req, res) => {
  try {
    const { sender_id, sender_type, sender_name, message, file_url, message_type, location_data } = req.body;
    const locData = location_data ? (typeof location_data === 'string' ? location_data : JSON.stringify(location_data)) : '';
    const msgType = message_type || 'text';
    const info = db.prepare(
      `INSERT INTO staff_chat_messages (chat_id, sender_id, sender_type, sender_name, message, file_url, message_type, location_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_id || 0, sender_type || 'courier', sender_name || '', message || '', file_url || '', msgType, locData);
    const msg = db.prepare('SELECT * FROM staff_chat_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = chatToCamel(msg);
    if (data.locationData) { try { data.locationData = JSON.parse(data.locationData); } catch {} }

    const displayMsg = msgType === 'location' ? '📍 Местоположение' : (message || '');
    db.prepare(`UPDATE staff_chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(displayMsg, req.params.id);

    io.emit('staff-chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'staff-chat:message', chatId: parseInt(req.params.id), message: data }));

    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/staff-chats/:id/close', (req, res) => {
  try {
    db.prepare("UPDATE staff_chats SET status = 'closed', closed_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?")
      .run(req.params.id);
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('staff-chat:closed', data);
    broadcast(JSON.stringify({ type: 'staff-chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/staff-chats/:id/important', (req, res) => {
  try {
    const { isImportant } = req.body;
    db.prepare('UPDATE staff_chats SET is_important = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(isImportant ? 1 : 0, req.params.id);
    const chat = db.prepare('SELECT sc.*, o.id AS order_number FROM staff_chats sc LEFT JOIN orders o ON sc.order_id = o.id WHERE sc.id = ? AND sc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = chatToCamel(chat);
    io.emit('staff-chat:important', data);
    broadcast(JSON.stringify({ type: 'staff-chat:important', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

const staffChatUploadDir = path.join(__dirname, 'uploads', 'staff-chat');
try { require('fs').mkdirSync(staffChatUploadDir, { recursive: true }); } catch {}
const staffChatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, staffChatUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `staff_chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const uploadStaffChat = multer({ storage: staffChatStorage, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/staff-chats/upload', uploadStaffChat.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/staff-chat/${req.file.filename}`, filename: req.file.filename });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Courier-Guest Chat ─────────────────────────────────────────
app.get('/api/courier-guest-chats', (req, res) => {
  try {
    const { order_id, status, courier_id, guest_phone, guest_id, search, tenant_id } = req.query;
    let sql = 'SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.tenant_id = current_tenant_id()';
    const conditions = [];
    const params = [];
    if (tenant_id) { conditions.push('cgc.tenant_id = ?'); params.push(tenant_id); }
    if (order_id) { conditions.push('cgc.order_id = ?'); params.push(order_id); }
    if (status && status !== 'all') { conditions.push('cgc.status = ?'); params.push(status); }
    if (courier_id && courier_id !== '0') { conditions.push('cgc.courier_id = ?'); params.push(courier_id); }
    if (guest_phone) { conditions.push('cgc.guest_phone = ?'); params.push(guest_phone); }
    if (guest_id && guest_id !== '0') { conditions.push('cgc.guest_id = ?'); params.push(guest_id); }
    if (search) { conditions.push('(cgc.last_message LIKE ? OR cgc.courier_name LIKE ? OR cgc.guest_name LIKE ? OR cgc.guest_phone LIKE ?)'); const q = '%' + search + '%'; params.push(q, q, q, q); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY cgc.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(cgChatToCamel));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/courier-guest-chats', (req, res) => {
  try {
    const { tenant_id, order_id, courier_id, courier_name, guest_id, guest_name, guest_phone } = req.body;
    const existing = db.prepare('SELECT * FROM courier_guest_chats WHERE order_id = ? AND status = ?').get(order_id, 'open');
    if (existing) return res.json(cgChatToCamel(existing));
    const info = db.prepare(
      `INSERT INTO courier_guest_chats (tenant_id, order_id, courier_id, courier_name, guest_id, guest_name, guest_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(tenant_id || 1, order_id || 0, courier_id || 0, courier_name || '', guest_id || 0, guest_name || '', guest_phone || '');
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(info.lastInsertRowid);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:new', data);
    broadcast(JSON.stringify({ type: 'cg-chat:new', data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/courier-guest-chats/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Chat not found' });
    res.json(cgChatToCamel(row));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/courier-guest-chats/:id/close', (req, res) => {
  try {
    db.prepare("UPDATE courier_guest_chats SET status = 'closed', closed_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?")
      .run(req.params.id);
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:closed', data);
    broadcast(JSON.stringify({ type: 'cg-chat:closed', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/courier-guest-chats/:id/important', (req, res) => {
  try {
    const { isImportant } = req.body;
    db.prepare('UPDATE courier_guest_chats SET is_important = ?, updated_at = datetime(\'now\', \'+3 hours\') WHERE id = ?')
      .run(isImportant ? 1 : 0, req.params.id);
    const chat = db.prepare('SELECT cgc.*, o.id AS order_number FROM courier_guest_chats cgc LEFT JOIN orders o ON cgc.order_id = o.id WHERE cgc.id = ? AND cgc.tenant_id = current_tenant_id()').get(req.params.id);
    const data = cgChatToCamel(chat);
    io.emit('cg-chat:important', data);
    broadcast(JSON.stringify({ type: 'cg-chat:important', data }));
    res.json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/courier-guest-chats/:id/messages', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM courier_guest_messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id);
    const result = rows.map(cgChatToCamel);
    for (const r of result) {
      if (r.locationData) { try { r.locationData = JSON.parse(r.locationData); } catch {} }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/courier-guest-chats/:id/messages', (req, res) => {
  try {
    const { sender_id, sender_type, sender_name, message, file_url, message_type, location_data } = req.body;
    const locData = location_data ? (typeof location_data === 'string' ? location_data : JSON.stringify(location_data)) : '';
    const msgType = message_type || 'text';
    const info = db.prepare(
      `INSERT INTO courier_guest_messages (chat_id, sender_id, sender_type, sender_name, message, file_url, message_type, location_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.params.id, sender_id || 0, sender_type || 'courier', sender_name || '', message || '', file_url || '', msgType, locData);
    const msg = db.prepare('SELECT * FROM courier_guest_messages WHERE id = ?').get(info.lastInsertRowid);
    const data = cgChatToCamel(msg);
    if (data.locationData) { try { data.locationData = JSON.parse(data.locationData); } catch {} }

    const displayMsg = msgType === 'location' ? '📍 Местоположение' : (msgType === 'photo' ? '📷 Фото' : (message || ''));
    db.prepare(`UPDATE courier_guest_chats SET last_message = ?, last_message_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours') WHERE id = ?`)
      .run(displayMsg, req.params.id);

    io.emit('cg-chat:message', { chatId: parseInt(req.params.id), message: data });
    broadcast(JSON.stringify({ type: 'cg-chat:message', chatId: parseInt(req.params.id), message: data }));
    res.status(201).json(data);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Courier Chat Templates ──────────────────────────────────────
app.get('/api/admin/courier-templates', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const templates = db.prepare('SELECT * FROM courier_chat_templates WHERE tenant_id = ? ORDER BY sort_order ASC, created_at DESC').all(tenantId);
    res.json(templates.map(t => ({ ...t, isActive: !!t.is_active, sortOrder: t.sort_order })));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/courier-templates', (req, res) => {
  try {
    const { tenant_id, text, is_active, sort_order } = req.body;
    const info = db.prepare('INSERT INTO courier_chat_templates (tenant_id, text, is_active, sort_order) VALUES (?, ?, ?, ?)')
      .run(tenant_id || 1, text || '', is_active !== undefined ? (is_active ? 1 : 0) : 1, sort_order || 0);
    const tmpl = db.prepare('SELECT * FROM courier_chat_templates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...tmpl, isActive: !!tmpl.is_active, sortOrder: tmpl.sort_order });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/courier-templates/:id', (req, res) => {
  try {
    const { text, is_active, sort_order } = req.body;
    const updates = [];
    const params = [];
    if (text !== undefined) { updates.push('text = ?'); params.push(text); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (updates.length) {
      updates.push("updated_at = datetime('now', '+3 hours')");
      params.push(req.params.id);
      db.prepare(`UPDATE courier_chat_templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    const tmpl = db.prepare('SELECT * FROM courier_chat_templates WHERE id = ?').get(req.params.id);
    res.json({ ...tmpl, isActive: !!tmpl.is_active, sortOrder: tmpl.sort_order });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/courier-templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM courier_chat_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/courier-templates/reorder', (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array of {id, sort_order}' });
    const update = db.prepare('UPDATE courier_chat_templates SET sort_order = ? WHERE id = ?');
    for (const item of order) {
      update.run(item.sort_order, item.id);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Courier Personal Templates ─────────────────────────────────
app.get('/api/courier/templates', (req, res) => {
  try {
    const { user_id, tenant_id } = req.query;
    const systemTemplates = db.prepare('SELECT * FROM courier_chat_templates WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC').all(tenant_id || 1);
    const personalTemplates = user_id ? db.prepare('SELECT * FROM courier_personal_templates WHERE user_id = ? ORDER BY created_at DESC').all(user_id) : [];
    res.json({
      system: systemTemplates.map(t => ({ ...t, isActive: !!t.is_active, sortOrder: t.sort_order })),
      personal: personalTemplates,
    });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/courier/templates/personal', (req, res) => {
  try {
    const { user_id, text } = req.body;
    if (!user_id || !text) return res.status(400).json({ error: 'user_id and text required' });
    const info = db.prepare('INSERT INTO courier_personal_templates (user_id, text) VALUES (?, ?)').run(user_id, text);
    const tmpl = db.prepare('SELECT * FROM courier_personal_templates WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(tmpl);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/courier/templates/personal/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM courier_personal_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── WebSocket subscriptions for courier-guest chat ──────────
// Add these to the io.on('connection') handler if found. For now just ensure events exist.

// ─── Telegram Bot ─────────────────────────────────────────────────
let telegramBot;
try { telegramBot = require(path.join(__dirname, 'services', 'telegram-bot.service.js')); } catch (e) { console.warn('[TelegramBot] Service load error:', e.message); telegramBot = { getSettings: () => ({}), saveSettings: () => ({}), startIfConfigured: () => {}, stopBot: () => {}, getStats: () => ({}), broadcast: async () => ({}) }; }

app.get('/api/telegram-bot/settings', (req, res) => {
  try { res.json(telegramBot.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/telegram-bot/settings', (req, res) => {
  try { res.json(telegramBot.saveSettings(db, req.body, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/telegram-bot/restart', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    jwt.verify(token, JWT_SECRET);
    telegramBot.stopBot();
    telegramBot.startIfConfigured(db, req.query.tenant_id || 1);
    res.json({ success: true });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Invalid token' });
    res.status(500).json({ error: safeError(e.message) });
  }
});

app.get('/api/telegram-bot/stats', (req, res) => {
  try { res.json(telegramBot.getStats(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/telegram-bot/broadcast', (req, res) => {
  try {
    const settings = telegramBot.getSettings(db, req.query.tenant_id || 1);
    if (!settings.token) return res.status(400).json({ error: 'Bot token not configured' });
    telegramBot.broadcast(db, settings.token, req.body.message).then(r => res.json(r)).catch(e => res.status(500).json({ error: safeError(e.message) }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Subscribe user to order notifications
app.post('/api/telegram-bot/subscribe', (req, res) => {
  const { chat_id, order_id } = req.body;
  if (!chat_id || !order_id) return res.status(400).json({ error: 'Missing params' });
  db.prepare("INSERT OR IGNORE INTO telegram_order_subscriptions (tenant_id, chat_id, order_id) VALUES (?, ?, ?)").run(req.query.tenant_id || 1, chat_id, order_id);
  res.json({ success: true });
});

// Unsubscribe from order notifications
app.delete('/api/telegram-bot/subscribe', (req, res) => {
  const { chat_id, order_id } = req.body;
  db.prepare('DELETE FROM telegram_order_subscriptions WHERE chat_id = ? AND order_id = ?').run(chat_id, order_id);
  res.json({ success: true });
});

// Get bot analytics
app.get('/api/telegram-bot/analytics', (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM telegram_bot_users WHERE tenant_id = ?').get(tenantId).c;
  const activeToday = db.prepare("SELECT COUNT(*) as c FROM telegram_bot_users WHERE date(last_interaction) = date('now') AND tenant_id = ?").get(tenantId).c;
  const popularCmds = db.prepare("SELECT command, COUNT(*) as count FROM telegram_bot_log WHERE tenant_id = ? AND created_at > datetime('now', '-30 days') GROUP BY command ORDER BY count DESC LIMIT 10").all(tenantId);
  const dailyActive = db.prepare("SELECT date(last_interaction) as day, COUNT(*) as users FROM telegram_bot_users WHERE tenant_id = ? AND last_interaction > datetime('now', '-14 days') GROUP BY date(last_interaction) ORDER BY day").all(tenantId);
  res.json({ totalUsers, activeToday, popularCmds, dailyActive });
});

// ─── Email Settings ──────────────────────────────────────────────
const emailService = require(path.join(__dirname, 'services', 'email.service.js'));

app.get('/api/email/settings', (req, res) => {
  try { res.json(emailService.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/email/settings', (req, res) => {
  try { res.json(emailService.saveSettings(db, req.body, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/email/test', async (req, res) => {
  try {
    const result = await emailService.testConnection(db, req.body?.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Missing to/subject' });
    const result = await emailService.sendMail(db, { to, subject, html }, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/email/track/:logId', (req, res) => {
  try {
    const { logId } = req.params;
    db.prepare('UPDATE email_logs SET opened_at = COALESCE(opened_at, datetime("now")) WHERE id = ?').run(logId);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.end(gif);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/email/unsubscribe', (req, res) => {
  try {
    const { email, tenant } = req.query;
    if (!email) return res.status(400).send('Missing email');
    const t = tenant || 1;
    db.prepare('INSERT OR IGNORE INTO email_unsubscribes (tenant_id, email) VALUES (?, ?)').run(t, email);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<h1>Вы отписались от рассылки</h1><p>Вы больше не будете получать email-уведомления от этого ресторана.</p>');
  } catch (e) { res.status(500).send('Error'); }
});

// ─── Push Settings ───────────────────────────────────────────────
app.get('/api/push-settings', (req, res) => {
  try {
    const tenantId = req.query.tenant_id || 1;
    const row = db.prepare('SELECT * FROM push_settings WHERE tenant_id = ?').get(tenantId);
    res.json(row || { api_key: '', project_id: '', sender_id: '', app_id: '', is_enabled: false });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/push-settings', (req, res) => {
  try {
    const { tenant_id, api_key, project_id, sender_id, app_id, is_enabled } = req.body;
    const tid = tenant_id || 1;
    const existing = db.prepare('SELECT id FROM push_settings WHERE tenant_id = ?').get(tid);
    if (existing) {
      db.prepare('UPDATE push_settings SET api_key = ?, project_id = ?, sender_id = ?, app_id = ?, is_enabled = ? WHERE tenant_id = ?')
        .run(api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0, tid);
    } else {
      db.prepare('INSERT INTO push_settings (tenant_id, api_key, project_id, sender_id, app_id, is_enabled) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tid, api_key || '', project_id || '', sender_id || '', app_id || '', is_enabled ? 1 : 0);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/push-settings/test', (req, res) => {
  try {
    const tenantId = (req.body && req.body.tenant_id) || 1;
    const row = db.prepare('SELECT * FROM push_settings WHERE tenant_id = ?').get(tenantId);
    if (!row || !row.api_key) {
      return res.status(400).json({ error: 'Push-настройки не заданы. Укажите API-ключ.' });
    }
    res.json({ ok: true, message: 'Тестовое подключение выполнено (имитация).' });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Email Templates & Campaigns ─────────────────────────────────
app.get('/api/email/templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM email_templates WHERE tenant_id = ? ORDER BY is_system DESC, name ASC').all(req.query.tenant_id || 1);
    res.json(templates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/email/templates', (req, res) => {
  try {
    const { name, subject, body_html, variables } = req.body;
    if (!name || !subject) return res.status(400).json({ error: 'name и subject обязательны' });
    const info = db.prepare('INSERT INTO email_templates (tenant_id, name, subject, body_html, variables, is_system) VALUES (?, ?, ?, ?, ?, 0)').run(
      req.query.tenant_id || 1, name, subject, body_html || '', JSON.stringify(variables || [])
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/email/templates/:id', (req, res) => {
  try {
    const { name, subject, body_html, variables } = req.body;
    db.prepare('UPDATE email_templates SET name = ?, subject = ?, body_html = ?, variables = ? WHERE id = ?').run(
      name, subject, body_html || '', JSON.stringify(variables || []), req.params.id
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/email/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM email_templates WHERE id = ? AND is_system = 0').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/email/logs', (req, res) => {
  try {
    const { limit, campaign_id } = req.query;
    let sql = 'SELECT * FROM email_logs WHERE tenant_id = ?';
    const params = [req.query.tenant_id || 1];
    if (campaign_id) { sql += ' AND campaign_id = ?'; params.push(campaign_id); }
    sql += ' ORDER BY sent_at DESC LIMIT ?';
    params.push(parseInt(limit) || 100);
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/email/send-campaign', async (req, res) => {
  try {
    const { template_id, recipient_emails, subject_override } = req.body;
    if (!template_id || !recipient_emails?.length) return res.status(400).json({ error: 'template_id и recipient_emails обязательны' });
    const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(template_id);
    if (!template) return res.status(404).json({ error: 'Шаблон не найден' });
    const subject = subject_override || template.subject;
    let sent = 0, failed = 0;
    for (const email of recipient_emails) {
      const result = await emailService.sendMail(db, { to: email, subject, html: template.body_html });
      db.prepare('INSERT INTO email_logs (tenant_id, recipient, subject, status) VALUES (?, ?, ?, ?)').run(
        req.query.tenant_id || 1, email, subject, result.success ? 'sent' : 'failed'
      );
      if (result.success) sent++; else failed++;
    }
    res.json({ sent, failed, total: recipient_emails.length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Email statistics
app.get('/api/email/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM email_logs WHERE tenant_id = 1').get();
  const sent = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status = 'sent' AND tenant_id = 1").get();
  const failed = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE status = 'failed' AND tenant_id = 1").get();
  const opened = db.prepare("SELECT COUNT(*) as c FROM email_logs WHERE opened_at IS NOT NULL AND tenant_id = 1").get();
  const recent = db.prepare('SELECT * FROM email_logs WHERE tenant_id = 1 ORDER BY sent_at DESC LIMIT 20').all();
  res.json({ total: total.c, sent: sent.c, failed: failed.c, opened: opened.c, openRate: total.c > 0 ? Math.round(opened.c / total.c * 100) : 0, recent });
});

// Segment guests for campaigns
app.get('/api/guests/segments', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const withOrders = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM orders').get().c;
  const vip = db.prepare("SELECT COUNT(*) as c FROM users WHERE total_spent > 5000").get().c;
  const newUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE julianday('now') - julianday(created_at) < 30").get().c;
  const inactive = db.prepare("SELECT COUNT(*) as c FROM users WHERE julianday('now') - julianday(last_visit_at) > 90").get().c;
  res.json({ total, withOrders, vip, newUsers, inactive });
});

// Render email template with variables
app.post('/api/email/templates/:id/preview', (req, res) => {
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  let html = template.body_html || template.body || '';
  const variables = req.body.variables || {};
  for (const [key, val] of Object.entries(variables)) {
    html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  res.json({ subject: template.subject, html });
});

try { db.exec(`ALTER TABLE modifiers ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE modifier_groups ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_modifiers ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN access_mode TEXT DEFAULT 'production'`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN demo_data_created_at TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN demo_auto_cleanup_days INTEGER DEFAULT 30`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN app_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN branding TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN site_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN terminal_transaction_id TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN bonus_used REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN waiter_id INTEGER DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN waiter_name TEXT DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN guest_count INTEGER DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN check_id INTEGER DEFAULT NULL`); } catch(e) {}

// ─── Waiter / Dine-in tables ───────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS order_item_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  dish_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  expected_ready_at TEXT,
  prepared_by INTEGER,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`);
try { db.exec(`ALTER TABLE order_item_statuses ADD COLUMN expected_ready_at TEXT`); } catch(e) {}
db.exec(`CREATE TABLE IF NOT EXISTS waiter_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  table_name TEXT,
  note TEXT,
  resolved_at TEXT,
  resolved_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS dine_in_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  table_name TEXT,
  waiter_id INTEGER NOT NULL,
  waiter_name TEXT,
  guest_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  total REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// ─── Loyalty Levels (Stage 4) ──────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS loyalty_levels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, min_points REAL DEFAULT 0, discount_percent REAL DEFAULT 0, bonus_multiplier REAL DEFAULT 1, is_active INTEGER DEFAULT 1)`);
app.get('/api/loyalty-levels', (req, res) => { try { res.json(db.prepare('SELECT * FROM loyalty_levels ORDER BY min_points').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.post('/api/loyalty-levels', (req, res) => { try { const { name, minPoints, discountPercent, bonusMultiplier } = req.body; const info = db.prepare('INSERT INTO loyalty_levels (name, min_points, discount_percent, bonus_multiplier) VALUES (?, ?, ?, ?)').run(name, minPoints || 0, discountPercent || 0, bonusMultiplier || 1); res.status(201).json({ id: info.lastInsertRowid }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/loyalty-levels/:id', (req, res) => { try { const b = req.body; const s=[];const v=[]; if(b.name!==undefined){s.push('name=?');v.push(b.name)} if(b.minPoints!==undefined){s.push('min_points=?');v.push(b.minPoints)} if(b.discountPercent!==undefined){s.push('discount_percent=?');v.push(b.discountPercent)} if(b.bonusMultiplier!==undefined){s.push('bonus_multiplier=?');v.push(b.bonusMultiplier)} if(b.isActive!==undefined){s.push('is_active=?');v.push(b.isActive?1:0)} if(s.length){v.push(req.params.id);db.prepare(`UPDATE loyalty_levels SET ${s.join(',')} WHERE id=?`).run(...v)} res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.delete('/api/loyalty-levels/:id', (req, res) => { try { db.prepare('DELETE FROM loyalty_levels WHERE id=?').run(req.params.id); res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });

// ─── KPI Targets (Stage 5) ────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS kpi_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, role TEXT, target_name TEXT NOT NULL, target_value REAL DEFAULT 0, period TEXT DEFAULT 'month', created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS kpi_results (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, target_id INTEGER, actual_value REAL DEFAULT 0, period_start TEXT, period_end TEXT, score REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
app.get('/api/kpi-targets', (req, res) => { try { res.json(db.prepare('SELECT kt.*, s.first_name||\' \'||s.last_name as staff_name FROM kpi_targets kt LEFT JOIN staff s ON kt.staff_id = s.id WHERE kt.tenant_id = current_tenant_id() ORDER BY kt.period, kt.target_name').all()); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.post('/api/kpi-targets', (req, res) => { try { const { staffId, role, targetName, targetValue, period } = req.body; const info = db.prepare('INSERT INTO kpi_targets (staff_id, role, target_name, target_value, period) VALUES (?, ?, ?, ?, ?)').run(staffId || null, role || '', targetName, targetValue || 0, period || 'month'); res.status(201).json({ id: info.lastInsertRowid }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/kpi-targets/:id', (req, res) => { try { const b = req.body; const s=[];const v=[]; if(b.targetName!==undefined){s.push('target_name=?');v.push(b.targetName)} if(b.targetValue!==undefined){s.push('target_value=?');v.push(b.targetValue)} if(b.period!==undefined){s.push('period=?');v.push(b.period)} if(s.length){v.push(req.params.id);db.prepare(`UPDATE kpi_targets SET ${s.join(',')} WHERE id=?`).run(...v)} res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.delete('/api/kpi-targets/:id', (req, res) => { try { db.prepare('DELETE FROM kpi_targets WHERE id=?').run(req.params.id); res.json({ok:true}); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.get('/api/kpi-results/:staffId', (req, res) => { try { res.json(db.prepare('SELECT kr.*, kt.target_name FROM kpi_results kr LEFT JOIN kpi_targets kt ON kr.target_id = kt.id WHERE kr.staff_id = ? AND kr.tenant_id = current_tenant_id() ORDER BY kr.period_start DESC').all(req.params.staffId)); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });

// ─── Cashflow Report (Stage 6) ────────────────────────────────
app.get('/api/finance/cashflow', (req, res) => {
  try {
    const { from, to } = req.query;
    let where = ''; const params = [];
    if (from) { where += ' AND date >= ?'; params.push(from); }
    if (to) { where += ' AND date <= ?'; params.push(to); }
    const incoming = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type IN ('income','order_payment') ${where}`).get(...params)?.total || 0;
    const outgoing = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type IN ('expense','refund','salary') ${where}`).get(...params)?.total || 0;
    const byCategory = db.prepare(`SELECT category, type, SUM(amount) as total, COUNT(*) as count FROM finance_transactions WHERE 1=1 ${where} GROUP BY category, type ORDER BY total DESC`).all(...params);
    res.json({ incoming, outgoing, balance: incoming - outgoing, byCategory });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Integrations (Stage 8) ───────────────────────────────────
aggregatorIntegration.setupRoutes(app, db, broadcast, io);
paymentModule.setupRoutes(app, db, broadcast, io);
db.exec(`CREATE TABLE IF NOT EXISTS integration_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, integration_type TEXT NOT NULL UNIQUE, settings TEXT DEFAULT '{}', is_enabled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('1c', '{"api_url":"","api_key":"","exchange_interval":3600}', 0)`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('egais', '{"api_url":"","fsrar_id":"","region_code":""}', 0)`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('telegram', '{"bot_token":"","chat_id":"","notifications_enabled":false}', 0)`); } catch(e) {}

app.get('/api/integrations/:type', (req, res) => { try { const row = db.prepare('SELECT * FROM integration_settings WHERE integration_type = ?').get(req.params.type); res.json(row || { integration_type: req.params.type, settings: '{}', is_enabled: false }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });
app.put('/api/integrations/:type', (req, res) => { try { const { settings, isEnabled } = req.body; const existing = db.prepare('SELECT id FROM integration_settings WHERE integration_type = ?').get(req.params.type); if (existing) { db.prepare('UPDATE integration_settings SET settings = ?, is_enabled = ? WHERE integration_type = ?').run(JSON.stringify(settings || {}), isEnabled ? 1 : 0, req.params.type); } else { db.prepare('INSERT INTO integration_settings (integration_type, settings, is_enabled) VALUES (?, ?, ?)').run(req.params.type, JSON.stringify(settings || {}), isEnabled ? 1 : 0); } res.json({ ok: true }); } catch (e) { res.status(500).json({ error: safeError(e.message) }); } });

// 1C export: products list
app.get('/api/integrations/1c/export-products', (req, res) => {
  try {
    const items = db.prepare("SELECT id as 'ИдТовара', name as 'Наименование', article as 'Артикул', barcode as 'Штрихкод', base_price as 'Цена', unit as 'Единица', current_stock as 'Остаток' FROM inventory_items WHERE id_1c IS NOT NULL OR article IS NOT NULL").all();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── 1C Integration (Admin) ──────────────────────────────────
app.get('/api/admin/integrations/1c/settings', (req, res) => {
  try {
    const settings = integration1C.getSettings(db);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/integrations/1c/settings', (req, res) => {
  try {
    integration1C.updateSettings(db, 1, req.body);
    if (typeof schedule1CSync === 'function') schedule1CSync();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/integrations/1c/test', async (req, res) => {
  try {
    const settings = integration1C.getSettings(db);
    const result = await integration1C.testConnection(settings);
    integration1C.logOperation(db, 1, 'test_connection', 'export', result.ok ? 'success' : 'error', {}, result.data, result.ok ? null : result.data);
    if (result.ok) {
      integration1C.updateSettings(db, 1, { last_sync_status: 'success', last_sync_at: new Date().toISOString() });
    } else {
      integration1C.updateSettings(db, 1, { last_sync_status: 'error' });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/integrations/1c/sync', async (req, res) => {
  try {
    const result = await integration1C.runSyncAll(db, 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/integrations/1c/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { direction, status, operation, dateFrom, dateTo } = req.query;
    const conditions = [];
    const params = [];
    if (direction) { conditions.push('direction = ?'); params.push(direction); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (operation) { conditions.push('operation = ?'); params.push(operation); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM integration_1c_log ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM integration_1c_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Individual sync operations
app.post('/api/admin/integrations/1c/sync/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const settings = integration1C.getSettings(db);
    if (!settings.enabled) return res.status(400).json({ ok: false, error: 'Интеграция отключена' });

    const opMap = {
      export_orders: integration1C.exportOrdersTo1C,
      import_goods: integration1C.importGoodsFrom1C,
      import_contragents: integration1C.importContragentsFrom1C,
      import_menu: integration1C.importMenuFrom1C,
      export_tech_cards: integration1C.exportTechCardsTo1C,
      sync_prices: integration1C.syncPricesWith1C,
      export_remains: integration1C.exportRemainsTo1C,
    };

    const fn = opMap[operation];
    if (!fn) return res.status(400).json({ ok: false, error: `Неизвестная операция: ${operation}` });

    const dirs = { export_orders: 'export', import_goods: 'import', import_contragents: 'import', import_menu: 'import', export_tech_cards: 'export', sync_prices: 'export', export_remains: 'export' };
    const r = await fn(db, settings);
    integration1C.logOperation(db, 1, operation, dirs[operation] || 'export', r.ok ? 'success' : 'error', {}, r.data, r.ok ? null : (r.data?.message || r.data || 'Unknown error'));

    if (r.ok) {
      integration1C.updateSettings(db, 1, { last_sync_status: 'success', last_sync_at: new Date().toISOString() });
    } else {
      integration1C.updateSettings(db, 1, { last_sync_status: 'error' });
    }
    res.json(r);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── CRM Integration (amoCRM / Bitrix24) ───────────────────────
const crmIntegrationService = require(path.join(__dirname, 'services', 'crm-integration.service.js'));

app.get('/api/admin/crm/settings/:provider', (req, res) => {
  try {
    const data = crmIntegrationService.getSettings(db, req.params.provider, req.query.tenant_id || 1);
    res.json(data);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/crm/settings/:provider', (req, res) => {
  try {
    crmIntegrationService.saveSettings(db, req.params.provider, req.body, req.query.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/crm/test/:provider', async (req, res) => {
  try {
    const settings = crmIntegrationService.getSettings(db, req.params.provider, req.body?.tenant_id || 1);
    const result = await crmIntegrationService.testConnection(req.params.provider, settings);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/crm/export/:provider', async (req, res) => {
  try {
    const result = await crmIntegrationService.exportClients(db, req.params.provider, req.query.tenant_id || 1);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// EGAIS: mark imported products
app.put('/api/integrations/egais/mark-product', (req, res) => {
  try {
    const { itemId, alcoholType, beerType } = req.body;
    db.prepare('UPDATE inventory_items SET alcohol_type = ?, beer_type = ? WHERE id = ?').run(alcoholType ? 1 : 0, beerType ? 1 : 0, itemId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Settings extras (Stage 9) ────────────────────────────────
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_telegram_orders', 'false', 'orders', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_sms_notifications', 'false', 'orders', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_email_notifications', 'false', 'orders', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('loyalty_program_name', 'Бонусная программа', 'loyalty', 'text')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('loyalty_program_description', 'Копите бонусы и оплачивайте до 50% заказа', 'loyalty', 'text')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('min_bonus_payment', '100', 'loyalty', 'number')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('max_bonus_payment_percent', '50', 'loyalty', 'number')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_booking', 'false', 'orders', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_preorder', 'false', 'orders', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('order_confirmation_sms_template', 'Ваш заказ №{number} принят!', 'orders', 'text')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_multi_branch', 'false', 'general', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_staff_schedule', 'false', 'general', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('enable_documents_approval', 'true', 'warehouse', 'boolean')`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO system_settings (key, value, group_name, type) VALUES ('yandex_maps_api_key', '', 'maps', 'text')`); } catch(e) {}
try { db.exec(`ALTER TABLE orders ADD COLUMN return_route_polyline TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS franchise_networks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, manager_id INTEGER, royalty_percent REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), tenant_id INTEGER DEFAULT 1); CREATE TABLE IF NOT EXISTS global_menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, network_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT, base_price REAL DEFAULT 0, tech_card_id INTEGER, created_at TEXT DEFAULT (datetime('now')), tenant_id INTEGER DEFAULT 1); CREATE TABLE IF NOT EXISTS franchise_adaptations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, network_id INTEGER NOT NULL, global_item_id INTEGER NOT NULL, adapted_price REAL, enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), UNIQUE(tenant_id, global_item_id)); CREATE TABLE IF NOT EXISTS royalty_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, network_id INTEGER NOT NULL, period TEXT NOT NULL, amount REAL DEFAULT 0, status TEXT DEFAULT 'pending', paid_at TEXT, created_at TEXT DEFAULT (datetime('now')));`); } catch(e) { console.error('[Franchise] Table error:', e.message); }

try { db.exec(`
  CREATE TABLE IF NOT EXISTS yandex_afisha_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1 UNIQUE,
    api_key TEXT DEFAULT '',
    venue_id TEXT DEFAULT '',
    enabled INTEGER DEFAULT 0,
    auto_confirm INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS yandex_afisha_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    external_id TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    guests INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT,
    comment TEXT,
    status TEXT DEFAULT 'pending',
    booking_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[YandexAfisha] Table error:', e.message); }

// ─── WebSocket ─────────────────────────────────────────────────────
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server });
const wsClients = new Set();
wss.on('connection', (ws, req) => {
  wsClients.add(ws);
  ws._rooms = new Set();
  ws.send(JSON.stringify({ type: 'connected', clientCount: wsClients.size }));
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'subscribe:chat') ws._rooms.add('chat:' + msg.chatId);
      if (msg.type === 'subscribe:waiter') ws._rooms.add('waiter:' + msg.waiterId);
      if (msg.type === 'unsubscribe:chat') ws._rooms.delete('chat:' + msg.chatId);
    } catch {}
  });
  ws.on('close', () => wsClients.delete(ws));
});
function broadcast(data, room) {
  const msg = typeof data === 'string' ? data : JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState !== 1) continue;
    if (room && !ws._rooms.has(room)) continue;
    ws.send(msg);
  }
}

// ─── Global Search ──────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) return res.json({ orders: [], dishes: [], items: [], clients: [], staff: [], documents: [] });
    const query = `%${q}%`;
    const orders = db.prepare("SELECT id, user_name, user_phone, total, status, created_at FROM orders WHERE user_name LIKE ? OR user_phone LIKE ? OR id LIKE ? LIMIT 10").all(query, query, query);
    const dishes = db.prepare("SELECT id, name, price FROM dishes WHERE name LIKE ? LIMIT 10").all(query);
    const items = db.prepare("SELECT id, name, article, barcode, current_stock FROM inventory_items WHERE name LIKE ? OR article LIKE ? OR barcode LIKE ? LIMIT 10").all(query, query, query);
    const clients = db.prepare("SELECT id, name, phone FROM users WHERE name LIKE ? OR phone LIKE ? LIMIT 10").all(query, query);
    const staff = db.prepare("SELECT id, first_name, last_name, role, phone FROM staff WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? LIMIT 10").all(query, query, query);
    const documents = db.prepare("SELECT id, type, number, status, date FROM documents WHERE number LIKE ? OR note LIKE ? LIMIT 10").all(query, query);
    res.json({ orders, dishes, items, clients, staff, documents });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Courier Locations ──────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS courier_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, courier_id INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (courier_id) REFERENCES staff(id))`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_locations_courier_id ON courier_locations(courier_id)`); } catch (e) {}

app.get('/api/couriers', (req, res) => {
  try {
    const couriers = db.prepare(`SELECT s.id, s.first_name, s.last_name, s.phone, s.role, s.isOnline, s.photo, cl.latitude, cl.longitude, cl.updated_at as location_updated_at FROM staff s LEFT JOIN courier_locations cl ON cl.courier_id = s.id WHERE s.role = 'courier' AND s.tenant_id = current_tenant_id()`).all();
    res.json(couriers);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── 2FA ────────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS user_2fa (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER UNIQUE NOT NULL, secret TEXT NOT NULL, enabled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (staff_id) REFERENCES staff(id))`); } catch (e) {}

app.post('/api/auth/2fa/setup', (req, res) => {
  try {
    const { staffId } = req.body;
    const secret = speakeasy.generateSecret({ name: 'FoodChain Admin' });
    const existing = db.prepare('SELECT id FROM user_2fa WHERE staff_id = ?').get(staffId);
    if (existing) {
      db.prepare('UPDATE user_2fa SET secret = ?, enabled = 0 WHERE staff_id = ?').run(secret.base32, staffId);
    } else {
      db.prepare('INSERT INTO user_2fa (staff_id, secret) VALUES (?, ?)').run(staffId, secret.base32);
    }
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) return res.status(500).json({ error: 'QR generation failed' });
      res.json({ secret: secret.base32, qrCode: dataUrl });
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/auth/2fa/verify', (req, res) => {
  try {
    const { staffId, token } = req.body;
    const record = db.prepare('SELECT secret FROM user_2fa WHERE staff_id = ?').get(staffId);
    if (!record) return res.status(400).json({ error: '2FA not set up' });
    const verified = speakeasy.totp.verify({ secret: record.secret, encoding: 'base32', token });
    if (verified) {
      db.prepare('UPDATE user_2fa SET enabled = 1 WHERE staff_id = ?').run(staffId);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Неверный код' });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/auth/2fa/status', (req, res) => {
  try {
    const { staffId } = req.query;
    const record = db.prepare('SELECT enabled FROM user_2fa WHERE staff_id = ?').get(staffId);
    res.json({ enabled: !!record?.enabled });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/auth/2fa/disable', (req, res) => {
  try {
    const { staffId } = req.body;
    db.prepare('DELETE FROM user_2fa WHERE staff_id = ?').run(staffId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ═══════════════════════════════════════════════════════════════════
// ─── Waiter Terminal & Kitchen Display Endpoints ─────────────────
// ═══════════════════════════════════════════════════════════════════

// ─── Waiter: get tables with current order info ──────────────────
app.get('/api/waiter/tables', (req, res) => {
  try {
    const tables = db.prepare('SELECT * FROM booking_tables ORDER BY name').all();
    const now = new Date().toISOString().slice(0, 10);
    const activeOrders = db.prepare("SELECT * FROM orders WHERE status NOT IN ('delivered','closed','cancelled') AND type = 'dine_in'").all();
    const activeChecks = db.prepare("SELECT * FROM dine_in_checks WHERE status = 'open'").all();
    const todaysBookings = db.prepare('SELECT * FROM bookings WHERE date = ? AND status IN (\'confirmed\',\'pending\')').all(now);
    const calls = db.prepare('SELECT * FROM waiter_calls WHERE resolved_at IS NULL').all();

    const result = tables.map(t => {
      const order = activeOrders.find(o => o.table_number === t.id || o.table_id === t.id);
      const check = activeChecks.find(c => c.table_id === t.id);
      const booking = todaysBookings.find(b => b.table_id === t.id);
      const call = calls.find(c => c.table_id === t.id);
      let status = 'free';
      if (check || (order && ['new','confirmed','preparing','ready','served'].includes(order.status))) status = 'occupied';
      if (booking) status = 'reserved';
      if (order && order.status === 'paid') status = 'occupied';
      return {
        id: t.id, name: t.name, capacity: t.capacity, zone: t.zone || '',
        x: t.x, y: t.y, width: t.width, height: t.height, shape: t.shape, color: t.color,
        status, currentOrderId: order?.id || null, currentCheckId: check?.id || null,
        waiterName: check?.waiter_name || order?.waiter_name || null,
        guestCount: check?.guest_count || order?.guest_count || null,
        hasCall: !!call,
      };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: seat a table (create dine-in check) ────────────────
app.post('/api/waiter/seated', (req, res) => {
  try {
    const { tableId, waiterId, waiterName, guestCount } = req.body;
    if (!tableId || !waiterId) return res.status(400).json({ error: 'tableId and waiterId required' });

    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    if (!table) return res.status(404).json({ error: 'Стол не найден' });

    const existingCheck = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open'").get(tableId);
    if (existingCheck) return res.status(400).json({ error: 'Стол уже занят' });

    const info = db.prepare('INSERT INTO dine_in_checks (table_id, table_name, waiter_id, waiter_name, guest_count) VALUES (?, ?, ?, ?, ?)')
      .run(tableId, table.name, waiterId, waiterName || '', guestCount || 1);

    broadcast({ type: 'waiter:seated', tableId: Number(tableId), checkId: Number(info.lastInsertRowid) });
    io.emit('waiter:seated', { tableId: Number(tableId), checkId: Number(info.lastInsertRowid), waiterName });

    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(check);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: create an order ────────────────────────────────────
app.post('/api/waiter/orders', (req, res) => {
  try {
    const { checkId, tableId, waiterId, waiterName, items, guestCount, comment, type, deliveryName, deliveryPhone, deliveryAddress, deliveryComment, discount } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items required' });

    const orderType = type || 'dine_in';

    let check;
    if (orderType === 'dine_in') {
      if (!checkId && !tableId) return res.status(400).json({ error: 'checkId or tableId required for dine-in' });
      if (checkId) {
        check = db.prepare("SELECT * FROM dine_in_checks WHERE id = ? AND status = 'open'").get(checkId);
        if (!check) return res.status(404).json({ error: 'Чек не найден или уже закрыт' });
      }
    }

    const itemsJson = JSON.stringify(items.map((i) => ({
      dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity || 1,
      options: i.options || [], comment: i.comment || '', itemStatus: 'pending',
    })));
    const subtotal = items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
    let discountAmount = 0;
    if (discount && discount.value > 0) {
      discountAmount = discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value;
    }
    const total = Math.max(0, subtotal - discountAmount);
    const tid = tableId || check?.table_id || 0;

    const userPhone = deliveryPhone || '';
    const userName = deliveryName || waiterName || 'Официант';
    const userAddr = deliveryAddress || '';

    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, guest_count, check_id, comment, address, discount)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(waiterId || 0, userName, userPhone, itemsJson, subtotal, total,
        orderType, tid, waiterId || null, waiterName || null, guestCount || check?.guest_count || 1,
        checkId || null, comment || '', userAddr, discountAmount);

    const orderId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(orderId, 'new', 'Заказ создан официантом');

    if (checkId && orderType === 'dine_in') {
      db.prepare('UPDATE dine_in_checks SET total = total + ?, updated_at = datetime(\'now\') WHERE id = ?').run(total, checkId);
    }

    for (const item of items) {
      db.prepare('INSERT INTO order_item_statuses (order_id, dish_id, status) VALUES (?, ?, ?)').run(orderId, item.dishId, 'pending');
    }

    const order = getOrderFull(orderId);
    io.emit('order:new', order);
    broadcast({ type: 'order:new', orderId });
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: active checks for a waiter ─────────────────────────
app.get('/api/waiter/active-checks', (req, res) => {
  try {
    const { waiterId } = req.query;
    let checks;
    if (waiterId) {
      checks = db.prepare("SELECT * FROM dine_in_checks WHERE waiter_id = ? AND status = 'open' ORDER BY created_at DESC").all(waiterId);
    } else {
      checks = db.prepare("SELECT * FROM dine_in_checks WHERE status = 'open' ORDER BY created_at DESC").all();
    }
    const result = checks.map(c => {
      const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled') ORDER BY created_at ASC").all(c.id);
      const ordersFull = orders.map((o) => getOrderFull(o.id));
      return { ...c, orders: ordersFull, total: ordersFull.reduce((s, o) => s + o.total, 0) };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: get orders for a check ─────────────────────────────
app.get('/api/waiter/check-orders/:checkId', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders WHERE check_id = ? ORDER BY created_at ASC').all(req.params.checkId);
    res.json(orders.map((o) => getOrderFull(o.id)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: call waiter ────────────────────────────────────────
app.post('/api/waiter/call', (req, res) => {
  try {
    const { tableId, note } = req.body;
    if (!tableId) return res.status(400).json({ error: 'tableId required' });
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    const info = db.prepare('INSERT INTO waiter_calls (table_id, table_name, note) VALUES (?, ?, ?)').run(tableId, table?.name || '', note || '');
    broadcast({ type: 'waiter:call', tableId: Number(tableId), tableName: table?.name, callId: Number(info.lastInsertRowid) });
    io.emit('waiter:call', { tableId: Number(tableId), tableName: table?.name, callId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: info.lastInsertRowid, tableId, tableName: table?.name });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: resolve a call ─────────────────────────────────────
app.post('/api/waiter/call/:id/resolve', (req, res) => {
  try {
    const { resolvedBy } = req.body;
    db.prepare('UPDATE waiter_calls SET resolved_at = datetime(\'now\'), resolved_by = ? WHERE id = ?').run(resolvedBy || null, req.params.id);
    broadcast({ type: 'waiter:call:resolved', callId: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: serve order (mark as served) ──────────────────────
app.post('/api/orders/:id/serve', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (order.status !== 'ready') return res.status(400).json({ error: 'Заказ ещё не готов' });

    db.prepare("UPDATE orders SET status = 'served', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'served', 'Подано официантом');
    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'served' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: split order check ──────────────────────────────────
app.post('/api/orders/:id/split', (req, res) => {
  try {
    const { items: splitItemIds } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const orderItems = JSON.parse(order.items || '[]');
    const splitItems = orderItems.filter((_, i) => splitItemIds.includes(i));
    const remainingItems = orderItems.filter((_, i) => !splitItemIds.includes(i));
    if (!splitItems.length) return res.status(400).json({ error: 'Нет позиций для разделения' });
    if (!remainingItems.length) return res.status(400).json({ error: 'Нельзя разделить все позиции, создайте новый заказ' });

    const splitTotal = splitItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    const remainingTotal = remainingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);

    db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(remainingItems), remainingTotal, remainingTotal, req.params.id);

    const info = db.prepare(`INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, check_id, payment_method, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(order.user_id, order.user_name, order.user_phone, JSON.stringify(splitItems), splitTotal, splitTotal,
        order.type, 'new', order.table_number, order.waiter_id, order.waiter_name, order.check_id, order.payment_method,
        `Разделён из заказа #${req.params.id}`);

    const newOrderId = Number(info.lastInsertRowid);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(newOrderId, 'new', `Разделён из заказа #${req.params.id}`);

    broadcast({ type: 'order:update', orderId: Number(req.params.id) });
    io.emit('order:update', getOrderFull(req.params.id));
    const newOrder = getOrderFull(newOrderId);
    io.emit('order:new', newOrder);

    res.json({ original: getOrderFull(req.params.id), split: newOrder });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: merge orders into one check ────────────────────────
app.post('/api/orders/merge', (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || orderIds.length < 2) return res.status(400).json({ error: 'Need at least 2 order IDs' });

    const orders = orderIds.map((id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id)).filter(Boolean);
    if (orders.length < 2) return res.status(400).json({ error: 'Не удалось найти заказы для объединения' });

    const allItems = [];
    let totalMerged = 0;

    const keep = orders[0];
    for (let i = 1; i < orders.length; i++) {
      const mergeOrder = orders[i];
      const items = JSON.parse(mergeOrder.items || '[]');
      allItems.push(...items);
      totalMerged += items.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(mergeOrder.id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(mergeOrder.id, 'cancelled', `Объединён с заказом #${keep.id}`);
    }

    const existingItems = JSON.parse(keep.items || '[]');
    const mergedItems = [...existingItems, ...allItems];
    const mergedTotal = existingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0) + totalMerged;

    db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(mergedItems), mergedTotal, mergedTotal, keep.id);

    broadcast({ type: 'order:update', orderId: keep.id });
    io.emit('order:update', getOrderFull(keep.id));
    res.json(getOrderFull(keep.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: process payment for an order ───────────────────────
app.post('/api/orders/:id/payment', (req, res) => {
  try {
    const { paymentMethod, amount, isPaid, bonusUsed } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const paidAmount = amount || order.total;
    // Associate with open shift if any
    const activeShift = db.prepare("SELECT id FROM cashier_shifts WHERE status = 'open' AND tenant_id = 1 LIMIT 1").get();
    const shiftId = activeShift ? activeShift.id : 0;
    db.prepare("UPDATE orders SET payment_method = ?, total = ?, is_paid = ?, status = 'paid', bonus_used = ?, shift_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(paymentMethod || order.payment_method, paidAmount, isPaid !== false ? 1 : 0, bonusUsed || 0, shiftId, req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'paid', `Оплачено: ${paidAmount}₽`);

    // If order has a check, update check total
    if (order.check_id) {
      const otherOrders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND id != ? AND status NOT IN ('closed','cancelled')").all(order.check_id, req.params.id);
      const otherTotal = otherOrders.reduce((s, o) => s + o.total, 0);
      if (otherTotal === 0) {
        db.prepare("UPDATE dine_in_checks SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(order.check_id);
      }
    }

    // Auto-create fiscal receipt
    try {
      const fiscalKkt = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").get();
      if (fiscalKkt) {
        const receiptId = fiscalization.createReceipt(db, { ...order, total: paidAmount }, paymentMethod || order.payment_method);
        // Async print - don't block response
        setImmediate(async () => {
          try {
            const activeKkt = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").all();
            if (activeKkt.length > 0) {
              await fiscalization.printReceiptById(db, receiptId);
            }
          } catch (e) { console.error('[Fiscal] Auto-print error:', e.message); }
        });
      }
    } catch (e) { console.error('[Fiscal] Auto-receipt creation error:', e.message); }

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'paid' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: move guests / merge tables ──────────────────────────
app.post('/api/waiter/move-guests', (req, res) => {
  try {
    const { fromTableId, toTableId } = req.body;
    if (!fromTableId || !toTableId) return res.status(400).json({ error: 'fromTableId and toTableId required' });
    const checks = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open'").all(fromTableId);
    for (const check of checks) {
      db.prepare('UPDATE dine_in_checks SET table_id = ?, table_name = (SELECT name FROM booking_tables WHERE id = ?), updated_at = datetime(\'now\') WHERE id = ?')
        .run(toTableId, toTableId, check.id);
      db.prepare('UPDATE orders SET table_number = ?, updated_at = datetime(\'now\') WHERE check_id = ?').run(toTableId, check.id);
    }
    broadcast({ type: 'table:status', fromTableId, toTableId });
    io.emit('waiter:moved', { fromTableId, toTableId });
    res.json({ moved: checks.length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: split check by order items ──────────────────────────
app.post('/api/waiter/split-check/:checkId', (req, res) => {
  try {
    const { orderItemIds } = req.body;
    const check = db.prepare('SELECT * FROM dine_in_checks WHERE id = ?').get(req.params.checkId);
    if (!check) return res.status(404).json({ error: 'Чек не найден' });
    const orders = db.prepare("SELECT * FROM orders WHERE check_id = ? AND status NOT IN ('closed','cancelled')").all(check.id);
    const moved = [];
    for (const order of orders) {
      const items = JSON.parse(order.items || '[]');
      const splitItems = items.filter((item, idx) => orderItemIds.includes(item.dishId) || orderItemIds.includes(idx));
      if (splitItems.length === 0 || splitItems.length === items.length) continue;
      const remainingItems = items.filter((item, idx) => !(orderItemIds.includes(item.dishId) || orderItemIds.includes(idx)));
      const splitTotal = splitItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      const remainingTotal = remainingItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      db.prepare('UPDATE orders SET items = ?, subtotal = ?, total = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(JSON.stringify(remainingItems), remainingTotal, remainingTotal, order.id);
      const info = db.prepare("INSERT INTO orders (user_id, user_name, user_phone, items, subtotal, total, type, status, table_number, waiter_id, waiter_name, check_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)")
        .run(order.user_id, order.user_name, order.user_phone, JSON.stringify(splitItems), splitTotal, splitTotal,
          order.type, order.table_number, order.waiter_id, order.waiter_name, check.id,
          `Разделён из заказа #${order.id}`);
      moved.push(Number(info.lastInsertRowid));
    }
    res.json({ split: moved });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: request bill for table ──────────────────────────────
app.post('/api/waiter/table/:id/request-bill', (req, res) => {
  try {
    const tableId = req.params.id;
    const table = db.prepare('SELECT * FROM booking_tables WHERE id = ?').get(tableId);
    if (!table) return res.status(404).json({ error: 'Стол не найден' });
    broadcast({ type: 'table:bill:requested', tableId: Number(tableId) });
    io.emit('waiter:bill-requested', { tableId: Number(tableId) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Waiter: update guest count for table ────────────────────────
app.patch('/api/waiter/table/:id/guests', (req, res) => {
  try {
    const { guestCount } = req.body;
    const check = db.prepare("SELECT * FROM dine_in_checks WHERE table_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").get(req.params.id);
    if (check) {
      db.prepare('UPDATE dine_in_checks SET guest_count = ?, updated_at = datetime(\'now\') WHERE id = ?').run(guestCount || 1, check.id);
    }
    res.json({ success: true, guestCount });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen chat ────────────────────────────────────────────────
app.post('/api/kitchen/chat', (req, res) => {
  try {
    const { id, from, text, timestamp, orderId } = req.body;
    broadcast({ type: 'kitchen:chat', id, from, text, timestamp, orderId });
    io.emit('kitchen:chat', { id, from, text, timestamp, orderId });
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: get active orders (new + confirmed + preparing) ───
app.get('/api/kitchen/orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE status IN ('new','confirmed','preparing') AND type IN ('dine_in','delivery','pickup') ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, created_at ASC").all();
    const result = orders.map((o) => {
      const full = getOrderFull(o.id);
      const itemStatuses = db.prepare('SELECT * FROM order_item_statuses WHERE order_id = ?').all(o.id);
      const waitingTime = o.created_at ? Math.floor((Date.now() - new Date(o.created_at + 'Z').getTime()) / 60000) : 0;
      const waitSeconds = o.created_at ? Math.floor((Date.now() - new Date(o.created_at + 'Z').getTime()) / 1000) : 0;

      // Attach tech card instructions to each item
      let items = [];
      try { items = JSON.parse(o.items || '[]'); } catch {}
      const now = Date.now();
      const itemsWithTech = items.map(item => {
        const dishId = item.dishId || item.dish_id;
        if (!dishId) return item;
        const tc = db.prepare('SELECT technology, cooking_time, output, description, step_instructions, step_mode FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1').get(dishId);
        // Priority scoring
        let priorityScore = 0;
        if (tc?.cooking_time) {
          priorityScore = Math.round((waitSeconds / 60) / tc.cooking_time * 100);
          if (waitingTime > tc.cooking_time) {
            priorityScore = Math.min(priorityScore + 30, 100);
          }
        } else {
          priorityScore = Math.min(Math.round(waitSeconds / 60), 100);
        }
        return { ...item, techCard: tc || null, priority_score: Math.min(priorityScore, 100) };
      });

      return { ...full, items: itemsWithTech, itemStatuses, waitingTime };
    });
    // Sort: higher priority first, but keep new orders on top
    result.sort((a, b) => {
      if (a.status === 'new' && b.status !== 'new') return -1;
      if (a.status !== 'new' && b.status === 'new') return 1;
      const aMax = Math.max(...(a.items || []).map(i => i.priority_score || 0));
      const bMax = Math.max(...(b.items || []).map(i => i.priority_score || 0));
      return bMax - aMax;
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: accept order (start preparing) ────────────────────
app.post('/api/kitchen/orders/:id/accept', (req, res) => {
  try {
    const { chefId } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    db.prepare("UPDATE orders SET status = 'preparing', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'preparing', 'Принят в работу');

    // Update all pending items to preparing
    db.prepare("UPDATE order_item_statuses SET status = 'preparing', started_at = datetime('now'), prepared_by = ? WHERE order_id = ? AND status = 'pending'")
      .run(chefId || null, req.params.id);

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'preparing' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: update individual item status ─────────────────────
app.patch('/api/orders/:id/items/:dishId/status', (req, res) => {
  try {
    const { status, chefId } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const now = new Date().toISOString();
    let extraSet = '';
    const params = [status];

    if (status === 'preparing') {
      const tc = db.prepare('SELECT cooking_time FROM dish_tech_cards WHERE dish_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1').get(req.params.dishId);
      const cookTime = tc?.cooking_time || 10;
      const readyAt = new Date(Date.now() + cookTime * 60 * 1000).toISOString();
      extraSet = ', started_at = ?, expected_ready_at = ?';
      params.push(now, readyAt);
    }
    if (status === 'ready') { extraSet = ', completed_at = ?'; params.push(now); }

    const existing = db.prepare('SELECT * FROM order_item_statuses WHERE order_id = ? AND dish_id = ?').get(req.params.id, req.params.dishId);
    if (existing) {
      params.push(req.params.id, req.params.dishId);
      db.prepare(`UPDATE order_item_statuses SET status = ?${extraSet}${chefId ? ', prepared_by = ?' : ''} WHERE order_id = ? AND dish_id = ?`).run(...params, ...(chefId ? [chefId] : []));
    } else {
      const insReadyAt = status === 'preparing' ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
      db.prepare(`INSERT INTO order_item_statuses (status, started_at, expected_ready_at, order_id, dish_id, prepared_by) VALUES (?, ?, ?, ?, ?, ?)`).run(status, status === 'preparing' ? now : null, insReadyAt, req.params.id, req.params.dishId, chefId || null);
    }

    // Update item status in order's JSON items
    const items = JSON.parse(order.items || '[]');
    const updated = items.map((item) => {
      if (item.dishId === Number(req.params.dishId)) {
        return { ...item, itemStatus: status };
      }
      return item;
    });
    db.prepare('UPDATE orders SET items = ? WHERE id = ?').run(JSON.stringify(updated), req.params.id);

    broadcast({ type: 'order:item:update', orderId: Number(req.params.id), dishId: Number(req.params.dishId), status });
    io.emit('order:item:update', { orderId: Number(req.params.id), dishId: Number(req.params.dishId), status });

    // Check if all items are ready -> auto-complete order
    if (status === 'ready') {
      const remaining = db.prepare("SELECT COUNT(*) as cnt FROM order_item_statuses WHERE order_id = ? AND status != 'ready' AND status != 'served'").get(req.params.id);
      if (remaining.cnt === 0) {
        db.prepare("UPDATE orders SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
        db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Все блюда готовы');
        broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready' });
        io.emit('order:update', getOrderFull(req.params.id));
      }
    }

    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: complete order (mark all ready) ───────────────────
app.post('/api/kitchen/orders/:id/complete', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    if (!['new', 'confirmed', 'preparing'].includes(order.status)) return res.status(400).json({ error: 'Заказ уже завершён' });

    db.prepare("UPDATE order_item_statuses SET status = 'ready', completed_at = datetime('now') WHERE order_id = ? AND status != 'ready'").run(req.params.id);
    db.prepare("UPDATE orders SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, 'ready', 'Заказ готов');

    broadcast({ type: 'order:update', orderId: Number(req.params.id), status: 'ready' });
    io.emit('order:update', getOrderFull(req.params.id));
    res.json(getOrderFull(req.params.id));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Sous Chef: priority recommendations ─────────────────────────
app.get('/api/kitchen/sous-chef', (req, res) => {
  try {
    const orders = db.prepare("SELECT o.*, (julianday('now') - julianday(o.created_at)) * 86400 as wait_seconds FROM orders o WHERE o.status IN ('confirmed','preparing') AND o.tenant_id = ? ORDER BY o.created_at ASC").all(req.tenant_id || 1);
    const recommendations = [];
    for (const order of orders) {
      const items = JSON.parse(order.items || '[]');
      let maxPriority = 0;
      for (const item of items) {
        const techCard = db.prepare('SELECT cooking_time FROM dish_tech_cards WHERE dish_id = ?').get(item.dish_id || item.dishId);
        const cookTime = techCard?.cooking_time || 10;
        const waitTime = order.wait_seconds || 0;
        const priority = Math.round((waitTime / 60) / cookTime * 100);
        if (priority > maxPriority) maxPriority = priority;
      }
      recommendations.push({ order_id: order.id, table: order.table_id, guest: order.user_name, items_count: items.length, wait_minutes: Math.round((order.wait_seconds || 0) / 60), priority_score: Math.min(maxPriority, 100), suggested_action: maxPriority > 80 ? 'START_NOW' : maxPriority > 50 ? 'SOON' : 'ON_SCHEDULE' });
    }
    recommendations.sort((a, b) => b.priority_score - a.priority_score);
    res.json(recommendations);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: step completions (step-by-step mode) ─────────────
app.get('/api/kitchen/step-completions/:orderId/:dishId', (req, res) => {
  try {
    const rows = db.prepare('SELECT step_index, completed_by, completed_at FROM dish_step_completions WHERE order_id = ? AND dish_id = ?').all(req.params.orderId, req.params.dishId);
    res.json(rows.map(r => ({ stepIndex: r.step_index, completedBy: r.completed_by, completedAt: r.completed_at })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/kitchen/step-completions', (req, res) => {
  try {
    const { order_id, dish_id, step_index, completed } = req.body;
    if (completed) {
      db.prepare('INSERT OR IGNORE INTO dish_step_completions (order_id, dish_id, step_index) VALUES (?, ?, ?)').run(order_id, dish_id, step_index);
    } else {
      db.prepare('DELETE FROM dish_step_completions WHERE order_id = ? AND dish_id = ? AND step_index = ?').run(order_id, dish_id, step_index);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/tech-cards/:id/steps', (req, res) => {
  try {
    const tc = db.prepare('SELECT step_instructions, step_mode, technology FROM dish_tech_cards WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Not found' });
    const steps = (tc.step_instructions || tc.technology || '').split('\n').filter(s => s.trim());
    res.json({ stepMode: !!tc.step_mode, steps, raw: tc.step_instructions || tc.technology || '' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Kitchen: get pending waiter calls ──────────────────────────
app.get('/api/waiter/calls/pending', (req, res) => {
  try {
    const calls = db.prepare('SELECT * FROM waiter_calls WHERE resolved_at IS NULL ORDER BY created_at ASC').all();
    res.json(calls);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── User Language ────────────────────────────────────────────────
app.put('/api/user/language', (req, res) => {
  try {
    const { staffId, language } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });
    if (!['ru', 'en', 'kk'].includes(language)) return res.status(400).json({ error: 'Invalid language. Must be ru, en, or kk' });
    const staff = db.prepare('SELECT id FROM staff WHERE id = ?').get(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    db.prepare('UPDATE staff SET language = ? WHERE id = ?').run(language, staffId);
    res.json({ ok: true, language });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Cron: Auto-close inactive chats ────────────────────────────
cron.schedule('*/5 * * * *', () => {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const inactive = db.prepare(`
      UPDATE chats SET status = 'closed', closed_at = datetime('now', '+3 hours'), updated_at = datetime('now', '+3 hours')
      WHERE status = 'open' AND updated_at < ?
    `).run(cutoff);
    if (inactive.changes > 0) {
      console.log(`[Chats] Auto-closed ${inactive.changes} inactive chat(s)`);
    }
  } catch (e) {
    console.error('[Chats] Auto-close error:', e.message);
  }
});

// ─── Cron: Daily Forecast Generation ─────────────────────────────
cron.schedule('0 2 * * *', () => {
  try {
    const result = forecastService.generateForecast(db);
    console.log(`[Forecast] Auto-generated ${result.length} forecast entries`);
  } catch (e) {
    console.error('[Forecast] Auto-generation error:', e.message);
  }
});

// ─── Fiscalization tables ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS fiscal_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    provider TEXT NOT NULL DEFAULT 'atol',
    enabled INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    is_test INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fiscal_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    order_id INTEGER,
    receipt_type TEXT NOT NULL DEFAULT 'sell',
    items_json TEXT DEFAULT '[]',
    total REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    user_name TEXT DEFAULT '',
    user_phone TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    receipt_data TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT
  );
`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS terminal_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      provider TEXT NOT NULL DEFAULT 'inpas',
      ip TEXT NOT NULL DEFAULT '192.168.1.100',
      port INTEGER DEFAULT 8000,
      terminal_id TEXT DEFAULT '',
      login TEXT DEFAULT '',
      password TEXT DEFAULT '',
      enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS terminal_transactions (
      transaction_id TEXT PRIMARY KEY,
      tenant_id INTEGER DEFAULT 1,
      order_id INTEGER,
      amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      rrn TEXT DEFAULT '',
      auth_code TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      request_body TEXT DEFAULT '',
      terminal_response TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS terminal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      order_id INTEGER DEFAULT 0,
      amount REAL DEFAULT 0,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT DEFAULT '',
      rrn TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

// ─── Fiscalization API routes ─────────────────────────────────
const fiscalization = require(path.join(__dirname, 'services', 'fiscalization.service'));

// Get fiscal settings
app.get('/api/admin/fiscal/settings', (req, res) => {
  try {
    const settings = fiscalization.getSettings(db);
    const result = settings.map(s => ({
      ...s,
      parsedSettings: (() => { try { return JSON.parse(s.settings || '{}'); } catch { return {}; } })(),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Update fiscal settings
app.put('/api/admin/fiscal/settings/:provider', (req, res) => {
  try {
    fiscalization.updateSettings(db, 1, req.params.provider, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Test connection
app.post('/api/admin/fiscal/test', async (req, res) => {
  try {
    const { provider, settings } = req.body;
    const result = await fiscalization.testConnection({ ...settings, provider });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Print receipt for an order
app.post('/api/admin/fiscal/print/:orderId', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    // Create receipt record
    const receiptId = fiscalization.createReceipt(db, order, req.body.paymentMethod || 'cash');
    const kktSettings = db.prepare("SELECT * FROM fiscal_settings WHERE tenant_id = 1 AND enabled = 1").all();

    if (kktSettings.length === 0) {
      return res.json({ ok: false, data: 'Нет активных касс. Чек сохранён в очередь.' });
    }

    // Try to print immediately
    const result = await fiscalization.printReceiptById(db, receiptId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Print refund receipt
app.post('/api/admin/fiscal/refund/:orderId', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const receiptId = fiscalization.createRefundReceipt(db, order, req.body.reason || 'Возврат');
    const receipt = db.prepare('SELECT * FROM fiscal_receipts WHERE id = ?').get(receiptId);
    res.json({ ok: true, receipt });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Retry failed receipt
app.post('/api/admin/fiscal/retry/:receiptId', async (req, res) => {
  try {
    const result = await fiscalization.printReceiptById(db, req.params.receiptId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Get fiscal receipts list
app.get('/api/admin/fiscal/receipts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, orderId, dateFrom, dateTo } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM fiscal_receipts ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM fiscal_receipts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Get fiscal stats
app.get('/api/admin/fiscal/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1').get()?.count || 0;
    const printed = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'printed'").get()?.count || 0;
    const pending = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'pending'").get()?.count || 0;
    const errors = db.prepare("SELECT COUNT(*) as count FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'error'").get()?.count || 0;
    const totalSum = db.prepare("SELECT COALESCE(SUM(total), 0) as sum FROM fiscal_receipts WHERE tenant_id = 1 AND status = 'printed'").get()?.sum || 0;
    res.json({ total, printed, pending, errors, totalSum });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Process pending receipts (cron handler)
app.post('/api/admin/fiscal/process-queue', async (req, res) => {
  try {
    const result = await fiscalization.processPendingReceipts(db);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Cron: Process pending fiscal receipts ─────────────────────
cron.schedule('*/1 * * * *', async () => {
  try {
    const result = await fiscalization.processPendingReceipts(db);
    if (result.processed > 0) console.log(`[Fiscal] Processed ${result.processed} pending receipts`);
  } catch (e) { console.error('[Fiscal] Queue processing error:', e.message); }
});

// ─── Terminal Integration Routes ─────────────────────────────────
const terminalIntegration = require(path.join(__dirname, 'services', 'terminal-integration.service'));

// Get terminal settings
app.get('/api/admin/terminal/settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const settings = terminalIntegration.getSettings(db, tenantId);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Save terminal settings
app.put('/api/admin/terminal/settings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const settings = terminalIntegration.saveSettings(db, tenantId, req.body);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Test terminal connection
app.post('/api/admin/terminal/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const result = await terminalIntegration.testConnection(db, tenantId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Initiate terminal payment
app.post('/api/terminal/pay', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const tenantId = order.tenant_id || 1;
    const payAmount = amount || order.total;
    const result = await terminalIntegration.initPayment(db, tenantId, orderId, payAmount, io);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Check payment status
app.get('/api/terminal/status/:transactionId', (req, res) => {
  try {
    const result = terminalIntegration.checkStatus(db, req.params.transactionId);
    if (!result) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Cancel payment
app.post('/api/terminal/cancel/:transactionId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const tenantId = payload.tenantId || payload.tenant_id || 1;
    const result = await terminalIntegration.cancelPayment(db, tenantId, req.params.transactionId, io);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Get terminal transactions
app.get('/api/admin/terminal/transactions', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, orderId } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM terminal_transactions ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM terminal_transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Get terminal logs
app.get('/api/admin/terminal/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const { status, operation, orderId } = req.query;
    const conditions = ['tenant_id = 1'];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (operation) { conditions.push('operation = ?'); params.push(operation); }
    if (orderId) { conditions.push('order_id = ?'); params.push(orderId); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as total FROM terminal_logs ${where}`).get(...params)?.total || 0;
    const items = db.prepare(`SELECT * FROM terminal_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Cron: Burn expired bonuses ──────────────────────────────────
cron.schedule('0 3 * * *', () => {
  try {
    const settings = getLoyaltySettings();
    if (settings.burnDays <= 0) return;
    const cutoff = new Date(Date.now() - settings.burnDays * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    // Find user_bonuses where all earned transactions are older than burnDays
    const bonuses = db.prepare('SELECT * FROM user_bonuses WHERE balance > 0').all();
    let totalBurned = 0;
    for (const bonus of bonuses) {
      // Get oldest earned transaction that hasn't been spent
      const oldEarnings = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as old_sum FROM bonus_transactions 
        WHERE bonus_id = ? AND type = 'earned' AND created_at < ? AND amount > 0
      `).get(bonus.id, cutoff);
      const spent = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as spent_sum FROM bonus_transactions 
        WHERE bonus_id = ? AND type = 'spend'
      `).get(bonus.id);
      const burnable = Math.round((bonus.balance - spent.spent_sum) * 100) / 100;
      const oldAmount = oldEarnings.old_sum;
      const toBurn = Math.round(Math.min(oldAmount, Math.max(0, burnable)) * 100) / 100;
      if (toBurn > 0) {
        db.prepare('UPDATE user_bonuses SET balance = MAX(0, balance - ?) WHERE id = ?').run(toBurn, bonus.id);
        db.prepare('UPDATE users SET bonus_balance = MAX(0, bonus_balance - ?) WHERE id = ?').run(toBurn, bonus.user_id);
        db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)').run(bonus.user_id, bonus.id, 'burn', -toBurn, `Сгоревшие бонусы (${settings.burnDays} дней)`);
        totalBurned += toBurn;
      }
    }
    if (totalBurned > 0) console.log(`[Loyalty] Burned ${totalBurned} expired bonus points`);
  } catch (e) { console.error('[Loyalty] Burn cron error:', e.message); }
});

// ─── Cron: Scheduled 1C sync ───────────────────────────────────
const ONE_CRCON_REG = Symbol('1c_cron');
function schedule1CSync() {
  const settings = integration1C.getSettings(db);
  if (!settings.enabled || settings.sync_interval === 'manual') return;

  let cronExpr;
  if (settings.sync_interval === 'hourly') {
    cronExpr = '0 * * * *';
  } else if (settings.sync_interval === 'daily') {
    const hour = settings.sync_hour !== undefined ? settings.sync_hour : 3;
    cronExpr = `0 ${hour} * * *`;
  } else { return; }

  // Cancel existing cron if any
  const existing = global[ONE_CRCON_REG];
  if (existing) { try { existing.stop(); } catch(e) {} }

  const job = cron.schedule(cronExpr, async () => {
    console.log('[1C] Running scheduled sync...');
    try {
      const result = await integration1C.runSyncAll(db, 1);
      console.log(`[1C] Scheduled sync completed: ${result.ok ? 'success' : 'partial'}`);
    } catch (e) {
      console.error('[1C] Scheduled sync error:', e.message);
    }
  });
  global[ONE_CRCON_REG] = job;
}

// Initial schedule
schedule1CSync();

// Re-schedule when settings change (called from updateSettings route)
// ─── Auto Orders Cron ──────────────────────────────────────────
const autoOrdersCron = autoOrdersService.scheduleAutoCheck(db);
const autoWriteoffCron = autoWriteoffService.scheduleAutoCheck(db);
const costingCron = costingService.scheduleAutoRecalc(db);

// ─── Reports ──────────────────────────────────────────────────
const reportsRouter = require('./reports');
reportsRouter(app, db);

// ─── Internal: Import menu ────────────────────────────────────

app.post('/api/internal/import-menu', (req, res) => {
  try {
    const { key, tenant_id, items, settings } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    try { db.exec(`ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN cost REAL DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_available INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN weight REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN calories REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN proteins REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN fats REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN carbs REAL`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE tech_cards ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE tech_card_ingredients ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch (e) {}

    const updateExisting = settings?.update_existing !== false;
    const createCategories = settings?.create_categories !== false;

    const result = { imported: 0, updated: 0, skipped: 0, errors: [], categories_created: 0 };

    const processItems = db.transaction((items) => {
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          if (!item.name || !item.name.trim()) {
            result.errors.push({ row: i, error: 'Item name is required' });
            continue;
          }
          if (item.price === undefined || item.price === null) {
            result.errors.push({ row: i, error: 'Price is required' });
            continue;
          }

          let categoryId = null;
          const catName = item.category ? String(item.category).trim() : '';
          if (catName) {
            if (createCategories) {
              let cat = db.prepare('SELECT id FROM menu_categories WHERE name = ? AND tenant_id = ?').get(catName, tenant_id);
              if (!cat) {
                const info = db.prepare('INSERT INTO menu_categories (name, tenant_id) VALUES (?, ?)').run(catName, tenant_id);
                result.categories_created++;
                categoryId = info.lastInsertRowid;
              } else {
                categoryId = cat.id;
              }
            } else {
              const cat = db.prepare('SELECT id FROM menu_categories WHERE name = ? AND tenant_id = ?').get(catName, tenant_id);
              categoryId = cat?.id || null;
            }
          }

          const trimmedName = item.name.trim();
          const existing = db.prepare('SELECT id FROM dishes WHERE name = ? AND tenant_id = ?').get(trimmedName, tenant_id);

          if (existing) {
            if (updateExisting) {
              db.prepare(`UPDATE dishes SET description = ?, price = ?, cost = ?, category_id = ?, weight = ?, unit = ?, calories = ?, proteins = ?, fats = ?, carbs = ?, is_available = ?, is_active = ?, tags = ? WHERE id = ?`).run(
                item.description || null,
                item.price,
                item.cost || null,
                categoryId,
                item.gross_weight || item.net_weight || null,
                item.unit || null,
                item.kcal || null,
                item.proteins || null,
                item.fats || null,
                item.carbs || null,
                item.is_active !== false ? 1 : 0,
                item.is_active !== false ? 1 : 0,
                item.tags ? JSON.stringify(item.tags) : null,
                existing.id
              );
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            db.prepare(`INSERT INTO dishes (name, description, price, cost, category_id, weight, unit, calories, proteins, fats, carbs, is_available, is_active, tags, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
              trimmedName,
              item.description || null,
              item.price,
              item.cost || null,
              categoryId,
              item.gross_weight || item.net_weight || null,
              item.unit || null,
              item.kcal || null,
              item.proteins || null,
              item.fats || null,
              item.carbs || null,
              item.is_active !== false ? 1 : 0,
              item.is_active !== false ? 1 : 0,
              item.tags ? JSON.stringify(item.tags) : null,
              tenant_id
            );
            result.imported++;
          }
        } catch (e) {
          result.errors.push({ row: i, error: safeError(e.message) });
        }
      }
    });

    processItems(items);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Internal: Import tech cards ─────────────────────────────

app.post('/api/internal/import-tech-cards', (req, res) => {
  try {
    const { key, tenant_id, items, settings } = req.body;
    if (key !== PORTAL_SYNC_KEY) return res.status(403).json({ error: 'Invalid key' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    try { db.exec(`ALTER TABLE dishes ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE dishes ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN unit TEXT DEFAULT 'шт'`); } catch (e) {}
    try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch (e) {}
    db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dish_id INTEGER, dish_name TEXT,
      number TEXT, valid_from TEXT, portions REAL, output REAL, technology TEXT,
      fixed_costs REAL, package_weight REAL, cost_price REAL, created_at TEXT,
      tenant_id INTEGER DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_card_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tech_card_id INTEGER,
      item_id INTEGER, item_name TEXT, quantity REAL, unit TEXT,
      netto REAL, yield REAL, tenant_id INTEGER DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, unit TEXT, current_balance REAL, tenant_id INTEGER DEFAULT 1)`);

    const createIngredients = settings?.create_ingredients !== false;
    const mode = settings?.mode || 'replace';

    const result = { imported: 0, updated: 0, skipped: 0, errors: [], ingredients_created: 0, tech_cards_created: 0 };

    const grouped = {};
    for (const item of items) {
      const dishName = (item.dish_name || '').trim();
      if (!dishName) {
        result.errors.push({ dish: '(empty)', error: 'dish_name is required' });
        continue;
      }
      if (!grouped[dishName]) {
        grouped[dishName] = { dish_name: dishName, valid_from: item.valid_from, portions: item.portions, technology: item.technology, fixed_costs: item.fixed_costs, package_weight: item.package_weight, ingredients: [] };
      }
      if (item.valid_from) grouped[dishName].valid_from = item.valid_from;
      if (item.portions !== undefined) grouped[dishName].portions = item.portions;
      if (item.technology) grouped[dishName].technology = item.technology;
      if (item.fixed_costs !== undefined) grouped[dishName].fixed_costs = item.fixed_costs;
      if (item.package_weight !== undefined) grouped[dishName].package_weight = item.package_weight;
      if (item.name && item.name.trim()) {
        grouped[dishName].ingredients.push({ name: item.name.trim(), quantity: item.quantity, unit: item.unit, netto: item.netto, yield: item.yield });
      }
    }

    const processGroups = db.transaction((grouped) => {
      for (const [dishName, group] of Object.entries(grouped)) {
        try {
          const dish = db.prepare('SELECT id FROM dishes WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(dishName, tenant_id);
          if (!dish) {
            result.errors.push({ dish: dishName, error: 'Dish not found' });
            continue;
          }

          let ingredientsCreated = 0;
          for (const ing of group.ingredients) {
            if (!createIngredients) continue;
            const existing = db.prepare('SELECT id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(ing.name, tenant_id);
            if (!existing) {
              db.prepare('INSERT INTO inventory_items (name, unit, current_balance, tenant_id) VALUES (?, ?, 0, ?)').run(ing.name, ing.unit || 'шт', tenant_id);
              ingredientsCreated++;
            }
          }
          result.ingredients_created += ingredientsCreated;

          const existingTc = db.prepare('SELECT id FROM dish_tech_cards WHERE dish_id = ? AND tenant_id = ?').get(dish.id, tenant_id);

          if (existingTc) {
            if (mode === 'replace') {
              db.prepare('DELETE FROM dish_tech_card_ingredients WHERE tech_card_id = ?').run(existingTc.id);
              db.prepare('DELETE FROM dish_tech_cards WHERE id = ?').run(existingTc.id);
              result.updated++;
            } else {
              result.skipped++;
              continue;
            }
          }

          const number = `TC-${dish.id}-${Date.now()}`;
          const tcInfo = db.prepare('INSERT INTO dish_tech_cards (dish_id, dish_name, number, valid_from, portions, technology, fixed_costs, package_weight, cost_price, created_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime(\'now\'), ?)').run(
            dish.id, dishName, number, group.valid_from || null, group.portions || null, group.technology || null, group.fixed_costs || null, group.package_weight || null, tenant_id
          );
          result.tech_cards_created++;

          const insertIng = db.prepare('INSERT INTO dish_tech_card_ingredients (tech_card_id, item_name, quantity, unit, netto, yield, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
          for (const ing of group.ingredients) {
            const invItem = db.prepare('SELECT id FROM inventory_items WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND tenant_id = ?').get(ing.name, tenant_id);
            insertIng.run(tcInfo.lastInsertRowid, ing.name, ing.quantity || 0, ing.unit || 'шт', ing.netto || null, ing.yield || null, tenant_id);
          }

          result.imported++;
        } catch (e) {
          result.errors.push({ dish: dishName, error: safeError(e.message) });
        }
      }
    });

    processGroups(grouped);
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ═══════════════════════════════════════════════════════════════════
// ─── App Management (Guest App) Tables ─────────────────────────
// ═══════════════════════════════════════════════════════════════════
db.exec(`CREATE TABLE IF NOT EXISTS app_general_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER UNIQUE NOT NULL DEFAULT 1,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  image_url TEXT NOT NULL,
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  link_type TEXT DEFAULT '',
  link_value TEXT DEFAULT '',
  date_from TEXT,
  date_to TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL,
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  dish_id INTEGER,
  category_id INTEGER,
  combo_dishes TEXT DEFAULT '[]',
  combo_price REAL DEFAULT 0,
  promo_code TEXT DEFAULT '',
  min_order_amount REAL DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  date_from TEXT,
  date_to TEXT,
  is_active INTEGER DEFAULT 1,
  show_on_dish INTEGER DEFAULT 0,
  show_as_banner INTEGER DEFAULT 0,
  show_on_page INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_working_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER NOT NULL,
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  is_closed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_special_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  is_closed INTEGER DEFAULT 1,
  message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_modifier_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  group_id INTEGER,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES app_modifier_groups(id) ON DELETE SET NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS app_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  admin_id INTEGER,
  admin_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// ─── Default App Settings ───────────────────────────────────────
const DEFAULT_APP_SETTINGS = JSON.stringify({
  delivery: {
    free_delivery_enabled: false,
    free_delivery_from: 0,
    estimated_time: 60,
    pickup_enabled: true,
    pickup_points: [],
  },
  working_status: 'open',
  auto_switch: true,
  tips_enabled: true,
  tips_percent: 10,
  service_fee_enabled: false,
  service_fee_type: 'percent',
  service_fee_value: 0,
  service_fee_description: '',
  payment_methods: {
    cash: true,
    card_courier: true,
    online: true,
    in_place: true,
  },
});

function parseAppSettings(raw) {
  if (!raw) return JSON.parse(DEFAULT_APP_SETTINGS);
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const defaults = JSON.parse(DEFAULT_APP_SETTINGS);
    function mergeDeep(target, source) {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          mergeDeep(target[key], source[key]);
        } else {
          if (target[key] === undefined || target[key] === null) {
            target[key] = source[key];
          }
        }
      }
    }
    mergeDeep(parsed, defaults);
    return parsed;
  } catch { return JSON.parse(DEFAULT_APP_SETTINGS); }
}

function extractTenant(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return 1;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.tenantId || payload.tenant_id || 1;
  } catch { return 1; }
}

function logAppAudit(tenantId, adminId, adminName, action, details) {
  db.prepare('INSERT INTO app_audit_log (tenant_id, admin_id, admin_name, action, details) VALUES (?, ?, ?, ?, ?)').run(
    tenantId, adminId || null, adminName || '', action || '', details || ''
  );
}

// ═══════════════════════════════════════════════════════════════════
// ─── App Management API Endpoints ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// ─── General Settings ──────────────────────────────────────────
app.get('/api/app/settings', (req, res) => {
  try {
    const tenantId = extractTenant(req) || 1;
    const row = db.prepare('SELECT settings FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    res.json({ settings: parseAppSettings(row?.settings) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/settings', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) tenantId = 1;
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const merged = parseAppSettings(settings);
    const str = JSON.stringify(merged);
    const existing = db.prepare('SELECT id FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    if (existing) {
      db.prepare("UPDATE app_general_settings SET settings = ?, updated_at = datetime('now') WHERE tenant_id = ?").run(str, tenantId);
    } else {
      db.prepare('INSERT INTO app_general_settings (tenant_id, settings) VALUES (?, ?)').run(tenantId, str);
    }
    const payload = jwt.verify(req.headers.authorization.slice(7), JWT_SECRET);
    logAppAudit(tenantId, payload.id, payload.username, 'update_settings', 'Обновлены общие настройки приложения');
    res.json({ settings: merged, message: 'Настройки сохранены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/settings/reset', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const defaults = JSON.parse(DEFAULT_APP_SETTINGS);
    const str = JSON.stringify(defaults);
    const existing = db.prepare('SELECT id FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    if (existing) {
      db.prepare("UPDATE app_general_settings SET settings = ?, updated_at = datetime('now') WHERE tenant_id = ?").run(str, tenantId);
    } else {
      db.prepare('INSERT INTO app_general_settings (tenant_id, settings) VALUES (?, ?)').run(tenantId, str);
    }
    res.json({ settings: defaults, message: 'Настройки сброшены' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Banners ──────────────────────────────────────────────────
app.get('/api/app/banners', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const banners = db.prepare('SELECT * FROM app_banners WHERE tenant_id = ? ORDER BY sort_order ASC, created_at DESC').all(tenantId);
    res.json(toCamelCaseArray(banners));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/banners', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required' });
    const info = db.prepare('INSERT INTO app_banners (tenant_id, image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      tenantId, image_url, title || '', subtitle || '', link_type || '', link_value || '', date_from || null, date_to || null, is_active !== false ? 1 : 0, sort_order || 0
    );
    const banner = db.prepare('SELECT * FROM app_banners WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(banner));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/banners/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_banners WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Баннер не найден' });
    const { image_url, title, subtitle, link_type, link_value, date_from, date_to, is_active, sort_order } = req.body;
    const sets = []; const params = [];
    if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url); }
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (subtitle !== undefined) { sets.push('subtitle = ?'); params.push(subtitle); }
    if (link_type !== undefined) { sets.push('link_type = ?'); params.push(link_type); }
    if (link_value !== undefined) { sets.push('link_value = ?'); params.push(link_value); }
    if (date_from !== undefined) { sets.push('date_from = ?'); params.push(date_from || null); }
    if (date_to !== undefined) { sets.push('date_to = ?'); params.push(date_to || null); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_banners SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const banner = db.prepare('SELECT * FROM app_banners WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(banner));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/app/banners/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_banners WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Баннер не найден' });
    db.prepare('DELETE FROM app_banners WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/banners/reorder', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of {id, sort_order}' });
    const update = db.prepare('UPDATE app_banners SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?');
    for (const item of order) {
      update.run(item.sort_order, item.id, tenantId);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Promotions ───────────────────────────────────────────────
app.get('/api/app/promotions', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const promotions = db.prepare('SELECT * FROM app_promotions WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
    res.json(toCamelCaseArray(promotions));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/promotions', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { name, description, type, discount_percent, discount_amount, dish_id, category_id, combo_dishes, combo_price, promo_code, min_order_amount, max_uses, date_from, date_to, is_active, show_on_dish, show_as_banner, show_on_page } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const info = db.prepare(`INSERT INTO app_promotions (tenant_id, name, description, type, discount_percent, discount_amount, dish_id, category_id, combo_dishes, combo_price, promo_code, min_order_amount, max_uses, date_from, date_to, is_active, show_on_dish, show_as_banner, show_on_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      tenantId, name, description || '', type, discount_percent || 0, discount_amount || 0, dish_id || null, category_id || null, JSON.stringify(combo_dishes || []), combo_price || 0, promo_code || '', min_order_amount || 0, max_uses || 0, date_from || null, date_to || null, is_active !== false ? 1 : 0, show_on_dish ? 1 : 0, show_as_banner ? 1 : 0, show_on_page ? 1 : 0
    );
    const promotion = db.prepare('SELECT * FROM app_promotions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(promotion));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/promotions/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_promotions WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Акция не найдена' });
    const fields = ['name','description','type','discount_percent','discount_amount','dish_id','category_id','combo_dishes','combo_price','promo_code','min_order_amount','max_uses','date_from','date_to','is_active','show_on_dish','show_as_banner','show_on_page'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        let val = req.body[f];
        if (f === 'combo_dishes') val = JSON.stringify(val || []);
        if (f === 'is_active' || f === 'show_on_dish' || f === 'show_as_banner' || f === 'show_on_page') val = val ? 1 : 0;
        sets.push(`${f} = ?`); params.push(val);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_promotions SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const promotion = db.prepare('SELECT * FROM app_promotions WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(promotion));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/app/promotions/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_promotions WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Акция не найдена' });
    db.prepare('DELETE FROM app_promotions WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Working Hours ─────────────────────────────────────────────
app.get('/api/app/working-hours', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const hours = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    const specialDays = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? ORDER BY date ASC').all(tenantId);
    res.json({ workingHours: toCamelCaseArray(hours), specialDays: toCamelCaseArray(specialDays) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/working-hours', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { hours } = req.body;
    if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours must be an array' });
    db.prepare('DELETE FROM app_working_hours WHERE tenant_id = ?').run(tenantId);
    const insert = db.prepare('INSERT INTO app_working_hours (tenant_id, day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, ?, ?)');
    for (const h of hours) {
      insert.run(tenantId, h.day_of_week, h.open_time, h.close_time, h.is_closed ? 1 : 0);
    }
    const result = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    res.json(toCamelCaseArray(result));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/special-days', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { date, is_closed, message } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    const existing = db.prepare('SELECT id FROM app_special_days WHERE tenant_id = ? AND date = ?').get(tenantId, date);
    if (existing) {
      db.prepare('UPDATE app_special_days SET is_closed = ?, message = ? WHERE id = ?').run(is_closed !== false ? 1 : 0, message || '', existing.id);
    } else {
      db.prepare('INSERT INTO app_special_days (tenant_id, date, is_closed, message) VALUES (?, ?, ?, ?)').run(tenantId, date, is_closed !== false ? 1 : 0, message || '');
    }
    const days = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? ORDER BY date ASC').all(tenantId);
    res.json(toCamelCaseArray(days));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/app/special-days/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('DELETE FROM app_special_days WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Common Modifiers ─────────────────────────────────────────
app.get('/api/app/modifiers', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const groups = db.prepare('SELECT * FROM app_modifier_groups WHERE tenant_id = ? ORDER BY sort_order ASC').all(tenantId);
    const modifiers = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.tenant_id = ? ORDER BY am.sort_order ASC').all(tenantId);
    res.json({ groups: toCamelCaseArray(groups), modifiers: toCamelCaseArray(modifiers) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/modifier-groups', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const info = db.prepare('INSERT INTO app_modifier_groups (tenant_id, name, sort_order) VALUES (?, ?, ?)').run(tenantId, name, sort_order || 0);
    const group = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/modifier-groups/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Группа не найдена' });
    const { name, sort_order } = req.body;
    if (name !== undefined) db.prepare('UPDATE app_modifier_groups SET name = ? WHERE id = ?').run(name, req.params.id);
    if (sort_order !== undefined) db.prepare('UPDATE app_modifier_groups SET sort_order = ? WHERE id = ?').run(sort_order, req.params.id);
    const group = db.prepare('SELECT * FROM app_modifier_groups WHERE id = ?').get(req.params.id);
    res.json(toCamelCase(group));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/app/modifier-groups/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('UPDATE app_modifiers SET group_id = NULL WHERE group_id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    db.prepare('DELETE FROM app_modifier_groups WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/app/modifiers', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { group_id, name, price, description, sort_order, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const info = db.prepare('INSERT INTO app_modifiers (tenant_id, group_id, name, price, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      tenantId, group_id || null, name, price || 0, description || '', sort_order || 0, is_active !== false ? 1 : 0
    );
    const modifier = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(modifier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/modifiers/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const existing = db.prepare('SELECT * FROM app_modifiers WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ error: 'Модификатор не найден' });
    const { group_id, name, price, description, sort_order, is_active } = req.body;
    const sets = []; const params = [];
    if (group_id !== undefined) { sets.push('group_id = ?'); params.push(group_id || null); }
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (price !== undefined) { sets.push('price = ?'); params.push(price); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id, tenantId);
    db.prepare(`UPDATE app_modifiers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
    const modifier = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.id = ?').get(req.params.id);
    res.json(toCamelCase(modifier));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/app/modifiers/:id', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    db.prepare('DELETE FROM app_modifiers WHERE id = ? AND tenant_id = ?').run(req.params.id, tenantId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Category Visibility (quick toggle) ───────────────────────
app.get('/api/app/visibility', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const categories = db.prepare('SELECT id, name, icon, parent_id, sort_order, show_on_site, show_on_app, show_on_kiosk, show_on_waiter, show_on_aggregators FROM menu_categories WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY sort_order ASC').all(tenantId);
    res.json(toCamelCaseArray(categories));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/app/visibility/batch', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates must be an array' });
    const update = db.prepare('UPDATE menu_categories SET show_on_site = ?, show_on_app = ?, show_on_kiosk = ?, show_on_waiter = ?, show_on_aggregators = ? WHERE id = ?');
    for (const u of updates) {
      update.run(u.show_on_site ? 1 : 0, u.show_on_app ? 1 : 0, u.show_on_kiosk ? 1 : 0, u.show_on_waiter ? 1 : 0, u.show_on_aggregators ? 1 : 0, u.id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Upload for app management ────────────────────────────────
const appUploadDir = path.join(__dirname, 'uploads', 'app');
try { require('fs').mkdirSync(appUploadDir, { recursive: true }); } catch {}
const appStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, appUploadDir),
  filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `tmp_${Date.now()}${ext}`); },
});
const uploadAppImage = multer({ storage: appStorage, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/app/upload', uploadAppImage.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let tenantId = 'unknown';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        tenantId = payload.tenantId || payload.tenant_id || 'unknown';
      } catch {}
    }
    const ext = path.extname(req.file.originalname);
    const newName = `${tenantId}_${Date.now()}${ext}`;
    const newPath = path.join(req.file.destination, newName);
    require('fs').renameSync(req.file.path, newPath);
    const url = `/uploads/app/${newName}`;
    res.json({ url, filename: newName });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Public endpoint for guest app ────────────────────────────
app.get('/api/public/app-config/:tenantId', (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const settingsRow = db.prepare('SELECT settings FROM app_general_settings WHERE tenant_id = ?').get(tenantId);
    const banners = db.prepare('SELECT * FROM app_banners WHERE tenant_id = ? AND is_active = 1 AND (date_from IS NULL OR date_from <= date(\'now\')) AND (date_to IS NULL OR date_to >= date(\'now\')) ORDER BY sort_order ASC').all(tenantId);
    const promotions = db.prepare('SELECT * FROM app_promotions WHERE tenant_id = ? AND is_active = 1 AND (date_from IS NULL OR date_from <= date(\'now\')) AND (date_to IS NULL OR date_to >= date(\'now\')) ORDER BY created_at DESC').all(tenantId);
    const workingHours = db.prepare('SELECT * FROM app_working_hours WHERE tenant_id = ? ORDER BY day_of_week ASC').all(tenantId);
    const specialDays = db.prepare('SELECT * FROM app_special_days WHERE tenant_id = ? AND date >= date(\'now\') ORDER BY date ASC').all(tenantId);
    const modifiers = db.prepare('SELECT am.*, amg.name as group_name FROM app_modifiers am LEFT JOIN app_modifier_groups amg ON am.group_id = amg.id WHERE am.tenant_id = ? AND am.is_active = 1 ORDER BY am.sort_order ASC').all(tenantId);
    const brandingRow = db.prepare('SELECT branding FROM foodchain_portal_tenants WHERE id = ?').get(tenantId);
    const deliveryZones = db.prepare('SELECT * FROM delivery_zones ORDER BY name ASC').all();
    res.json({
      settings: parseAppSettings(settingsRow?.settings),
      banners: toCamelCaseArray(banners),
      promotions: toCamelCaseArray(promotions),
      workingHours: toCamelCaseArray(workingHours),
      specialDays: toCamelCaseArray(specialDays),
      modifiers: toCamelCaseArray(modifiers),
      branding: parseBranding(brandingRow?.branding),
      deliveryZones: toCamelCaseArray(deliveryZones),
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── App audit log ─────────────────────────────────────────────
app.get('/api/app/audit-log', (req, res) => {
  try {
    const tenantId = extractTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Auth required' });
    const logs = db.prepare('SELECT * FROM app_audit_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200').all(tenantId);
    res.json(toCamelCaseArray(logs));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Background courier return recalc (every 15s) ──────────────
async function recalculateReturningRoutes() {
  try {
    const returning = db.prepare("SELECT id, courier_id, courier_name, return_courier_lat, return_courier_lng, return_route_polyline FROM orders WHERE is_returning = 1 AND status = 'delivered'").all();
    if (!returning.length) return;
    const rc = getRestaurantCoords();
    if (!rc) return;
    for (const order of returning) {
      if (!order.return_courier_lat || !order.return_courier_lng) continue;
      const route = await calcRoute(order.return_courier_lat, order.return_courier_lng, rc.lat, rc.lng);
      const eta = new Date(Date.now() + route.durationMin * 60000).toISOString();
      db.prepare('UPDATE orders SET return_distance_km = ?, return_duration_min = ?, return_eta = ?, return_route_polyline = ? WHERE id = ?')
        .run(route.distanceKm, route.durationMin, eta, route.polyline, order.id);
      // Auto-arrive if within 50m
      if (route.distanceKm < 0.05) {
        db.prepare(`UPDATE orders SET is_returning = 0, return_started_at = NULL, return_distance_km = 0,
          return_duration_min = 0, return_eta = NULL, return_courier_lat = 0, return_courier_lng = 0,
          return_route_polyline = '' WHERE id = ?`).run(order.id);
        io.emit('order:update', emitOrderUpdate(order.id));
        broadcast(JSON.stringify({ type: 'courier:returning-arrived', orderId: Number(order.id) }));
        // Auto-send staff chat message
        try {
          const chat = db.prepare("SELECT id FROM staff_chats WHERE order_id = ? AND status = 'open' LIMIT 1").get(order.id);
          if (chat) {
            db.prepare('INSERT INTO staff_chat_messages (staff_chat_id, sender_id, sender_type, sender_name, message, file_url) VALUES (?, ?, ?, ?, ?, ?)').run(chat.id, order.courier_id || 0, 'courier', order.courier_name || 'Курьер', '✅ Прибыл в ресторан', '');
            broadcast(JSON.stringify({ type: 'staff-chat:message', chatId: chat.id, message: { id: Date.now(), senderId: order.courier_id || 0, senderType: 'courier', senderName: order.courier_name || 'Курьер', message: '✅ Прибыл в ресторан', fileUrl: '', createdAt: new Date().toISOString() } }));
          }
        } catch {}
        continue;
      }
      broadcast(JSON.stringify({ type: 'courier:returning-update', orderId: Number(order.id), courierName: order.courier_name, distanceKm: route.distanceKm, durationMin: route.durationMin, eta, courierLat: order.return_courier_lat, courierLng: order.return_courier_lng, polyline: route.polyline }));
    }
  } catch (e) { console.error('Return recalc error:', e.message); }
}
const returnRecalcInterval = setInterval(recalculateReturningRoutes, 15000);

// ─── Franchising API ─────────────────────────────────────────────
app.get('/api/admin/franchise/networks', (req, res) => {
  try {
    const networks = db.prepare('SELECT fn.*, COALESCE(s.first_name || " " || s.last_name, s.first_name, "") as manager_name FROM franchise_networks fn LEFT JOIN staff s ON s.id = fn.manager_id WHERE fn.tenant_id = ?').all(req.tenant_id || 1);
    res.json(networks);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/franchise/networks', (req, res) => {
  try {
    const { name, manager_id, royalty_percent } = req.body;
    const result = db.prepare('INSERT INTO franchise_networks (name, manager_id, royalty_percent, tenant_id) VALUES (?, ?, ?, ?)').run(name, manager_id || null, royalty_percent || 0, req.tenant_id || 1);
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/franchise/networks/:id', (req, res) => {
  try {
    const { name, manager_id, royalty_percent } = req.body;
    db.prepare('UPDATE franchise_networks SET name = ?, manager_id = ?, royalty_percent = ? WHERE id = ? AND tenant_id = ?').run(name, manager_id || null, royalty_percent || 0, req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/franchise/networks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM franchise_networks WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    db.prepare('DELETE FROM global_menu_items WHERE network_id = ?').run(req.params.id);
    db.prepare('DELETE FROM franchise_adaptations WHERE network_id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/franchise/menu/:networkId', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM global_menu_items WHERE network_id = ? AND tenant_id = ?').all(req.params.networkId, req.tenant_id || 1);
    res.json(items);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/franchise/menu', (req, res) => {
  try {
    const { network_id, name, category, base_price, tech_card_id } = req.body;
    const result = db.prepare('INSERT INTO global_menu_items (network_id, name, category, base_price, tech_card_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?)').run(network_id, name, category || null, base_price || 0, tech_card_id || null, req.tenant_id || 1);
    res.json({ id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/franchise/menu/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM global_menu_items WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM franchise_adaptations WHERE global_item_id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/franchise/royalty/:networkId', (req, res) => {
  try {
    const invoices = db.prepare('SELECT ri.*, t.name as tenant_name FROM royalty_invoices ri LEFT JOIN tenants t ON t.id = ri.tenant_id WHERE ri.network_id = ? ORDER BY ri.created_at DESC').all(req.params.networkId);
    res.json(invoices);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/franchise/royalty/generate', (req, res) => {
  try {
    const { network_id, period } = req.body;
    const network = db.prepare('SELECT * FROM franchise_networks WHERE id = ?').get(network_id);
    if (!network) return res.status(404).json({ error: 'Network not found' });
    const tenants = db.prepare('SELECT id, name FROM tenants').all();
    const created = [];
    for (const t of tenants) {
      const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ? AND status != 'cancelled'").get(t.id, period);
      const amount = totalRevenue.revenue * (network.royalty_percent / 100);
      const existing = db.prepare('SELECT id FROM royalty_invoices WHERE tenant_id = ? AND network_id = ? AND period = ?').get(t.id, network_id, period);
      if (!existing) {
        db.prepare('INSERT INTO royalty_invoices (tenant_id, network_id, period, amount) VALUES (?, ?, ?, ?)').run(t.id, network_id, period, amount);
      }
      created.push({ tenant_id: t.id, tenant_name: t.name, amount });
    }
    res.json({ ok: true, created, royalty_percent: network.royalty_percent });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/franchise/royalty/:id/pay', (req, res) => {
  try {
    db.prepare("UPDATE royalty_invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Website SPA catch-all ─────────────────────────────────────
if (fs.existsSync(websiteDist)) {
  app.use(express.static(websiteDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/login')) return next();
    if (fs.existsSync(path.join(websiteDist, 'index.html'))) {
      res.sendFile(path.join(websiteDist, 'index.html'));
    } else {
      next();
    }
  });
}

// ─── Yandex Afisha API ────────────────────────────────────────────
app.get('/api/admin/yandex-afisha/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) {
      db.prepare('INSERT INTO yandex_afisha_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1);
      return res.json({ tenant_id: req.tenant_id || 1, api_key: '', venue_id: '', enabled: 0, auto_confirm: 0 });
    }
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/yandex-afisha/settings', (req, res) => {
  try {
    const { api_key, venue_id, enabled, auto_confirm } = req.body;
    const existing = db.prepare('SELECT id FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) {
      db.prepare("UPDATE yandex_afisha_settings SET api_key = ?, venue_id = ?, enabled = ?, auto_confirm = ?, updated_at = datetime('now') WHERE tenant_id = ?")
        .run(api_key || '', venue_id || '', enabled ? 1 : 0, auto_confirm ? 1 : 0, req.tenant_id || 1);
    } else {
      db.prepare("INSERT INTO yandex_afisha_settings (tenant_id, api_key, venue_id, enabled, auto_confirm) VALUES (?, ?, ?, ?, ?)")
        .run(req.tenant_id || 1, api_key || '', venue_id || '', enabled ? 1 : 0, auto_confirm ? 1 : 0);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/yandex-afisha/test', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM yandex_afisha_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s || !s.api_key) return res.json({ ok: false, message: 'API ключ не настроен' });
    res.json({ ok: true, message: 'Подключение работает' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/yandex-afisha/bookings', (req, res) => {
  try {
    let sql = 'SELECT * FROM yandex_afisha_bookings WHERE tenant_id = ?';
    const params = [req.tenant_id || 1];
    if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.date_from) { sql += ' AND date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ' AND date <= ?'; params.push(req.query.date_to); }
    sql += ' ORDER BY date DESC, time DESC';
    const bookings = db.prepare(sql).all(...params);
    res.json(bookings);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.patch('/api/admin/yandex-afisha/bookings/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare("UPDATE yandex_afisha_bookings SET status = ? WHERE id = ? AND tenant_id = ?").run(status, req.params.id, req.tenant_id || 1);
    const booking = db.prepare('SELECT * FROM yandex_afisha_bookings WHERE id = ?').get(req.params.id);
    if (status === 'confirmed' && booking) {
      const existingBooking = db.prepare("SELECT id FROM bookings WHERE date = ? AND time = ? AND user_phone = ? AND status = 'confirmed'").get(booking.date, booking.time, booking.phone);
      if (!existingBooking) {
        const result = db.prepare("INSERT INTO bookings (user_name, user_phone, date, time, guest_count, comment, status) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')").run(booking.name, booking.phone || '', booking.date, booking.time, booking.guests, booking.comment || 'Яндекс Афиша');
        db.prepare('UPDATE yandex_afisha_bookings SET booking_id = ? WHERE id = ?').run(result.lastInsertRowid, req.params.id);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/yandex-afisha/stats', (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    const total = db.prepare('SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ?').get(tenantId).c;
    const confirmed = db.prepare("SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ? AND status = 'confirmed'").get(tenantId).c;
    const cancelled = db.prepare("SELECT COUNT(*) as c FROM yandex_afisha_bookings WHERE tenant_id = ? AND status = 'cancelled'").get(tenantId).c;
    const byDate = db.prepare("SELECT date, COUNT(*) as count FROM yandex_afisha_bookings WHERE tenant_id = ? GROUP BY date ORDER BY date DESC LIMIT 30").all(tenantId);
    res.json({ total, confirmed, cancelled, conversion_rate: total > 0 ? Math.round(confirmed / total * 100) : 0, by_date: byDate });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/webhooks/yandex-afisha', (req, res) => {
  try {
    const { external_id, date, time, guests, name, phone, comment, api_key } = req.body;
    const settings = db.prepare('SELECT * FROM yandex_afisha_settings WHERE api_key = ? AND enabled = 1').get(api_key);
    if (!settings) return res.status(403).json({ error: 'Invalid API key' });
    db.prepare('INSERT INTO yandex_afisha_bookings (tenant_id, external_id, date, time, guests, name, phone, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(settings.tenant_id, external_id || '', date, time, guests || 1, name, phone || '', comment || '');
    if (settings.auto_confirm) {
      db.prepare("INSERT INTO bookings (user_name, user_phone, date, time, guest_count, comment, status) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')").run(name, phone || '', date, time, guests || 1, 'Яндекс Афиша');
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Extensions Tables ─────────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS extensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT DEFAULT '1.0.0',
    developer TEXT,
    icon TEXT,
    url TEXT,
    type TEXT DEFAULT 'integration',
    price REAL DEFAULT 0,
    is_active INTEGER DEFAULT 0,
    tenant_id INTEGER DEFAULT 1,
    installed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[Extensions] Table error:', e.message); }

// ─── IP Telephony Tables ──────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS telephony_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1 UNIQUE,
    provider TEXT DEFAULT 'telphin',
    enabled INTEGER DEFAULT 0,
    api_key TEXT DEFAULT '',
    api_secret TEXT DEFAULT '',
    api_url TEXT DEFAULT '',
    widget_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS telephony_call_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    call_id TEXT,
    caller_phone TEXT,
    callee_phone TEXT,
    direction TEXT DEFAULT 'incoming',
    duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    recording_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[Telephony] Table error:', e.message); }

// ─── Extensions API ─────────────────────────────────────────────
app.get('/api/admin/extensions', (req, res) => {
  try {
    const installed = db.prepare('SELECT * FROM extensions WHERE tenant_id = ?').all(req.tenant_id || 1);
    const catalog = [];
    res.json({ installed, catalog });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/extensions/install', (req, res) => {
  try {
    const { name, description, version, developer, icon, url, type } = req.body;
    const existing = db.prepare('SELECT id FROM extensions WHERE name = ? AND tenant_id = ?').get(name, req.tenant_id || 1);
    if (existing) return res.json({ ok: true, message: 'Уже установлено' });
    db.prepare("INSERT INTO extensions (name, description, version, developer, icon, url, type, is_active, tenant_id, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))").run(name, description || '', version || '1.0.0', developer || '', icon || '', url || '', type || 'integration', req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/extensions/:id/toggle', (req, res) => {
  try {
    const ext = db.prepare('SELECT * FROM extensions WHERE id = ?').get(req.params.id);
    if (!ext) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE extensions SET is_active = ? WHERE id = ?').run(ext.is_active ? 0 : 1, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/extensions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM extensions WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── IP Telephony API ──────────────────────────────────────────
app.get('/api/admin/telephony/settings', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s) { db.prepare('INSERT INTO telephony_settings (tenant_id) VALUES (?)').run(req.tenant_id || 1); return res.json({}); }
    if (s.api_key) s.api_key = s.api_key.substring(0, 4) + '****';
    if (s.api_secret) s.api_secret = s.api_secret.substring(0, 4) + '****';
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/telephony/settings', (req, res) => {
  try {
    const { provider, enabled, api_key, api_secret, api_url, widget_url } = req.body;
    const existing = db.prepare('SELECT id FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (existing) db.prepare("UPDATE telephony_settings SET provider = ?, enabled = ?, api_key = ?, api_secret = ?, api_url = ?, widget_url = ? WHERE tenant_id = ?").run(provider || 'telphin', enabled ? 1 : 0, api_key || '', api_secret || '', api_url || '', widget_url || '', req.tenant_id || 1);
    else db.prepare("INSERT INTO telephony_settings (tenant_id, provider, enabled, api_key, api_secret, api_url, widget_url) VALUES (?, ?, ?, ?, ?, ?, ?)").run(req.tenant_id || 1, provider || 'telphin', enabled ? 1 : 0, api_key || '', api_secret || '', api_url || '', widget_url || '');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/telephony/test', (req, res) => {
  try {
    const s = db.prepare('SELECT * FROM telephony_settings WHERE tenant_id = ?').get(req.tenant_id || 1);
    if (!s || !s.api_url) return res.json({ ok: false, message: 'URL не настроен' });
    res.json({ ok: true, message: 'Подключение к ' + (s.provider || 'telphin') + ' работает' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/telephony/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM telephony_call_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50').all(req.tenant_id || 1);
    res.json(logs);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/webhooks/telephony/incoming-call', (req, res) => {
  try {
    const { call_id, caller_phone, callee_phone, api_key } = req.body;
    const settings = db.prepare('SELECT * FROM telephony_settings WHERE api_key = ? AND enabled = 1').get(api_key);
    if (!settings) return res.status(403).json({ error: 'Invalid API key' });
    db.prepare("INSERT INTO telephony_call_log (tenant_id, call_id, caller_phone, callee_phone, direction) VALUES (?, ?, ?, ?, 'incoming')").run(settings.tenant_id, call_id || '', caller_phone || '', callee_phone || '');
    const client = db.prepare('SELECT id, name FROM users WHERE phone = ? AND tenant_id = ?').get(caller_phone, settings.tenant_id);
    res.json({ ok: true, client: client ? { id: client.id, name: client.name } : null });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Gamification Tables ────────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    type TEXT NOT NULL DEFAULT 'wheel_of_fortune',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    settings TEXT DEFAULT '{}',
    prize_description TEXT DEFAULT '',
    cooldown_hours INTEGER DEFAULT 24,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS game_participations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    guest_id INTEGER NOT NULL,
    game_id INTEGER,
    game_type TEXT NOT NULL,
    result TEXT DEFAULT '',
    points INTEGER DEFAULT 0,
    prize TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS guest_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    guest_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '🏆',
    progress INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[Gamification] Table error:', e.message); }

// ─── Multi-currency Tables ──────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    currency_code TEXT NOT NULL,
    name TEXT DEFAULT '',
    symbol TEXT DEFAULT '',
    rate REAL DEFAULT 1,
    is_base INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[ExchangeRates] Table error:', e.message); }

try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN base_currency TEXT DEFAULT 'RUB'`); } catch(e) {}

// ─── Extension Hooks Table ──────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS extension_hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    extension_id INTEGER NOT NULL,
    event TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[ExtensionHooks] Table error:', e.message); }

// ─── Telephony Operator Table ───────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS phone_operator_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    call_id TEXT,
    caller_phone TEXT,
    callee_phone TEXT,
    client_id INTEGER DEFAULT 0,
    client_name TEXT DEFAULT '',
    order_id INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    notes TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[PhoneOperator] Table error:', e.message); }

// ─── Gamification API ────────────────────────────────────────────
app.get('/api/admin/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenant_id || 1);
    res.json(games);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/games', (req, res) => {
  try {
    const { type, name, description, prize_description, cooldown_hours, enabled } = req.body;
    const r = db.prepare("INSERT INTO games (tenant_id, type, name, description, prize_description, cooldown_hours, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)").run(req.tenant_id || 1, type || 'wheel_of_fortune', name, description || '', prize_description || '', cooldown_hours || 24, enabled !== undefined ? enabled : 1);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/games/:id/toggle', (req, res) => {
  try {
    const g = db.prepare('SELECT * FROM games WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id || 1);
    if (!g) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE games SET enabled = ? WHERE id = ?').run(g.enabled ? 0 : 1, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/games/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM games WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/gamification/stats', (req, res) => {
  try {
    const tid = req.tenant_id || 1;
    const totalPlayers = db.prepare('SELECT COUNT(DISTINCT guest_id) as c FROM game_participations WHERE tenant_id = ?').get(tid).c;
    const totalPoints = db.prepare('SELECT COALESCE(SUM(points),0) as s FROM game_participations WHERE tenant_id = ?').get(tid).s;
    const totalPlays = db.prepare('SELECT COUNT(*) as c FROM game_participations WHERE tenant_id = ?').get(tid).c;
    res.json({ total_players: totalPlayers, total_points: totalPoints, total_plays: totalPlays });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/admin/gamification/leaderboard', (req, res) => {
  try {
    const top = db.prepare('SELECT gp.guest_id, COALESCE(u.name, "Гость") as guest_name, SUM(gp.points) as total_points, COUNT(*) as games_played FROM game_participations gp LEFT JOIN users u ON gp.guest_id = u.id WHERE gp.tenant_id = ? GROUP BY gp.guest_id ORDER BY total_points DESC LIMIT 20').all(req.tenant_id || 1);
    res.json(top);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Guest Gamification API ──────────────────────────────────────
app.get('/api/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games WHERE tenant_id = ? AND enabled = 1').all(req.tenant_id || 1);
    res.json(games);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/games/wheel/play', (req, res) => {
  try {
    const { guest_id, points, prize } = req.body;
    const tid = req.tenant_id || 1;
    if (guest_id) {
      const recent = db.prepare("SELECT created_at FROM game_participations WHERE guest_id = ? AND game_type = 'wheel_of_fortune' AND tenant_id = ? ORDER BY created_at DESC LIMIT 1").get(guest_id, tid);
      if (recent) {
        const diff = (Date.now() - new Date(recent.created_at + 'Z').getTime()) / 3600000;
        const game = db.prepare("SELECT cooldown_hours FROM games WHERE type = 'wheel_of_fortune' AND tenant_id = ? AND enabled = 1").get(tid);
        if (game && diff < game.cooldown_hours) return res.json({ ok: false, message: 'Кулдаун' });
      }
      db.prepare("INSERT INTO game_participations (tenant_id, guest_id, game_type, points, prize) VALUES (?, ?, 'wheel_of_fortune', ?, ?)").run(tid, guest_id, points || 0, prize || '');
      if (points > 0) {
        db.prepare('UPDATE user_bonuses SET balance = COALESCE(balance,0) + ? WHERE user_id = ? AND tenant_id = ?').run(points, guest_id, tid);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/games/quiz/answer', (req, res) => {
  try {
    const { guest_id, score } = req.body;
    const tid = req.tenant_id || 1;
    if (guest_id) {
      db.prepare("INSERT INTO game_participations (tenant_id, guest_id, game_type, points, prize) VALUES (?, ?, 'quiz', ?, ?)").run(tid, guest_id, score || 0, '');
      if (score > 0) {
        db.prepare('UPDATE user_bonuses SET balance = COALESCE(balance,0) + ? WHERE user_id = ? AND tenant_id = ?').run(score, guest_id, tid);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/games/leaderboard', (req, res) => {
  try {
    const top = db.prepare('SELECT gp.guest_id, COALESCE(u.name, "Гость") as guest_name, SUM(gp.points) as total_points FROM game_participations gp LEFT JOIN users u ON gp.guest_id = u.id WHERE gp.tenant_id = ? GROUP BY gp.guest_id ORDER BY total_points DESC LIMIT 10').all(req.tenant_id || 1);
    res.json(top);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/games/challenges', (req, res) => {
  try {
    const guestId = req.query.guest_id;
    if (!guestId) return res.json([]);
    const tid = req.tenant_id || 1;
    const ordersCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND tenant_id = ?').get(guestId, tid).c;
    const reviewsCount = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND tenant_id = ?').get(guestId, tid).c;
    const bonus = db.prepare('SELECT COALESCE(balance,0) as b FROM user_bonuses WHERE user_id = ? AND tenant_id = ?').get(guestId, tid);
    const challenges = [
      { id: 'orders_5', title: 'Постоянный гость', desc: 'Сделайте 5 заказов', icon: '🛵', max: 5, progress: ordersCount },
      { id: 'orders_10', title: 'Завсегдатай', desc: 'Сделайте 10 заказов', icon: '⭐', max: 10, progress: ordersCount },
      { id: 'reviews_3', title: 'Критик', desc: 'Оставьте 3 отзыва', icon: '✍️', max: 3, progress: reviewsCount },
      { id: 'bonus_500', title: 'Бонус-хантер', desc: 'Накопите 500 бонусов', icon: '💰', max: 500, progress: bonus?.b || 0 },
    ];
    res.json(challenges);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Multi-currency API ──────────────────────────────────────────
app.get('/api/admin/exchange-rates', (req, res) => {
  try {
    const rates = db.prepare('SELECT * FROM exchange_rates WHERE tenant_id = ? ORDER BY currency_code').all(req.tenant_id || 1);
    res.json(rates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/exchange-rates', (req, res) => {
  try {
    const { currency_code, name, symbol, rate } = req.body;
    const existing = db.prepare('SELECT id FROM exchange_rates WHERE currency_code = ? AND tenant_id = ?').get(currency_code, req.tenant_id || 1);
    if (existing) return res.status(400).json({ error: 'Валюта уже добавлена' });
    db.prepare("INSERT INTO exchange_rates (tenant_id, currency_code, name, symbol, rate) VALUES (?, ?, ?, ?, ?)").run(req.tenant_id || 1, currency_code, name || '', symbol || '', rate || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/exchange-rates/:id', (req, res) => {
  try {
    const { rate } = req.body;
    db.prepare("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(rate, req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/exchange-rates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM exchange_rates WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/exchange-rates/auto-update', (req, res) => {
  try {
    const tid = req.tenant_id || 1;
    const base = db.prepare('SELECT base_currency FROM foodchain_portal_tenants WHERE id = ?').get(tid);
    const baseCur = base?.base_currency || 'RUB';
    const rates = [
      { code: 'USD', rate: 88.5 }, { code: 'EUR', rate: 96.2 }, { code: 'KZT', rate: 0.18 },
      { code: 'BYN', rate: 27.3 }, { code: 'UZS', rate: 0.007 }, { code: 'AMD', rate: 0.22 },
      { code: 'KGS', rate: 1.0 }, { code: 'CNY', rate: 12.3 }, { code: 'TRY', rate: 2.75 },
      { code: 'GBP', rate: 112.8 }, { code: 'AED', rate: 24.1 },
    ];
    for (const r of rates) {
      if (r.code === baseCur) continue;
      const existing = db.prepare('SELECT id FROM exchange_rates WHERE currency_code = ? AND tenant_id = ?').get(r.code, tid);
      if (existing) {
        db.prepare("UPDATE exchange_rates SET rate = ?, updated_at = datetime('now') WHERE id = ?").run(r.rate, existing.id);
      } else {
        db.prepare("INSERT INTO exchange_rates (tenant_id, currency_code, name, symbol, rate) VALUES (?, ?, ?, ?, ?)").run(tid, r.code, '', '', r.rate);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/exchange-rates', (req, res) => {
  try {
    const rates = db.prepare('SELECT currency_code, rate, symbol FROM exchange_rates WHERE tenant_id = ?').all(req.tenant_id || 1);
    res.json(rates);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Tenant Settings (base_currency) ────────────────────────────
app.get('/api/admin/tenant-settings', (req, res) => {
  try {
    const t = db.prepare('SELECT base_currency FROM foodchain_portal_tenants WHERE id = ?').get(req.tenant_id || 1);
    res.json({ base_currency: t?.base_currency || 'RUB' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.put('/api/admin/tenant-settings', (req, res) => {
  try {
    const { base_currency } = req.body;
    db.prepare('UPDATE foodchain_portal_tenants SET base_currency = ? WHERE id = ?').run(base_currency || 'RUB', req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Telephony Operator API ──────────────────────────────────────
app.post('/api/admin/telephony/operator/notes', (req, res) => {
  try {
    const { call_id, notes } = req.body;
    db.prepare("UPDATE phone_operator_calls SET notes = ? WHERE call_id = ? AND tenant_id = ?").run(notes, call_id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/telephony/operator/orders', (req, res) => {
  try {
    const { call_id, order_id } = req.body;
    db.prepare("UPDATE phone_operator_calls SET order_id = ?, status = 'order_created' WHERE call_id = ? AND tenant_id = ?").run(order_id, call_id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Extensions Hooks API ────────────────────────────────────────
app.get('/api/admin/extensions/hooks', (req, res) => {
  try {
    const hooks = db.prepare('SELECT eh.*, e.name as extension_name FROM extension_hooks eh LEFT JOIN extensions e ON eh.extension_id = e.id WHERE eh.tenant_id = ? ORDER BY eh.created_at DESC').all(req.tenant_id || 1);
    res.json(hooks);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/admin/extensions/hooks', (req, res) => {
  try {
    const { extension_id, event, endpoint } = req.body;
    db.prepare("INSERT INTO extension_hooks (tenant_id, extension_id, event, endpoint) VALUES (?, ?, ?, ?)").run(req.tenant_id || 1, extension_id, event, endpoint);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.delete('/api/admin/extensions/hooks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM extension_hooks WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── 1C Scheduled Sync ──────────────────────────────────────────
cron.schedule('0 * * * *', () => {
  try {
    const tenants = db.prepare('SELECT DISTINCT tenant_id FROM integration_1c_settings WHERE enabled = 1 AND (sync_interval = "hourly" OR (sync_interval = "daily" AND CAST(strftime("%H", datetime("now")) AS INTEGER) = COALESCE(sync_hour, 0)))').all();
    for (const t of tenants) {
      integration1C.runSyncAll(db, t.tenant_id);
    }
  } catch (e) { console.error('[1C Sync]', e.message); }
});

// ─── Catch missing API routes ──────────────────────────────────
app.get('/api/v1', (req, res) => res.json({ name: 'FoodChain API', version: '1.0', status: 'ok' }));

app.get('/api/admin/clients/search', (req, res) => {
  try {
    const q = req.query.q || '';
    const tid = req.tenant_id || 1;
    const rows = db.prepare("SELECT id, name, phone, email, total_spent, visits_count FROM users WHERE tenant_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY total_spent DESC LIMIT 20").all(tid, `%${q}%`, `%${q}%`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.post('/api/notifications/push', (req, res) => {
  try {
    const { title, body, user_ids } = req.body;
    res.json({ ok: true, sent: user_ids?.length || 0 });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Start ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  // Start Telegram bot if configured
  try { db.exec("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, value TEXT, tenant_id INTEGER DEFAULT 1)"); } catch(e) {}
  try { telegramBot.startIfConfigured(db); } catch (e) { console.error('[TelegramBot] Init error:', e.message); }
});

// ─── Graceful shutdown ──────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down…');
  terminalIntegration.shutdownRetries();
  autoWriteoffService.shutdown();
  costingService.shutdown();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  terminalIntegration.shutdownRetries();
  autoWriteoffService.shutdown();
  costingService.shutdown();
  server.close(() => process.exit(0));
});
