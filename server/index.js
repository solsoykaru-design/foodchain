const express = require('express');
const http = require('http');
const https = require('https');
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
const stationService = require(path.join(__dirname, 'services', 'station.service.js'));
const forecastService = require(path.join(__dirname, 'services', 'forecast.service.js'));
const integration1C = require(path.join(__dirname, 'services', 'integration-1c.service'));
const autoOrdersService = require(path.join(__dirname, 'services', 'auto-orders.service.js'));
const autoWriteoffService = require(path.join(__dirname, 'services', 'auto-writeoff.service.js'));
const costingService = require(path.join(__dirname, 'services', 'costing.service.js'));
const campaignTriggersService = require(path.join(__dirname, 'services', 'campaign-triggers.service.js'));
const telegramBotService = require(path.join(__dirname, 'services', 'telegram-bot.service.js'));
const { seedDemoData } = require(path.join(__dirname, 'services', 'seed-demo-data.service.js'));
const supplierPortal = require(path.join(__dirname, 'services', 'supplier-portal.service.js'));
const backup = require(path.join(__dirname, 'backup.js'));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET environment variable is not set'); process.exit(1); }

const PORTAL_SYNC_KEY = process.env.PORTAL_SYNC_KEY;
if (!PORTAL_SYNC_KEY) { console.error('FATAL: PORTAL_SYNC_KEY environment variable is not set'); process.exit(1); }

// --- Crash on missing env vars in production ---
if (process.env.NODE_ENV === 'production') {
  const required = ['SUPPLIER_JWT_SECRET'];
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

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err?.message || err);
});

const DATA_DIR = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(DATA_DIR, 'uploads');
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
app.set('trust proxy', 1);
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 4000;
console.log(`[env] PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV}`);
server.on('error', (err) => console.error('[server] Listen error:', err.message));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Accepting connections on http://0.0.0.0:${PORT}`);
});

// Увеличиваем timeout для длинных запросов
server.timeout = 120000;
server.keepAliveTimeout = 120000;

// Заголовки для keep-alive
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

// ─── Debug endpoint: check dist directories (dev only) ──────────────
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/dist', (req, res) => {
    const base = path.join(__dirname, '..');
    const dirs = ['dist-admin', 'dist-waiter', 'dist-guest', 'dist-courier', 'dist-kitchen', 'dist-pos', 'dist-website', 'dist-kiosk', 'dist-techcard'];
    const result = {};
    for (const d of dirs) {
      const full = path.join(base, d);
      const serverFull = path.join(__dirname, d);
      const exists = fs.existsSync(full) || fs.existsSync(serverFull);
      const files = fs.existsSync(full) ? fs.readdirSync(full).slice(0, 5) : (fs.existsSync(serverFull) ? fs.readdirSync(serverFull).slice(0, 5) : []);
      result[d] = { exists, files };
    }
    let rootFiles = [];
    let serverFiles = [];
    try { rootFiles = fs.readdirSync(base); } catch(e) { rootFiles = ['ERROR: '+e.message]; }
    try { serverFiles = fs.readdirSync(__dirname); } catch(e) { serverFiles = ['ERROR: '+e.message]; }
    res.json({ cwd: process.cwd(), dirname: __dirname, base, rootFiles: rootFiles.filter(f => !f.startsWith('.') && !f.startsWith('node_modules')), serverFiles: serverFiles.filter(f => !f.startsWith('.') && !f.startsWith('node_modules')), dirs: result });
  });
}

const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (isDev ? '' : '*')).split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
  if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
  console.warn('[cors] Blocked origin:', origin);
  return callback(new Error('Not allowed by CORS'), false);
};
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
const io = new Server(server, { cors: corsOptions });




const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false, message: { error: 'Слишком много запросов, попробуйте позже' }, validate: { xForwardedForHeader: false } });

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  validate: { xForwardedForHeader: false },
});

app.use(cors(corsOptions));

// Middleware для мобильных клиентов - отключаем helmet для /api/mobile
app.use((req, res, next) => {
  if (req.path.startsWith('/api/mobile')) {
    // Для мобильных API не используем helmet
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=120');
    return next();
  }
  // Для остальных используем helmet
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: 'sameorigin' },
  })(req, res, next);
});
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/staff/login', authLimiter);
app.use('/api/courier/login', authLimiter);
app.use(express.json({ limit: '50mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/releases', express.static(path.join(__dirname, 'releases')));

app.get('/api/health', (req, res) => {
  let dbStatus = 'ok';
  let dbSize = 0;
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (integrity && integrity['integrity_check'] !== 'ok') dbStatus = 'corrupted';
    dbSize = fs.statSync(DB_PATH).size;
  } catch (e) { dbStatus = e.message; }

  let supabaseStatus = 'disabled';
  try {
    const sb = require('./lib/supabase').getClient();
    supabaseStatus = sb ? 'connected' : 'not configured';
  } catch (e) { supabaseStatus = e.message; }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    db: {
      status: dbStatus,
      size: dbSize,
      sizeMB: (dbSize / 1024 / 1024).toFixed(2),
    },
    supabase: supabaseStatus,
    uptime: process.uptime().toFixed(0) + 's',
  });
});

function findDistDir(name) {
  const local = path.join(__dirname, name);
  if (fs.existsSync(local)) return local;
  const parent = path.join(__dirname, '..', name);
  if (fs.existsSync(parent)) return parent;
  return null;
}

const guestDist = findDistDir('dist-guest');
if (guestDist) {
  app.use('/guest', express.static(guestDist));
  app.use('/guest', (req, res) => {
    res.sendFile(path.join(guestDist, 'index.html'));
  });
}

const adminDist = findDistDir('dist-admin');
if (adminDist) {
  app.use('/admin', express.static(adminDist));
  app.use('/admin', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

// Vosk model proxy (dev only — unrestricted external proxy is unsafe in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/vosk-models', (req, res) => {
    const filePath = req.path.replace(/^\//, '');
    const targetUrl = `https://alphacephei.com/vosk/models/${filePath}`;
    https.get(targetUrl, (proxyRes) => {
      delete proxyRes.headers['content-disposition'];
      delete proxyRes.headers['content-encoding'];
      proxyRes.pipe(res);
    }).on('error', () => {
      res.status(502).send('Proxy error');
    });
  });
}

