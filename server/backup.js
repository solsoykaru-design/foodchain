const fs = require('fs');
const path = require('path');
const { init: initSupabase, getClient } = require('./lib/supabase');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'foodchain.db');
const PORTAL_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'portal-backend', 'portal.db');
const BUCKET_NAME = 'foodchain-backups';

let backupInterval = null;

async function init(db) {
  const client = initSupabase();
  if (!client) {
    console.log('[backup] Supabase not configured — backup disabled');
    return;
  }

  try {
    const { data: buckets } = await client.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET_NAME)) {
      const { error } = await client.storage.createBucket(BUCKET_NAME, { public: false, fileSizeLimit: 52428800 });
      if (error) console.log('[backup] Could not create bucket:', error.message);
      else console.log('[backup] Created bucket:', BUCKET_NAME);
    }
  } catch (e) {
    console.log('[backup] Bucket check error:', e.message);
  }

  // Auto-backup both main and portal DB every 5 minutes
  backupInterval = setInterval(() => {
    doBackup(DB_PATH, 'foodchain.db');
    doBackup(PORTAL_DB_PATH, 'portal.db');
  }, 5 * 60 * 1000);
  console.log('[backup] Auto-backup every 5 minutes (foodchain.db + portal.db)');

  // Also run immediately
  setTimeout(() => {
    doBackup(DB_PATH, 'foodchain.db');
    doBackup(PORTAL_DB_PATH, 'portal.db');
  }, 5000);
}

async function restoreAll() {
  const sb = getClient();
  if (!sb) return;
  await restoreDatabaseFile(DB_PATH, 'foodchain.db');
  await restoreDatabaseFile(PORTAL_DB_PATH, 'portal.db');
}

async function restoreDatabaseFile(dbPath, key) {
  try {
    const sb = getClient();
    if (!sb) return;

    const { data: files, error: listError } = await sb.storage.from(BUCKET_NAME).list();
    if (listError) {
      if (listError.message?.includes('bucket')) {
        const { error: createError } = await sb.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800,
        });
        if (createError) {
          console.log('[backup] Could not create bucket:', createError.message);
          return;
        }
        console.log('[backup] Created bucket:', BUCKET_NAME);
      }
      return;
    }

    const backupFile = files?.find(f => f.name === key);
    if (!backupFile) {
      console.log(`[backup] No existing backup found for ${key}`);
      return;
    }

    const { data, error: downloadError } = await sb.storage.from(BUCKET_NAME).download(key);
    if (downloadError || !data) {
      console.log(`[backup] Download failed for ${key}:`, downloadError?.message);
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length === 0) {
      console.log(`[backup] Backup file is empty for ${key}`);
      return;
    }

    if (buffer[0] !== 0x53 || buffer[1] !== 0x51 || buffer[2] !== 0x4c) {
      console.log(`[backup] Backup file is not a valid SQLite database — skipping restore (${key})`);
      return;
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, buffer);
    console.log(`[backup] Restored ${buffer.length} bytes from cloud backup (${key})`);
  } catch (e) {
    console.log(`[backup] Restore error (${key}):`, e.message);
  }
}

async function restoreFromBackup(db) {
  // Legacy signature — restore main DB by passing its path
  return restoreDatabaseFile(DB_PATH, 'foodchain.db');
}

async function doBackup(target, key) {
  try {
    const dbPath = typeof target === 'string' ? target : DB_PATH;
    const backupKey = key || 'foodchain.db';
    const sb = getClient();
    if (!sb) return;

    if (!fs.existsSync(dbPath)) {
      console.log(`[backup] DB file not found (${backupKey})`);
      return;
    }

    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length === 0) return;

    const { error } = await sb.storage.from(BUCKET_NAME).upload(backupKey, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      console.log(`[backup] Upload failed (${backupKey}):`, error.message);
      return;
    }

    const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[backup] Backed up ${sizeMB} MB (${backupKey}) at ${new Date().toISOString()}`);
  } catch (e) {
    console.log('[backup] Backup error:', e.message);
  }
}

function stop() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

module.exports = { init, doBackup, restoreFromBackup, restoreAll, stop };
