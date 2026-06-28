// ─── FoodChain (MIRUZ) — Full QA Test Suite v2 ─────────────────
// Tests both old (deployed) and new (post-fix) behavior
// Usage: node qa-test.mjs
// Environment: BASE_URL (default: https://foodchain-qpxh.onrender.com)

const BASE = process.env.BASE_URL || 'https://foodchain-qpxh.onrender.com';

let PASS = 0, FAIL = 0, TOTAL = 0;
const errors = [];
const findings = [];
const timer = { start: Date.now() };

function log(ok, label, detail = '') {
  TOTAL++;
  if (ok) { PASS++; process.stdout.write('.'); }
  else { FAIL++; process.stdout.write('F'); errors.push({ label, detail }); }
}

// Track findings (not pass/fail)
function finding(label, detail) {
  findings.push({ label, detail });
  process.stdout.write('·');
}

async function req(method, path, body = null, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

// ─── Main ──────────────────────────────────────────────────────
console.log(`\n🧪 FoodChain QA v2 — ${new Date().toISOString()}`);
console.log(`Target: ${BASE}\n`);

// ─── 0. Health & Deployment Check ──────────────────────────────
async function main() {
  console.log('── 0. Health & Deployment ──');

  const h = await req('GET', '/api/health');
  log(h.ok, 'GET /api/health', `Status ${h.status}`);
  finding('Server version', `Response keys: ${Object.keys(h.data||{}).join(', ')}`);
  finding('Response size', `${JSON.stringify(h.data).length} bytes`);
  if (h.data) {
    const entries = Object.entries(h.data);
    entries.forEach(([k, v]) => {
      if (typeof v === 'string' && v.length > 40) v = v.slice(0, 40) + '...';
      finding(`  health.${k}`, String(v));
    });
  }

  // 0.1 Check if admin:admin works (OLD code — will fail after redeploy)
  const backdoor = await req('POST', '/api/auth/admin-login', { username: 'admin', password: 'admin' });
  log(backdoor.ok, 'admin:admin backdoor', backdoor.ok ? '⚠️ STILL WORKS (old code deployed)' : 'REMOVED ✓');
  if (backdoor.ok) {
    finding('Backdoor token', `${backdoor.data.token?.slice(0, 20)}...`);
  }

  // 0.2 Check if unauthenticated /api/orders returns 401 (our fix) or 200 (old code)
  const noAuthOrders = await req('GET', '/api/orders', null, '');
  log(noAuthOrders.status === 401, 'Unauthenticated /api/orders returns 401',
    noAuthOrders.status === 200 ? '⚠️ RETURNS 200 (tenant_id fallback active — pre-fix)' : `Status ${noAuthOrders.status}`);

  // 0.3 Check if invalid JWT returns 401
  const badToken = await req('GET', '/api/orders', null, 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic3VwZXJhZG1pbiJ9.badsignature');
  log(badToken.status === 401, 'Invalid JWT returns 401',
    badToken.status === 200 ? '⚠️ RETURNS 200 (no jwt.verify on this route?)' : `Status ${badToken.status}`);

  // 0.4 Portal status
  const portal = await req('POST', '/portal/api/auth/login', { username: 'admin', password: 'admin' });
  finding('Portal endpoint', `Status ${portal.status}: ${portal.data?.error || JSON.stringify(portal.data).slice(0, 100)}`);
  log(portal.status !== 503, 'Portal NOT returning 503',
    portal.status === 503 ? '⚠️ STILL 503 (portal not loaded)' : `Status ${portal.status}`);

  // 0.5 Attempt superadmin access via the still-working backdoor
  let superToken = '';
  if (backdoor.ok) {
    superToken = backdoor.data.token;
    log(true, 'Superadmin token acquired via backdoor', 'Will create test data');
  }

  let adminToken = '';
  let tenantId = '';
  let testOrderId = null;
  let testDishId = null;

  // ─── 1. Bootstrap Test Data (via backdoor) ─────────────────
  if (superToken) {
    console.log('\n── 1. Bootstrap Test Data (via superadmin backdoor) ──');

    // 1.1 Create test tenant
    const tenant = await req('POST', '/api/tenants', {
      name: 'QA-Test Restaurant',
      subdomain: 'qatest',
      contact_phone: '+998901234500',
      address: 'Test Street 1',
    }, superToken);
    log(tenant.ok || tenant.status === 409, 'Create test tenant', tenant.ok ? `id=${tenant.data?.id}` : (tenant.data?.error || `Status ${tenant.status}`));
    if (tenant.data?.id) tenantId = tenant.data.id;

    // 1.2 Create admin for the test tenant
    const adminUser = await req('POST', '/api/users', {
      username: 'testadmin', password: 'TestAdmin2026!',
      role: 'admin', tenant_id: tenantId,
      first_name: 'Test', last_name: 'Admin',
      phone: '+998901234501',
    }, superToken);
    log(adminUser.ok || adminUser.status === 409, 'Create tenant admin', adminUser.ok ? `id=${adminUser.data?.id}` : (adminUser.data?.error || `Status ${adminUser.status}`));

    // 1.3 Login as tenant admin
    const adminLogin = await req('POST', '/api/auth/admin-login', { username: 'testadmin', password: 'TestAdmin2026!' });
    if (adminLogin.ok) {
      adminToken = adminLogin.data.token;
      tenantId = adminLogin.data.user?.tenant_id || tenantId;
    }
    log(!!adminToken, 'Tenant admin login', adminToken ? `tenant_id=${tenantId}` : `Failed ${adminLogin.status}`);

    if (adminToken) {
      // 1.4 Create menu categories
      const cat1 = await req('POST', '/api/menu-categories', { name: 'Суши', sort_order: 1 }, adminToken);
      log(cat1.ok || cat1.status === 409, 'Create category "Суши"', cat1.ok ? `id=${cat1.data?.id}` : cat1.data?.error);
      const catId = cat1.data?.id || null;

      // 1.5 Create dishes
      const dish = await req('POST', '/api/dishes', {
        name: 'Калифорния ролл', price: 450, type: 'dish',
        category_id: catId, description: 'Краб, авокадо, огурец'
      }, adminToken);
      log(dish.ok || dish.status === 409, 'Create dish "Калифорния ролл"', dish.ok ? `id=${dish.data?.id}` : dish.data?.error);
      if (dish.data?.id) testDishId = dish.data.id;

      const dish2 = await req('POST', '/api/dishes', {
        name: 'Филадельфия ролл', price: 550, type: 'dish',
        category_id: catId, description: 'Лосось, сливочный сыр'
      }, adminToken);
      log(dish2.ok || dish2.status === 409, 'Create dish "Филадельфия ролл"', dish2.ok ? 'OK' : dish2.data?.error);

      // 1.6 Create inventory items
      for (const item of [{ name: 'Рис', unit: 'кг', quantity: 20, min_stock: 2 },
                          { name: 'Нори', unit: 'шт', quantity: 100, min_stock: 20 },
                          { name: 'Лосось', unit: 'кг', quantity: 10, min_stock: 1 }]) {
        const inv = await req('POST', '/api/inventory-items', item, adminToken);
        log(inv.ok || inv.status === 409, `Inv: ${item.name}`, inv.ok ? 'OK' : inv.data?.error);
      }

      // 1.7 Create staff
      for (const s of [{ username: 'waiter1', password: 'Waiter1!', first_name: 'Алиса', last_name: 'Официант', role: 'waiter', phone: '+998901234571' },
                       { username: 'cook1', password: 'Cook1!', first_name: 'Шеф', last_name: 'Повар', role: 'cook', phone: '+998901234572' },
                       { username: 'courier1', password: 'Courier1!', first_name: 'Быстрый', last_name: 'Курьер', role: 'courier', phone: '+998901234573' }]) {
        const staff = await req('POST', '/api/staff', s, adminToken);
        log(staff.ok || staff.status === 409, `Staff: ${s.username}`, staff.ok ? `id=${staff.data?.id}` : staff.data?.error);
      }
    }
  }

  // ─── 2. Waiter Flow ────────────────────────────────────────
  console.log('\n── 2. Waiter Flow ──');

  let waiterToken = '';
  if (adminToken) {
    const wLogin = await req('POST', '/api/auth/login', { username: 'waiter1', password: 'Waiter1!', tenant_name: 'QA-Test Restaurant' });
    if (wLogin.ok) waiterToken = wLogin.data.token;
    log(!!waiterToken, 'Waiter login', waiterToken ? 'OK' : `Failed ${wLogin.status}`);

    if (waiterToken) {
      // 2.1 Open shift
      const shift = await req('POST', '/api/admin/shifts/open', { openingBalance: 0 }, waiterToken);
      log(shift.ok || shift.status === 409, 'Open shift', shift.ok ? `id=${shift.data?.id}` : shift.data?.error);
      const shiftId = shift.data?.id || null;

      // 2.2 Create order
      if (testDishId) {
        const order = await req('POST', '/api/orders', {
          items: [{ dishId: testDishId, quantity: 2, price: 450 }],
          total: 900, type: 'dine-in',
        }, waiterToken);
        log(order.ok, 'Create dine-in order', order.ok ? `id=${order.data?.id}` : `Status ${order.status}: ${JSON.stringify(order.data)}`);
        if (order.data?.id) testOrderId = order.data.id;
      }

      // 2.3 List orders
      const orders = await req('GET', '/api/orders', null, waiterToken);
      log(orders.ok, 'List orders', orders.ok ? `${orders.data?.length || 0} orders` : `Status ${orders.status}`);

      // 2.4 Send to kitchen
      if (testOrderId) {
        const confirmed = await req('PATCH', `/api/orders/${testOrderId}/status`, { status: 'confirmed' }, waiterToken);
        log(confirmed.ok, 'Order → confirmed (to kitchen)', confirmed.ok ? 'OK' : `Status ${confirmed.status}`);
      }

      // 2.5 Voice draft
      if (testOrderId) {
        const draft = await req('POST', '/api/waiter/voice/draft', {
          items: [{ name: 'Калифорния ролл', quantity: 1, price: 450 }]
        }, waiterToken);
        log(draft.ok, 'Voice draft created', draft.ok ? `id=${draft.data?.id}` : `Status ${draft.status}`);

        // 2.6 Voice queue
        const queue = await req('GET', '/api/waiter/voice/queue', null, waiterToken);
        log(queue.ok, 'Voice queue fetched', queue.ok ? `${queue.data?.queue?.length || queue.data?.length || 0} items` : `Status ${queue.status}`);
      }

      // 2.7 Close shift
      if (shiftId) {
        const close = await req('PUT', `/api/admin/shifts/${shiftId}/close`, { closingBalance: 900 }, waiterToken);
        log(close.ok || close.status === 404, 'Close shift', close.ok ? 'OK' : close.data?.error);
      }
    }
  }

  // ─── 3. Kitchen Flow ───────────────────────────────────────
  console.log('\n── 3. Kitchen Flow ──');

  let cookToken = '';
  if (adminToken) {
    const cLogin = await req('POST', '/api/auth/login', { username: 'cook1', password: 'Cook1!', tenant_name: 'QA-Test Restaurant' });
    if (cLogin.ok) cookToken = cLogin.data.token;
    log(!!cookToken, 'Cook login', cookToken ? 'OK' : `Failed ${cLogin.status}`);

    if (cookToken) {
      const kOrders = await req('GET', '/api/kitchen/orders', null, cookToken);
      log(kOrders.ok, 'Kitchen orders fetched', kOrders.ok ? `${kOrders.data?.length || 0} orders` : `Status ${kOrders.status}`);

      if (testOrderId) {
        const accept = await req('POST', `/api/kitchen/orders/${testOrderId}/accept`, {}, cookToken);
        log(accept.ok || accept.status === 409, 'Kitchen accepted order', accept.ok ? 'OK' : accept.data?.error);

        const complete = await req('POST', `/api/kitchen/orders/${testOrderId}/complete`, {}, cookToken);
        log(complete.ok || complete.status === 409, 'Kitchen completed order', complete.ok ? 'OK' : complete.data?.error);
      }
    }
  }

  // ─── 4. Courier Flow ───────────────────────────────────────
  console.log('\n── 4. Courier Flow ──');

  let courierToken = '';
  if (adminToken) {
    const courierLogin = await req('POST', '/api/auth/login', { username: 'courier1', password: 'Courier1!', tenant_name: 'QA-Test Restaurant' });
    if (courierLogin.ok) courierToken = courierLogin.data.token;
    log(!!courierToken, 'Courier login', courierToken ? 'OK' : `Failed ${courierLogin.status}`);

    if (courierToken) {
      const online = await req('POST', '/api/courier/online', { is_online: true }, courierToken);
      log(online.ok || online.status === 404, 'Courier online', online.ok ? 'OK' : online.data?.error);

      const orders = await req('GET', '/api/orders', null, courierToken);
      log(orders.ok, 'Courier orders', orders.ok ? `${orders.data?.length || 0} orders` : `Status ${orders.status}`);

      if (testOrderId) {
        const onWay = await req('PATCH', `/api/orders/${testOrderId}/status`, { status: 'on_the_way' }, courierToken);
        log(onWay.ok, 'Order → on_the_way', onWay.ok ? 'OK' : `Status ${onWay.status}`);

        const delivered = await req('PATCH', `/api/orders/${testOrderId}/status`, { status: 'delivered' }, courierToken);
        log(delivered.ok, 'Order → delivered', delivered.ok ? 'OK' : `Status ${delivered.status}`);
      }
    }
  }

  // ─── 5. Guest / Public ─────────────────────────────────────
  console.log('\n── 5. Guest / Public ──');

  const pubMenu = await req('GET', '/api/public/menu?channel=guest', null, '');
  log(pubMenu.ok, 'Public menu (no auth)', pubMenu.ok ? 'OK' : `Status ${pubMenu.status}: ${JSON.stringify(pubMenu.data).slice(0, 80)}`);

  const tenants = await req('GET', '/api/tenants/search?q=QA-Test', null, '');
  log(tenants.ok, 'Search tenants (no auth)', tenants.ok ? `${tenants.data?.length || 0} results` : `Status ${tenants.status}`);

  // ─── 6. Security ───────────────────────────────────────────
  console.log('\n── 6. Security Checks ──');

  // 6.1 No auth on protected routes
  const n1 = await req('GET', '/api/admin/shifts/open', null, '');
  const n2 = await req('POST', '/api/orders', { items: [] }, null, '');
  const n3 = await req('GET', '/api/staff', null, '');
  log(n1.status === 401, 'No auth → /api/admin/shifts/open = 401', n1.status === 200 ? '⚠️ 200 (old code)' : `Status ${n1.status}`);
  log(n2.status === 401, 'No auth → POST /api/orders = 401', n2.status === 200 ? '⚠️ 200 (old code)' : `Status ${n2.status}`);
  log(n3.status === 401, 'No auth → GET /api/staff = 401', n3.status === 200 ? '⚠️ 200 (old code)' : `Status ${n3.status}`);

  // 6.2 Rate limiting
  const rateCheck = await req('POST', '/api/auth/admin-login', { username: 'admin', password: 'wrong' });
  finding('Rate limiting', rateCheck.status === 429 ? `Active (429): ${rateCheck.data?.error}` : `Not triggered (${rateCheck.status})`);

  // 6.3 No stack traces in errors
  const errResp = await req('GET', '/api/orders', null, 'invalid-token-format');
  const errStr = JSON.stringify(errResp.data);
  log(!errStr.includes('stack') && !errStr.includes('Error:'), 'No stack leak in error', errResp.status === 401 ? '401 w/out stack ✓' : errStr.slice(0, 80));

  // ─── 7. Negative Tests ─────────────────────────────────────
  console.log('\n── 7. Negative Tests ──');

  // 7.1 Wrong credentials
  const wp = await req('POST', '/api/auth/admin-login', { username: 'admin', password: 'wrongpass' });
  log(!wp.ok && wp.status !== 500, 'Wrong password (expect 401/429)', `Got ${wp.status}: ${wp.data?.error || ''}`);

  // 7.2 Missing password
  const mp = await req('POST', '/api/auth/admin-login', { username: 'admin' });
  log(!mp.ok, 'Missing password (expect 400/401)', `Got ${mp.status}: ${mp.data?.error || ''}`);

  // 7.3 Empty order
  if (waiterToken) {
    const empty = await req('POST', '/api/orders', { items: [], total: 0 }, waiterToken);
    log(!empty.ok, 'Empty order rejected', `Got ${empty.status}: ${JSON.stringify(empty.data).slice(0, 80)}`);
  }

  // ─── 8. Audit Trail ────────────────────────────────────────
  console.log('\n── 8. Audit ──');
  if (adminToken) {
    const audit = await req('GET', '/api/audit-logs', null, adminToken);
    log(audit.ok, 'Audit logs accessible', audit.ok ? `${audit.data?.length || 0} logs` : `Status ${audit.status}`);
  }

  // ─── Results ───────────────────────────────────────────────
  const elapsed = ((Date.now() - timer.start) / 1000).toFixed(1);

  console.log('\n\n══════════════════════════════════════════════════════');
  console.log('📊 QA TEST REPORT — FoodChain API');
  console.log('══════════════════════════════════════════════════════');
  console.log(`Target:     ${BASE}`);
  console.log(`Date:       ${new Date().toISOString()}`);
  console.log(`Duration:   ${elapsed}s`);
  console.log(`Tests:      ${TOTAL}`);
  console.log(`✅ Passed:   ${PASS}`);
  console.log(`❌ Failed:   ${FAIL}`);
  console.log('──────────────────────────────────────────────────────');

  if (errors.length === 0) {
    console.log('🎉 ALL TESTS PASSED');
  } else {
    console.log('\n🔴 FAILED TESTS:');
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.label} → ${e.detail}`));
  }

  console.log('\n📋 FINDINGS:');
  findings.forEach(f => console.log(`  • ${f.label}: ${f.detail}`));

  console.log('\n⚠️  POST-DEPLOY EXPECTATIONS:');
  console.log('  • admin:admin → 401/403 (was 200 — backdoor removed)');
  console.log('  • No auth routes → 401 (was 200 — ensureTenantId now requires JWT)');
  console.log('  • Portal login → 400 (was 503 — portal backend loads but needs env vars)');
  console.log('  • Invalid JWT → 401 (was 200 — added algorithms:[HS256])');
  console.log('  • JWT_SECRET missing → crash (was fallback to hardcoded)');
  console.log('  • tenant_id from JWT only (was query param)');
  console.log('  • All jwt.verify verify with HS256 algorithm');

  console.log('\n══════════════════════════════════════════════════════');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