const courierDist = findDistDir('dist-courier');
if (courierDist) {
  app.use('/courier', express.static(courierDist));
  app.use('/courier', (req, res) => {
    res.sendFile(path.join(courierDist, 'index.html'));
  });
}

const waiterDist = findDistDir('dist-waiter');
if (waiterDist) {
  app.use('/waiter', express.static(waiterDist));
  app.use('/waiter', (req, res) => {
    res.sendFile(path.join(waiterDist, 'index.html'));
  });
}

const kitchenDist = findDistDir('dist-kitchen');
if (kitchenDist) {
  app.use('/kitchen', express.static(kitchenDist));
  app.use('/kitchen', (req, res) => {
    res.sendFile(path.join(kitchenDist, 'index.html'));
  });
}

const posDist = findDistDir('dist-pos');
if (posDist) {
  app.use('/pos', express.static(posDist));
  app.use('/pos', (req, res) => {
    res.sendFile(path.join(posDist, 'index.html'));
  });
}

const managerDist = findDistDir('dist-manager');
if (managerDist) {
  app.use('/manager', express.static(managerDist));
  app.use('/manager', (req, res) => {
    res.sendFile(path.join(managerDist, 'index.html'));
  });
}

const websiteDist = path.join(__dirname, 'dist-website');

const kioskDist = path.join(__dirname, 'dist-kiosk');
if (fs.existsSync(kioskDist)) {
  app.use('/kiosk', express.static(kioskDist));
  app.use('/kiosk', (req, res) => {
    res.sendFile(path.join(kioskDist, 'index.html'));
  });
}



// ─── Portal backend (loaded async, mounted sync) ─────────────────
let portalHandler;
let portalReady = Promise.resolve();
const portalPath = path.join(__dirname, 'portal-backend', 'src', 'index.js');
const portalDist = path.join(__dirname, 'portal-frontend-dist');
if (fs.existsSync(portalPath)) {
  process.env.PORTAL_MOUNTED = 'true';
  const { pathToFileURL } = require('url');
  portalReady = import(pathToFileURL(portalPath).href)
    .then(m => {
      portalHandler = (req, res, next) => {
        if (req.url.startsWith('/portal')) {
          req.url = req.url.slice(7) || '/';
        }
        req.baseUrl = '/portal';
        m.default.handle(req, res, next);
      };
      console.log('Portal backend mounted at /portal');
    })
    .catch(e => {
      console.error('Failed to load portal backend:', e);
      console.error('Portal stack:', e.stack);
    });
}

const DB_PATH = path.join(DATA_DIR, 'foodchain.db');
const PORTAL_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'portal-backend', 'portal.db');

function isValidSqliteFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('ascii', 0, 16) === 'SQLite format 3\0';
  } catch (e) {
    return false;
  }
}

// ─── Restore DBs from Supabase backup only when local files are missing/corrupt ───
// Render attaches the persistent disk to new deploys, so normally the DBs already exist.
// This block runs synchronously before server.listen; keep it fast to avoid port-scan timeouts.
const needsRestore = !isValidSqliteFile(DB_PATH) || !isValidSqliteFile(PORTAL_DB_PATH);
if (needsRestore) {
  console.log('[startup] Local DBs missing or invalid, attempting Supabase restore...');
  try {
    const { execSync } = require('child_process');
    execSync('node restore-dbs.js', { cwd: __dirname, stdio: 'inherit', timeout: 15000 });
  } catch (e) {
    console.log('[startup] DB restore skipped:', e.message);
  }
} else {
  console.log('[startup] Local DBs found, skipping Supabase restore');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── DB integrity check on startup ──────────────────────────────
try {
  const tableCount = db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'").get()?.cnt || 0;
  console.log(`[db] Found ${tableCount} tables`);
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity && integrity['integrity_check'] !== 'ok') {
    console.error('[db] INTEGRITY CHECK FAILED:', integrity['integrity_check']);
  } else {
    console.log('[db] Integrity check passed');
  }
} catch (e) {
  console.log('[db] Integrity check skipped:', e.message);
}

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
  'courier_chat_templates', 'push_settings', 'device_tokens', 'notification_logs', 'cashier_shifts',
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
  const upper = sqlText.toUpperCase();
  const firstWordMatch = upper.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/);
  const firstWord = firstWordMatch ? firstWordMatch[1] : '';
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
    // Find the real WHERE clause (whole word, last occurrence before ORDER/LIMIT/GROUP/HAVING)
    let whereIdx = -1;
    for (const m of upper.matchAll(/\bWHERE\b/g)) {
      if (m.index < insertPos) whereIdx = m.index;
    }
    const hasWhere = whereIdx !== -1;
    const tail = modified.slice(insertPos).trim();
    if (hasWhere) {
      const beforeWhere = modified.slice(0, whereIdx).trimEnd();
      const whereClause = modified.slice(whereIdx + 5, insertPos).trim();
      modified = beforeWhere + ' WHERE (' + whereClause + ') AND tenant_id = current_tenant_id() ' + tail;
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
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    req.tenant_id = decoded.tenantId || decoded.tenant_id;
    // Update AsyncLocalStorage so current_tenant_id() returns the real tenant_id from JWT
    tenantStorage.enterWith(req.tenant_id);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
  };
}

// ─── Tenant middleware: ensures req.tenant_id is set ───────────
const PUBLIC_API_PATHS = ['/api/auth/', '/api/public/', '/api/internal/', '/api/tenants/search', '/api/tenants/register', '/api/pos/auth'];
function ensureTenantId(req, res, next) {
  const requestPath = req.originalUrl || req.url;
  if (PUBLIC_API_PATHS.some(p => requestPath.startsWith(p))) return next();
  if (req.tenant_id) return next();
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      req.tenant_id = decoded.tenantId || decoded.tenant_id;
    } catch {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
  }
  if (!req.tenant_id) return res.status(401).json({ error: 'Требуется авторизация' });
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

// ─── Portal sync endpoints (internal, PORTAL_SYNC_KEY auth) ──
function validatePortalSyncKey(req, res, next) {
  const key = req.body?.key || req.query?.key;
  if (!key || key !== PORTAL_SYNC_KEY) {
    return res.status(403).json({ error: 'Invalid sync key' });
  }
  next();
}

