import { query, get, run, transaction } from './db.js';
import bcrypt from 'bcrypt';
import { config } from './config.js';

export function seedSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL || 'admin@foodchain.ru';
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin123!';

  if (!email || !password) {
    console.warn('SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set, skipping superadmin seed');
    return;
  }

  const existing = query("SELECT id FROM users WHERE role = 'superadmin'");
  if (existing.length > 0) {
    console.log('Superadmin already exists, skipping seed');
    return;
  }

  const hash = bcrypt.hashSync(password, config.bcryptRounds);
  run(
    "INSERT INTO users (email, password_hash, full_name, role, email_verified) VALUES (?, ?, ?, 'superadmin', 1)",
    [email, hash, 'Super Administrator']
  );

  console.log(`Superadmin created: ${email}`);
}
