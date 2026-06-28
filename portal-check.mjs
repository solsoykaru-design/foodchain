const BASE = process.env.BASE_URL || 'https://foodchain-qpxh.onrender.com';

async function req(method, path, body = null, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('=== Проверка через портал ===');
  const login = await req('POST', '/portal/api/auth/login', { email: 'admin@foodchain.ru', password: 'Admin123!' });
  console.log('1. Вход суперадмина:', login.status, login.data.error || 'OK');
  if (!login.ok) return;
  const token = login.data.accessToken;

  const suffix = Date.now().toString().slice(-6);
  const tenantName = `QA-${suffix}`;
  const subdomain = `qa${suffix}`;
  const adminUser = `admin${suffix}`;
  const adminPass = `AdminPass${suffix}!`;

  const create = await req('POST', '/portal/api/admin/tenants', {
    name: tenantName,
    nickname: tenantName,
    email: `qa${suffix}@test.com`,
    inn: `inn${suffix}`,
    phone: `+99890${suffix}`,
    address: 'Test',
    tariff_id: 1,
    admin_username: adminUser,
    admin_password: adminPass,
  }, token);
  console.log('2. Создание ресторана:', create.status, create.data.error || `id=${create.data?.id}`, create.data?.syncWarnings || '');

  const search = await req('GET', `/api/tenants/search?q=${tenantName}`, null, '');
  console.log('3. Поиск ресторана в админке:', search.status, search.data?.length, search.data?.[0]?.name || search.data?.error);

  const adminLogin = await req('POST', '/api/auth/admin-login', { username: adminUser, password: adminPass });
  console.log('4. Вход администратора ресторана:', adminLogin.status, adminLogin.data.error || `tenant_id=${adminLogin.data?.user?.tenant_id}`);

  const tLogin = await req('POST', '/api/auth/login', { username: adminUser, password: adminPass, tenant_name: tenantName });
  console.log('5. Вход staff-приложение:', tLogin.status, tLogin.data.error || 'OK');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