app.post('/api/internal/sync-tenant', validatePortalSyncKey, (req, res) => {
  try {
    const { tenant } = req.body;
    if (!tenant || !tenant.id) return res.status(400).json({ error: 'Missing tenant data' });

    db.prepare(`
      INSERT INTO foodchain_portal_tenants (id, name, nickname, phone, is_active, allow_create_branches, access_mode, base_currency, app_settings, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        nickname = excluded.nickname,
        phone = excluded.phone,
        is_active = 1,
        allow_create_branches = excluded.allow_create_branches,
        access_mode = excluded.access_mode,
        base_currency = excluded.base_currency,
        app_settings = excluded.app_settings,
        updated_at = datetime('now')
    `).run(
      tenant.id, tenant.name, tenant.nickname || null, tenant.admin_email || '',
      tenant.allow_create_branches || 0, tenant.access_mode || 'development',
      tenant.base_currency || 'RUB', tenant.app_settings || null
    );

    res.json({ status: 'ok', tenant_id: tenant.id });
  } catch (e) {
    console.error('[SYNC] sync-tenant error:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/internal/sync-staff', validatePortalSyncKey, (req, res) => {
  try {
    const { staff } = req.body;
    if (!staff || !staff.tenant_id || !staff.username) return res.status(400).json({ error: 'Missing staff data' });

    // Sync into the main server's staff table (not users — staff have username/tenant_id)
    const existing = db.prepare("SELECT id FROM staff WHERE username = ? AND tenant_id = ?").get(staff.username, staff.tenant_id);
    if (existing) {
      db.prepare(`
        UPDATE staff
        SET password = ?, role = ?, first_name = ?, phone = ?, email = ?, is_active = 1
        WHERE id = ?
      `).run(staff.password_hash || '', staff.role || 'admin', staff.first_name || '', staff.phone || '', staff.email || '', existing.id);
    } else {
      db.prepare(`
        INSERT INTO staff (username, password, role, tenant_id, first_name, phone, email, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `).run(staff.username, staff.password_hash || '', staff.role || 'admin', staff.tenant_id, staff.first_name || '', staff.phone || '', staff.email || '');
    }
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('[SYNC] sync-staff error:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/internal/delete-tenant', validatePortalSyncKey, (req, res) => {
  try {
    const { tenant_id } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });
    db.prepare('DELETE FROM foodchain_portal_tenants WHERE id = ?').run(tenant_id);
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('[SYNC] delete-tenant error:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

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
  new:        { next: ['confirmed', 'paid', 'cancelled'] },
  confirmed:  { next: ['preparing', 'paid', 'cancelled'] },
  preparing:  { next: ['ready', 'paid', 'cancelled'] },
  ready:      { next: ['served', 'assigned', 'paid', 'cancelled'] },
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
    if (key === 'password' || key === 'password_hash') continue;
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
    if (key === 'password' || key === 'password_hash') continue;
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
    sort_order INTEGER DEFAULT 0,
    show_on_site INTEGER DEFAULT 1,
    show_on_app INTEGER DEFAULT 1,
    show_on_kiosk INTEGER DEFAULT 1,
    show_on_waiter INTEGER DEFAULT 1,
    show_on_aggregators INTEGER DEFAULT 1,
    tenant_id INTEGER DEFAULT 1
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
    is_active INTEGER DEFAULT 1,
    tenant_id INTEGER DEFAULT 1
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
  try { db.exec("CREATE TABLE IF NOT EXISTS telegram_bot_users (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER DEFAULT 1, chat_id INTEGER UNIQUE NOT NULL, phone TEXT DEFAULT '', first_name TEXT DEFAULT '', username TEXT DEFAULT '', interaction_count INTEGER DEFAULT 1, last_interaction TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')))"); } catch(e) {}
  try { db.exec("ALTER TABLE telegram_bot_users ADD COLUMN phone TEXT DEFAULT ''"); } catch(e) {}
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
    nickname TEXT,
    address TEXT,
    phone TEXT,
    lat REAL DEFAULT 0,
    lng REAL DEFAULT 0,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    allow_create_branches INTEGER DEFAULT 0,
    access_mode TEXT DEFAULT 'development',
    base_currency TEXT DEFAULT 'RUB',
    branding TEXT,
    site_settings TEXT,
    app_settings TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    token TEXT NOT NULL,
    platform TEXT DEFAULT '',
    device_info TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', '+3 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+3 hours')),
    UNIQUE(token)
  );

  CREATE TABLE IF NOT EXISTS notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    channel TEXT NOT NULL,
    recipient TEXT DEFAULT '',
    title TEXT DEFAULT '',
    status TEXT DEFAULT 'sent',
    error TEXT,
    message_id TEXT,
    created_at TEXT DEFAULT (datetime('now', '+3 hours'))
  );
`);

// ─── Schema migrations ───────────────────────────────────────────
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN nickname TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN address TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN phone TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN lat REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN lng REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN photo_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN access_mode TEXT DEFAULT 'development'`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN base_currency TEXT DEFAULT 'RUB'`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN branding TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN site_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN app_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN updated_at TEXT`); } catch(e) {}
try { db.exec(`UPDATE foodchain_portal_tenants SET updated_at = datetime('now') WHERE updated_at IS NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN image_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_site INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_app INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_kiosk INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_waiter INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_aggregators INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN username TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_type TEXT DEFAULT 'per_order'`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_value REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN is_online INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN last_location TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN tenant_id INTEGER`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN language TEXT DEFAULT 'ru'`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN pin TEXT`); } catch(e) {}
try {
  const posRoles = ['admin', 'manager', 'waiter'];
  const staffWithoutPin = db.prepare(`SELECT id, first_name FROM staff WHERE (pin IS NULL OR pin = '') AND role IN (${posRoles.map(() => '?').join(',')}) AND is_active = 1`).all(...posRoles);
  const existingPins = new Set(db.prepare("SELECT pin FROM staff WHERE pin IS NOT NULL AND pin != ''").all().map(r => r.pin));
  for (const s of staffWithoutPin) {
    let pin;
    do { pin = Math.floor(1000 + Math.random() * 9000).toString(); } while (existingPins.has(pin));
    existingPins.add(pin);
    db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(pin, s.id);
    console.log(`[PIN] Generated PIN ${pin} for ${s.first_name} (id=${s.id})`);
  }
} catch (e) { console.error('[PIN] generation error:', e.message); }
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
    fsrar_id TEXT DEFAULT '',
    gost_key_path TEXT DEFAULT '',
    test_mode INTEGER DEFAULT 1,
    api_url TEXT DEFAULT '',
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
  CREATE TABLE IF NOT EXISTS marking_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    product_id INTEGER,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    document_id INTEGER,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS honest_sign_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    type TEXT NOT NULL,
    doc_number TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    xml_payload TEXT,
    reason TEXT,
    total_quantity REAL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    sent_at TEXT,
    response TEXT,
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
stationService.initTables(db);
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
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/022_extensions_webhooks.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/023_honest_sign_egais.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/024_enterprise_payroll.sql'), 'utf8')); } catch(e) {}
try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/025_dynamic_pricing.sql'), 'utf8')); } catch(e) {}
  try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/026_referral_program.sql'), 'utf8')); } catch(e) {}
  try { db.exec(fs.readFileSync(path.join(__dirname, 'migrations/027_courier_shift_payroll.sql'), 'utf8')); } catch(e) {}
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
try { db.exec(`ALTER TABLE users ADD COLUMN login TEXT UNIQUE`); } catch(e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`); } catch(e) {}
try { db.exec(`
  CREATE TABLE IF NOT EXISTS auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tenant_id INTEGER,
    action TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  )
`); } catch(e) {}
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
db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER, dish_name TEXT,
  number TEXT, valid_from TEXT, portions REAL, output REAL, technology TEXT,
  fixed_costs REAL, package_weight REAL, cost_price REAL, created_at TEXT,
  tenant_id INTEGER DEFAULT 1, cooking_time INTEGER DEFAULT 0,
  description TEXT DEFAULT '', updated_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS dish_tech_card_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tech_card_id INTEGER, item_id INTEGER, item_name TEXT,
  quantity REAL DEFAULT 0, unit TEXT DEFAULT 'г', netto REAL DEFAULT 0,
  yield REAL DEFAULT 0, tenant_id INTEGER DEFAULT 1
)`);
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN step_instructions TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN step_mode INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN is_active INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_cards ADD COLUMN version INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_card_ingredients ADD COLUMN cold_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_card_ingredients ADD COLUMN heat_loss_percent REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE dish_tech_card_ingredients ADD COLUMN yield_percent REAL DEFAULT 100`); } catch(e) {}
try { db.exec(`CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  dish_name TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT
)`); } catch(e) {}
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
try { db.exec(`ALTER TABLE dishes ADD COLUMN course TEXT DEFAULT 'main'`); } catch(e) {}
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
    ndfl_amount REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    paid_date TEXT,
    payment_method TEXT,
    note TEXT,
    details TEXT DEFAULT '{}',
    status TEXT DEFAULT 'calculated',
    calculated_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT,
    tenant_id INTEGER DEFAULT 1,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS salary_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    amount REAL DEFAULT 0,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    tenant_id INTEGER DEFAULT 1,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1 UNIQUE,
    ndfl_rate REAL DEFAULT 0.13,
    night_rate_multiplier REAL DEFAULT 1.5,
    holiday_rate_multiplier REAL DEFAULT 2.0,
    overtime_rate_multiplier REAL DEFAULT 1.5,
    weekly_hours_norm REAL DEFAULT 40,
    daily_hours_norm REAL DEFAULT 8,
    kpi_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS timesheet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    staff_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    break_minutes INTEGER DEFAULT 0,
    note TEXT,
    is_approved INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kpi_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'all',
    metric TEXT NOT NULL,
    threshold REAL DEFAULT 0,
    bonus_amount REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dynamic_pricing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referral_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1 UNIQUE,
    enabled INTEGER DEFAULT 0,
    referrer_bonus REAL DEFAULT 100,
    referee_bonus REAL DEFAULT 100,
    min_order_amount REAL DEFAULT 500,
    bonus_type TEXT DEFAULT 'points',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referral_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    used_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    referrer_id INTEGER NOT NULL,
    referee_id INTEGER NOT NULL,
    code TEXT,
    status TEXT DEFAULT 'pending',
    order_amount REAL,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
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
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN nickname TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN address TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN phone TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN lat REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN lng REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN photo_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN access_mode TEXT DEFAULT 'development'`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN base_currency TEXT DEFAULT 'RUB'`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN branding TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN site_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN app_settings TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE foodchain_portal_tenants ADD COLUMN updated_at TEXT`); } catch(e) {}
try { db.exec(`UPDATE foodchain_portal_tenants SET updated_at = datetime('now') WHERE updated_at IS NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN image_url TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_site INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_app INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_kiosk INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_waiter INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE menu_categories ADD COLUMN show_on_aggregators INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE inventory_items ADD COLUMN current_balance REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN username TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_type TEXT DEFAULT 'per_order'`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN salary_value REAL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN is_online INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN last_location TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN position TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE staff ADD COLUMN pin TEXT`); } catch(e) {}
try {
  const posRoles = ['admin', 'manager', 'waiter'];
  const staffWithoutPin = db.prepare(`SELECT id, first_name FROM staff WHERE (pin IS NULL OR pin = '') AND role IN (${posRoles.map(() => '?').join(',')}) AND is_active = 1`).all(...posRoles);
  const existingPins = new Set(db.prepare("SELECT pin FROM staff WHERE pin IS NOT NULL AND pin != ''").all().map(r => r.pin));
  for (const s of staffWithoutPin) {
    let pin;
    do { pin = Math.floor(1000 + Math.random() * 9000).toString(); } while (existingPins.has(pin));
    existingPins.add(pin);
    db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(pin, s.id);
    console.log(`[PIN] Generated PIN ${pin} for ${s.first_name} (id=${s.id})`);
  }
} catch (e) { console.error('[PIN] generation error:', e.message); }
try { db.exec(`ALTER TABLE orders ADD COLUMN pickup_point_id INTEGER`); } catch(e) {}
// Multi-tenant: add tenant_id to tables that lack it
try { db.exec(`ALTER TABLE couriers ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE order_status_history ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'system'`); } catch(e) {}
try { db.exec(`ALTER TABLE notifications ADD COLUMN data TEXT DEFAULT '{}'`); } catch(e) {}
try { db.exec(`ALTER TABLE booking_tables ADD COLUMN tenant_id INTEGER DEFAULT 1`); } catch(e) {}
try { db.exec(`ALTER TABLE booking_tables ADD COLUMN status TEXT DEFAULT 'free'`); } catch(e) {}
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

