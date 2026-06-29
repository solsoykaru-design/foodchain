require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { init: initSupabase, getClient } = require('./lib/supabase');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'foodchain.db');
const PORTAL_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'portal-backend', 'portal.db');
const BUCKET_NAME = 'foodchain-backups';

async function restoreFile(dbPath, key) {
  try {
    initSupabase();
    const sb = getClient();
    if (!sb) {
      console.log('[restore-dbs] Supabase not configured');
      return;
    }

    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET_NAME)) {
      const { error: createError } = await sb.storage.createBucket(BUCKET_NAME, { public: false, fileSizeLimit: 52428800 });
      if (createError) {
        console.log('[restore-dbs] Could not create bucket:', createError.message);
        return;
      }
      console.log('[restore-dbs] Created bucket:', BUCKET_NAME);
    }

    const { data: files, error: listError } = await sb.storage.from(BUCKET_NAME).list();
    if (listError) {
      console.log('[restore-dbs] List error:', listError.message);
      return;
    }

    const backupFile = files?.find(f => f.name === key);
    if (!backupFile) {
      console.log(`[restore-dbs] No backup found for ${key}`);
      return;
    }

    const { data, error: downloadError } = await sb.storage.from(BUCKET_NAME).download(key);
    if (downloadError || !data) {
      console.log(`[restore-dbs] Download error for ${key}:`, downloadError?.message);
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length === 0) {
      console.log(`[restore-dbs] Empty backup for ${key}`);
      return;
    }

    if (buffer[0] !== 0x53 || buffer[1] !== 0x51 || buffer[2] !== 0x4c) {
      console.log(`[restore-dbs] Invalid SQLite backup for ${key}`);
      return;
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, buffer);
    console.log(`[restore-dbs] Restored ${buffer.length} bytes for ${key}`);
  } catch (e) {
    console.log(`[restore-dbs] Error restoring ${key}:`, e.message);
  }
}

(async () => {
  try {
    console.log('[restore-dbs] Restoring databases from Supabase...');
    await restoreFile(DB_PATH, 'foodchain.db');
    await restoreFile(PORTAL_DB_PATH, 'portal.db');
    console.log('[restore-dbs] Done');
  } catch (e) {
    console.error('[restore-dbs] Fatal error:', e.message);
  }
  process.exit(0);
})();
