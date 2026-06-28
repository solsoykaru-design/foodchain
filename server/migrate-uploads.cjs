const fs = require('fs');
const path = require('path');
const { init: initSupabase, getClient, ensureBucket, uploadFile } = require('./lib/supabase');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BUCKET = 'foodchain-uploads';

async function migrate() {
  const client = initSupabase();
  if (!client) {
    console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  console.log('Ensuring bucket exists...');
  await ensureBucket(BUCKET, { public: true, fileSizeLimit: 52428800 });

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('No uploads directory found.');
    return;
  }

  let total = 0;
  let uploaded = 0;
  let failed = 0;

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const remotePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, remotePath);
      } else {
        total++;
        const content = fs.readFileSync(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream';

        uploadFile(BUCKET, `uploads/${remotePath}`, content, mime)
          .then(() => {
            uploaded++;
            process.stdout.write(`\rUploaded ${uploaded}/${total}...`);
          })
          .catch(e => {
            failed++;
            console.log(`\nFailed: ${remotePath} — ${e.message}`);
          });
      }
    }
  }

  walk(UPLOADS_DIR, '');
  console.log(`\nDone. ${uploaded} uploaded, ${failed} failed out of ${total} total.`);
}

migrate().catch(e => console.error('Error:', e.message));