// ─── Backup ────────────────────────────────────────────────────────
backup.init(db);

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


// ─── Unified multi-tenant login (all staff roles) ──────────────
// ─── Tenant search / nearby ────────────────────────────────────


// ─── Admin login (static + staff) ───────────────────────────────

// ─── Staff Auth (portal-synced) ─────────────────────────────────

// ─── Internal: sync staff from portal ──────────────────────────

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



// GET /api/orders/:id/tracking — full tracking info for guest



// GET /api/orders/:id/chat — check if courier-guest chat exists for this order

// Emit courier location via WebSocket for real-time tracking


// ─── Order Split ──────────────────────────────────────────────────






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





// ─── Courier availability ────────────────────────────────────────



// ─── Courier App Auth & Profile ───────────────────────────────────




// ─── Users ────────────────────────────────────────────────────────

// ─── Reviews ─────────────────────────────────────────────────────


// ─── Notifications ───────────────────────────────────────────────



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



// ─── Client Groups CRUD ─────────────────────────────────────────




// ─── Review Questions ────────────────────────────────────────────



// ─── Menu Items (extended dishes list) ────────────────────────────

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





// ─── Menu Categories CRUD ────────────────────────────────────────


// PUT /api/menu-categories/batch-visibility — must be before :id routes




// GET active tech card for a dish (with losses)

