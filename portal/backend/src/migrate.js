import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`Running migration: ${file}...`);
    try {
      db.exec(sql);
      console.log('  OK');
    } catch (err) {
      console.error(`Migration ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed successfully');
}

migrate();
