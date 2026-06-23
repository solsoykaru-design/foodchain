const Database = require('better-sqlite3');
const db = new Database('foodchain.db', { readonly: true });
const t = db.prepare('SELECT id, name, nickname FROM foodchain_portal_tenants WHERE LOWER(name) = LOWER(?)').get('бомбастик');
console.log('Tenant:', JSON.stringify(t));
const s = db.prepare("SELECT id, username, tenant_id, substr(password,1,30) as password_prefix, role FROM staff WHERE username = ? AND tenant_id = ?").get('admi1', t?.id);
console.log('Staff:', JSON.stringify(s));
db.close();