// GET tech card versions for a dish

// POST create or update tech card for a dish



// ─── Dish Tech Cards Management ─────────────────────────────────
// GET /api/tech-cards — list all dish tech cards with pagination

// GET /api/tech-cards/:id — get one with ingredients

// POST /api/tech-cards — create new

// PUT /api/tech-cards/:id — update

// DELETE /api/tech-cards/:id

// GET /api/tech-cards/stats — overview stats

// Calculate cost for all dishes

// ─── Stock Categories CRUD ────────────────────────────────────────




// ─── File upload ─────────────────────────────────────────────────

// ─── OLD Tech Cards CRUD (disabled — replaced by dish_tech_cards above) ────
/* OLD ROUTES DISABLED — see /api/tech-cards endpoints above for dish_tech_cards */



// ─── Stock‑oriented Tech Cards (full CRUD) ──────────────────────





// KBJU auto-calculate from ingredients

// Copy tech card (versioning)

// XLSX export

// XLSX import

// ─── Tech Card Ingredients CRUD ────────────────────────────────




// ─── Tech Card Modifiers CRUD ─────────────────────────────────




// ─── Tables CRUD ─────────────────────────────────────────────────




// ─── Website API endpoints ─────────────────────────────────────




// ─── Bookings CRUD ───────────────────────────────────────────────




// ─── Inventory Items (WPF) ───────────────────────────────────────




// ─── Stock Item Card ────────────────────────────────────────────


// Tech cards



// ─── Tech cards where this product is used as ingredient ──────────

// ─── Stock items search for autocomplete ──────────────────────

// Breakdown tech cards (reuse same tech_cards table with type='breakdown')

// Packaging




// Composition (items that contain this stock item)

// Batches

// Contragents



// History

// Warehouse bindings



// ─── Inventory Items (original) ─────────────────────────────────




// ─── Inventory Transactions ──────────────────────────────────────



// ─── Forecast ────────────────────────────────────────────────────




// ─── Auto Orders ──────────────────────────────────────────────────





// Auto-orders settings

// Approve / Reject / Send / Receive

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






// ─── Auto Write-off (expiry dates) ───────────────────────────────







// ─── Costing (cost price calculation) ────────────────────────────





// ─── Честный знак API ───────────────────────────────────────────




// ─── Suppliers ───────────────────────────────────────────────────




// ─── Supplier Portal (Admin) ─────────────────────────────────────








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




// ─── Supplier Portal (Self-Service API) ─────────────────────────



const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });





// ─── Offline Sync ─────────────────────────────────────────────────

// ─── Barcode Lookup ──────────────────────────────────────────────


// ─── Barcode generation ──────────────────────────────────────────


// ─── Contragents (full-featured) ─────────────────────────────────




// ─── Pickup Points ───────────────────────────────────────────────




// ─── Pickup Orders ───────────────────────────────────────────────

// ─── Staff Schedule (employee scheduling) ──────────────────────
const staffScheduleService = require(path.join(__dirname, 'services', 'staff-schedule.service.js'));





// ─── Staff CRUD ──────────────────────────────────────────────────

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





// ─── Staff Shifts ────────────────────────────────────────────────



// ─── Staff Permissions ───────────────────────────────────────────


// ─── Themes ──────────────────────────────────────────────────────







// ─── Delivery Orders ─────────────────────────────────────────────

// ─── Delivery Zones ──────────────────────────────────────────────




// ─── Salary (delegated to enterprise payroll service) ─────────────
const payrollService = require(path.join(__dirname, 'services', 'payroll.service.js'));
function calcMonthDates(month, year) {
  return payrollService.calcMonthDates(month, year);
}
function calculateStaffSalary(staffId, month, year) {
  return payrollService.calculateStaffSalary(db, 1, staffId, month, year);
}






const bankStatementService = require(path.join(__dirname, 'services', 'bank-statement.service.js'));

// ─── Finance ─────────────────────────────────────────────────────




// ─── Chart of Accounts ────────────────────────────────────────────




// ─── Journal Entries (Double-Entry) ───────────────────────────────



// ─── Trial Balance (ОСВ) ──────────────────────────────────────────

// ─── Balance Sheet ────────────────────────────────────────────────

// ─── Bank Statement Reconciliation ─────────────────────────────




// ─── Tax Accounting (VAT / НДС) ────────────────────────────────
const taxAccountingService = require(path.join(__dirname, 'services', 'tax-accounting.service.js'));




// ─── Marketing: Generate Code ────────────────────────────────────

// ─── Marketing: Guest Search for Discounts ───────────────────────

// ─── Marketing: Promo Codes ──────────────────────────────────────




// ─── Marketing: Campaigns ────────────────────────────────────────




// ─── Marketing: Analytics ────────────────────────────────────────

// ─── Marketing: Discount Rules ────────────────────────────────────




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

// Guest: get own bonus transactions

// Guest: get loyalty settings (public)

// Guest: use bonuses when placing order (compute discount)

// Guest: spend bonuses (called during order placement)

