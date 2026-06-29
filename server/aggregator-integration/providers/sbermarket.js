const PROVIDER = 'sbermarket';

function getHeaders(credentials) {
  return {
    'Authorization': `Bearer ${credentials.api_key || ''}`,
    'X-Client-Id': credentials.client_id || '',
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
      'https://partner-api.sbermarket.ru/v1/health',
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
      external_id: String(c.id),
      title: c.name,
    })),
    products: menuData.dishes.map(d => ({
      external_id: String(d.id),
      category_external_id: String(d.categoryId),
      title: d.name,
      description: d.description || '',
      price: d.price,
      measure: d.weight ? `${d.weight} г` : 'шт',
      measure_value: d.weight || 1,
      measure_unit: d.weight ? 'g' : 'pcs',
      images: d.imageUrl ? [{ url: d.imageUrl, is_main: true }] : [],
      is_available: d.isAvailable !== false,
      nutritional_info: d.calories ? {
        calories: d.calories,
        proteins: d.proteins,
        fats: d.fats,
        carbs: d.carbs,
      } : undefined,
      modifications: (d.modifiers || []).map(m => ({
        external_id: String(m.id),
        title: m.name,
        min: m.minSelect || 0,
        max: m.maxSelect || 0,
        options: (m.options || []).map(o => ({
          external_id: String(o.id),
          title: o.name,
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
    'https://partner-api.sbermarket.ru/v1/menu/sync',
    'POST',
    getHeaders(credentials),
    payload
  );

  return { ok, status, data };
}

function parseOrder(payload) {
  const order = payload.order || payload;
  const items = (order.items || []).map(item => ({
    externalItemId: String(item.id || item.product_external_id || ''),
    name: item.title || item.name || '',
    price: item.price || 0,
    quantity: item.quantity || 1,
    options: (item.modifications || []).map(m => m.title || ''),
  }));

  const addr = order.delivery_address || order.address || {};

  return {
    externalOrderId: String(order.id || order.external_id || ''),
    externalProvider: PROVIDER,
    source: 'external',
    userName: order.customer?.name || order.client_name || 'Внешний клиент',
    userPhone: order.customer?.phone || order.client_phone || '',
    address: [
      addr.city, addr.street, addr.house, addr.building,
      addr.apartment, addr.entrance, addr.floor,
    ].filter(Boolean).join(', '),
    items,
    subtotal: order.subtotal || order.items_cost || 0,
    deliveryFee: order.delivery_cost || 0,
    total: order.total || order.cost || 0,
    comment: order.comment || order.note || '',
    paymentMethod: order.payment_method === 'card' ? 'online' : 'cash',
    type: 'delivery',
  };
}

function mapStatusToExternal(internalStatus) {
  const map = {
    confirmed: 'ACCEPTED',
    preparing: 'COOKING',
    ready: 'PACKED',
    assigned: 'TRANSFERRED_TO_DELIVERY',
    en_route: 'DELIVERING',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
  };
  return map[internalStatus] || null;
}

function mapStatusFromExternal(externalStatus) {
  const map = {
    'ACCEPTED': 'confirmed',
    'COOKING': 'preparing',
    'PACKED': 'ready',
    'TRANSFERRED_TO_DELIVERY': 'assigned',
    'DELIVERING': 'en_route',
    'DELIVERED': 'delivered',
    'CANCELLED': 'cancelled',
    'REJECTED': 'cancelled',
    'EXPIRED': 'cancelled',
  };
  return map[externalStatus] || null;
}

async function updateStatus(order, externalOrderId, internalStatus, credentials) {
  const externalStatus = mapStatusToExternal(internalStatus);
  if (!externalStatus) return { ok: false, status: 0, data: `Нет маппинга для статуса ${internalStatus}` };

  const { ok, status, data } = await apiRequest(
    `https://partner-api.sbermarket.ru/v1/orders/${externalOrderId}/status`,
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
    return signature === hmac.digest('hex');
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
