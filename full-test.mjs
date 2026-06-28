const BASE = process.env.BASE_URL || 'https://foodchain-qpxh.onrender.com';

let PASS = 0, FAIL = 0, TOTAL = 0;
const errors = [];
const findings = [];

function log(ok, label, detail = '') {
  TOTAL++;
  if (ok) { PASS++; process.stdout.write('.'); }
  else { FAIL++; process.stdout.write('F'); errors.push({ label, detail }); }
}

function finding(label, detail) {
  findings.push({ label, detail });
}

async function req(method, path, body = null, token = '', headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text) || {}; } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('🧪 Полное тестирование FoodChain API');
  console.log('══════════════════════════════════════════════════════\n');

  // ─── 1. Портал: вход суперадмина ─────────────────────────────
  console.log('── 1. Портал ──');
  const portalLogin = await req('POST', '/portal/api/auth/login', { email: 'admin@foodchain.ru', password: 'Admin123!' });
  log(portalLogin.ok, 'Вход суперадмина портала', portalLogin.status);
  if (!portalLogin.ok) return finish();
  const portalToken = portalLogin.data.accessToken;

  // ─── 2. Создание ресторана в портале ─────────────────────────
  const suffix = Date.now().toString().slice(-6);
  const tenantName = `QA-${suffix}`;
  const adminUser = `admin${suffix}`;
  const adminPass = `AdminPass${suffix}!`;

  const tenant = await req('POST', '/portal/api/admin/tenants', {
    name: tenantName, nickname: tenantName, email: `qa${suffix}@test.com`,
    inn: `inn${suffix}`, phone: `+99890${suffix}`, address: 'Test address',
    tariff_id: 1, admin_username: adminUser, admin_password: adminPass,
  }, portalToken);
  log(tenant.ok, 'Создание ресторана', tenant.data.error || `id=${tenant.data?.id}`);
  const tenantId = tenant.data?.id;

  // ─── 3. Поиск ресторана в админке ────────────────────────────
  const search = await req('GET', `/api/tenants/search?q=${tenantName}`);
  log(search.ok && search.data?.length > 0, 'Поиск ресторана', `${search.data?.length} results`);

  // ─── 4. Вход администратора ресторана ────────────────────────
  console.log('\n── 2. Администратор ──');
  const adminLogin = await req('POST', '/api/auth/admin-login', { username: adminUser, password: adminPass });
  log(adminLogin.ok, 'Вход администратора', adminLogin.data.error || `tenantId=${adminLogin.data?.user?.tenantId}`);
  const adminToken = adminLogin.data?.token;

  let catId, dishId, waiterId, cookId, courierId;

  if (adminToken) {
    // Категория
    const cat = await req('POST', '/api/menu-categories', { name: 'Суши', sort_order: 1 }, adminToken);
    log(cat.ok, 'Создание категории меню', cat.data.error || `id=${cat.data?.id}`);
    catId = cat.data?.id;

    // Блюдо
    const dish = await req('POST', '/api/dishes', {
      name: 'Калифорния ролл', price: 450, type: 'dish', category_id: catId,
      description: 'Краб, авокадо, огурец'
    }, adminToken);
    log(dish.ok, 'Создание блюда', dish.data.error || `id=${dish.data?.id}`);
    dishId = dish.data?.id;

    // Инвентарь
    const inv = await req('POST', '/api/inventory-items', { name: 'Рис', unit: 'кг', quantity: 20, min_stock: 2 }, adminToken);
    log(inv.ok, 'Создание инвентаря', inv.data.error || `id=${inv.data?.id}`);

    // Сотрудники
    const waiter = await req('POST', '/api/staff', {
      username: `waiter${suffix}`, password: `Waiter1!`, first_name: 'Алиса', last_name: 'Официант',
      role: 'waiter', phone: `+9989012345${suffix.slice(-2)}`
    }, adminToken);
    log(waiter.ok, 'Создание официанта', waiter.data.error || `id=${waiter.data?.id}`);
    waiterId = waiter.data?.id;

    const cook = await req('POST', '/api/staff', {
      username: `cook${suffix}`, password: `Cook1!`, first_name: 'Шеф', last_name: 'Повар',
      role: 'cook', phone: `+9989012346${suffix.slice(-2)}`
    }, adminToken);
    log(cook.ok, 'Создание повара', cook.data.error || `id=${cook.data?.id}`);
    cookId = cook.data?.id;

    const courier = await req('POST', '/api/staff', {
      username: `courier${suffix}`, password: `Courier1!`, first_name: 'Быстрый', last_name: 'Курьер',
      role: 'courier', phone: `+9989012347${suffix.slice(-2)}`
    }, adminToken);
    log(courier.ok, 'Создание курьера', courier.data.error || `id=${courier.data?.id}`);
    courierId = courier.data?.id;
  }

  // ─── 5. Официант ─────────────────────────────────────────────
  console.log('\n── 3. Официант ──');
  let waiterToken, orderId, shiftId;
  if (waiterId) {
    const wLogin = await req('POST', '/api/auth/login', { tenantName, login: `waiter${suffix}`, password: `Waiter1!` });
    log(wLogin.ok, 'Вход официанта', wLogin.data.error || 'OK');
    waiterToken = wLogin.data?.token;

    if (waiterToken) {
      const shift = await req('POST', '/api/admin/shifts/open', { openingBalance: 0 }, waiterToken);
      log(shift.ok, 'Открытие смены', shift.data.error || `id=${shift.data?.id}`);
      shiftId = shift.data?.id;

      if (dishId && waiterId) {
        const order = await req('POST', '/api/orders', {
          user_id: waiterId, user_name: 'Алиса Официант', user_phone: `+9989012345${suffix.slice(-2)}`,
          items: [{ dishId, quantity: 2, price: 450 }], total: 900, type: 'delivery'
        }, waiterToken);
        log(order.ok, 'Создание заказа', order.data.error || `id=${order.data?.id}`);
        orderId = order.data?.id;
      }

      const orders = await req('GET', '/api/orders', null, waiterToken);
      log(orders.ok, 'Список заказов', orders.data?.length !== undefined ? `${orders.data.length} заказов` : orders.data.error);

      if (orderId) {
        const confirmed = await req('PATCH', `/api/orders/${orderId}/status`, { status: 'confirmed' }, waiterToken);
        log(confirmed.ok, 'Заказ → confirmed', confirmed.data.error || 'OK');

        const voiceDraft = await req('POST', '/api/waiter/voice/draft', {
          waiterId: waiterId, waiterName: 'Алиса Официант',
          items: [{ name: 'Калифорния ролл', quantity: 1, price: 450 }]
        }, waiterToken);
        log(voiceDraft.ok, 'Голосовой черновик', voiceDraft.data.error || 'OK');

        const queue = await req('GET', '/api/waiter/voice/queue', null, waiterToken);
        log(queue.ok, 'Очередь голоса', queue.data?.queue?.length !== undefined ? `${queue.data.queue.length} items` : 'OK');
      }

      if (shiftId) {
        const close = await req('PUT', `/api/admin/shifts/${shiftId}/close`, { closingBalance: 900 }, waiterToken);
        log(close.ok || close.status === 404, 'Закрытие смены', close.data.error || 'OK');
      }
    }
  }

  // ─── 6. Повар ────────────────────────────────────────────────
  console.log('\n── 4. Повар ──');
  let cookToken;
  if (cookId) {
    const cLogin = await req('POST', '/api/auth/login', { tenantName, login: `cook${suffix}`, password: `Cook1!` });
    log(cLogin.ok, 'Вход повара', cLogin.data.error || 'OK');
    cookToken = cLogin.data?.token;

    if (cookToken) {
      const kOrders = await req('GET', '/api/kitchen/orders', null, cookToken);
      log(kOrders.ok, 'Список заказов кухни', kOrders.data?.length !== undefined ? `${kOrders.data.length} заказов` : kOrders.data.error);

      if (orderId) {
        const accept = await req('POST', `/api/kitchen/orders/${orderId}/accept`, {}, cookToken);
        log(accept.ok || accept.status === 409, 'Кухня приняла заказ', accept.data.error || 'OK');

        const complete = await req('POST', `/api/kitchen/orders/${orderId}/complete`, {}, cookToken);
        log(complete.ok || complete.status === 409, 'Кухня завершила заказ', complete.data.error || 'OK');
      }
    }
  }

  // ─── 7. Курьер ───────────────────────────────────────────────
  console.log('\n── 5. Курьер ──');
  let courierToken;
  if (courierId) {
    const crLogin = await req('POST', '/api/auth/login', { tenantName, login: `courier${suffix}`, password: `Courier1!` });
    log(crLogin.ok, 'Вход курьера', crLogin.data.error || 'OK');
    courierToken = crLogin.data?.token;

    if (courierToken) {
      const online = await req('POST', '/api/courier/online', { staff_id: courierId, is_online: true }, courierToken);
      log(online.ok || online.status === 404, 'Курьер онлайн', online.data.error || 'OK');

      const crOrders = await req('GET', '/api/orders', null, courierToken);
      log(crOrders.ok, 'Заказы курьера', crOrders.data?.length !== undefined ? `${crOrders.data.length} заказов` : crOrders.data.error);

      if (orderId) {
        const assigned = await req('PATCH', `/api/orders/${orderId}/status`, { status: 'assigned' }, courierToken);
        log(assigned.ok, 'Заказ → assigned', assigned.data.error || 'OK');

        const enRoute = await req('PATCH', `/api/orders/${orderId}/status`, { status: 'en_route' }, courierToken);
        log(enRoute.ok, 'Заказ → en_route', enRoute.data.error || 'OK');

        const delivered = await req('PATCH', `/api/orders/${orderId}/status`, { status: 'delivered' }, courierToken);
        log(delivered.ok, 'Заказ → delivered', delivered.data.error || 'OK');
      }
    }
  }

  // ─── 8. Гость / публичные ────────────────────────────────────
  console.log('\n── 6. Гость / публичные ──');
  const pubMenu = await req('GET', '/api/public/menu?channel=site', null, '');
  log(pubMenu.ok, 'Публичное меню', pubMenu.data.error || 'OK');

  const pubSearch = await req('GET', `/api/tenants/search?q=${tenantName}`, null, '');
  log(pubSearch.ok, 'Поиск ресторанов', pubSearch.data?.length !== undefined ? `${pubSearch.data.length} results` : pubSearch.data.error);

  // ─── 9. Безопасность ─────────────────────────────────────────
  console.log('\n── 7. Безопасность ──');
  const noAuth1 = await req('GET', '/api/orders', null, '');
  log(noAuth1.status === 401, 'Без авторизации /api/orders = 401', noAuth1.status);

  const noAuth2 = await req('POST', '/api/orders', { items: [] }, '');
  log(noAuth2.status === 401, 'Без авторизации POST /api/orders = 401', noAuth2.status);

  const backdoor = await req('POST', '/api/auth/admin-login', { username: 'admin', password: 'admin' });
  log(backdoor.status === 401, 'Бэкдор admin:admin = 401', backdoor.status);

  const badJwt = await req('GET', '/api/orders', null, 'invalid-token');
  log(badJwt.status === 401, 'Невалидный JWT = 401', badJwt.status);

  // ─── 8. Персистентность ─────────────────────────────────────
  console.log('\n── 8. Проверка сохранения данных ──');
  const tenantsAfter = await req('GET', `/api/tenants/search?q=${tenantName}`);
  log(tenantsAfter.ok && tenantsAfter.data?.length > 0, 'Ресторан сохранился в базе', `${tenantsAfter.data?.length} results`);

  // ─── 9. Мульти-тенантная изоляция ──────────────────────────────────────
  console.log('\n── 9. Мульти-тенантная изоляция ──');
  const tenant2Name = `QA2-${suffix}`;
  const admin2User = `admin2${suffix}`;
  const admin2Pass = `AdminPass2${suffix}!`;
  const tenant2 = await req('POST', '/portal/api/admin/tenants', {
    name: tenant2Name, nickname: tenant2Name, email: `qa2${suffix}@test.com`,
    inn: `inn2${suffix}`, phone: `+99891${suffix}`, address: 'Test2',
    tariff_id: 1, admin_username: admin2User, admin_password: admin2Pass,
  }, portalToken);
  log(tenant2.ok, 'Создание второго ресторана', tenant2.data.error || `id=${tenant2.data?.id}`);

  const admin2Login = await req('POST', '/api/auth/admin-login', { username: admin2User, password: admin2Pass });
  const admin2Token = admin2Login.data?.token;
  log(!!admin2Token, 'Вход админа второго ресторана', admin2Login.data.error || `tenantId=${admin2Login.data?.user?.tenantId}`);

  if (adminToken && admin2Token && dishId) {
    const dishes1 = await req('GET', '/api/dishes', null, adminToken);
    const hasDish1 = dishes1.ok && dishes1.data?.some(d => d.id === dishId);
    log(hasDish1, 'Админ 1 видит своё блюдо', hasDish1 ? 'OK' : 'NOT FOUND');

    const dishes2 = await req('GET', '/api/dishes', null, admin2Token);
    const hasDish2 = dishes2.ok && dishes2.data?.some(d => d.id === dishId);
    log(!hasDish2, 'Админ 2 НЕ видит блюдо админа 1', hasDish2 ? 'LEAK' : 'OK');
  }

  finish();
}

function finish() {
  console.log('\n\n══════════════════════════════════════════════════════');
  console.log('📊 ОТЧЁТ');
  console.log('══════════════════════════════════════════════════════');
  console.log(`Всего тестов: ${TOTAL}`);
  console.log(`✅ Пройдено:   ${PASS}`);
  console.log(`❌ Провалено:  ${FAIL}`);
  if (errors.length > 0) {
    console.log('\n🔴 ОШИБКИ:');
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.label}`));
    console.log('\nДетали:');
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.label} → ${JSON.stringify(e.detail).slice(0, 120)}`));
  }
  console.log('══════════════════════════════════════════════════════');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
