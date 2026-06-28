const BASE = 'https://foodchain-qpxh.onrender.com';
async function req(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  return { status: r.status, data: await r.json().catch(() => null) };
}
const login = await req('POST', '/portal/api/auth/login', { email: 'admin@foodchain.ru', password: 'Admin123!' });
console.log('portal login:', login.status, login.data?.error || 'OK');
if (login.data?.accessToken) {
  const T = login.data.accessToken;
  const list = await req('GET', '/portal/api/admin/tenants', null, T);
  console.log('portal tenants:', list.data?.length || 0);
  (list.data || []).forEach(t => console.log(' -', t.id, t.name, t.created_at));
}
const health = await req('GET', '/api/health');
console.log('uptime:', health.data?.uptime, 's');
console.log('db size:', health.data?.db?.sizeMB, 'MB');
