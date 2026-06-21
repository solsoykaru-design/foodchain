const PROVIDER = 'delivery_club';

function getHeaders(credentials) {
  return {
    'X-Api-Key': credentials.api_key || '',
    'X-Secret': credentials.api_secret || '',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function apiRequest(url, method, headers, body) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function testConnection(credentials) {
  try {
    const { ok, status, data } = await apiRequest(
      'https://api.delivery-club.ru/api/v1/status',
      'GET',
      getHeaders(credentials)
    );
    return { ok, status, data };
  } catch (e) {
    return { ok: false, status: 0, data: e.message };
  }
}

function buildMenuPayload(menuData) {
  return {
    categories: menuData.categories.map(c => ({
      id: c.id,
      name: c.name,
      weight: 1,
    })),
    products: menuData.dishes.map(d => ({
      id: d.id,
      categoryId: d.categoryId,
      name: d.name,
      description: d.description || '',
      price: d.price,
      weight: d.weight || 0,
      measureUnit: d.weight ? 'g' : 'pcs',
      image: d.imageUrl || '',
      available: d.isAvailable !== false,
      nutritional: d.calories ? {
        calorific: d.calories,
        proteins: d.proteins,
        fats: d.fats,
        carbohydrates: d.carbs,
      } : undefined,
      modifiers: (d.modifiers || []).map(m => ({
        id: m.id,
        name: m.name,
        min: m.minSelect || 0,
        max: m.maxSelect || 0,
        options: (m.options || []).map(o => ({
          id: o.id,
          name: o.name,
          price: o.price,
        })),
      })),
    })),
  };
}

async function syncMenu(tenantId, credentials, db) {
  const dishes = db.prepare(`
    SELECT d.*, mc.name as category_name
    FROM dishes d
    LEFT JOIN menu_categories mc ON mc.id = d.category_id
    ORDER BY d.category_id
  `).all();

  const categories = db.prepare('SELECT * FROM menu_categories ORDER BY sort_order').all();
  const modifiers = db.prepare('SELECT * FROM modifier_groups ORDER BY sort_order').all();
  const modifierOptions = db.prepare('SELECT * FROM modifier_options ORDER BY id').all();

  const mappedModifiers = modifiers.map(m => ({
    id: m.id,
    name: m.name,
    minSelect: m.min_select,
    maxSelect: m.max_select,
    options: modifierOptions.filter(o => o.group_id === m.id).map(o => ({
      id: o.id,
      name: o.name,
      price: o.price || 0,
    })),
  }));

  const payload = buildMenuPayload({
    categories: categories.map(c => ({ id: c.id, name: c.name })),
    dishes: dishes.map(d => ({
      id: d.id,
      categoryId: d.category_id,
      name: d.name,
      description: d.description,
      price: d.price,
      weight: d.weight,
      imageUrl: d.image_url,
      isAvailable: d.is_available === 1,
      calories: d.calories,
      proteins: d.proteins,
      fats: d.fats,
      carbs: d.carbs,
      modifiers: d.category_id ? mappedModifiers : [],
    })),
  });

  const { ok, status, data } = await apiRequest(
    'https://api.delivery-club.ru/api/v1/menu/import',
    'POST',
    getHeaders(credentials),
    payload
  );

  return { ok, status, data };
}

function parseOrder(payload) {
  const order = payload.order || payload;
  const items = (order.items || []).map(item => ({
    externalItemId: String(item.id || item.productId || ''),
    name: item.name || '',
    price: item.price || 0,
    quantity: item.quantity || 1,
    options: (item.modifiers || []).map(m => m.name || ''),
  }));

  const addr = order.deliveryAddress || order.address || {};

  return {
    externalOrderId: String(order.id || order.orderId || ''),
    externalProvider: PROVIDER,
    source: 'external',
    userName: order.client?.name || order.customerName || 'Внешний клиент',
    userPhone: order.client?.phone || order.customerPhone || '',
    address: [
      addr.city, addr.street, addr.house, addr.building,
      addr.apartment, addr.entrance, addr.floor,
    ].filter(Boolean).join(', '),
    items,
    subtotal: order.subtotal || order.productsCost || 0,
    deliveryFee: order.deliveryCost || 0,
    total: order.total || order.cost || 0,
    comment: order.comment || '',
    paymentMethod: order.paymentType === 'card' ? 'online' : 'cash',
    type: 'delivery',
  };
}

function mapStatusToExternal(internalStatus) {
  const map = {
    confirmed: 'ACCEPTED',
    preparing: 'PREPARING',
    ready: 'READY_FOR_DELIVERY',
    assigned: 'WITH_COURIER',
    en_route: 'DELIVERING',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
  };
  return map[internalStatus] || null;
}

function mapStatusFromExternal(externalStatus) {
  const map = {
    'ACCEPTED': 'confirmed',
    'PREPARING': 'preparing',
    'READY_FOR_DELIVERY': 'ready',
    'WITH_COURIER': 'assigned',
    'DELIVERING': 'en_route',
    'DELIVERED': 'delivered',
    'CANCELLED': 'cancelled',
    'REJECTED': 'cancelled',
  };
  return map[externalStatus] || null;
}

async function updateStatus(order, externalOrderId, internalStatus, credentials) {
  const externalStatus = mapStatusToExternal(internalStatus);
  if (!externalStatus) return { ok: false, status: 0, data: `Нет маппинга для статуса ${internalStatus}` };

  const { ok, status, data } = await apiRequest(
    `https://api.delivery-club.ru/api/v1/orders/${externalOrderId}/status`,
    'PUT',
    getHeaders(credentials),
    { status: externalStatus }
  );

  return { ok, status, data };
}

module.exports = {
  PROVIDER,
  testConnection,
  syncMenu,
  parseOrder,
  updateStatus,
  mapStatusFromExternal,
};
