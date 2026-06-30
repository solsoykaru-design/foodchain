const telegramBot = require('./telegram-bot.service');

function formatItems(items) {
  return (items || []).slice(0, 6).map(i => `${i.quantity || 1}× ${i.name || '—'}`).join('\n');
}

function orderTypeLabel(type) {
  const map = { delivery: 'Доставка', dine_in: 'В зале', pickup: 'Самовывоз', qr_self_order: 'QR-заказ' };
  return map[type] || type || 'Заказ';
}

function notifyNewOrder(db, tenantId, orderId, source = '') {
  try {
    const order = db.prepare('SELECT id, type, total, user_name, user_phone, address, table_id, table_number, items FROM orders WHERE id = ?').get(orderId);
    if (!order) return;
    const items = JSON.parse(order.items || '[]');
    const typeLabel = orderTypeLabel(order.type);
    const place = order.type === 'dine_in'
      ? `Стол ${order.table_number || order.table_id || '—'}`
      : (order.address || '—');
    const more = items.length > 6 ? `\n_...и ещё ${items.length - 6} поз._` : '';
    const msg = `🆕 *${typeLabel} #${order.id}*${source ? ` (${source})` : ''}\n` +
      `💰 ${Number(order.total).toFixed(2)} ₽\n` +
      `👤 ${order.user_name || 'Гость'} ${order.user_phone || ''}\n` +
      `📍 ${place}\n\n` +
      `🍽️ *Состав:*\n${formatItems(items)}${more}`;
    telegramBot.notifyOwner(db, tenantId || 1, msg).catch(e => console.error('[OrderOwnerNotify]', e.message));
  } catch (e) {
    console.error('[OrderOwnerNotify] error:', e.message);
  }
}

module.exports = { notifyNewOrder };
