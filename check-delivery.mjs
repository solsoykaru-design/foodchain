const BASE = 'https://foodchain-qpxh.onrender.com';
async function req(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  return { status: r.status, data: await r.json().catch(() => null), text: await r.text().catch(() => '') };
}

// Portal superadmin login
const login = await req('POST', '/portal/api/auth/login', { email: 'admin@foodchain.ru', password: 'Admin123!' });
const T = login.data?.accessToken;

// Create tenant
const suffix = Date.now().toString().slice(-6);
const tenantName = `QA-${suffix}`;
const adminUser = `admin${suffix}`;
const adminPass = `AdminPass${suffix}!`;
const tenant = await req('POST', '/portal/api/admin/tenants', {
  name: tenantName, nickname: tenantName, email: `qa${suffix}@test.com`,
  inn: `inn${suffix}`, phone: `+99890${suffix}`, address: 'Test',
  tariff_id: 1, admin_username: adminUser, admin_password: adminPass,
}, T);
console.log('Tenant:', tenant.status, tenant.data?.id, tenant.data?.syncWarnings || '');

// Admin login
const adminLogin = await req('POST', '/api/auth/admin-login', { username: adminUser, password: adminPass });
const A = adminLogin.data?.token;
console.log('Admin login:', adminLogin.status, adminLogin.data?.error || 'OK');

// Delivery page endpoints
const orders = await req('GET', '/api/delivery-orders', null, A);
console.log('Delivery orders:', orders.status, Array.isArray(orders.data) ? `${orders.data.length} orders` : orders.data?.error);

const users = await req('GET', '/api/users', null, A);
console.log('Users:', users.status, Array.isArray(users.data) ? `${users.data.length} users` : users.data?.error);

const couriers = await req('GET', '/api/couriers', null, A);
console.log('Couriers:', couriers.status, Array.isArray(couriers.data) ? `${couriers.data.length} couriers` : couriers.data?.error);

const returning = await req('GET', '/api/couriers/returning', null, A);
console.log('Returning couriers:', returning.status, Array.isArray(returning.data) ? `${returning.data.length} returning` : returning.data?.error);

// Check admin JS for Yandex tiles
const admin = await fetch(BASE + '/admin/');
const adminText = await admin.text();
const m = adminText.match(/src="\.\/assets\/([^"]+\.js)"/);
const jsUrl = BASE + '/admin/assets/' + m[1];
const js = await fetch(jsUrl);
const jsText = await js.text();
console.log('Admin JS:', m[1]);
console.log('Has Yandex tiles:', jsText.includes('core-renderer-tiles.maps.yandex.net'));
