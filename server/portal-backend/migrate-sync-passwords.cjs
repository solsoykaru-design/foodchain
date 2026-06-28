const D = require('better-sqlite3');
const path = require('path');

const PORTAL_DB = path.join(__dirname, 'portal.db');
const MAIN_DB = path.join(__dirname, '..', '..', 'server', 'foodchain.db');

const pdb = new D(PORTAL_DB);
const mdb = new D(MAIN_DB);

const staffAccounts = pdb.prepare(`
  SELECT s.*, t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone
  FROM staff_accounts s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.password_hash IS NOT NULL
`).all();

console.log(`Found ${staffAccounts.length} staff accounts with password_hash in portal\n`);

let updated = 0;
let created = 0;
let errors = [];

for (const s of staffAccounts) {
  try {
    const existing = mdb.prepare('SELECT id FROM staff WHERE username = ? AND tenant_id = ?').get(s.username, s.tenant_id);
    if (existing) {
      mdb.prepare('UPDATE staff SET password = ?, role = ?, first_name = ?, phone = ?, email = ? WHERE id = ?')
        .run(s.password_hash, s.role === 'superadmin' ? 'admin' : s.role, s.first_name || s.tenant_name, s.tenant_phone || null, s.tenant_email || null, existing.id);
      console.log(`  UPDATED: ${s.username} (tenant=${s.tenant_name}, id=${s.tenant_id})`);
      updated++;
    } else {
      mdb.prepare('INSERT INTO staff (username, password, role, first_name, phone, email, tenant_id, is_active) VALUES (?,?,?,?,?,?,?,1)')
        .run(s.username, s.password_hash, s.role === 'superadmin' ? 'admin' : s.role, s.first_name || s.tenant_name, s.tenant_phone || null, s.tenant_email || null, s.tenant_id);
      console.log(`  CREATED: ${s.username} (tenant=${s.tenant_name}, id=${s.tenant_id})`);
      created++;
    }
  } catch (err) {
    console.error(`  ERROR: ${s.username} (id=${s.id}): ${err.message}`);
    errors.push({ username: s.username, tenant_id: s.tenant_id, error: err.message });
  }
}

console.log(`\n--- Done ---`);
console.log(`Updated: ${updated}`);
console.log(`Created: ${created}`);
console.log(`Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\nErrors:');
  for (const e of errors) {
    console.log(`  ${e.username} (tenant_id=${e.tenant_id}): ${e.error}`);
  }
}

pdb.close();
mdb.close();