// ─── Loyalty Program: Admin Endpoints ────────────────────────────



// ─── Marketing: Bonuses ───────────────────────────────────────────



// ─── Marketing: Certificates ──────────────────────────────────────




// ─── Reviews (enhanced) ──────────────────────────────────────────



// ─── Public Settings (guest/courier apps) ───────────────────────

// GET /api/public/menu?channel=site — filtered menu by channel visibility

// ─── Settings ────────────────────────────────────────────────────




// ─── Audit Logs ──────────────────────────────────────────────────


// ─── Notifications (push) ────────────────────────────────────────

// ─── Orders (multi-status filter) ─────────────────────────────────

// ─── Orders (enhanced) ───────────────────────────────────────────

// ─── Dashboard ───────────────────────────────────────────────────

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


// ─── Payment Methods (Guest - active only) ─────────────────────

// ─── Status info endpoint ──────────────────────────────────────

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





// ─── Weekly Menu ──────────────────────────────────────────────



// ─── Languages ────────────────────────────────────────────────




// Dish-Modifier bindings



// Update LanguagesPage to use API

// ─── Branches API (for tenant WPF admin) ──────────────────────

// GET /api/branches — list branches for a tenant

// POST /api/branches — create a branch (checks allow_create_branches for tenants)

// PUT /api/branches/:id

// DELETE /api/branches/:id

// ─── Internal: sync tenant data from portal ───────────────────


// ─── Internal: tenant stats for portal ─────────────────────────


// ─── Internal: reset demo data (called by portal) ─────────────────


// ─── Internal: get access mode for a tenant ───────────────────────


// ─── Demo mode info for admin panel ──────────────────────────────


// ─── Tenant app limits & usage (for admin frontend) ───────────────


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

// PUT /api/branding — save branding settings

// POST /api/branding/reset — reset to defaults

// GET /api/branding/public/:tenantId — public endpoint for apps (no auth)

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
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.tenantId = payload.tenantId || payload.tenant_id || 'unknown';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

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

// PUT /api/site-settings

// POST /api/site-settings/reset

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

// GET /api/site-settings/public/:tenantId — public endpoint for site (no auth)

// ─── Demo data seeding function ───────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS workshops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, branch_id INTEGER, is_active INTEGER DEFAULT 1)`); } catch(e) {}





// ─── Wholesale Prices ──────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS wholesale_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 1)`); } catch(e) {}





// ─── Modifier Groups ───────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS modifier_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, min_count INTEGER DEFAULT 0, max_count INTEGER DEFAULT 0, tenant_id INTEGER DEFAULT 1)`); } catch(e) {}





// ─── Modifiers ─────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS modifiers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL DEFAULT 0, group_id INTEGER, is_active INTEGER DEFAULT 1, tenant_id INTEGER DEFAULT 1, FOREIGN KEY(group_id) REFERENCES modifier_groups(id))`); } catch(e) {}





// ─── Stop Lists ────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS stop_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT NOT NULL, reason TEXT, until_date TEXT, is_active INTEGER DEFAULT 1, tenant_id INTEGER DEFAULT 1)`); } catch(e) {}





// ─── Staff Roles ───────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS staff_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, permissions TEXT DEFAULT '{}', tenant_id INTEGER DEFAULT 1)`); } catch(e) {}





// ─── Staff Schedule ────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS staff_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, day TEXT, shift_start TEXT, shift_end TEXT, FOREIGN KEY(staff_id) REFERENCES staff(id))`); } catch(e) {}




// ─── Messages ────────────────────────────────────────────────────



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








// ─── Chat Messages ────────────────────────────────────────────



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

// ─── Staff Chats (courier ↔ waiter) ─────────────────────────────







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

// ─── Courier-Guest Chat ─────────────────────────────────────────







// ─── Courier Chat Templates ──────────────────────────────────────





// ─── Courier Personal Templates ─────────────────────────────────



// ─── WebSocket subscriptions for courier-guest chat ──────────
// Add these to the io.on('connection') handler if found. For now just ensure events exist.

// ─── Telegram Bot ─────────────────────────────────────────────────
let telegramBot;
try { telegramBot = require(path.join(__dirname, 'services', 'telegram-bot.service.js')); } catch (e) { console.warn('[TelegramBot] Service load error:', e.message); telegramBot = { getSettings: () => ({}), saveSettings: () => ({}), startIfConfigured: () => {}, stopBot: () => {}, getStats: () => ({}), broadcast: async () => ({}) }; }






// Subscribe user to order notifications

// Unsubscribe from order notifications

// Get bot analytics

// ─── Email Settings ──────────────────────────────────────────────
const emailService = require(path.join(__dirname, 'services', 'email.service.js'));
const pushService = require(path.join(__dirname, 'services', 'push.service.js'));







// ─── Push Settings ───────────────────────────────────────────────



// ─── Email Templates & Campaigns ─────────────────────────────────






// Email statistics

// Segment guests for campaigns

// Render email template with variables

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

// ─── KPI Targets (Stage 5) ────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS kpi_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, role TEXT, target_name TEXT NOT NULL, target_value REAL DEFAULT 0, period TEXT DEFAULT 'month', created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS kpi_results (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, target_id INTEGER, actual_value REAL DEFAULT 0, period_start TEXT, period_end TEXT, score REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);

// ─── Cashflow Report (Stage 6) ────────────────────────────────

