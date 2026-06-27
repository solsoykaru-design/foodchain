const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const dbPath = path.join(__dirname, 'foodchain.db');

if (!supabaseUrl || !supabaseKey) {
  console.log('[restore] SUPABASE_URL/SUPABASE_ANON_KEY not set — skipping restore');
  process.exit(0);
}

async function restore() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = 'foodchain-backups';

    // Check if bucket exists, create if not
    const { error: bucketError } = await supabase.storage.getBucket(bucket);
    if (bucketError && bucketError.message?.includes('not found')) {
      await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 52428800 });
      console.log('[restore] Created bucket:', bucket);
      process.exit(0);
    }

    // Download backup
    const { data, error } = await supabase.storage.from(bucket).download('foodchain.db');
    if (error || !data) {
      console.log('[restore] No backup found — starting fresh');
      process.exit(0);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length < 100) {
      console.log('[restore] Backup too small — starting fresh');
      process.exit(0);
    }

    // Validate SQLite header
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
