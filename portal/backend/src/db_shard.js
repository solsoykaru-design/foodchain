import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TENANTS_DIR = path.join(__dirname, '..', 'tenants');
const SCHEMA_TEMPLATE = path.join(__dirname, 'schema_template.sql');

const connections = {};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDbPath(tenantId, isDemo) {
  ensureDir(TENANTS_DIR);
  const suffix = isDemo ? '_demo' : '';
  return path.join(TENANTS_DIR, `tenant_${tenantId}${suffix}.db`);
}

function runMigrations(tenantDb, tenantId, isDemo) {
  tenantDb.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const migrationsDir = path.join(__dirname, 'tenant_migrations');
  if (!fs.existsSync(migrationsDir)) return; // no tenant migrations yet

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedSet = new Set(
    tenantDb.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`[tenant ${tenantId}${isDemo ? ' demo' : ''}] Running migration: ${file}...`);
    tenantDb.exec(sql);
    tenantDb.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }
}

export function getTenantDb(tenantId, isDemo = false) {
  const key = `${tenantId}_${isDemo ? 'demo' : 'prod'}`;
  if (connections[key]) return connections[key];

  const dbPath = getDbPath(tenantId, isDemo);
  const exists = fs.existsSync(dbPath);

  const tenantDb = new Database(dbPath);
  tenantDb.pragma('journal_mode = WAL');
  tenantDb.pragma('foreign_keys = ON');

  if (!exists) {
    if (fs.existsSync(SCHEMA_TEMPLATE)) {
      const schema = fs.readFileSync(SCHEMA_TEMPLATE, 'utf-8');
      tenantDb.exec(schema);
      console.log(`[tenant ${tenantId}] Schema created from template`);
    } else {
      runMigrations(tenantDb, tenantId, isDemo);
    }
  }

  connections[key] = tenantDb;
  return tenantDb;
}

export function closeTenantDb(tenantId, isDemo = false) {
  const key = `${tenantId}_${isDemo ? 'demo' : 'prod'}`;
  if (connections[key]) {
    try { connections[key].close(); } catch (e) {}
    delete connections[key];
  }
}

export function closeAll() {
  for (const key of Object.keys(connections)) {
    try { connections[key].close(); } catch (e) {}
    delete connections[key];
  }
}

export function dropTenantDb(tenantId, isDemo = false) {
  closeTenantDb(tenantId, isDemo);
  const dbPath = getDbPath(tenantId, isDemo);
  try { fs.unlinkSync(dbPath); } catch (e) {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch (e) {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch (e) {}
}

export function tenantDbExists(tenantId, isDemo = false) {
  return fs.existsSync(getDbPath(tenantId, isDemo));
}

export function copyDemoToProduction(tenantId) {
  const demoDb = getTenantDb(tenantId, true);
  const prodDb = getTenantDb(tenantId, false);

  const tables = demoDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations' AND name NOT LIKE 'sqlite_%'"
  ).all();

  for (const { name } of tables) {
    const rows = demoDb.prepare(`SELECT * FROM "${name}"`).all();
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]).filter(c => c !== 'id');
    const placeholders = columns.map(() => '?').join(', ');
    const colNames = columns.map(c => `"${c}"`).join(', ');

    prodDb.prepare(`DELETE FROM "${name}"`).run();
    const insert = prodDb.prepare(`INSERT INTO "${name}" (${colNames}) VALUES (${placeholders})`);

    const insertMany = prodDb.transaction((rows) => {
      for (const row of rows) {
        insert.run(...columns.map(c => row[c]));
      }
    });
    insertMany(rows);
  }

  prodDb.prepare('UPDATE _migrations SET applied_at = applied_at').run();
}