// ─── Integrations (Stage 8) ───────────────────────────────────
aggregatorIntegration.setupRoutes(app, db, broadcast, io);
paymentModule.setupRoutes(app, db, broadcast, io);
db.exec(`CREATE TABLE IF NOT EXISTS integration_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, integration_type TEXT NOT NULL UNIQUE, settings TEXT DEFAULT '{}', is_enabled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('1c', '{"api_url":"","api_key":"","exchange_interval":3600}', 0)`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('egais', '{"api_url":"","fsrar_id":"","region_code":""}', 0)`); } catch(e) {}
try { db.exec(`INSERT OR IGNORE INTO integration_settings (integration_type, settings, is_enabled) VALUES ('telegram', '{"bot_token":"","chat_id":"","notifications_enabled":false}', 0)`); } catch(e) {}


// 1C export: products list

// ─── 1C Integration (Admin) ──────────────────────────────────





// Individual sync operations

// ─── CRM Integration (amoCRM / Bitrix24) ───────────────────────
const crmIntegrationService = require(path.join(__dirname, 'services', 'crm-integration.service.js'));





// EGAIS: mark imported products

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

// ─── Courier Locations ──────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS courier_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, courier_id INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (courier_id) REFERENCES staff(id))`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_locations_courier_id ON courier_locations(courier_id)`); } catch (e) {}


// ─── 2FA ────────────────────────────────────────────────────────
try { db.exec(`CREATE TABLE IF NOT EXISTS user_2fa (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER UNIQUE NOT NULL, secret TEXT NOT NULL, enabled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (staff_id) REFERENCES staff(id))`); } catch (e) {}





// ═══════════════════════════════════════════════════════════════════
// ─── Waiter Terminal & Kitchen Display Endpoints ─────────────────
// ═══════════════════════════════════════════════════════════════════

// ─── Waiter: get tables with current order info ──────────────────

// ─── Waiter: seat a table (create dine-in check) ────────────────

// ─── Waiter: create an order ────────────────────────────────────

// ─── Waiter: active checks for a waiter ─────────────────────────

// ─── Waiter: get orders for a check ─────────────────────────────

// ─── Waiter: call waiter ────────────────────────────────────────

// ─── Waiter: resolve a call ─────────────────────────────────────

// ─── Waiter: serve order (mark as served) ──────────────────────

// ─── Waiter: split order check ──────────────────────────────────

// ─── Waiter: merge orders into one check ────────────────────────

// ─── Waiter: process payment for an order ───────────────────────

// ─── Waiter: move guests / merge tables ──────────────────────────

// ─── Waiter: split check by order items ──────────────────────────

// ─── Waiter: request bill for table ──────────────────────────────

// ─── Waiter: update guest count for table ────────────────────────

// ─── Kitchen chat ────────────────────────────────────────────────

// ─── Kitchen: get active orders (new + confirmed + preparing) ───

// ─── Kitchen: accept order (start preparing) ────────────────────

// ─── Kitchen: update individual item status ─────────────────────

// ─── Kitchen: complete order (mark all ready) ───────────────────

// ─── Sous Chef: priority recommendations ─────────────────────────

// ─── Kitchen: step completions (step-by-step mode) ─────────────



// ─── Kitchen: get pending waiter calls ──────────────────────────

// ─── User Language ────────────────────────────────────────────────

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

// Update fiscal settings

// Test connection

// Print receipt for an order

// Print refund receipt

// Retry failed receipt

// Get fiscal receipts list

// Get fiscal stats

// Process pending receipts (cron handler)

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

// Save terminal settings

// Test terminal connection

// Initiate terminal payment

// Check payment status

// Cancel payment

// Get terminal transactions

// Get terminal logs

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
const campaignTriggersCron = campaignTriggersService.scheduleCampaignTriggers(db);

// ─── Reports ──────────────────────────────────────────────────
const reportsRouter = require('./reports');
reportsRouter(app, db);

// ─── Internal: Import menu ────────────────────────────────────


// ─── Internal: Import tech cards ─────────────────────────────


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
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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



// ─── Banners ──────────────────────────────────────────────────





// ─── Promotions ───────────────────────────────────────────────




// ─── Working Hours ─────────────────────────────────────────────




// ─── Common Modifiers ─────────────────────────────────────────







// ─── Category Visibility (quick toggle) ───────────────────────


// ─── Upload for app management ────────────────────────────────
const appUploadDir = path.join(__dirname, 'uploads', 'app');
try { require('fs').mkdirSync(appUploadDir, { recursive: true }); } catch {}
const appStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, appUploadDir),
  filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `tmp_${Date.now()}${ext}`); },
});
const uploadAppImage = multer({ storage: appStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Public endpoint for guest app ────────────────────────────

// ─── App audit log ─────────────────────────────────────────────

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










// ─── Portal SPA catch-all ────────────────────────────────────────
// Serve portal frontend static files BEFORE the portal handler
if (fs.existsSync(portalDist)) {
  app.use('/portal', express.static(portalDist));
}
app.use('/portal', (req, res, next) => {
  if (portalHandler) {
    portalHandler(req, res, next);
  } else {
    res.status(503).json({ error: 'Portal is initializing' });
  }
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
    hook_secret TEXT,
    installed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[Extensions] Table error:', e.message); }
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
`); } catch(e) { console.error('[Extension hooks] Table error:', e.message); }
try { db.exec(`
  CREATE TABLE IF NOT EXISTS extension_webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    hook_id INTEGER,
    extension_id INTEGER,
    event TEXT,
    endpoint TEXT,
    status INTEGER,
    response TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`); } catch(e) { console.error('[Extension webhook logs] Table error:', e.message); }

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




// ─── IP Telephony API ──────────────────────────────────────────





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






// ─── Guest Gamification API ──────────────────────────────────────





// ─── Multi-currency API ──────────────────────────────────────────






// ─── Tenant Settings (base_currency) ────────────────────────────


// ─── Telephony Operator API ──────────────────────────────────────


// ─── Extensions Hooks API ────────────────────────────────────────



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



// ─── Route modules (extracted for maintainability) ──────
const config = {
  JWT_SECRET, PORTAL_SYNC_KEY, safeError, io, upload,
  toCamelCase, toCamelCaseArray,
  STATUS_CHAIN, STATUS_LABELS, validateTransition, emitOrderUpdate, getOrderFull,
  getRoleLimit, checkRoleLimit,
  getLoyaltySettings, getGuestBonusInfo,
  uploadBranding, uploadSiteImage, uploadChat, uploadStaffChat, uploadAppImage,
  authenticateBrandingUpload,
  csvUpload,
  broadcast,
  aggregatorIntegration, supplierPortal, emailService, pushService,
  authenticateToken, requireRole,
};

// Make services available to route modules
config.shiftService = shiftService;
config.autoOrdersService = autoOrdersService;

function notifLog(channel, recipient, title, status, error, messageId) {
  try {
    db.prepare('INSERT INTO notification_logs (tenant_id, channel, recipient, title, status, error, message_id) VALUES (1, ?, ?, ?, ?, ?, ?)')
      .run(channel, String(recipient || '').slice(0, 500), String(title || '').slice(0, 500), status, error || null, messageId || null);
  } catch (e) { console.error('[notifLog]', e.message); }
}
config.notifLog = notifLog;

