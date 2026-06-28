import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { tenantsRouter } from './routes/tenants.js';
import { tariffsRouter } from './routes/tariffs.js';
import { paymentsRouter } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { staffRouter } from './routes/staff.js';
import { ticketsRouter } from './routes/tickets.js';
import { articlesRouter } from './routes/articles.js';
import { templatesRouter } from './routes/templates.js';
import { monitoringRouter } from './routes/monitoring.js';
import { brandingRouter } from './routes/branding.js';
import { searchRouter } from './routes/search.js';
import { messagesRouter, notificationsRouter, pushSettingsRouter } from './routes/messaging.js';
import { importRouter } from './routes/import.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { webhooksRouter } from './routes/webhooks.js';
import { authenticate, requireRole } from './middleware/auth.js';
import multer from 'multer';
import { seedSuperadmin } from './seed.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isMounted = process.env.PORTAL_MOUNTED === 'true';

function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}...`);
    try {
      db.exec(sql);
    } catch (e) {
      console.log(`  Warning: ${e.message}`);
    }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log('  OK');
  }
  console.log('All migrations completed');
}

runMigrations();
seedSuperadmin();

// Configure payment providers from DB
import * as yookassa from './services/yookassa.js';
import * as cloudpayments from './services/cloudpayments.js';
import * as tbank from './services/tbank.js';
try {
  const providers = db.prepare('SELECT * FROM payment_providers WHERE is_active = 1').all();
  for (const p of providers) {
    let cfg = {};
    try { cfg = JSON.parse(p.config); } catch {}
    if (p.code === 'yookassa' && cfg.shopId) yookassa.configureYooKassa(cfg);
    if (p.code === 'cloudpayments' && cfg.publicId) cloudpayments.configureCloudPayments(cfg);
    if (p.code === 'tbank' && cfg.terminalKey) tbank.configureTBank(cfg);
  }
  console.log('Payment providers configured from DB');
} catch (e) {
  // payment_providers table may not exist yet — skip
}

const app = express();

app.use((req, res, next) => {
  if (req.body !== undefined) return next();
  express.json({ limit: '1mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.query === undefined) {
    const idx = req.url.indexOf('?');
    req.query = idx !== -1 ? Object.fromEntries(new URLSearchParams(req.url.slice(idx))) : {};
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
});

const staticPrefix = isMounted ? '' : '/portal';
const frontendDist = isMounted
  ? path.join(__dirname, '..', '..', 'portal-frontend-dist')
  : path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(staticPrefix || '/', express.static(frontendDist));
  console.log(`Serving frontend from ${frontendDist} under ${staticPrefix || '/'}`);
} else if (!isMounted) {
  console.log('Frontend dist not found, run: cd frontend && npm run build');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/tariffs', tariffsRouter);

app.use('/api/tenants', authenticate, tenantsRouter);
app.use('/api/payments', authenticate, paymentsRouter);
app.use('/api/staff', authenticate, staffRouter);

app.use('/api/subscriptions', authenticate, subscriptionsRouter);

app.use('/api/webhooks', webhooksRouter);

app.use('/api/admin', authenticate, requireRole('superadmin'), adminRouter);
app.use('/api/tickets', authenticate, ticketsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/templates', authenticate, requireRole('superadmin'), templatesRouter);
app.use('/api/monitoring', authenticate, requireRole('superadmin'), monitoringRouter);
app.use('/api/branding', authenticate, brandingRouter);
app.use('/api/search', authenticate, requireRole('superadmin'), searchRouter);

app.use('/api/messages', messagesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/push-settings', pushSettingsRouter);
app.use('/api/import', authenticate, importRouter);

if (fs.existsSync(frontendDist) && isMounted) {
  app.get('/*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else if (fs.existsSync(frontendDist)) {
  app.get('/portal*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  app.get('/', (req, res) => { res.redirect('/portal'); });
  app.get('/login', (req, res) => { res.redirect('/portal/login'); });
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

export default app;

if (!isMounted) {
  app.listen(config.port, () => {
    console.log(`Portal API running on http://localhost:${config.port}`);
  });
}
