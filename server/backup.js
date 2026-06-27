const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH = path.join(__dirname, 'foodchain.db');
const BUCKET_NAME = 'foodchain-backups';
const BACKUP_KEY = 'foodchain.db';

let supabase = null;
let backupInterval = null;

function init(db) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('[backup] SUPABASE_URL/SUPABASE_ANON_KEY not set — backup disabled');
    return;
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[backup] Supabase client initialized');

  // Restore on startup
  restoreFromBackup(db);

  // Auto-backup every 5 minutes
  backupInterval = setInterval(() => doBackup(db), 5 * 60 * 1000);
  console.log('[backup] Auto-backup every 5 minutes');

  // Also run immediately
  setTimeout(() => doBackup(db), 5000);
}

async function restoreFromBackup(db) {
  try {
    // List files in bucket to find the latest backup
    const { data: files, error: listError } = await supabase.storage.from(BUCKET_NAME).list();
    if (listError) {
      if (listError.message?.includes('bucket')) {
        // Bucket doesn't exist yet — create it
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
        });
        if (createError) {
          console.log('[backup] Could not create bucket:', createError.message);
          return;
        }
        console.log('[backup] Created bucket:', BUCKET_NAME);
      }
      return;
    }

    const backupFile = files?.find(f => f.name === BACKUP_KEY);
    if (!backupFile) {
      console.log('[backup] No existing backup found');
      return;
    }

    // Download backup
    const { data, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(BACKUP_KEY);
    if (downloadError || !data) {
      console.log('[backup] Download failed:', downloadError?.message);
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length === 0) {
      console.log('[backup] Backup file is empty');
      return;
    }

    // Verify it's a valid SQLite file (starts with SQLite format header)
    if (buffer[0] !== 0x53 || buffer[1] !== 0x51 || buffer[2] !== 0x4c) {
      console.log('[backup] Backup file is not a valid SQLite database — skipping restore');
      return;
    }

    // Write backup to disk
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`[backup] Restored ${buffer.length} bytes from cloud backup`);

    // Reconnect database
    try {
      db.close();
    } catch {}
    // The calling code needs to handle reconnection
  } catch (e) {
    console.log('[backup] Restore error:', e.message);
  }
}

async function doBackup(db) {
  try {
    if (!supabase) return;

    // Verify DB file exists and is accessible
    if (!fs.existsSync(DB_PATH)) {
      console.log('[backup] DB file not found');
      return;
    }

    // Check DB integrity
    try {
      const integrity = db.prepare('PRAGMA integrity_check').get();
      if (integrity && integrity['integrity_check'] !== 'ok') {
        console.log('[backup] DB integrity check failed — skipping backup');
        return;
      }
    } catch {
      console.log('[backup] Integrity check error — skipping backup');
      return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    if (fileBuffer.length === 0) return;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(BACKUP_KEY, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      console.log('[backup] Upload failed:', error.message);
      return;
    }

    const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[backup] Backed up ${sizeMB} MB at ${new Date().toISOString()}`);
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

module.exports = { init, doBackup, restoreFromBackup, stop };