require('./routes/misc.js')(app, db, config);
require('./routes/auth.js')(app, db, config);
require('./routes/orders.js')(app, db, config);
require('./routes/couriers.js')(app, db, config);
require('./routes/clients.js')(app, db, config);
require('./routes/menu.js')(app, db, config);
require('./routes/tech-cards.js')(app, db, config);
require('./routes/bookings.js')(app, db, config);
require('./routes/inventory.js')(app, db, config);
require('./routes/admin.js')(app, db, config);
require('./routes/suppliers.js')(app, db, config);
require('./routes/staff.js')(app, db, config);
require('./routes/finance.js')(app, db, config);
require('./routes/loyalty.js')(app, db, config);
require('./routes/settings.js')(app, db, config);
require('./routes/payments.js')(app, db, config);
require('./routes/branding.js')(app, db, config);
require('./routes/telegram.js')(app, db, config);
require('./routes/yuma-import.js')(app, db, config);
require('./routes/mobile.js')(app, db, { safeError });
require('./routes/mobile-push.js')(app, db, { safeError });
require('./routes/voice.js')(app, db, config);
require('./routes/pos.js')(app, db, config);
require('./routes/stations.js')(app, db, config);
require('./routes/reports.js')(app, db, config);

// ─── Background schedulers ───────────────────────────────────────
autoWriteoffService.scheduleAutoCheck(db);
autoOrdersService.scheduleAutoCheck(db);
campaignTriggersService.scheduleCampaignTriggers(db);
console.log('[schedulers] Auto-writeoff, auto-orders and campaign trigger schedulers started');

// ─── Telegram bot (if configured) ─────────────────────────────────
try {
  telegramBotService.startIfConfigured(db, 1);
  console.log('[telegram] Bot startup check completed');
} catch (e) {
  console.warn('[telegram] Bot startup error:', e.message);
}

// ─── Voice WebSocket Server ──────────────────────────────────────
const VoiceHeadsetService = require('./services/voice-headset.service');
const VoiceWebSocketServer = require('./services/voice-websocket.service');
const voiceHeadsetService = new VoiceHeadsetService(db);
const voiceWsServer = new VoiceWebSocketServer(server, db, voiceHeadsetService, io);
console.log('[Voice] WebSocket server initialized');

// ─── Global error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err?.message || err, err?.stack || '');
  res.status(500).json({ error: safeError(err?.message || 'Внутренняя ошибка сервера') });
});

// ─── Backup endpoints ────────────────────────────────────────────
app.post('/api/backup', authenticateToken, requireRole('superadmin'), (req, res) => {
  Promise.all([
    backup.doBackup(DB_PATH, 'foodchain.db', db),
    backup.doBackup(PORTAL_DB_PATH, 'portal.db'),
  ]).then(() => res.json({ success: true })).catch(e => res.status(500).json({ error: e.message }));
});

app.get('/api/debug/db-status', authenticateToken, requireRole('superadmin'), async (req, res) => {
  const path = require('path');
  const portalDbPath = process.env.DATABASE_PATH || path.join(__dirname, 'portal-backend', 'portal.db');

  const fileInfo = (p) => {
    try {
      const stat = fs.statSync(p);
      return { path: p, size: stat.size, exists: true };
    } catch (e) {
      return { path: p, size: 0, exists: false, error: e.message };
    }
  };

  const { getClient } = require('./lib/supabase');
  const sb = getClient();
  let cloudBackups = [];
  if (sb) {
    try {
      const { data: files, error } = await sb.storage.from('foodchain-backups').list();
      if (!error && files) {
        cloudBackups = files.map(f => ({ name: f.name, size: f.metadata?.size || f.size, updatedAt: f.updated_at || f.created_at }));
      } else if (error) {
        cloudBackups = [{ error: error.message }];
      }
    } catch (e) {
      cloudBackups = [{ error: e.message }];
    }
  }

  res.json({
    main: fileInfo(DB_PATH),
    portal: fileInfo(portalDbPath),
    dataDir: process.env.DATA_DIR || __dirname,
    databasePath: process.env.DATABASE_PATH || null,
    cloudBackups,
  });
});

// ─── Seed superadmin ────────────────────────────────────────────
try { db.exec(`ALTER TABLE users ADD COLUMN login TEXT`); } catch(e) {}
let superadmin = null;
let superadminPassword = '';
try {
  superadmin = db.prepare("SELECT * FROM users WHERE login = 'ali' AND role = 'superadmin'").get();
} catch (e) {
  console.error('[Seed] Superadmin check failed:', e.message);
}
if (!superadmin) {
  superadminPassword = crypto.randomBytes(4).toString('hex') + '-' + crypto.randomBytes(4).toString('hex');
  const hashed = bcrypt.hashSync(superadminPassword, 10);
  try {
    const info = db.prepare("INSERT INTO users (login, name, phone, password, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)").run('ali', 'SuperAdmin', '+70000000001', hashed, 'superadmin', null);
    console.log('✅ Superadmin created: login=ali password=' + superadminPassword);
  } catch(e) {
    console.error('[Seed] Failed to create superadmin:', e.message);
  }
} else {
  console.log('ℹ️  Superadmin "ali" already exists');
}

if (superadminPassword) {
  console.log('🔐 SUPERADMIN PASSWORD (save it now): ' + superadminPassword);
}

// Start Telegram bot if configured
try { db.exec("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, value TEXT, tenant_id INTEGER DEFAULT 1)"); } catch(e) {}
try { telegramBot.startIfConfigured(db); } catch (e) { console.error('[TelegramBot] Init error:', e.message); }

portalReady.finally(() => {
  // Portal handler is now ready (or failed); it will be used by the /portal middleware.
});

// ─── Graceful shutdown ──────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[${signal}] Shutting down gracefully…`);
  backup.stop();
  try {
    if (typeof backup.doBackup === 'function') {
      await backup.doBackup(DB_PATH, 'foodchain.db', db);
      await backup.doBackup(process.env.DATABASE_PATH || path.join(__dirname, 'portal-backend', 'portal.db'), 'portal.db');
    }
  } catch (e) {
    console.log('[shutdown] Backup error:', e.message);
  }
  try { db.close(); } catch(e) { console.log('[shutdown] DB close:', e.message); }
  server.close(() => {
    console.log('[shutdown] Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout');
    process.exit(1);
  }, 25000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
