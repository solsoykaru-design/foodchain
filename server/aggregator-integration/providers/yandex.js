const PROVIDER = 'yandex';

function getHeaders(credentials) {
  return {
    'Authorization': `Bearer ${credentials.api_key || ''}`,
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
      'https://api.eda.yandex.com/api/v1/ping',
      'GET',
      getHeaders(credentials)
    );
    return { ok, status, data };
  } catch (e) {
    return { ok: false, status: 0, data: e.message };
  }
}

function buildMenuPayload(menuData) {
  const categories = menuData.categories.map(c => ({
    id: String(c.id),
    name: c.name,
    sort_order: c.sortOrder || 0,
  }));

  const items = menuData.dishes.map(d => ({
    id: String(d.id),
    category_id: String(d.categoryId),
    name: d.name,
    description: d.description || '',
    price: Math.round(d.price * 100),
    currency: 'RUB',
    weight: d.weight ? `${d.weight}g` : '',
    image_url: d.imageUrl || '',
    is_available: d.isAvailable !== false,
    nutritional_value: d.calories ? {
      calories: d.calories,
      proteins: d.proteins,
      fats: d.fats,
      carbs: d.carbs,
    } : undefined,
    modifiers: (d.modifiers || []).map(m => ({
      id: String(m.id),
      name: m.name,
      min: m.minSelect || 0,
      max: m.maxSelect || 0,
      options: (m.options || []).map(o => ({
        id: String(o.id),
        name: o.name,
        price: Math.round(o.price * 100),
      })),
    })),
  }));

  return { categories, items };
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
    categories: categories.map(c => ({ id: c.id, name: c.name, sortOrder: c.sort_order })),
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
    'https://api.eda.yandex.com/api/v1/menu/upload',
    'POST',
    getHeaders(credentials),
    payload
  );

  return { ok, status, data };
}

function parseOrder(payload) {
  const order = payload.order || payload;
  const items = (order.items || []).map(item => ({
    externalItemId: String(item.id || item.menu_item_id || ''),
    name: item.name || '',
    price: (item.price || 0) / 100,
    quantity: item.quantity || 1,
    options: (item.modifiers || []).map(m => m.name || ''),
  }));

  return {
    externalOrderId: String(order.id || order.order_id || ''),
    externalProvider: PROVIDER,
    source: 'external',
    userName: order.customer?.name || order.address?.customer?.name || 'Внешний клиент',
    userPhone: order.customer?.phone || order.address?.customer?.phone || '',
    address: formatAddress(order),
    items,
    subtotal: (order.total || 0) / 100,
    deliveryFee: (order.delivery_fee || order.deliveryFee || 0) / 100,
    total: (order.total || 0) / 100,
    comment: order.comment || order.customer?.comment || '',
    paymentMethod: 'online',
    type: 'delivery',
  };
}

function formatAddress(order) {
  const addr = order.address || order.delivery_address || {};
  const parts = [
    addr.city, addr.street, addr.house, addr.building,
    addr.apartment, addr.flat, addr.entrance, addr.floor,
    addr.intercom, addr.comment,
  ].filter(Boolean);
  return parts.join(', ');
}

function mapStatusToExternal(internalStatus) {
  const map = {
    confirmed: 'CONFIRMED',
    preparing: 'COOKING',
    ready: 'READY',
    assigned: 'DELIVERING',
    en_route: 'DELIVERING',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
  };
  return map[internalStatus] || null;
}

function mapStatusFromExternal(externalStatus) {
  const map = {
    'CONFIRMED': 'confirmed',
    'COOKING': 'preparing',
    'READY': 'ready',
    'DELIVERING': 'assigned',
    'DELIVERED': 'delivered',
    'CANCELLED': 'cancelled',
    'CANCELLED_BY_PLACE': 'cancelled',
  };
  return map[externalStatus] || null;
}

async function updateStatus(order, externalOrderId, internalStatus, credentials) {
  const externalStatus = mapStatusToExternal(internalStatus);
  if (!externalStatus) return { ok: false, status: 0, data: `Нет маппинга для статуса ${internalStatus}` };

  const { ok, status, data } = await apiRequest(
    `https://api.eda.yandex.com/api/v1/orders/${externalOrderId}/status`,
    'PUT',
    getHeaders(credentials),
    { status: externalStatus }
  );

  return { ok, status, data };
}

function verifyWebhook(payload, signature, credentials) {
  if (!signature || !credentials.webhook_secret) return true;
  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', credentials.webhook_secret);
    hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
    const digest = hmac.digest('hex');
    return signature === digest || signature === `sha256=${digest}`;
  } catch { return false; }
}

module.exports = {
  PROVIDER,
  testConnection,
  syncMenu,
  parseOrder,
  updateStatus,
  mapStatusFromExternal,
  verifyWebhook,
};
