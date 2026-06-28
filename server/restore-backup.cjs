const fs = require('fs');
const path = require('path');
const { init: initSupabase, getClient } = require('./lib/supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const dbPath = path.join(DATA_DIR, 'foodchain.db');

if (!supabaseUrl || !supabaseKey) {
  console.log('[restore] SUPABASE_URL/SUPABASE_ANON_KEY not set — skipping restore');
  process.exit(0);
}

async function restore() {
  try {
    const client = initSupabase();
    if (!client) {
      console.log('[restore] Supabase client initialization failed');
      process.exit(0);
    }
    const sb = getClient();

    const bucket = 'foodchain-backups';

    const { error: bucketError } = await sb.storage.getBucket(bucket);
    if (bucketError && bucketError.message?.includes('not found')) {
      await sb.storage.createBucket(bucket, { public: false, fileSizeLimit: 52428800 });
      console.log('[restore] Created bucket:', bucket);
      process.exit(0);
    }

    const { data, error } = await sb.storage.from(bucket).download('foodchain.db');
    if (error || !data) {
      console.log('[restore] No backup found — starting fresh');
      process.exit(0);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length < 100) {
      console.log('[restore] Backup too small — starting fresh');
      process.exit(0);
    }

    if (buffer[0] !== 0x53 || buffer[1] !== 0x51 || buffer[2] !== 0x4c) {
      console.log('[restore] Invalid backup file — starting fresh');
      process.exit(0);
    }

    fs.writeFileSync(dbPath, buffer);
    console.log(`[restore] Restored ${(buffer.length / 1024 / 1024).toFixed(2)} MB from cloud backup`);
  } catch (e) {
    console.log('[restore] Error:', e.message);
  }
  process.exit(0);
}

restore();
